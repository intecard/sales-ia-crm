import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createEditorial,EDITORIAL_LAYOUTS,repeatedEditorial} from './community-editorial.ts';
import {publicationSvg} from './community-publication-art.ts';
import {officialPublicationLogo} from './community-editorial-renderer.ts';
import {flyerOffer} from './community-flyer-offer.ts';
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
test('all editorial geometries render both sizes with long official Spanish headlines and escaped text',async()=>{
 const p=makeContent(catalog.courses[0],catalog,'2026-11-25','flyer',0);
 const creative=p.creative!;
 const logo='data:image/png;base64,'+(await officialPublicationLogo()).toString('base64');
 const digests=new Set();
 for(const layout of EDITORIAL_LAYOUTS){for(const kind of ['flyer','story'] as const){
  const svg=publicationSvg({...p,kind,creative:{...creative,layout,headline:'¿Puedes explicar la gestión de autorizaciones médicas y sus procesos sin tecnicismos?'}},logo);
  assert.ok(svg.includes('id="institutional-logo"'));assert.ok(svg.includes('id="course-image-content"'));
  assert.ok(svg.includes('RD$2,500')&&svg.includes('RD$2,000'));assert.ok(svg.includes('Autorizaciones Médicas'));
  const bytes=await sharp(Buffer.from(svg)).png().toBuffer();
  const meta=await sharp(bytes).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,kind==='story'?1920:1350);digests.add(bytes.toString('base64'));
 }}
 assert.equal(digests.size,EDITORIAL_LAYOUTS.length*2);
 const escaped=publicationSvg({...p,creative:{...creative,headline:'<script> & "texto"'}},logo);
 assert.ok(escaped.includes('&lt;script&gt;'));assert.ok(!escaped.includes('<script>'));
 const incomplete={...p,flyerOffer:{...flyerOffer(catalog.courses[0],'2026-11-25'),monthly:null}};
 assert.throws(()=>publicationSvg(incomplete,logo),/CM_PUBLICATION_PRICE_MISSING/);
 assert.throws(()=>publicationSvg(p,''),/CM_OFFICIAL_LOGO_MISSING/);
});
test('meaningfully duplicated teaching text is rejected despite a different date, color, CTA or filename',()=>{
 const a=createEditorial(catalog.courses[0],'2026-11-25','flyer',0);
 assert.equal(repeatedEditorial({...a,visualKey:'different',palette:3,cta:'Otra llamada'},[a]),true);
 const p=makeContent(catalog.courses[0],catalog,'2026-11-25','short',0);
 assert.ok(p.script?.scenes.at(-1)?.dialogue.includes('809-643-5502'));
 const json=JSON.parse(JSON.stringify(p));json.creative.headline+=' changed';assert.notEqual(contentHash(json),contentHash(p));
});
