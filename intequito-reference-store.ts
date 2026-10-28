/**
 * Private, owner-controlled reference image for INTEQUITO.
 * No untrusted public URL, no made-up character, no client credentials.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type Store={request:(resource:string,method?:string,body?:unknown)=>Promise<any>};
type Env=NodeJS.ProcessEnv;
const bucket='crm-local-reference';
const maxSize=6*1024*1024;
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);

const validPath=(name:unknown):name is string=>
 typeof name==='string'&&/^intequito\/official-[a-f0-9]{64}\.png$/.test(name);
const sha=(data:Buffer)=>createHash('sha256').update(data).digest('hex');

function keys(env:Env){
 const url=env.SUPABASE_URL||'';
 if(!url.startsWith('https://')||!env.SUPABASE_SERVICE_ROLE_KEY)
   throw Error('LOCAL_REFERENCE_STORAGE_NOT_CONFIGURED');
 const base=new URL(url);
 return {base:base.origin,headers:{
   apikey:env.SUPABASE_SERVICE_ROLE_KEY,
   Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,
 }};
}
const checkedFetch=(fetcher:typeof fetch,url:string,options:RequestInit)=>
 fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(25000)});

export class IntequitoReferenceStore{
 constructor(
  private store:Store,private env:Env=process.env,
  private fetcher:typeof fetch=fetch,private root=process.cwd(),
 ){}
 private async settings(){
  const records=await this.store.request('crm_local_video_settings?id=eq.inteca&limit=1');
  return records?.[0]||null;
 }
 async storageStatus(){
  const result={databaseReady:false,videoBucketReady:false,referenceBucketReady:false};
  try{
   result.databaseReady=Boolean(await this.settings());
   const {base,headers}=keys(this.env);
   const [videos,reference]=await Promise.all([
    checkedFetch(this.fetcher,base+'/storage/v1/bucket/crm-local-videos',{headers}),
    checkedFetch(this.fetcher,base+'/storage/v1/bucket/'+bucket,{headers}),
   ]);
   result.videoBucketReady=videos.ok;
   result.referenceBucketReady=reference.ok;
  }catch{/* Do not label inaccessible storage as available. */}
  return result;
 }
 private async local():Promise<Buffer|null>{
  try{return await readFile(path.join(this.root,'public/intequito-oficial.png'));}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
 }
 async referenceStatus(){
  let data:any;
  try{data=await this.settings();}catch{return {referencePresent:false,source:'none' as const};}
  if(validPath(data?.reference_path)&&/^[a-f0-9]{64}$/.test(data?.reference_sha256||'')){
   try{
    const {base,headers}=keys(this.env);
    const response=await checkedFetch(this.fetcher,base+'/storage/v1/object/'+bucket+'/'+data.reference_path,
      {method:'HEAD',headers});
    if(response.ok)return {referencePresent:true,source:'private_storage' as const};
   }catch{/* A failed read must not count as verified. */}
  }
  const exists=Boolean(await this.local());
  return {referencePresent:exists,source:exists?'bundled' as const:'none' as const};
 }
 async read():Promise<Buffer>{
  const data=await this.settings();
  if(validPath(data?.reference_path)&&/^[a-f0-9]{64}$/.test(data?.reference_sha256||'')){
   const {base,headers}=keys(this.env);
   const response=await checkedFetch(this.fetcher,base+'/storage/v1/object/'+bucket+'/'+data.reference_path,{headers});
   if(!response.ok)throw Error('LOCAL_REFERENCE_UNAVAILABLE');
   const len=Number(response.headers.get('content-length'));
   if(Number.isFinite(len)&&len>maxSize)throw Error('LOCAL_REFERENCE_INVALID');
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length<1024||bytes.length>maxSize||!bytes.subarray(0,8).equals(pngSignature)||sha(bytes)!==data.reference_sha256)
     throw Error('LOCAL_REFERENCE_INVALID');
   return bytes;
  }
  const local=await this.local();
  if(local?.subarray(0,8).equals(pngSignature))return local;
  throw Error('LOCAL_REFERENCE_MISSING');
 }
 async save(bytes:Buffer){
  if(!Buffer.isBuffer(bytes)||bytes.length<1024||bytes.length>maxSize||!bytes.subarray(0,8).equals(pngSignature))
    throw Error('LOCAL_REFERENCE_INVALID');
  let metadata:sharp.Metadata;
  try{metadata=await sharp(bytes,{limitInputPixels:18_000_000}).metadata();}
  catch{throw Error('LOCAL_REFERENCE_INVALID');}
  const w=metadata.width||0,h=metadata.height||0;
  if(metadata.format!=='png'||w<400||h<400||w>4096||h>4096||w/h<0.35||w/h>2.5)
    throw Error('LOCAL_REFERENCE_DIMENSIONS');
  const {base,headers}=keys(this.env);
  const digest=sha(bytes),refPath='intequito/official-'+digest+'.png';
  const url=base+'/storage/v1/object/'+bucket+'/'+refPath;
  const upload=await checkedFetch(this.fetcher,url,{
    method:'POST',headers:{...headers,'Content-Type':'image/png','x-upsert':'false'},
    body:new Uint8Array(bytes),
  });
  if(!upload.ok){
    // Idempotent upload: only accept a duplicate if bytes retrieved from
    // private storage exactly equal the owner-uploaded image.
    if(upload.status!==409)throw Error('LOCAL_REFERENCE_UPLOAD_FAILED');
    const already=await checkedFetch(this.fetcher,url,{headers});
    if(!already.ok||sha(Buffer.from(await already.arrayBuffer()))!==digest)
      throw Error('LOCAL_REFERENCE_UPLOAD_FAILED');
  }
  // The original reference is only replaced after the private upload succeeds;
  // enabling automatic AI/video production is a separate action.
  const updated=await this.store.request('crm_local_video_settings?id=eq.inteca','PATCH',{
    reference_path:refPath,reference_sha256:digest,
    reference_updated_at:new Date().toISOString(),auto_enabled:false,
    updated_at:new Date().toISOString(),
  });
  if(!updated?.[0])throw Error('LOCAL_REFERENCE_RECORD_FAILED');
  return {saved:true,width:w,height:h,sha256:digest,storage:'private',autoEnabled:false};
 }
}
