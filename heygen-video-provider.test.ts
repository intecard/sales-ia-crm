import test from 'node:test';
import assert from 'node:assert/strict';
import { HeyGenVideoProvider } from './heygen-video-provider.ts';
import type { Script } from './intequito-studio.ts';

const script:Script={
  actor:'INTEQUITO',
  reference:'/intequito-oficial.png',
  duration:45,format:'9:16',course:'Técnico en Autorizaciones Médicas',objective:'educar',
  state:'guion_pendiente_de_render_3d',
  scenes:[{from:0,to:5,location:'Clínica',action:'Saluda',camera:'Plano medio',dialogue:'Hola, te habla INTEQUITO.',subtitle:'Hola, te habla INTEQUITO.',audio:'voz en español'}],
  requirements:[],
};
const env={
  HEYGEN_API_KEY:'private-test-only',
  HEYGEN_INTEQUITO_AVATAR_ID:'intequito_photo_avatar_01',
  HEYGEN_INTEQUITO_VOICE_ID:'spanish_voice_intequito_01',
} as NodeJS.ProcessEnv;
const good=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
test('HeyGen provider requires explicit approval before sending a paid generation',async()=>{
  let calls=0;
  const p=new HeyGenVideoProvider(env,(async()=>{calls++;return good({data:{video_id:'v_intequito_01',status:'waiting'}});}) as typeof fetch);
  await assert.rejects(()=>p.createVideo(script,{confirmed:false,requestId:'approved-example'}),/VIDEO_APPROVAL_REQUIRED/);
  assert.equal(calls,0);
});
test('HeyGen creates video using only the configured INTEQUITO avatar and Spanish voice',async()=>{
  let body:any;
  let key:string|null=null;
  const p=new HeyGenVideoProvider(env,async(url,init)=>{
    assert.equal(url,'https://api.heygen.com/v3/videos');
    assert.equal(init?.method,'POST');
    body=JSON.parse(String(init?.body));
    key=new Headers(init?.headers).get('Idempotency-Key');
    return good({data:{video_id:'v_intequito_01',status:'waiting'}});
  });
  const started=await p.createVideo(script,{confirmed:true,requestId:'confirmed-01'});
  assert.equal(started.provider,'heygen');
  assert.equal(started.id,'v_intequito_01');
  assert.equal(body.type,'avatar');
  assert.equal(body.avatar_id,env.HEYGEN_INTEQUITO_AVATAR_ID);
  assert.equal(body.voice_id,env.HEYGEN_INTEQUITO_VOICE_ID);
  assert.equal(body.aspect_ratio,'9:16');
  assert.equal(body.script,'Hola, te habla INTEQUITO.');
  assert.equal(body.output_format,'mp4');
  assert.equal(key,'confirmed-01');
  assert.equal(started.reviewRequired,true);
});
test('HeyGen status uses provider ID and never marks incomplete videos as published',async()=>{
  const p=new HeyGenVideoProvider(env,async(url)=>{
    assert.equal(url,'https://api.heygen.com/v3/videos/v_intequito_01');
    return good({data:{id:'v_intequito_01',status:'completed',duration:43.6,video_url:'https://files.heygen.ai/video/1.mp4',subtitle_url:'https://files.heygen.ai/video/1.srt'}});
  });
  const status=await p.getVideo('v_intequito_01');
  assert.equal(status.videoUrl,'https://files.heygen.ai/video/1.mp4');
  assert.equal(status.subtitleUrl,'https://files.heygen.ai/video/1.srt');
  assert.equal(status.reviewRequired,true);
});
test('HeyGen cannot substitute a generic avatar when INTEQUITO identity is missing',async()=>{
  const p=new HeyGenVideoProvider({HEYGEN_API_KEY:'key'} as NodeJS.ProcessEnv);
  assert.equal(p.status().ready,false);
  await assert.rejects(()=>p.createVideo(script,{confirmed:true,requestId:'test-1'}),/HEYGEN_NOT_CONFIGURED/);
});
