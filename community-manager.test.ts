import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityManager } from './community-manager.ts';
import { makeContent, planMonth, rdDay, sha } from './community-plan.ts';
import { hasDiscount } from './advertising-agent.ts';
import type { Catalog } from './whatsapp-catalog.ts';
const catalog:Catalog={text:'official',hash:'official-hash',generalSchedule:'Un día por semana',specialSchedules:[],payments:'',courses:[{title:'Técnico en Autorizaciones Médicas',text:'',duration:'5 meses',modality:'Virtual',investment:'Inscripción RD$2,500 y mensualidad RD$2,000',schedule:'Sábados',description:'Aprende validación de coberturas y atención al afiliado.'}]};
test('30-day plan uses unique slots, official facts and four human long-video briefs',()=>{
 const jobs=planMonth(catalog,'2026-10-25');assert.equal(jobs.length,334);assert.equal(new Set(jobs.map(j=>j.slot)).size,jobs.length);
 assert.equal(jobs.filter(j=>j.channel==='youtube'&&j.payload.kind==='long_brief').length,4);
 assert.equal(jobs.filter(j=>j.channel==='instagram'&&j.payload.kind==='story').length,90);
 assert.equal(jobs.filter(j=>j.channel==='facebook'&&j.payload.kind==='short').length,60);
 assert.equal(jobs.every(j=>!hasDiscount(j.payload)&&j.payload.caption.includes('5 meses')&&j.payload.caption.includes('RD$2,500')),true);
 assert.equal(rdDay(new Date('2026-10-26T02:00:00Z')),'2026-10-25');
});
function harness(fail=false){
 const payload=makeContent(catalog.courses[0],catalog,rdDay(new Date()),'flyer',0);
 const settings={enabled:true,plan_started_at:'started',destinations:{facebook:'111'}};
 const row:any={id:'00000000-0000-4000-8000-000000000001',slot:'test',channel:'facebook',state:'queued',scheduled_at:new Date().toISOString(),payload,content_hash:sha(payload),media_url:'https://example.supabase.co/storage/v1/object/public/crm-community/a.jpg',result:{},updated_at:new Date().toISOString()};let publishes=0;
 const store={request:async(resource:string,method='GET',body?:any)=>{
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
test('cross-process conditional claim sends a post only once',async()=>{const h=harness();await Promise.all([h.create().tick(),h.create().tick()]);assert.equal(h.publishes(),1);assert.equal(h.row.state,'published');});
test('uncertain external result is never retried automatically',async()=>{const h=harness(true);const a=h.create();await a.tick();await a.tick();assert.equal(h.publishes(),1);assert.equal(h.row.state,'review_required');await assert.rejects(a.retry(h.row.id));});
test('pause, changed catalogue and changed destination prevent publication',async()=>{
 for(const change of ['pause','catalog','destination']){const h=harness();if(change==='pause')h.settings.enabled=false;if(change==='catalog')h.row.payload.catalogHash='changed';if(change==='destination')h.settings.destinations.facebook='other';await h.create().tick();assert.equal(h.publishes(),0);}
});
