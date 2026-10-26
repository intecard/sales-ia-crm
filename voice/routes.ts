import express from 'express';
import { z } from 'zod';
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { VoiceSalesAgent, redact } from './agent.ts';
import { publicBase } from './provider.ts';
const uuid=z.string().uuid();const orgId=z.string().regex(/^org_[a-zA-Z0-9_-]{1,100}$/);
const err=(res:express.Response,e:unknown)=>res.status(409).json({error:e instanceof Error&&/^VOICE_[A-Z_]+$/.test(e.message)?e.message:'Revisa configuración, permisos y datos. No se ha confirmado ninguna llamada.'});
export function voiceAdminRouter(agent:VoiceSalesAgent){const r=express.Router();r.param('org',(req,res,next,v)=>{if(!orgId.safeParse(v).success)return res.sendStatus(400);next();});
 r.get('/:org',async(req,res)=>{try{res.json(await agent.snapshot(String(req.params.org)));}catch(e){err(res,e);}});
 r.post('/:org/settings',async(req,res)=>{try{await agent.save(String(req.params.org),req.body);res.json({saved:true});}catch(e){err(res,e);}});
 r.post('/:org/verify',async(req,res)=>{try{res.json(await agent.verify(String(req.params.org)));}catch(e){err(res,e);}});
 r.post('/:org/import',async(req,res)=>{if(req.params.org!=='org_inteca_main')return res.sendStatus(403);try{res.json({imported:await agent.importInterested()});}catch(e){err(res,e);}});
 r.post('/:org/contacts',async(req,res)=>{try{res.json(await agent.addContact(String(req.params.org),req.body));}catch(e){err(res,e);}});
 r.post('/:org/contacts/:id/revoke',async(req,res)=>{if(!uuid.safeParse(req.params.id).success)return res.sendStatus(400);try{await agent.revoke(String(req.params.org),String(req.params.id));res.json({saved:true});}catch(e){err(res,e);}});
 r.post('/:org/schedule',async(req,res)=>{const b=z.object({contactId:uuid,at:z.string().datetime().refine(v=>Date.parse(v)>=Date.now()-60000)}).strict().safeParse(req.body);if(!b.success)return res.sendStatus(400);try{res.json(await agent.schedule(String(req.params.org),b.data.contactId,b.data.at));}catch(e){err(res,e);}});
 r.post('/:org/calls/:id/stop',async(req,res)=>{if(!uuid.safeParse(req.params.id).success)return res.sendStatus(400);try{await agent.stop(String(req.params.org),String(req.params.id));res.json({saved:true});}catch(e){err(res,e);}});
 r.post('/:org/calls/:id/reconcile',async(req,res)=>{if(!uuid.safeParse(req.params.id).success)return res.sendStatus(400);try{const j=await agent.job(String(req.params.id),String(req.params.org));if(!j.provider_sid)throw Error('VOICE_UNKNOWN_SID');const c=await agent.provider.inspect(j.provider_sid);const contact=(await agent.store.request(`crm_voice_contacts?id=eq.${j.contact_id}`))[0];if(c.from!==j.destination_from||c.to!==contact?.phone)throw Error('VOICE_DESTINATION');const map:Record<string,string>={'in-progress':'active',queued:'starting',ringing:'starting',completed:'completed',busy:'busy','no-answer':'no-answer',failed:'failed',canceled:'canceled'};await agent.update(j.id,{state:map[c.status]||'review_required',duration_seconds:Number(c.duration)||0,last_error:null});res.json({state:map[c.status]||'review_required'});}catch(e){err(res,e);}});
 r.post('/:org/simulate',async(req,res)=>{const b=z.object({course:z.string().max(250),text:z.string().min(1).max(1500),history:z.array(z.object({speaker:z.enum(['customer','agent']),text:z.string().max(1000)})).max(16)}).strict().safeParse(req.body);if(!b.success)return res.sendStatus(400);try{res.json({...await agent.answer(String(req.params.org),b.data.course,b.data.history,b.data.text),simulation:true,telephoneCall:false});}catch(e){err(res,e);}});
 return r;
}
export function voiceProviderRouter(agent:VoiceSalesAgent){const r=express.Router();r.use(express.urlencoded({extended:false,limit:'32kb'}));
 r.use((req,res,next)=>{if(Object.values(req.body||{}).some(v=>typeof v!=='string')||!agent.provider.valid(req.get('X-Twilio-Signature')||'',`${publicBase()}${req.originalUrl}`,req.body||{})||req.body.AccountSid!==agent.provider.account())return res.sendStatus(403);next();});
 async function bind(req:express.Request){if(!uuid.safeParse(req.params.id).success)throw Error('VOICE_ID');const j=await agent.job(String(req.params.id));const c=(await agent.store.request(`crm_voice_contacts?id=eq.${j.contact_id}&organization_id=eq.${j.organization_id}`))[0];if(!c||c.phone!==req.body.To||j.destination_from!==req.body.From||!/^CA[0-9a-f]{32}$/i.test(req.body.CallSid)||j.provider_sid&&j.provider_sid!==req.body.CallSid)throw Error('VOICE_DESTINATION');if(!j.provider_sid)await agent.store.request(`crm_voice_calls?id=eq.${j.id}&provider_sid=is.null`,'PATCH',{provider_sid:req.body.CallSid});return {j,c};}
 r.post('/connect/:id',async(req,res)=>{try{const {j,c}=await bind(req);const s=await agent.settings(j.organization_id);if(!s?.enabled||!c.consent||c.do_not_call||!['starting','active'].includes(j.state))return res.type('text/xml').send('<Response><Hangup/></Response>');res.type('text/xml').send(agent.provider.xml(j.id,s.max_seconds,s.company_name));}catch{res.sendStatus(403);}});
 r.post('/status/:id',async(req,res)=>{try{const {j}=await bind(req);const seq=Number(req.body.SequenceNumber);if(!Number.isInteger(seq)||seq<0)return res.sendStatus(400);const map:Record<string,string>={queued:'starting',initiated:'starting',ringing:'starting','in-progress':'active',completed:'completed',busy:'busy','no-answer':'no-answer',failed:'failed',canceled:'canceled'};const state=map[req.body.CallStatus];if(!state)return res.sendStatus(204);await agent.store.request(`crm_voice_calls?id=eq.${j.id}&status_seq=lt.${seq}`,'PATCH',{state,status_seq:seq,duration_seconds:Math.max(0,Math.min(10000,Number(req.body.CallDuration)||0)),updated_at:new Date().toISOString()});res.sendStatus(204);}catch{res.sendStatus(403);}});
 r.post('/finish/:id',async(req,res)=>{try{const {j}=await bind(req);const s=await agent.settings(j.organization_id);res.type('text/xml').send(agent.provider.finish(j.outcome==='human'&&s?.enabled?s.transfer_number:'',j.destination_from,j.outcome));}catch{res.sendStatus(403);}});
 return r;
}
export function attachVoiceRelay(server:Server,agent:VoiceSalesAgent){const wss=new WebSocketServer({noServer:true,maxPayload:16384});
 server.on('upgrade',(req,socket,head)=>{if(!req.url?.startsWith('/api/voice/relay/'))return;const match=/^\/api\/voice\/relay\/([a-f0-9-]{36})$/.exec(req.url);const signature=String(req.headers['x-twilio-signature']||'');if(!match||!uuid.safeParse(match[1]).success||!agent.provider.valid(signature,`${publicBase().replace('https:','wss:')}${req.url}`)){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>{void run(ws,match[1]);});});
 async function run(ws:WebSocket,id:string){let job:any,contact:any,ready=false,epoch=0,busy=false;let history:Array<{speaker:string;text:string}>=[];let pending='';let turns=0;let queue=Promise.resolve();
  const timer=setTimeout(()=>ws.close(1000,'Maximum duration'),310000);timer.unref();ws.on('close',()=>{epoch++;clearTimeout(timer);});
  const send=(data:any)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
  async function handle(raw:string){const m=JSON.parse(raw);
   if(m.type==='setup'){if(ready)return ws.close(1008,'Duplicate setup');job=await agent.job(id);contact=(await agent.store.request(`crm_voice_contacts?id=eq.${job.contact_id}&organization_id=eq.${job.organization_id}`))[0];const s=await agent.settings(job.organization_id);
    if(!s?.enabled||!contact?.consent||contact.do_not_call||m.accountSid!==agent.provider.account()||m.callSid!==job.provider_sid||m.from!==job.destination_from||m.to!==contact.phone||!['starting','active'].includes(job.state))return ws.close(1008,'Invalid call');
    const locked=await agent.store.request(`crm_voice_calls?id=eq.${id}&session_id=is.null`,'PATCH',{session_id:String(m.sessionId).slice(0,100),state:'active',updated_at:new Date().toISOString()});if(!locked.length)return ws.close(1008,'Session already used');
    const previous=await agent.store.request(`crm_voice_calls?contact_id=eq.${contact.id}&organization_id=eq.${job.organization_id}&id=neq.${id}&order=created_at.desc&limit=1`);history=(previous[0]?.transcript||[]).slice(-12);ready=true;return;
   }
   if(!ready)return ws.close(1008,'Setup required');
   if(m.type==='interrupt'){epoch++;if(history.at(-1)?.speaker==='agent')history[history.length-1].text=redact(String(m.utteranceUntilInterrupt||''));return;}
   if(m.type==='error'){await agent.update(id,{last_error:'VOICE_RELAY_ERROR',next_action:'Revisar Twilio Debugger antes de volver a llamar.'});return ws.close(1011,'Provider error');}
   if(m.type!=='prompt')return;
   pending+=String(m.voicePrompt||'').slice(0,1500);if(pending.length>2000)return ws.close(1009,'Utterance too long');if(!m.last)return;
   const text=redact(pending);pending='';if(!text.trim())return;if(++turns>40)return send({type:'end'});
   const version=++epoch;history.push({speaker:'customer',text});await agent.update(id,{transcript:history.slice(-40)});
   busy=true;try{const s=await agent.settings(job.organization_id);const current=(await agent.store.request(`crm_voice_contacts?id=eq.${contact.id}&organization_id=eq.${job.organization_id}`))[0];if(!s?.enabled||!current?.consent||current.do_not_call)return send({type:'end'});const result=await agent.answer(job.organization_id,contact.course,history.slice(0,-1),text);if(version!==epoch||ws.readyState!==WebSocket.OPEN)return;
    history.push({speaker:'agent',text:result.reply});await agent.afterTurn(job,contact,result.action,text,history);
    if(['opt_out','end','human','follow_up_requested'].includes(result.action)){send({type:'end',handoffData:JSON.stringify({outcome:result.action})});return;}
    send({type:'text',token:result.reply,last:true,interruptible:true,preemptible:true});
   }catch{send({type:'text',token:'En este momento no puedo confirmar ese dato. Dejaré registrada la consulta para una persona del equipo.',last:true,interruptible:true});await agent.update(id,{last_error:'VOICE_ANSWER_UNAVAILABLE',next_action:'Atender consulta humana pendiente.'}).catch(()=>{});}finally{busy=false;}
  }
  // Interruptions invalidate an in-flight answer immediately, while other events
  // remain serialized to preserve transcript order and avoid duplicate actions.
  ws.on('message',data=>{try{const raw=data.toString();const m=JSON.parse(raw);if(m.type==='interrupt'){epoch++;if(history.at(-1)?.speaker==='agent')history[history.length-1].text=redact(String(m.utteranceUntilInterrupt||''));return;}if(busy&&m.type==='prompt')epoch++;queue=queue.then(()=>handle(raw)).catch(()=>ws.close(1011,'Session unavailable'));}catch{ws.close(1008,'Invalid message');}});
 }
 return wss;
}
