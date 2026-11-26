import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { flyerPhotoPrompt, photoFingerprint } from './community-flyer-photography.ts';
import { renderINTECAFlyer } from './community-flyer-renderer.ts';
import { communityAssetUrl, storeCommunityAsset } from './community-media.ts';
import { contentHash, type CommunityPayload } from './community-plan.ts';
import type { CatalogStore } from './whatsapp-catalog.ts';

type Store={request:(route:string,method?:string,body?:unknown)=>Promise<any>};
type Claim={authorized:boolean;assetKey?:string;payload?:CommunityPayload;lease?:string;attempt?:number;expiresAt?:string};
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
    this.store.request(`crm_flyer_engine_jobs?select=state,scheduled_at,expires_at,error_code&scheduled_at=gte.${current}&order=scheduled_at.asc&limit=6`),
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
  if(!await this.currentCatalog(p)||!p.flyerOffer){
    await this.finish(token,{asset:result.assetKey,lease:result.lease},null,'CATALOG_CHANGED');
    return null;
  }
  const prompt=flyerPhotoPrompt(p);
  return {asset:result.assetKey,lease:result.lease,expiresAt:result.expiresAt,seed:parseInt(hash(result.assetKey+':'+result.attempt).slice(0,7),16),
    prompt,people:!/no (?:visible writing or )?people|empty workplace|unoccupied workplace/i.test(prompt)};
 }
 private async currentCatalog(p:CommunityPayload){
  const catalog=await this.catalog.get();
  return p.kind==='flyer'&&p.creative?.version==='v8'&&!!catalog&&catalog.hash===p.catalogHash
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
  const [job]=await this.store.request(`crm_flyer_engine_jobs?asset_key=eq.${data.asset}&claim_token=eq.${data.lease}&state=eq.rendering&select=expires_at`);
  if(!job||Date.parse(job.expires_at)<=Date.now())throw Error('NATIVE_FLYER_EXPIRED');
  const input=sharp(bytes,{limitInputPixels:4_000_000,failOn:'warning'});
  const info=await input.metadata();
  if(!['jpeg','png','webp'].includes(info.format??'')||(info.pages??1)!==1||
     (info.width??0)<640||(info.height??0)<360)throw Error('NATIVE_FLYER_INVALID_IMAGE');
  const photo=await input.rotate().flatten({background:'#ffffff'}).toColourspace('srgb').jpeg({quality:91}).toBuffer();
  const decision=await this.store.request('rpc/crm_lock_native_flyer_upload','POST',{
    p_hash:hash(token),p_asset:data.asset,p_lease:data.lease,p_fingerprint:await photoFingerprint(photo),
  });
  if(decision!=='locked')throw Error(decision==='similar'?'NATIVE_FLYER_TOO_SIMILAR':'NATIVE_FLYER_EXPIRED');
  try{
    const date=encodeURIComponent(new Date().toISOString());
    const [row]=await this.store.request(`crm_community_jobs?organization_id=eq.org_inteca_main&payload->>assetKey=eq.${data.asset}&state=eq.queued&scheduled_at=gt.${date}&select=payload,content_hash&limit=1`);
    const p=row?.payload as CommunityPayload|undefined;
    if(!p||contentHash(p)!==row.content_hash||!await this.currentCatalog(p))throw Error('NATIVE_FLYER_STALE');
    const key=hash('native-flyer-v1:'+data.asset+':'+data.lease).slice(0,32);
    const jpeg=await renderINTECAFlyer(p,process.cwd(),photo);
    await storeCommunityAsset(key,jpeg,false,this.env,this.fetcher);
    if(!await this.finish(token,data,key,null))throw Error('NATIVE_FLYER_EXPIRED');
    return {state:'ready'};
  }catch(error){
    await this.finish(token,data,null,'COMPOSITION_FAILED').catch(()=>{});
    throw error;
  }
 }
 async media(p:CommunityPayload,scheduledAt:string){
  if(p.kind!=='flyer'||!assetId.test(p.assetKey))return null;
  const rows=await this.store.request(`crm_flyer_engine_jobs?asset_key=eq.${p.assetKey}&state=eq.ready&completed_at=lt.${encodeURIComponent(scheduledAt)}&select=media_key`);
  const key=rows[0]?.media_key;
  return typeof key==='string'&&assetId.test(key)?communityAssetUrl(key,false,this.env):null;
 }
}
