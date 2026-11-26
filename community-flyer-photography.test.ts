import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { planMonth } from './community-plan.ts';
import { flyerPhotoPrompt, prepareFlyerPhoto, photoFingerprint } from './community-flyer-photography.ts';
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
const env={SUPABASE_URL:'https://crm-storage.example.test',CM_FLYER_PHOTOGRAPHY_ENABLED:'true',GEMINI_API_KEY:'fake'};
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
test('single photo request per piece, shared by both channels and rejected if too similar',async()=>{
 const job=unique[0];
 let reservations=0,requests=0,uploads=0;
 const fetcher:typeof fetch=async(url,init)=>{
  if(String(url).startsWith('https://generativelanguage.googleapis.com/')){
    requests++;
    const body=JSON.parse(String(init?.body));
    assert.deepEqual(body.generationConfig.responseModalities,['IMAGE']);
    return Response.json({candidates:[{content:{parts:[{inlineData:{mimeType:'image/jpeg',data:image.toString('base64')}}]}}]});
  }
  uploads++;
  assert.match(String(url),/\/storage\/v1\/object\/crm-community\/[a-f0-9]{32}\.jpg$/);
  return Response.json({ok:true});
 };
 const store={request:async(route:string,_method:string,body:unknown)=>{
   if (route.endsWith('crm_reserve_flyer_photo')) return ++reservations===1?'reserved':'ready';
   if (route.endsWith('crm_record_flyer_photo')) {
     assert.equal((body as {p_hash:string}).p_hash, await photoFingerprint(image));
     return 'unique';
   }
   return [{state:'ready'}];
 }};
 const first=await prepareFlyerPhoto(job.payload,store,env,fetcher);
 const sibling=jobs.find(j=>j.channel==='instagram'&&j.payload.assetKey===job.payload.assetKey)!;
 assert.equal(await prepareFlyerPhoto(sibling.payload,store,env,fetcher),first);
 assert.equal(requests,1);assert.equal(uploads,1);
 const similar={request:async(route:string)=>route.endsWith('crm_reserve_flyer_photo')?'reserved':'similar'};
 await assert.rejects(prepareFlyerPhoto(job.payload,similar,env,fetcher),/CM_FLYER_PHOTO_TOO_SIMILAR/);
 assert.equal(uploads,1);
});
