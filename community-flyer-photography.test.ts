import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { contentHash, planMonth } from './community-plan.ts';
import {NativeFlyerEngine,workerCredential} from './native-flyer-engine.ts';
import { flyerPhotoPrompt, photoFingerprint } from './community-flyer-photography.ts';
import { renderINTECAFlyer } from './community-flyer-renderer.ts';
import type {Catalog,CatalogCourse} from './whatsapp-catalog.ts';

const catalog:Catalog={text:'source', hash:'9'.repeat(64), generalSchedule:'Sábados', specialSchedules:[], payments:'',
 courses:[
   ['Técnico en Oficial de Autorizaciones Médicas','Ley 87-01, PDSS, CIE-10, procesos de autorizaciones médicas.'],
   ['Técnico en Pre-Certificaciones Médicas','Pre-certificación, documentación, cobertura, procedimientos y PDSS.'],
   ['Técnico en Atención al Usuario/Paciente','Atención al usuario y paciente, empatía y comunicación efectiva.'],
   ['Farmacología Aplicada para Visitadores Médicos','Fundamentos de farmacología, medicamentos, visita médica y farmacovigilancia.'],
   ['Auxiliar de Enfermería','Enfermería, signos vitales, bioseguridad y cuidado del paciente.'],
   ['Promotor de Seguros de Salud','Promotor de seguros de salud, afiliación, coberturas y Ley 87-01.'],
   ['Promotor de Salud','Promoción de salud, prevención, educación y comunidad.'],
   ['Máster en Oficial de Autorizaciones Médicas','Procesos de autorizaciones, PDSS, codificación CIE-10 y hospitalización.'],
 ].map(([title,text]):CatalogCourse=>({title,text,duration:'5 meses',modality:'Virtual',schedule:'Sábados',
  investment:'Inscripción RD$2,500; mensualidad RD$2,000',description:'Programa técnico'}))};
const jobs=planMonth(catalog,'2026-01-01').filter(j=>j.payload.kind==='flyer');
const unique=jobs.filter(j=>j.channel==='facebook');
const env={SUPABASE_URL:'https://crm-storage.example.test',SUPABASE_SERVICE_ROLE_KEY:'storage-test-only'};
const image=await sharp(Buffer.from(`<svg width="800" height="450"><rect width="800" height="450" fill="#fb8"/><circle cx="420" cy="220" r="140" fill="#27a"/></svg>`)).jpeg().toBuffer();

test('morning authorization scenes alternate workers, empty office and another team',()=>{
 const mornings=unique.filter(j=>j.payload.editorialSlot==='morning');
 const variants=mornings.slice(0,3).map(j=>flyerPhotoPrompt(j.payload));
 assert.match(variants[0],/call center.*professionals actively working/);
 assert.match(variants[1],/call center.*empty workplace with no people/);
 assert.match(variants[2],/call center.*completely different group/);
 for(const job of unique) {
  const sibling=jobs.find(j=>j.channel==='instagram'&&j.payload.assetKey===job.payload.assetKey)!;
  assert.equal(flyerPhotoPrompt(job.payload),flyerPhotoPrompt(sibling.payload));
  if (job.payload.assetKey!==mornings[0].payload.assetKey) assert.notEqual(flyerPhotoPrompt(job.payload),variants[0]);
 }
});
test('generated imagery renders with canonical pricing across one month of courses and layouts',async()=>{
 for(const j of unique) {
   const result=await renderINTECAFlyer(j.payload,process.cwd(),image);
   const meta=await sharp(result).metadata();
   assert.equal(meta.width,1080);
   assert.equal(meta.height,1350);
 }
});
test('pairing stores only a hash and never exposes a credential in status',async()=>{
 let settings:Record<string,unknown>={enabled:true};
 const store={request:async(route:string,method?:string,body?:unknown)=>{
  assert.match(route,/crm_flyer_engine_/);
  if(method==='PATCH') settings=body as Record<string,unknown>;
  return route.includes('jobs')?[]:[settings];
 }};
 const engine=new NativeFlyerEngine(store,{get:async()=>catalog});
 const {token}=await engine.pair();
 assert.equal(workerCredential('Bearer '+token),token);
 assert.equal(workerCredential('Bearer bad'),undefined);
 assert.match(String(settings.token_hash),/^[a-f0-9]{64}$/);
 assert.notEqual(token,settings.token_hash);
 assert.doesNotMatch(JSON.stringify(await engine.status()),/token|[a-f0-9]{64}/);
 await engine.disconnect();
 assert.equal(settings.enabled,false);
});

