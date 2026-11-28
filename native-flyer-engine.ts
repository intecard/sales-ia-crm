import {brandedMediaKey, brandedMediaMatches} from './community-publication-assets.ts';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import sharp from 'sharp';
import { flyerPhotoPrompt, photoFingerprint } from './community-flyer-photography.ts';
import { renderEditorialImage } from './community-editorial-renderer.ts';
import { flyerOffer,isPublishableFlyer } from './community-flyer-offer.ts';
import { renderINTECAFlyer } from './community-flyer-renderer.ts';
import { communityAssetUrl, storeCommunityAsset } from './community-media.ts';
import { contentHash, makeContent, rdDay, type CommunityPayload } from './community-plan.ts';
import type { CatalogStore } from './whatsapp-catalog.ts';

type Store={request:(route:string,method?:string,body?:unknown)=>Promise<any>};
type Claim={authorized:boolean;assetKey?:string;payload?:CommunityPayload;lease?:string;attempt?:number;expiresAt?:string;studio?:boolean};
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const assetId=/^[a-f0-9]{32}$/;
type Lease={asset:string;lease:string};
export function workerCredential(header:string|undefined) {
 return /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header||'')?.[1];
}

export class NativeFlyerEngine {
 constructor(private store:Store,private catalog:Pick<CatalogStore,'get'>,private env=process.env,private fetcher=fetch){}
 async status(){
  const current=encodeURIComponent(new Date().toISOString());
  const [settings,recent]=await Promise.all([
    this.store.request('crm_flyer_engine_settings?id=eq.inteca&select=enabled,last_seen,token_hash'),
    this.store.request(`crm_flyer_engine_jobs?studio_payload=is.null&select=state,scheduled_at,expires_at,error_code&scheduled_at=gte.${current}&order=scheduled_at.asc&limit=6`),
  ]);
  const s=settings[0];
  if(!s)throw Error('NATIVE_FLYER_NOT_CONFIGURED');
  const offline=!(s.last_seen && Date.now()-Date.parse(s.last_seen)<5*60_000);
  const rendering=recent.some((j:{state:string;expires_at:string})=>['rendering','uploading'].includes(j.state)&&Date.parse(j.expires_at)>Date.now());
  return {enabled:s.enabled,paired:Boolean(s.token_hash),connected:Boolean(s.enabled&&s.token_hash&&s.last_seen&&(!offline||rendering)),
    lastSeen:s.last_seen,recent,provider:'local',imageCharges:false};
 }
 async pair(){
  const token=randomBytes(32).toString('base64url');
  const rows=await this.store.request('crm_flyer_engine_settings?id=eq.inteca','PATCH',{token_hash:hash(token),enabled:true,last_seen:null});
  if(rows.length!==1)throw Error('NATIVE_FLYER_NOT_CONFIGURED');
  return {token};
 }
 async disconnect(){
  await this.store.request('crm_flyer_engine_settings?id=eq.inteca','PATCH',{token_hash:null,enabled:false,last_seen:null});
 }
 async claim(token:string){
  const tokenHash=hash(token);
  const result:Claim=await this.store.request('rpc/crm_claim_native_flyer','POST',{p_hash:tokenHash});
  if(!result.authorized)throw Error('NATIVE_FLYER_AUTH');
  if(!result.payload||!result.assetKey||!result.lease)return null;
  const p=result.payload;
  if(!await this.currentCatalog(p,result.studio)||!p.flyerOffer){
    await this.finish(token,{asset:result.assetKey,lease:result.lease},null,'CATALOG_CHANGED');
    return null;
  }
  const prompt=flyerPhotoPrompt(p,{studio:result.studio,attempt:result.attempt});
  return {asset:result.assetKey,lease:result.lease,expiresAt:result.expiresAt,seed:parseInt(hash(result.assetKey+':'+result.attempt).slice(0,7),16),
    prompt,people:!/no (?:visible writing or )?people|empty workplace|unoccupied workplace/i.test(prompt)};
 }
 private async currentCatalog(p:CommunityPayload,studio=false){
  const catalog=await this.catalog.get();
  return (p.kind==='flyer'||(studio&&p.kind==='story'))&&p.creative?.version==='v8'&&!!catalog&&catalog.hash===p.catalogHash
    &&catalog.courses.some(c=>c.title===p.courseTitle);
 }
 async finish(token:string,data:Lease,media:string|null,error:string|null){
  return await this.store.request('rpc/crm_finish_native_flyer','POST',{
   p_hash:hash(token),p_asset:data.asset,p_lease:data.lease,p_media:media,p_error:error,
  })===true;
 }
 async upload(token:string,data:Lease,bytes:Buffer){
  // Check token before image decoding to avoid CPU use for unauthorized callers.
  const [setting]=await this.store.request(`crm_flyer_engine_settings?id=eq.inteca&enabled=eq.true&token_hash=eq.${hash(token)}&select=id`);
  if(!setting)throw Error('NATIVE_FLYER_AUTH');
  const [job]=await this.store.request(`crm_flyer_engine_jobs?asset_key=eq.${data.asset}&claim_token=eq.${data.lease}&state=eq.rendering&select=expires_at,studio_payload`);
  if(!job||Date.parse(job.expires_at)<=Date.now())throw Error('NATIVE_FLYER_EXPIRED');
  const photo=await normalizePhoto(bytes);
  const decision=await this.store.request('rpc/crm_lock_native_flyer_upload','POST',{
    p_hash:hash(token),p_asset:data.asset,p_lease:data.lease,p_fingerprint:await photoFingerprint(photo),
  });
  if(decision!=='locked')throw Error(decision==='similar'?'NATIVE_FLYER_TOO_SIMILAR':'NATIVE_FLYER_EXPIRED');
  try{
    const studio=Boolean(job.studio_payload);
    const date=encodeURIComponent(new Date(Date.now()-120*60_000).toISOString());
    const [row]=studio?[]:await this.store.request(`crm_community_jobs?organization_id=eq.org_inteca_main&payload->>assetKey=eq.${data.asset}&state=eq.queued&scheduled_at=gt.${date}&select=payload,content_hash&limit=1`);
    const p=(job.studio_payload||row?.payload) as CommunityPayload|undefined;
    if(!p||p.assetKey!==data.asset||(!studio&&contentHash(p)!==row.content_hash)||!await this.currentCatalog(p,studio))throw Error('NATIVE_FLYER_STALE');
    const key=studio?data.asset:brandedMediaKey(p,'local:'+data.lease);
    if(studio)await this.storeStudioPhoto(p,photo);
    else await storeCommunityAsset(key,await renderINTECAFlyer(p,process.cwd(),photo),false,this.env,this.fetcher);
    if(!await this.finish(token,data,key,null))throw Error('NATIVE_FLYER_EXPIRED');
    return {state:'ready'};
  }catch(error){
    await this.finish(token,data,null,'COMPOSITION_FAILED').catch(()=>{});
    throw error;
  }
 }
 async createStudio(courseTitle:string,kind:'flyer'|'story',bytes?:Buffer){
  const catalog=await this.catalog.get();
  const course=catalog?.courses.find(c=>c.title===courseTitle);
  if(!catalog||!course)throw Error('NATIVE_FLYER_COURSE');
  const date=rdDay(new Date());
  const offer=flyerOffer(course,date,0);
  if(!isPublishableFlyer(offer))throw Error('NATIVE_FLYER_COURSE');
  const p=makeContent(course,catalog,date,'flyer',0,randomInt(1,100_000));
  p.assetKey=randomBytes(16).toString('hex');
  p.kind=kind;
  const photo=bytes?await normalizePhoto(bytes):null;
  const created=await this.store.request('rpc/crm_create_studio_flyer','POST',{
   p_asset:p.assetKey,p_payload:p,p_fingerprint:photo?await photoFingerprint(photo):null,
  });
  if(created!=='created'){
   const failure:Record<string,string>={offline:'OFFLINE',busy:'BUSY',limit:'LIMIT',similar:'TOO_SIMILAR'};
   throw Error('NATIVE_FLYER_'+(failure[created]||'UNAVAILABLE'));
  }
  if(photo){
   const route=`crm_flyer_engine_jobs?asset_key=eq.${p.assetKey}&state=eq.uploading&studio_payload=not.is.null`;
   try{
    await this.storeStudioPhoto(p,photo);
    const updated=await this.store.request(route,'PATCH',{state:'ready',media_key:p.assetKey,completed_at:new Date().toISOString()});
    if(updated.length!==1)throw Error('NATIVE_FLYER_UNAVAILABLE');
   }catch(error){
    await this.store.request(route,'PATCH',{state:'failed',error_code:'COMPOSITION_FAILED'}).catch(()=>{});
    throw error;
   }
  }
  return {asset:p.assetKey,state:photo?'ready':'queued'};
 }
 async studioStatus(asset:string){
  if(!assetId.test(asset))throw Error('NATIVE_FLYER_NOT_FOUND');
  const [row]=await this.store.request(`crm_flyer_engine_jobs?asset_key=eq.${asset}&studio_payload=not.is.null&select=state,attempts,scheduled_at,expires_at,media_key`);
  if(!row)throw Error('NATIVE_FLYER_NOT_FOUND');
  const restart=row.state==='failed'&&row.attempts<2&&Date.parse(row.scheduled_at)>Date.now()+600_000;
  const stopped=row.state!=='ready'&&!restart&&(Date.parse(row.scheduled_at)<Date.now()||
   (row.state==='failed')||(row.attempts>=2&&Date.parse(row.expires_at)<Date.now()));
  return {asset,state:restart?'queued':stopped?'failed':row.state};
 }
 private studioObject(asset:string){
  const base=new URL(this.env.SUPABASE_URL||'');
  if(base.protocol!=='https:'||!this.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('NATIVE_FLYER_UNAVAILABLE');
  return {base:base.origin,file:`crm-studio-flyers/${asset}.jpg`,headers:{
   apikey:this.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
  }};
 }
 private async storeStudioPhoto(p:CommunityPayload,photo:Buffer){
  const {base,file,headers}=this.studioObject(p.assetKey);
  const response=await this.fetcher(`${base}/storage/v1/object/${file}`,{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(20_000),
   headers:{...headers,'Content-Type':'image/jpeg','x-upsert':'false'},
   body:new Uint8Array(await renderEditorialImage(p,0,photo)),
  });
  if(!response.ok)throw Error('NATIVE_FLYER_UNAVAILABLE');
 }
 async studioImage(asset:string){
  if((await this.studioStatus(asset)).state!=='ready')throw Error('NATIVE_FLYER_NOT_FOUND');
  const {base,file,headers}=this.studioObject(asset);
  const response=await this.fetcher(`${base}/storage/v1/object/authenticated/${file}`,{headers,redirect:'error',signal:AbortSignal.timeout(15_000)});
  if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/jpeg'))throw Error('NATIVE_FLYER_NOT_FOUND');
  return Buffer.from(await response.arrayBuffer());
 }
 async media(p:CommunityPayload,scheduledAt:string){
  if(p.kind!=='flyer'||!assetId.test(p.assetKey))return null;
  const rows=await this.store.request(`crm_flyer_engine_jobs?asset_key=eq.${p.assetKey}&state=eq.ready&studio_payload=is.null&completed_at=lt.${encodeURIComponent(new Date(Date.parse(scheduledAt)+120*60_000).toISOString())}&select=media_key`);
  const key=rows[0]?.media_key;
  const url=typeof key==='string'&&assetId.test(key)?communityAssetUrl(key,false,this.env):null;
  return brandedMediaMatches(p,url)?url:null;
 }
}

async function normalizePhoto(bytes:Buffer){
  const input=sharp(bytes,{limitInputPixels:4_000_000,failOn:'warning'});
  const info=await input.metadata();
  if(!['jpeg','png','webp'].includes(info.format??'')||(info.pages??1)!==1||
     (info.width??0)<640||(info.height??0)<360)throw Error('NATIVE_FLYER_INVALID_IMAGE');
  return await input.rotate().flatten({background:'#ffffff'}).toColourspace('srgb').jpeg({quality:91}).toBuffer();
}
