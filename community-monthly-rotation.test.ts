import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planMonth,contentHash,morningAuthorizationsCourse,afternoonCourseForDate,rdDay,type CommunityPayload} from './community-plan.ts';
import {renderCommunityImage,editorialVisualSignature} from './community-media.ts';
import {shouldMissCampaignSlot} from './community-manager.ts';
import type {Catalog,CatalogCourse} from './whatsapp-catalog.ts';
const create=(title:string,text:string,duration='4 meses'):CatalogCourse=>({
 title,text,duration,modality:'Virtual',schedule:'Sábados',
 investment:'Inscripción RD$2,500; mensualidad RD$2,000',
 description:'Programa especializado del Instituto Técnico del Caribe.',
});
const courses=[
 create('Técnico en Oficial de Autorizaciones Médicas','Ley 87-01, PDSS, CIE-10, procesos de autorizaciones médicas.', '5 meses'),
 create('Técnico en Pre-Certificaciones Médicas','Pre-certificación, documentación, cobertura, procedimientos y PDSS.'),
 create('Técnico en Atención al Usuario/Paciente','Atención al usuario y paciente, empatía y comunicación efectiva.'),
 create('Farmacología Aplicada para Visitadores Médicos','Fundamentos de farmacología, medicamentos, visita médica y farmacovigilancia.'),
 create('Auxiliar de Enfermería','Enfermería, signos vitales, bioseguridad y cuidado del paciente.','12 meses'),
 create('Promotor de Seguros de Salud','Promotor de seguros de salud, afiliación, coberturas y Ley 87-01.'),
 create('Promotor de Salud','Promoción de salud, prevención, educación y comunidad.'),
 create('Máster en Oficial de Autorizaciones Médicas','Procesos de autorizaciones, PDSS, codificación CIE-10 y hospitalización.','12 meses'),
];
const catalog:Catalog={text:'source',hash:'a'.repeat(64),generalSchedule:'Un día por semana',specialSchedules:[],payments:'',courses};
const fingerprint=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('fixed 9 AM authorizations and rotating 5 PM non-TAM course every date, 30 days',()=>{
 const jobs=planMonth(catalog,'2026-10-27');
 assert.equal(jobs.length,30*(4+8*2+1));
 assert.equal(new Set(jobs.map(j=>j.slot)).size,jobs.length);
 const dates=[...new Set(jobs.map(j=>j.payload.editorialDate))];
 assert.equal(dates.length,30);
 const afternoons:string[]=[];
 for(const date of dates){
  const daily=jobs.filter(j=>j.payload.editorialDate===date);
  assert.equal(daily.length,21);
  const flyers=daily.filter(j=>j.payload.kind==='flyer');
  assert.equal(flyers.length,4);
  assert.equal(daily.filter(j=>j.payload.kind==='short').length,16);
  assert.equal(daily.filter(j=>j.payload.kind==='promo_video').length,1);
  const mornings=flyers.filter(j=>j.payload.editorialSlot==='morning');
  const afternoon=flyers.filter(j=>j.payload.editorialSlot==='afternoon');
  assert.equal(mornings.length,2);
  assert.equal(afternoon.length,2);
  assert.equal(mornings[0].payload.courseTitle,courses[0].title);
  assert.notEqual(afternoon[0].payload.courseTitle,courses[0].title);
  afternoons.push(afternoon[0].payload.courseTitle);
  assert.equal(mornings[0].scheduled_at,new Date(date+'T09:00:00-04:00').toISOString());
  assert.equal(afternoon[0].scheduled_at,new Date(date+'T17:00:00-04:00').toISOString());
  assert.equal(mornings[0].payload.assetKey,mornings[1].payload.assetKey);
  assert.equal(afternoon[0].payload.assetKey,afternoon[1].payload.assetKey);
  assert.notEqual(mornings[0].payload.assetKey,afternoon[0].payload.assetKey);
  assert.notEqual(contentHash(mornings[0].payload),contentHash(afternoon[0].payload));
  assert.ok(mornings.every(j=>j.payload.flyerOffer!.duration==='5 meses'));
 }
 for(let i=1;i<afternoons.length;i++)assert.notEqual(afternoons[i],afternoons[i-1],'no consecutive repeats in afternoon');
 assert.equal(new Set(afternoons).size,courses.length-1);
});
test('only an exact TAM family may become the morning course (not the Master)',()=>{
 const reversed:Catalog={...catalog,courses:[courses[7],...courses.slice(1,7),courses[0]]};
 assert.equal(morningAuthorizationsCourse(reversed)?.title,courses[0].title);
 assert.notEqual(afternoonCourseForDate(reversed,'2026-10-28')?.title,courses[0].title);
});
test('v6 media fingerprints are unique for date and afternoon/morning; network photos optional',async()=>{
 const items=planMonth(catalog,'2026-10-28')
  .filter(x=>x.channel==='instagram'&&x.payload.kind==='flyer').slice(0,4);
 const hashes:string[]=[];
 for(const item of items){
  assert.ok(item.slot.startsWith('v6:'));
  const bytes=await renderCommunityImage(item.payload,undefined,'/missing/inteca-assets');
  assert.equal(bytes[0],255);assert.equal(bytes[1],216);
  hashes.push(fingerprint(bytes));
  assert.ok(editorialVisualSignature(item.payload).includes('2026-10-'));
 }
 assert.equal(new Set(hashes).size,4);
});
test('Render waking after the scheduled post is allowed for 2 hours, never overnight',()=>{
 const flyer={scheduled_at:'2026-10-27T09:00:00-04:00',payload:{kind:'flyer'} as CommunityPayload};
 assert.equal(shouldMissCampaignSlot(flyer,new Date('2026-10-27T10:59:00-04:00')),false);
 assert.equal(shouldMissCampaignSlot(flyer,new Date('2026-10-27T11:05:00-04:00')),true);
 const afternoon={scheduled_at:'2026-10-27T17:00:00-04:00',payload:{kind:'flyer'} as CommunityPayload};
 assert.equal(shouldMissCampaignSlot(afternoon,new Date('2026-10-27T18:15:00-04:00')),false);
 assert.equal(shouldMissCampaignSlot(afternoon,new Date('2026-10-28T00:01:00-04:00')),true);
 const oldReel={scheduled_at:'2026-10-27T10:00:00-04:00',payload:{kind:'short'} as CommunityPayload};
 assert.equal(shouldMissCampaignSlot(oldReel,new Date('2026-10-27T13:00:00-04:00')),true);
 assert.equal(rdDay(new Date('2026-10-28T02:00:00Z')),'2026-10-27');
});
