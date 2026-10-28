import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {IntequitoReferenceStore} from './intequito-reference-store.ts';
import {LocalVideoEngine} from './local-video-engine.ts';

const env={
 SUPABASE_URL:'https://project.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'TEST_ONLY_SERVICE_ROLE',
 INTECA_LOCAL_VIDEO_WORKER_TOKEN:'a'.repeat(64),
} as NodeJS.ProcessEnv;
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
async function image(){
 return sharp({create:{width:520,height:780,channels:4,background:'#068dc3'}}).png().toBuffer();
}
function fixture(){
 const state:any={id:'inteca',auto_enabled:false,max_daily_creatives:8,reference_path:null,reference_sha256:null,last_worker_seen_at:null};
 const files=new Map<string,Buffer>(),requests:{path:string;method?:string}[]=[];
 const store={request:async(path:string,method?:string,body?:any)=>{
   requests.push({path,method});
   if(path.startsWith('crm_local_video_settings?')){
     if(method==='PATCH')Object.assign(state,body);
     return [structuredClone(state)];
   }
   if(path.startsWith('crm_local_video_jobs?'))return [];
   throw Error('UNEXPECTED_DB_QUERY '+path);
 }};
 const fetcher=(async(url:any,options:RequestInit={})=>{
   const u=String(url),method=options.method||'GET';
   if(u.includes('/storage/v1/bucket/'))
      return new Response(JSON.stringify({name:u.split('/').at(-1)}),{status:200});
   const name=u.split('/storage/v1/object/crm-local-reference/')[1];
   if(!name)return new Response(null,{status:404});
   if(method==='POST'){
     if(files.has(name))return new Response(null,{status:409});
     files.set(name,Buffer.from(options.body as Uint8Array));
     return new Response(JSON.stringify({path:name}),{status:200});
   }
   const found=files.get(name);
   return new Response(method==='HEAD'?null:(found||null),
     {status:found?200:404,headers:{'Content-Type':'image/png','content-length':String(found?.length||0)}});
 }) as typeof fetch;
 return {store,fetcher,state,files,requests,reference:new IntequitoReferenceStore(store,env,fetcher,'/nonexistent')};
}
test('Database/storage status works even when a GPU worker token is missing',async()=>{
 const f=fixture();
 const result=await f.reference.storageStatus();
 assert.equal(result.databaseReady,true);
 assert.equal(result.videoBucketReady,true);
 assert.equal(result.referenceBucketReady,true);
 const noTokenEngine=new LocalVideoEngine(f.store as any,{get:async()=>null} as any,
   {SUPABASE_URL:env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY} as NodeJS.ProcessEnv,f.fetcher);
 const status=await noTokenEngine.status();
 assert.equal(status.databaseReady,true);
 assert.equal(status.storageReady,true);
 assert.equal(status.serverReady,false);
 assert.equal(status.workerConnected,false);
 assert.equal(status.autoEnabled,false);
});
test('Owner can save official PNG with immutable digest, and worker can fetch same exact bytes',async()=>{
 const f=fixture(),png=await image();
 const saved=await f.reference.save(png);
 assert.equal(saved.saved,true);
 assert.equal(saved.sha256,sha(png));
 assert.equal(f.state.reference_path,'intequito/official-'+sha(png)+'.png');
 assert.equal(f.state.auto_enabled,false);
 const ref=await f.reference.referenceStatus();
 assert.equal(ref.referencePresent,true);
 assert.equal(ref.source,'private_storage');
 assert.deepEqual(await f.reference.read(),png);
 // Uploading the exact same original is idempotent; no silent mutation.
 const savedAgain=await f.reference.save(png);
 assert.equal(savedAgain.sha256,saved.sha256);
 assert.equal(f.files.size,1);
});
test('Invalid files are rejected before upload and cannot replace a valid reference',async()=>{
 const f=fixture(),good=await image();
 await f.reference.save(good);
 const previous=f.state.reference_sha256;
 await assert.rejects(f.reference.save(Buffer.from('not an image')),/LOCAL_REFERENCE_INVALID/);
 const tiny=await sharp(randomBytes(399*600*3),{raw:{width:399,height:600,channels:3}}).png().toBuffer();
 await assert.rejects(f.reference.save(tiny),/LOCAL_REFERENCE_DIMENSIONS/);
 const fake=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(1100)]);
 await assert.rejects(f.reference.save(fake),/LOCAL_REFERENCE_INVALID/);
 assert.equal(f.state.reference_sha256,previous);
 assert.equal(f.files.size,1);
});
test('Tampered storage reference cannot be served as the official character',async()=>{
 const f=fixture(),good=await image();
 await f.reference.save(good);
 const path=f.state.reference_path;
 f.files.set(path,Buffer.alloc(good.length,1));
 await assert.rejects(f.reference.read(),/LOCAL_REFERENCE_INVALID/);
});
test('GPU remains inactive and cannot be enabled merely by uploading the official photo',async()=>{
 const f=fixture();
 await f.reference.save(await image());
 const engine=new LocalVideoEngine(f.store as any,{get:async()=>null} as any,env,f.fetcher);
 const status=await engine.status();
 assert.equal(status.referencePresent,true);
 assert.equal(status.storageReady,true);
 assert.equal(status.serverReady,true);
 assert.equal(status.workerConnected,false);
 assert.equal(status.readyForProduction,false);
 await assert.rejects(engine.setAutoEnabled(true),/LOCAL_WORKER_NOT_READY/);
 assert.equal(f.state.auto_enabled,false);
});
