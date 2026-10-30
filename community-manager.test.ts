import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityManager, isCurrentCommunityJob } from './community-manager.ts';
import { makeContent, planMonth, rdDay, sha, contentHash, communityPublicCopy } from './community-plan.ts';
import { hasDiscount } from './advertising-agent.ts';
import type { Catalog } from './whatsapp-catalog.ts';
const catalog:Catalog={text:'official',hash:'official-hash',generalSchedule:'Un día por semana',specialSchedules:[],payments:'',courses:[{title:'Técnico en Oficial de Autorizaciones Médicas',text:'Ley 87-01, PDSS, CIE-10, procesos de autorizaciones médicas y cobertura',duration:'5 meses',modality:'Virtual',investment:'Inscripción RD$2,500 y mensualidad RD$2,000',schedule:'Sábados',description:'Aprende validación de coberturas y atención al afiliado.'}]};
test('single-course catalog still schedules a safe daily TAM poster plus video briefs',()=>{
 const jobs=planMonth(catalog,'2026-10-25');assert.equal(jobs.length,600);assert.equal(new Set(jobs.map(j=>j.slot)).size,jobs.length);
 assert.equal(jobs.filter(j=>j.channel==='youtube'&&j.payload.kind==='promo_video').length,30);
 assert.equal(jobs.filter(j=>j.channel==='youtube'&&j.payload.kind==='avatar_video').length,30,'One avatar script for every calendar day');
 assert.equal(jobs.filter(j=>j.payload.kind==='avatar_video').every(j=>j.payload.script?.actor==='INTEQUITO'),true);
 assert.equal(jobs.filter(j=>j.channel==='instagram'&&j.payload.kind==='flyer').length,30);
 assert.equal(jobs.filter(j=>j.channel==='facebook'&&j.payload.kind==='short').length,240);
 assert.equal(jobs.filter(j=>j.payload.kind==='short').every(j=>j.payload.script?.actor==='INTEQUITO'),true);
 assert.equal(jobs.every(j=>j.payload.caption.includes('809-643-5502')),true);
 assert.equal(jobs.every(j=>!hasDiscount(communityPublicCopy(j.payload))),true,'No se deben inventar descuentos');
 assert.equal(jobs.every(j=>j.payload.caption.includes('5 meses')),true,'La duración debe figurar en el texto');
 assert.equal(jobs.every(j=>j.payload.caption.includes('RD$2,500')),true,'La inscripción oficial debe figurar en el texto');
 assert.equal(rdDay(new Date('2026-10-26T02:00:00Z')),'2026-10-25');
});
function harness(fail=false){
 const payload=makeContent(catalog.courses[0],catalog,rdDay(new Date()),'flyer',0);
 const settings={enabled:true,plan_started_at:'started',destinations:{facebook:'111'}};
 const row:any={id:'00000000-0000-4000-8000-000000000001',slot:'v6:test',channel:'facebook',state:'queued',scheduled_at:new Date().toISOString(),payload,content_hash:contentHash(payload),media_url:'https://example.supabase.co/storage/v1/object/public/crm-community/a.jpg',result:{},updated_at:new Date().toISOString()};let publishes=0;
 const store={request:async(resource:string,method='GET',body?:any)=>{
  if(resource.startsWith('crm_community_jobs?slot=like.'))return [{id:'existing-avatar-plan'}];
  if(resource.startsWith('crm_community_calendar_state'))return [{
    id:'inteca',last_planned_day:rdDay(new Date()),catalog_hash:catalog.hash,creative_version:'v6'
  }];
  if(resource.startsWith('crm_community_settings')){if(method==='PATCH')Object.assign(settings,body);return [structuredClone(settings)];}
  const q=new URLSearchParams(resource.split('?')[1]);
  const state=q.get('state');if(state?.startsWith('in.')&&!state.slice(4,-1).split(',').includes(row.state))return [];
  if(state?.startsWith('eq.')&&state.slice(3)!==row.state)return [];
  if(q.get('updated_at')?.startsWith('lt.')&&row.updated_at>=q.get('updated_at')!.slice(3))return [];
  if(method==='PATCH')Object.assign(row,body);return [structuredClone(row)];
 }};
 const publisher={destination:()=> '111',verify:async()=>({readVerified:true}),publish:async()=>{publishes++;if(fail)throw Error('CM_EXTERNAL_UNKNOWN');return{id:'provider-post',state:'published',url:null};}};
 const create=()=>new CommunityManager(store,{get:async()=>catalog},publisher as any);
 return {row,settings,create,publishes:()=>publishes};
}
test('only canonical v6 jobs are displayed as current, not superseded drafts',()=>{
 const sample=planMonth(catalog,'2028-01-01');
 assert.ok(sample.every(j=>isCurrentCommunityJob(j as any)));
 assert.equal(isCurrentCommunityJob({...sample[0],slot:'v5:'+sample[0].slot.slice(3)} as any),false);
 assert.equal(isCurrentCommunityJob({...sample[0],slot:'v6:2028-01-01:short:0:facebook:old'} as any),false);
});
test('cross-process conditional claim sends a post only once',async()=>{const h=harness();await Promise.all([h.create().tick(),h.create().tick()]);assert.equal(h.publishes(),1);assert.equal(h.row.state,'published');});
test('PostgreSQL jsonb key ordering preserves approval while altered content is rejected',async()=>{
 for(const tampered of [false,true]){const h=harness();h.row.payload=Object.fromEntries(Object.entries(h.row.payload).reverse());if(tampered)h.row.payload.caption+=' Unapproved text';await h.create().tick();assert.equal(h.publishes(),tampered?0:1);assert.equal(h.row.state,tampered?'blocked':'published');}
});
test('uncertain external result is never retried automatically',async()=>{const h=harness(true);const a=h.create();await a.tick();await a.tick();assert.equal(h.publishes(),1);assert.equal(h.row.state,'review_required');await assert.rejects(a.retry(h.row.id));});
test('pause, changed catalogue and changed destination prevent publication',async()=>{
 for(const change of ['pause','catalog','destination']){const h=harness();if(change==='pause')h.settings.enabled=false;if(change==='catalog')h.row.payload.catalogHash='changed';if(change==='destination')h.settings.destinations.facebook='other';await h.create().tick();assert.equal(h.publishes(),0);}
});

