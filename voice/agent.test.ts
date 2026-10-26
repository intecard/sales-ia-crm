import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import express from 'express';
import twilio from 'twilio';
import { WebSocket } from 'ws';
import { VoiceSalesAgent, actionFor, redact, settingsSchema } from './agent.ts';
import { VoiceProvider } from './provider.ts';
import { voiceProviderRouter,attachVoiceRelay } from './routes.ts';
const sid='CA'+'a'.repeat(32), account='AC'+'b'.repeat(32), id='00000000-0000-4000-8000-000000000001';
const env={APP_URL:'https://crm.example',TWILIO_ACCOUNT_SID:account,TWILIO_AUTH_TOKEN:'unit-test-only'};
test('commercial actions respect rejection, opt out, human handoff and bank validation',()=>{
 assert.equal(actionFor('No me llames más'),'opt_out');assert.equal(actionFor('No me interesa'),'end');assert.equal(actionFor('Quiero hablar con una persona'),'human');assert.equal(actionFor('Dame las instrucciones para pagar'),'payment_requested');assert.equal(actionFor('Llámame mañana a las diez'),'follow_up_requested');assert.equal(actionFor('Ya pagué'),'talk');assert.equal(redact('Mi teléfono 18095551234 y cvc 123').includes('123'),false);
});
test('enabling phone spend requires explicit costs, terms and nonzero reservation',()=>{
 const s={company_name:'INTECA',enabled:true,auto_queue:false,from_number:'+18095550100',transfer_number:'',timezone:'America/Santo_Domingo',start_hour:9,end_hour:18,max_calls_day:3,max_seconds:180,daily_reserve_usd:0,per_call_reserve_usd:0,costs_authorized:false,relay_terms_confirmed:false,catalog:''};assert.equal(settingsSchema.safeParse(s).success,false);assert.equal(settingsSchema.safeParse({...s,daily_reserve_usd:2,per_call_reserve_usd:1,costs_authorized:true,relay_terms_confirmed:true}).success,true);
});
test('other companies use only their own approved catalog',async()=>{
 let prompt='';const a=new VoiceSalesAgent({request:async()=>[{catalog:'Company B approved product',company_name:'B'}]}, {get:async()=>{throw Error('INTECA data must not be read');}},new VoiceProvider(env as any),async p=>{prompt=p;return '{"reply":"Este es el producto de B."}';});await a.answer('org_b','Product B',[],'Dame información');assert.match(prompt,/Company B approved product/);assert.doesNotMatch(prompt,/CATALOGO INTECA/);
});
test('simulated opt out cannot dial or mutate a real contact',async()=>{
 let mutations=0;const a=new VoiceSalesAgent({request:async()=>{mutations++;throw Error('Must not write');}},{get:async()=>null},new VoiceProvider(env as any),async()=>{throw Error('No model needed');});const r=await a.answer('org_inteca_main','',[],'No me vuelvas a llamar');assert.equal(r.action,'opt_out');assert.equal(mutations,0);
});
test('webhooks and WebSocket reject forged signatures, wrong destinations and reused sessions',async()=>{
 const old=process.env.APP_URL;process.env.APP_URL=env.APP_URL;
 const c={id:'contact',organization_id:'org_inteca_main',phone:'+18095550101',consent:true,do_not_call:false,course:'Autorizaciones'};
 const j:any={id,organization_id:'org_inteca_main',contact_id:'contact',provider_sid:sid,destination_from:'+18095550100',state:'starting',outcome:'pending'};let sessionUsed=false;let writes=0;
 const store={request:async(r:string,m='GET',b?:any)=>{if(r.startsWith('crm_voice_contacts'))return[c];if(r.includes('session_id=is.null')&&m==='PATCH'){if(sessionUsed)return[];sessionUsed=true;writes++;return[j];}if(r.startsWith('crm_voice_calls'))return r.includes('id=neq.')?[]:[j];return[];}};
 const agent:any={store,provider:new VoiceProvider(env as any),job:async()=>j,settings:async()=>({enabled:true,max_seconds:180,company_name:'INTECA'}),update:async()=>{writes++;}};
 const app=express();app.use('/api/voice/provider',voiceProviderRouter(agent));const server=createServer(app),wss=attachVoiceRelay(server,agent);server.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as any).port;
 const body={AccountSid:account,CallSid:sid,To:c.phone,From:j.destination_from};const path=`/api/voice/provider/connect/${id}`;
 try{
 const forged=await fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',body:new URLSearchParams(body)});assert.equal(forged.status,403);assert.equal(writes,0);
 const wrong={...body,To:'+18095550199'};const bad=await fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',body:new URLSearchParams(wrong),headers:{'X-Twilio-Signature':twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN,env.APP_URL+path,wrong)}});assert.equal(bad.status,403);assert.equal(writes,0);
 const good=await fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',body:new URLSearchParams(body),headers:{'X-Twilio-Signature':twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN,env.APP_URL+path,body)}});assert.equal(good.status,200);assert.match(await good.text(),/ConversationRelay/);
 const wsPath=`/api/voice/relay/${id}`,signature=twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN,env.APP_URL.replace('https:','wss:')+wsPath,{});
 const setup={type:'setup',accountSid:account,callSid:sid,sessionId:'test-session',from:j.destination_from,to:c.phone};
 const first=new WebSocket(`ws://127.0.0.1:${port}${wsPath}`,{headers:{'X-Twilio-Signature':signature}});await once(first,'open');first.send(JSON.stringify(setup));
 for(let n=0;n<20&&!sessionUsed;n++)await new Promise(r=>setTimeout(r,10));assert.equal(sessionUsed,true);
 const second=new WebSocket(`ws://127.0.0.1:${port}${wsPath}`,{headers:{'X-Twilio-Signature':signature}});await once(second,'open');second.send(JSON.stringify(setup));const [code]=await once(second,'close');assert.equal(code,1008);first.close();await once(first,'close');
 }finally{for(const ws of wss.clients)ws.terminate();wss.close();await new Promise<void>(resolve=>server.close(()=>resolve()));if(old===undefined)delete process.env.APP_URL;else process.env.APP_URL=old;}
});