test('local worker assembles one ready photo for both channels, with no image API call',async()=>{
 const j=unique[0];
 const p=j.payload;
 const asset=p.assetKey, lease='0ab03c8e-3ee0-4a0b-8a95-2ad83e132fcd',token='b'.repeat(43);
 const deadline=new Date('2099-01-01T00:00:00Z').toISOString();
 let phase='unique',uploads=0,mediaKey='';
 const store={request:async(route:string,_method?:string,body?:unknown)=>{
  if(route.endsWith('crm_claim_native_flyer')) return {authorized:true,payload:p,assetKey:asset,lease,attempt:1,expiresAt:deadline};
  if(route.startsWith('crm_flyer_engine_settings?')) return [{id:'inteca'}];
  if(route.includes('state=eq.rendering')) return [{expires_at:deadline}];
  if(route.endsWith('crm_lock_native_flyer_upload')){
   assert.equal((body as {p_fingerprint:string}).p_fingerprint, await photoFingerprint(image));
   return phase==='unique'?'locked':'similar';
  }
  if(route.startsWith('crm_community_jobs?')) return [{payload:p,content_hash:contentHash(p)}];
  if(route.endsWith('crm_finish_native_flyer')) {
   mediaKey=(body as {p_media:string}).p_media;
   return true;
  }
  if(route.includes('state=eq.ready')) return mediaKey?[{media_key:mediaKey}]:[];
  throw Error(route);
 }};
 const fetcher:typeof fetch=async(url,init)=>{
  assert.match(String(url),/^https:\/\/crm-storage\.example\.test\/storage\/v1\/object\/crm-community\/[a-f0-9]{32}\.jpg$/);
  assert.equal((await sharp(Buffer.from(init?.body as Uint8Array)).metadata()).height,1350);
  uploads++;
  return Response.json({ok:true});
 };
 const engine=new NativeFlyerEngine(store,{get:async()=>catalog},env,fetcher);
 const claim=await engine.claim(token);
 assert.equal(claim?.asset,p.assetKey);
 assert.match(claim?.prompt||'',/healthcare authorizations call center/);
 assert.equal(await engine.media(p,j.scheduled_at),null);
 assert.deepEqual(await engine.upload(token,{asset,lease},image),{state:'ready'});
 const sibling=jobs.find(candidate=>candidate.channel==='instagram'&&candidate.payload.assetKey===asset)!;
 assert.equal(await engine.media(p,j.scheduled_at),await engine.media(sibling.payload,sibling.scheduled_at));
 assert.equal(uploads,1);
 phase='similar';
 await assert.rejects(engine.upload(token,{asset,lease},image),/NATIVE_FLYER_TOO_SIMILAR/);
 assert.equal(uploads,1);
});

test('the studio assembles an uploaded original photo privately and blocks repeated photos',async()=>{
  let row:any=null;
  let pending:any=null;
  let jpg:Buffer|null=null;
  let previous='';
  const store={request:async(route:string,method?:string,body?:any)=>{
    if(route==='rpc/crm_create_studio_flyer'){
      if(body.p_fingerprint&&body.p_fingerprint===previous)return 'similar';
      pending=body.p_payload;
      previous=body.p_fingerprint;
      row={state:previous?'uploading':'queued',scheduled_at:new Date(Date.now()+7200000).toISOString()};
      assert.equal(body.p_asset,pending.assetKey);
      return 'created';
    }
    if(method==='PATCH')Object.assign(row,body);
    assert.match(route,/studio_payload=not.is.null/);
    return row?[row]:[];
  }};
  const fetcher:typeof fetch=async(url,options)=>{
    assert.match(String(url),/\/storage\/v1\/object\/(?:authenticated\/)?crm-studio-flyers\/[a-f0-9]{32}\.jpg$/);
    if(options?.method==='POST') {
      jpg=Buffer.from(options.body as Uint8Array);
      const picture=await sharp(jpg).metadata();
      assert.equal(picture.width,1080);assert.equal(picture.height,1350);
      return Response.json({ok:true});
    }
    assert.ok(jpg);
    return new Response(new Uint8Array(jpg),{headers:{'Content-Type':'image/jpeg'}});
  };
  const engine=new NativeFlyerEngine(store,{get:async()=>catalog},env,fetcher);
  const course=catalog.courses[0].title;
  const result=await engine.createStudio(course,'flyer',image);
  assert.equal(result.state,'ready');
  assert.equal((await engine.studioImage(result.asset)).length,jpg!.length);
  await assert.rejects(()=>engine.createStudio(course,'flyer',image),/NATIVE_FLYER_TOO_SIMILAR/);
  const future=await engine.createStudio(course,'story');
  assert.equal(future.state,'queued');
  assert.equal(pending.kind,'story');
  assert.notEqual(future.asset,result.asset);
});

test('every course family has its own photoreal workplace and a different retry scene',()=>{
 const targets=[
  [/Oficial de Autorizaciones Médicas$/, /healthcare authorizations call center/],
  [/Pre-Certificaciones/,/precertification administrative desk/],
  [/Atención al Usuario/,/clinic reception/],
  [/Farmacología/,/medical representative training room/],
  [/Enfermería/,/nursing simulation classroom/],
  [/Seguros/,/health insurance orientation office/],
  [/Promotor de Salud/,/community health education workshop/],
  [/^Máster/,/authorization escalation team/],
 ] as const;
 for(const [name,setting] of targets){
  const item=unique.find(j=>name.test(j.payload.courseTitle))!;
  assert.ok(item);
  const first=flyerPhotoPrompt(item.payload,{studio:true,attempt:1});
  const second=flyerPhotoPrompt(item.payload,{studio:true,attempt:2});
  assert.match(first,/Photorealistic documentary photograph/);
  assert.match(first,setting);assert.match(second,setting);
  assert.notEqual(first,second);
 }
});
