import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createEditorial,EDITORIAL_LAYOUTS,repeatedEditorial} from './community-editorial.ts';
import {editorialSvg} from './community-editorial-svg.ts';
import {diversifyPlan} from './community-editorial-history.ts';
import {contentHash,planMonth,makeContent} from './community-plan.ts';
import type {Catalog} from './whatsapp-catalog.ts';
const catalog:Catalog={text:'official',hash:'a'.repeat(64),generalSchedule:'Un día semanal',specialSchedules:[],payments:'',courses:[
 {title:'Técnico en Oficial de Autorizaciones Médicas',text:'Autorizaciones médicas, Ley 87-01, PDSS, CIE-10, coberturas, hospitalizaciones, documentación y procedimientos',duration:'5 meses',modality:'Virtual',investment:'Inscripción RD$2,500; mensualidad RD$2,000',schedule:'Sábados',description:'Gestión de autorizaciones médicas.'},
 {title:'Técnico en Atención al Usuario y al Paciente',text:'Atención al paciente, comunicación efectiva, empatía, orientación al afiliado, quejas, humanización',duration:'4 meses',modality:'Virtual',investment:'Inscripción RD$2,500; mensualidad RD$2,000',schedule:'Sábados',description:'Servicio al paciente.'}
]};
test('rolling renewal retains persisted payloads and uses seven days of real copy, not hashes, to avoid repetition',()=>{
 const initial=diversifyPlan(planMonth(catalog,'2026-11-25'),[],catalog);
 const eligible=initial.filter(p=>!p.repetitionBlocked);
 assert.ok(eligible.length>600);
 for(const channel of ['instagram','facebook','youtube']){
  const rows=eligible.filter(p=>p.channel===channel);
  for(let i=0;i<rows.length;i++){
   const recent=rows.slice(0,i).filter(p=>Date.parse(p.scheduled_at)>=Date.parse(rows[i].scheduled_at)-7*86400000);
   assert.equal(repeatedEditorial(rows[i].payload.creative!,recent.map(p=>p.payload.creative!)),false);
   if(recent.length)assert.notEqual(rows[i].payload.creative!.layout,recent.at(-1)!.payload.creative!.layout);
  }
 }
 const renewed=diversifyPlan(planMonth(catalog,'2026-11-26'),initial,catalog);
 const saved=new Map(initial.map(p=>[p.slot,p.payload]));
 for(const row of renewed)if(saved.has(row.slot))assert.equal(contentHash(row.payload),contentHash(saved.get(row.slot)!));
 assert.ok(eligible.every(p=>p.payload.caption.includes('809-643-5502')&&p.payload.caption.includes('RD$2,500')));
});
test('all eight geometries render both sizes with long official Spanish headlines and escaped text',async()=>{
 const creative=createEditorial(catalog.courses[0],'2026-11-25','flyer',0);
 const digests=new Set();
 for(const layout of EDITORIAL_LAYOUTS){for(const vertical of [false,true]){
  const svg=editorialSvg({creative:{...creative,layout,headline:'¿Puedes explicar la gestión de autorizaciones médicas y sus procesos sin tecnicismos?',points:[...creative.points,'Consulta el procedimiento y comunica el siguiente paso.']},course:catalog.courses[0].title,facts:'5 meses · Inscripción RD$2,500 · Mensualidad RD$2,000',vertical});
  assert.ok(!svg.includes('call-center.webp'));const bytes=await sharp(Buffer.from(svg)).png().toBuffer();
  const meta=await sharp(bytes).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,vertical?1920:1350);digests.add(bytes.toString('base64'));
 }}
 assert.equal(digests.size,16);
 const escaped=editorialSvg({creative:{...creative,headline:'<script> & "texto"'},course:'INTECA',facts:'Datos confirmados'});
 assert.ok(escaped.includes('&lt;script&gt;'));assert.ok(!escaped.includes('<script>'));
});
test('meaningfully duplicated teaching text is rejected despite a different date, color, CTA or filename',()=>{
 const a=createEditorial(catalog.courses[0],'2026-11-25','flyer',0);
 assert.equal(repeatedEditorial({...a,visualKey:'different',palette:3,cta:'Otra llamada'},[a]),true);
 const p=makeContent(catalog.courses[0],catalog,'2026-11-25','short',0);
 assert.ok(p.script?.scenes.at(-1)?.dialogue.includes('809-643-5502'));
 const json=JSON.parse(JSON.stringify(p));json.creative.headline+=' changed';assert.notEqual(contentHash(json),contentHash(p));
});
