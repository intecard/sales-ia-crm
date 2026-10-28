import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LocalVideoEngine, localWorkerTokenValid } from './local-video-engine.ts';
import { makeContent, contentHash } from './community-plan.ts';
import type { Catalog } from './whatsapp-catalog.ts';

const token='a'.repeat(64);
const env={
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'test-service-role-not-a-real-key',
  INTECA_LOCAL_VIDEO_WORKER_TOKEN:token,
} as NodeJS.ProcessEnv;
const catalog:Catalog={
  text:'official',hash:'official-hash',generalSchedule:'Un día por semana',
  specialSchedules:[],payments:'',courses:[{
    title:'Técnico en Autorizaciones Médicas',text:'',
    duration:'5 meses',modality:'Virtual',investment:'Inscripción RD$2,500 y mensualidad RD$2,000',
    schedule:'Sábados',description:'Aprende validación de coberturas y atención al afiliado.',
  }],
};
const communityId=randomUUID();
const payload=makeContent(catalog.courses[0],catalog,'2026-10-27','short',0);
function fixture(){
  const rows:any[]=[];
  const source={id:communityId,payload,state:'brief',content_hash:contentHash(payload)};
  const store={
    request:async(resource:string,method='GET',body?:any)=>{
      if(resource.startsWith('crm_community_jobs?'))return [source];
      if(resource.startsWith('crm_local_video_jobs?asset_key='))return rows.filter(j=>resource.includes(j.asset_key));
      if(resource==='crm_local_video_jobs'&&method==='POST'){
        const job={id:randomUUID(),...body,claim_token:null,progress:0};
        rows.push(job);return [job];
      }
      if(resource.startsWith('crm_local_video_jobs?id=')){
        if(resource.includes('claim_token=eq.')) {
          const arr=rows.filter(j=>resource.includes(j.id)&&resource.includes(j.claim_token)&&j.state==='rendering');
          if(method==='PATCH')arr.forEach(j=>Object.assign(j,body));
          return arr;
        }
        return rows.filter(j=>resource.includes(j.id));
      }
      if(resource.startsWith('crm_local_video_settings'))return [{auto_enabled:false,max_daily_creatives:8}];
      throw Error('UNEXPECTED: '+resource);
    }
  };
  return {source,rows,engine:new LocalVideoEngine(store,{get:async()=>catalog},env)};
}
test('Worker authentication requires a strong shared secret and constant-time exact match',()=>{
 assert.equal(localWorkerTokenValid('Bearer '+token,token),true);
 assert.equal(localWorkerTokenValid('Bearer '+token.slice(1),token),false);
 assert.equal(localWorkerTokenValid('Bearer '+'b'.repeat(64),token),false);
 assert.equal(localWorkerTokenValid('Bearer weak','weak'),false);
 assert.equal(localWorkerTokenValid(undefined,token),false);
});
test('One creative produces a single durable job (deduplicated across channel siblings)',async()=>{
 const f=fixture();
 const first=await f.engine.enqueue(communityId);
 const second=await f.engine.enqueue(communityId);
 assert.equal(first.id,second.id);
 assert.equal(f.rows.length,1);
 assert.equal(first.script?.actor,'INTEQUITO');
 assert.equal(first.asset_key.length,64);
});
test('Unauthorised or changed scripts and invented promotions cannot enter the local GPU queue',async()=>{
 const f=fixture();
 f.source.content_hash='tampered';
 await assert.rejects(()=>f.engine.enqueue(communityId),/LOCAL_SCRIPT_CHANGED/);
 f.source.content_hash=contentHash(payload);
 f.source.payload={...payload,caption:payload.caption+' Super descuento 50%'};
 f.source.content_hash=contentHash(f.source.payload);
 await assert.rejects(()=>f.engine.enqueue(communityId),/LOCAL_CATALOG_CHANGED/);
});
test('Media upload never accepts unknown claims or non-MP4 bytes',async()=>{
 const f=fixture();
 const inserted=await f.engine.enqueue(communityId);
 const claim=randomUUID();
 Object.assign(f.rows[0],{claim_token:claim,state:'rendering'});
 await assert.rejects(()=>f.engine.upload(inserted.id,claim,Buffer.alloc(2048)),/LOCAL_MP4_INVALID/);
 await assert.rejects(()=>f.engine.upload(randomUUID(),claim,Buffer.alloc(2048)),/LOCAL_MP4_INVALID/);
});
test('Upload validated MP4 to private bucket; mark only review ready, never published',async()=>{
 const f=fixture();
 const newJob=await f.engine.enqueue(communityId);
 const claim=randomUUID();
 Object.assign(f.rows[0],{claim_token:claim,state:'rendering'});
 const bytes=Buffer.alloc(2048);
 bytes.write('ftyp',4,'ascii');
 let receivedUrl='';
 const backend=new LocalVideoEngine((f.engine as any).store,{get:async()=>catalog},env,
  (async(url:string,init?:RequestInit)=>{
   receivedUrl=url;
   assert.equal(init?.method,'POST');
   assert.equal(new Headers(init?.headers).get('content-type'),'video/mp4');
   return new Response('{"Key":"ok"}',{status:200});
  }) as typeof fetch);
 const result=await backend.upload(newJob.id,claim,bytes);
 assert.equal(result.state,'ready_for_review');
 assert.match(receivedUrl,/crm-local-videos\/rendered\/.*\.mp4/);
 assert.equal(f.rows[0].state,'ready_for_review');
 assert.equal(f.rows[0].progress,100);
});
