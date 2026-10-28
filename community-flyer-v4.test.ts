import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {flyerOffer,isPublishableFlyer} from './community-flyer-offer.ts';
import {fitFlyerText,containFlyerPhoto,renderINTECAFlyer,FLYER_SIZE} from './community-flyer-renderer.ts';
import {makeContent,planMonth} from './community-plan.ts';
import type {Catalog,CatalogCourse} from './whatsapp-catalog.ts';

const course:CatalogCourse={
  title:'Técnico en Oficial de Autorizaciones Médicas',
  duration:'5 meses',modality:'opciones formativas según apertura y oferta institucional',
  schedule:'un día semanal',investment:'Inscripción RD$2,500; mensualidad RD$2,000; total estimado RD$12,500',
  description:'Aprenderás procesos de autorización médica para la atención al afiliado.',
  text:'Lo que aprenderá el estudiante:\n- Ley 87-01\n- Coberturas del PDSS\n- Códigos CIE-10\n- Hospitalizaciones\nDuración: 5 meses\nInversión: Inscripción RD$2,500; mensualidad RD$2,000',
};
const catalog:Catalog={hash:'a'.repeat(64),text:'official',courses:[course],generalSchedule:'Un día por semana',specialSchedules:[],payments:''};
const sha256=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
test('Flyer uses precise official enrollment and monthly fees, never estimated totals or vague modality',()=>{
  const offer=flyerOffer(course,'2026-10-28');
  assert.equal(offer.registration,'RD$2,500');
  assert.equal(offer.monthly,'RD$2,000');
  assert.equal(offer.duration,'5 meses');
  assert.equal(offer.modality,null);
  assert.equal(offer.course,course.title);
  assert.equal(isPublishableFlyer(offer),true);
  assert.ok(offer.benefits.some(x=>/PDSS|CIE-10|Ley 87-01|Hospitalizaciones/.test(x)));
  const payload=makeContent(course,catalog,'2026-10-28','flyer',0);
  assert.ok(payload.caption.includes('📲 WhatsApp: 809-643-5502'));
  assert.ok(payload.caption.includes('Inscripción: RD$2,500'));
  assert.ok(payload.caption.includes('Mensualidad: RD$2,000'));
  assert.equal(payload.caption.includes('oferta institucional'),false);
  assert.equal(payload.assetKey.length,32);
});
test('Unconfirmed or generic-only catalog details must NOT be advertised with invented facts',()=>{
  const blank={...course,investment:'Consultas y condiciones de pago',description:'Formación profesional en el sector salud dominicano',text:''};
  const offer=flyerOffer(blank,'2026-10-28');
  assert.equal(offer.registration,null);
  assert.equal(offer.monthly,null);
  assert.deepEqual(offer.benefits,[]);
  assert.equal(isPublishableFlyer(offer),false);
});
test('Photos preserve all four original corners with contain, avoiding clipping heads/hands',async()=>{
  const source=await sharp({
    create:{width:700,height:220,channels:3,background:'#ffffff'}
  }).composite([
    {input:Buffer.from('<svg width="350" height="110"><rect width="350" height="110" fill="#ff0000"/></svg>'),left:0,top:0},
    {input:Buffer.from('<svg width="350" height="110"><rect width="350" height="110" fill="#00ff00"/></svg>'),left:350,top:0},
    {input:Buffer.from('<svg width="350" height="110"><rect width="350" height="110" fill="#0000ff"/></svg>'),left:0,top:110},
    {input:Buffer.from('<svg width="350" height="110"><rect width="350" height="110" fill="#ffff00"/></svg>'),left:350,top:110},
  ]).png().toBuffer();
  const contained=await containFlyerPhoto(source,688,333);
  const result=sharp(contained);
  const meta=await result.metadata();
  assert.equal(meta.width,688);
  assert.equal(meta.height,333);
  const {data,info}=await result.raw().toBuffer({resolveWithObject:true});
  const rgb=(x:number,y:number)=>Array.from(data.slice((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3));
  const colors=[rgb(120,95),rgb(570,95),rgb(120,230),rgb(570,230)];
  assert.ok(colors[0][0]>180&&colors[0][1]<90,'top-left red preserved');
  assert.ok(colors[1][1]>150&&colors[1][0]<100,'top-right green preserved');
  assert.ok(colors[2][2]>180&&colors[2][0]<100,'bottom-left blue preserved');
  assert.ok(colors[3][0]>160&&colors[3][1]>160,'bottom-right yellow preserved');
});
test('Full course titles are fitted and never silently cut by an arbitrary 3-line slice',()=>{
  const title=fitFlyerText('Técnico en Oficial de Autorizaciones Médicas',940,3,54,32);
  assert.ok(title.lines.length<=3);
  assert.equal(title.lines.join(' '),'Técnico en Oficial de Autorizaciones Médicas');
  assert.throws(()=>fitFlyerText('Supercalifragilisticexpialidocious'.repeat(12),200,2,40,20),/CM_FLYER_TEXT_TOO_LONG/);
});
test('Daily 4:5 JPEGs differ in actual pixels and retain the official CTAs with no external generator',async()=>{
  const dates=['2026-10-27','2026-10-28','2026-10-29'];
  const files:Buffer[]=[];
  const params=planMonth(catalog,'2026-10-27').filter(j=>j.channel==='instagram'&&j.payload.kind==='flyer');
  for(let i=0;i<dates.length;i++){
    assert.equal(params[i].payload.editorialDate,dates[i]);
    assert.equal(params[i].payload.flyerOffer?.registration,'RD$2,500');
    const jpeg=await renderINTECAFlyer(params[i].payload,'/missing/optional/assets');
    files.push(jpeg);
    const meta=await sharp(jpeg).metadata();
    assert.equal(meta.width,FLYER_SIZE.width);
    assert.equal(meta.height,FLYER_SIZE.height);
  }
  assert.equal(new Set(files.map(sha256)).size,dates.length);
});
test('Missing actual tuition fees blocks image generation instead of making them up',async()=>{
  const noPrice={...course,investment:'Precio por confirmar'};
  const c={...catalog,courses:[noPrice]};
  const p=makeContent(noPrice,c,'2026-10-28','flyer',0);
  await assert.rejects(()=>renderINTECAFlyer(p,'/nonexistent'),/CM_FLYER_PRICE_OR_CONTENT_MISSING/);
});
