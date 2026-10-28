import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { featuredCourseForDate, planMonth, contentHash, type CommunityPayload } from './community-plan.ts';
import { renderCommunityImage, editorialVisualSignature } from './community-media.ts';
import type { Catalog } from './whatsapp-catalog.ts';

const course=(name:string)=>({
 title:name,text:'',duration:'4 meses',modality:'Virtual',schedule:'Sábados',
 investment:'Inscripción RD$2,500; mensualidad RD$2,000',
 description:'Formación profesional en el sistema de salud dominicano.',
});
const courses=Array.from({length:14},(_,i)=>course('Programa técnico INTECA '+(i+1)));
const catalog:Catalog={text:'source',hash:'a'.repeat(64),generalSchedule:'Un día por semana',specialSchedules:[],payments:'',courses};
const cryptoHash=(data:Buffer)=>createHash('sha256').update(data).digest('hex');

test('one course per calendar month, rotating through ALL 14 without truncating after 12',()=>{
 const seen=new Set<string>();
 for(let i=0;i<14;i++){
   const d=new Date(Date.UTC(2026,9+i,15)).toISOString().slice(0,10);
   seen.add(featuredCourseForDate(catalog,d).title);
 }
 assert.equal(seen.size,14);
 assert.equal(featuredCourseForDate(catalog,'2027-12-01').title,courses[0].title);
});
test('one daily poster with 7 reels and a longer video; same course across all 9 daily creatives',()=>{
 const jobs=planMonth(catalog,'2026-10-27');
 assert.equal(jobs.length,30*(2+7*3+3));
 const dates=new Set(jobs.map(j=>j.payload.editorialDate));
 assert.equal(dates.size,30);
 for(const date of dates){
   const matching=jobs.filter(j=>j.payload.editorialDate===date);
   assert.equal(matching.length,26);
   assert.equal(matching.filter(j=>j.payload.kind==='flyer').length,2);
   assert.equal(matching.filter(j=>j.payload.kind==='short').length,21);
   assert.equal(matching.filter(j=>j.payload.kind==='promo_video').length,3);
   assert.equal(new Set(matching.map(j=>j.payload.courseTitle)).size,1);
   assert.equal(matching[0].payload.courseTitle,featuredCourseForDate(catalog,date!).title);
 }
 assert.equal(featuredCourseForDate(catalog,'2026-10-31').title,courses[0].title);
 assert.equal(featuredCourseForDate(catalog,'2026-11-01').title,courses[1].title);
});
test('unique media fingerprint for every date, preserving shared same-day flyer across channels',()=>{
 const jobs=planMonth(catalog,'2026-10-27').filter(j=>j.payload.kind==='flyer');
 const byDate=new Map<string,CommunityPayload[]>();
 for(const j of jobs){
   const d=j.payload.editorialDate!;
   byDate.set(d,[...(byDate.get(d)||[]),j.payload]);
 }
 const fingerprints=new Set<string>();
 for(const [date,posters] of byDate){
   assert.equal(posters.length,2);
   assert.equal(posters[0].assetKey,posters[1].assetKey);
   const signature=editorialVisualSignature(posters[0]);
   assert.ok(!fingerprints.has(signature),date);
   fingerprints.add(signature);
   assert.equal(posters[0].campaignMonth,date.slice(0,7));
   assert.equal(contentHash(posters[0]),contentHash(posters[1]));
 }
 assert.equal(fingerprints.size,30);
});
test('actual exported JPEG bytes differ by day even for same monthly course',async()=>{
 const list=planMonth(catalog,'2026-10-27').filter(j=>j.channel==='instagram'&&j.payload.kind==='flyer');
 const [oct27,oct28,nov1]=[list[0],list[1],list[5]];
 assert.equal(oct27.payload.courseTitle,oct28.payload.courseTitle);
 const a=await renderCommunityImage(oct27.payload);
 const b=await renderCommunityImage(oct28.payload);
 const c=await renderCommunityImage(nov1.payload);
 assert.equal(a[0],0xff);
 assert.equal(a[1],0xd8);
 assert.notEqual(cryptoHash(a),cryptoHash(b),'two dates may never render identical pixels');
 assert.notEqual(cryptoHash(b),cryptoHash(c));
});

test('flyer still renders without optional PNG mascot, stock photos or image files',async()=>{
 const sample=planMonth(catalog,'2026-10-28').find(j=>j.channel==='instagram'&&j.payload.kind==='flyer')!;
 const image=await renderCommunityImage(sample.payload,undefined,'/nonexistent/inteca-assets-unit-test');
 assert.equal(image[0],0xff);
 assert.equal(image[1],0xd8);
 assert.ok(image.length>8_000);
});