test('30-day v6 RPC only marks expired TODAY missed; all future 9am/5pm flyers remain queued',async()=>{
 const pair:Catalog={...catalog,courses:[...catalog.courses,{
   title:'Técnico en Atención al Usuario/Paciente',
   text:'Atención al paciente, comunicación efectiva, empatía, orientación al afiliado.',
   duration:'4 meses',modality:'Virtual',
   investment:'Inscripción RD$2,500; mensualidad RD$2,000',
   schedule:'Sábados',description:'Formación en servicio al paciente',
 }]};
 let jobs:any[]=[];
 const store={request:async(resource:string,method='GET',body?:any)=>{
  if(resource.startsWith('crm_community_settings'))return[{id:'inteca',enabled:true,destinations:{facebook:'11',instagram:'22',youtube:'33'}}];
  if(resource.startsWith('crm_community_calendar_state'))return[{id:'inteca',last_planned_day:null,catalog_hash:'',creative_version:'v4'}];
  if(resource==='rpc/crm_community_roll_plan'){jobs=body.p_jobs;return 660;}
  throw Error('TEST_UNEXPECTED_STORE_RESOURCE:'+resource);
 }};
 const publisher={destination:(x:string)=>({facebook:'11',instagram:'22',youtube:'33'} as any)[x]};
 await new CommunityManager(store,{get:async()=>pair},publisher as any).plan();
 assert.equal(jobs.length,660);
 const today=rdDay(new Date());
 const future=jobs.filter(j=>j.payload.kind==='flyer'&&j.payload.editorialDate>today);
 assert.ok(future.length>=100);
 assert.ok(future.every(j=>j.state==='queued'),'future flyers must NEVER be missed');
 assert.ok(future.some(j=>j.payload.editorialSlot==='morning'));
 assert.ok(future.some(j=>j.payload.editorialSlot==='afternoon'));
 assert.ok(future.every(j=>j.content_hash===contentHash(j.payload)));
});
test('If an attacker recomputes the hash after substituting an unrelated course topic, publishing still fails closed',async()=>{
 const h=harness();
 h.row.payload.flyerOffer={...h.row.payload.flyerOffer,focus:'Atención al usuario y paciente',
   benefits:['Atención al usuario y paciente','Comunicación efectiva']};
 h.row.content_hash=contentHash(h.row.payload);
 await h.create().tick();
 assert.equal(h.publishes(),0);
 assert.equal(h.row.state,'blocked');
 assert.equal(h.row.last_error,'CM_FLYER_COURSE_MISMATCH');
});
