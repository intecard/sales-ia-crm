import test from 'node:test';
import assert from 'node:assert/strict';
import {growthSummary} from './community-growth.ts';
import {CommunityPublisher} from './community-publisher.ts';
import {makeContent} from './community-plan.ts';

test('growth uses latest post readings once and distinguishes unavailable data from measured zero',()=>{
 const jobs=[{id:'p',channel:'instagram'},{id:'q',channel:'instagram'}];
 const rows=[{job_id:'p',checked_at:'2026-10-26T12:00:00Z',metrics:{likes:10,comments:0,followers:105}},{job_id:'p',checked_at:'2026-10-25T12:00:00Z',metrics:{likes:5,comments:0,followers:100}},{job_id:'q',checked_at:'2026-10-26T12:00:00Z',metrics:{likes:2,comments:1,followers:105}}];
 const result=growthSummary(jobs,rows).find(g=>g.channel==='instagram')!;
 assert.equal(result.likes,12);assert.equal(result.comments,1);assert.equal(result.views,null);assert.equal(result.followers,105);assert.equal(result.followersChange,5);assert.equal(result.observedPosts,2);
 assert.equal(growthSummary([],[])[0].followers,null);
});

test('YouTube metrics are read only and restricted to the configured channel',async()=>{
 for(const wrong of [false,true]){
  const calls:string[]=[];
  const fetcher=async(url:any,init:any)=>{calls.push(String(url));if(String(url).includes('oauth2'))return Response.json({access_token:'fixture-token'});if(String(url).includes('/videos?'))return Response.json({items:[{id:'video',snippet:{channelId:wrong?'other':'inteca'},statistics:{viewCount:'100',likeCount:'4',commentCount:'2'}}]});return Response.json({items:[{id:'inteca',statistics:{subscriberCount:'20',hiddenSubscriberCount:false}}]});};
  const p=new CommunityPublisher({} as any,{YOUTUBE_CHANNEL_ID:'inteca'} as any,fetcher as typeof fetch);const m=await p.metrics('youtube','video');
  assert.equal(m.views,wrong?null:100);assert.equal(m.followers,wrong?null:20);assert.equal(calls.some(u=>u.includes('upload')||u.includes('insert')),false);
 }
});

test('new content rotates meaningful growth calls to action without changing course facts',()=>{
 const course={title:'Atención al Usuario',description:'Aprende atención al afiliado.',text:'',duration:'4 meses',modality:'Virtual',investment:'Inscripción RD$2,500 y mensualidad RD$2,000',schedule:'Sábados'};
 const catalog={courses:[course],hash:'catalog',generalSchedule:'Sábados'} as any;
 const captions=Array.from({length:5},(_,i)=>makeContent(course,catalog,`2026-10-${20+i}`,'short',0).caption);
 for(const prefix of ['Sigue a INTECA','comentarios','Guarda esta información','Comparte esta guía','Visita el programa'])assert.equal(captions.some(c=>c.includes(prefix)),true);
 for(const c of captions){assert.match(c,/4 meses/);assert.match(c,/RD\$2,500/);assert.match(c,/utm_campaign=lisa_crecimiento/);}
});
