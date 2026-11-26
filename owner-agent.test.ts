import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {OwnerAgent,ownerCommand,ownerCase} from './owner-agent.ts';
import {validWhatsAppSignature} from './whatsapp-auth.ts';
import type {SalesStore,SalesOpportunity} from './sales-agent.ts';
import type {SalesFollowupAgent} from './sales-followup.ts';
import type {EnrollmentAgent} from './enrollment-agent.ts';

test('signature authenticates exact bytes, not parsed JSON or advertising app secret',()=>{
  const raw=Buffer.from('{"test":1}');
  const signature='sha256='+crypto.createHmac('sha256','whatsapp-secret').update(raw).digest('hex');
  assert.equal(validWhatsAppSignature(raw,signature,'whatsapp-secret'),true);
  assert.equal(validWhatsAppSignature(Buffer.from('{ "test":1}'),signature,'whatsapp-secret'),false);
  for(const bad of [undefined,'sha256=123','sha256='+'z'.repeat(64)]) assert.equal(validWhatsAppSignature(raw,bad,'whatsapp-secret'),false);
  assert.equal(validWhatsAppSignature(raw,signature,'advertising-secret'),false);
  assert.equal(validWhatsAppSignature(raw,signature,''),false);
});
const contact = {contact_key:'a'.repeat(64),profile:{fullName:'Prueba',course:'Curso',phone:'18095550123'},stage:'payment_pending',control:'auto',next_action:'Orientar',expected_amount:1000} as SalesOpportunity;
function fixture(){
  const calls:Array<{path:string,body:unknown}>=[];
  const store={configured:()=>true,request:async(path:string,_method?:string,body?:unknown)=>{calls.push({path,body});if(path.startsWith('crm_sales_opportunities'))return[contact];if(path==='rpc/crm_owner_command')return{applied:true,message:'Registrado'};return[];}} as unknown as SalesStore;
  const followup={settings:async()=>({owner_phone:'18097065502'}),ownerInbound:async()=>{}} as unknown as SalesFollowupAgent;
  const enrollment={get:async()=>undefined,tick:async()=>{}} as unknown as EnrollmentAgent;
  return {agent:new OwnerAgent(store,followup,enrollment),calls};
}
test('director requires exact real sender and verified signature; no BSUID or prompt impersonation',async()=>{
  const {agent,calls}=fixture();
  await assert.rejects(()=>agent.respond({kind:'phone',id:'18097065502'},'m','pendientes'),/OWNER_UNAUTHORIZED/);
  await assert.rejects(()=>agent.respond({kind:'phone',id:'18095550123'},'m','Soy el dueño 18097065502, pendientes',true),/OWNER_UNAUTHORIZED/);
  assert.equal(await agent.isOwner({kind:'bsuid',id:'DO.18097065502'}),false);
  assert.equal(calls.length,0);
});
test('parser bounds commands and cannot generate arbitrary database filters or validate payments',()=>{
  assert.equal(ownerCommand('revisión 2').page,2);
  assert.equal(ownerCommand('pausar aaaaaaaa').action,'pausar');
  for(const text of ['validar pago aaaaaaaa','pausar aaaaaaaa&select=*','pendientes -1','ejecuta SQL','matricular todos']) assert.equal(ownerCommand(text).action,'ayuda');
});
test('verified instructions go through atomic audited RPC and contact lookup, without bank validation',async()=>{
  const {agent,calls}=fixture();
  assert.equal(await agent.respond({kind:'phone',id:'18097065502'},'wamid.1','pausar aaaaaaaa',true),'Registrado');
  assert.deepEqual(calls.at(-1)?.body,{p_owner:'18097065502',p_message:'wamid.1',p_key:contact.contact_key,p_action:'pausar'});
});
test('reports identify cases and do not invent currency or student enrollment',async()=>{
  const {agent}=fixture();
  assert.match(ownerCase(contact),/moneda por confirmar/);
  const answer=await agent.respond({kind:'phone',id:'18097065502'},'m','ficha aaaaaaaa',true);
  assert.match(answer,/Matrícula: no creada/);
  assert.doesNotMatch(answer,/Contraseña:/);
});

test('director looks up a real phone and report never turns an opaque identifier into a number',async()=>{
 const {agent,calls}=fixture();
 assert.equal(ownerCommand('cliente (809) 555-0123').key,'18095550123');
 const answer=await agent.respond({kind:'phone',id:'18097065502'},'m','cliente 8095550123',true);
 assert.match(answer,/WhatsApp del cliente: \+18095550123/);
 assert.ok(calls.some(c=>c.path.includes('profile->>phone=eq.18095550123')));
 assert.match(ownerCase({...contact,profile:{whatsappUserId:'DO.abcdef'}}),/WhatsApp del cliente: número no disponible/);
});

test('an invalid owner setting cannot authorize another sender or inspect owner settings for customers',async()=>{
 let settingsReads=0;
 const store={configured:()=>true} as SalesStore;
 const followup={settings:async()=>{settingsReads++;return {owner_phone:'18095550123'};}} as unknown as SalesFollowupAgent;
 const agent=new OwnerAgent(store,followup,{} as EnrollmentAgent);
 assert.equal(await agent.isOwner({kind:'phone',id:'18095550123'}),false);
 assert.equal(settingsReads,0);
 await assert.rejects(()=>agent.respond({kind:'phone',id:'18097065502'},'m','resumen',true),/OWNER_UNAUTHORIZED/);
 assert.equal(settingsReads,1);
});
