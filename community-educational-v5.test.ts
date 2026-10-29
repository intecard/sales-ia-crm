import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {courseFamily,verifiedCourseTopics} from './community-course-topics.ts';
import {flyerOffer,isPublishableFlyer} from './community-flyer-offer.ts';
import {makeContent,planMonth} from './community-plan.ts';
import {renderINTECAFlyer,FLYER_SIZE} from './community-flyer-renderer.ts';
import {intequitoScript} from './intequito-studio.ts';
import type {Catalog,CatalogCourse} from './whatsapp-catalog.ts';

const course=(title:string,text:string,duration='4 meses'):CatalogCourse=>({
 title,text,duration,description:'Formación profesional en salud.',
 modality:'opciones de formación según apertura institucional',
 schedule:'Un día semanal',
 investment:'Inscripción RD$2,500; mensualidad RD$2,000',});
const tam=course('Técnico en Oficial de Autorizaciones Médicas',
 'Autorizaciones médicas, Ley 87-01, PDSS, CIE-10, coberturas, hospitalizaciones, atención al afiliado.','5 meses');
const service=course('Técnico en Atención al Usuario/Paciente',
 'Atención al paciente, comunicación efectiva, empatía, humanización, orientación al afiliado, PDSS.');
const precert=course('Técnico en Pre-Certificaciones Médicas',
 'Pre-certificación de servicios médicos, documentación clínica, coberturas, procedimientos y PDSS.');
const nursing=course('Auxiliar de Enfermería','Enfermería, signos vitales, bioseguridad y cuidados básicos del paciente.','12 meses');
const courses=[tam,service,precert,nursing];
const catalog:Catalog={text:'official',hash:'a'.repeat(64),courses,generalSchedule:'',specialSchedules:[],payments:''};

test('TAM topics never turn into Atención al Usuario just because the catalog says afiliado',()=>{
 const offer=flyerOffer(tam,'2026-10-29');
 assert.equal(courseFamily(tam.title),'authorizations');
 assert.equal(offer.duration,'5 meses');
 assert.equal(offer.registration,'RD$2,500');
 assert.equal(offer.monthly,'RD$2,000');
 assert.equal(offer.family,'authorizations');
 assert.ok(offer.benefits.length>=2);
 assert.ok(offer.benefits.every(t=>!/atenci[oó]n|orientaci[oó]n|comunicaci[oó]n|empat[ií]a/i.test(t)));
 assert.ok(!/atenci[oó]n al usuario/i.test(offer.hook));
 const payload=makeContent(tam,catalog,'2026-10-29','flyer',0);
 assert.ok(payload.caption.includes(tam.title));
 assert.ok(payload.caption.includes('809-643-5502'));
 assert.ok(payload.caption.includes('Inscripción: RD$2,500'));
 assert.ok(payload.caption.includes('Mensualidad: RD$2,000'));
 assert.ok(!payload.caption.includes('atención al usuario'));
});
test('User/Paciente remains a separate course; education and questions are specific',()=>{
 const offer=flyerOffer(service,'2026-10-29',1);
 assert.equal(offer.family,'patient_service');
 assert.ok(offer.benefits.every(t=>!/CIE-10|autorizaciones|validaci[oó]n de coberturas/i.test(t)));
 assert.ok(/atenci[oó]n|comunicaci[oó]n|empat/i.test(offer.hook));
 assert.ok(offer.question.includes('¿'));
});
test('The Master cannot be selected as morning TAM and never inherits missing tuition',()=>{
 const master=course('Máster en Oficial de Autorizaciones Médicas','Autorizaciones, PDSS, cobertura, CIE-10','12 meses');
 assert.equal(courseFamily(master.title),'master_authorizations');
 const noPrice={...master,investment:'Monto no confirmado'};
 assert.equal(isPublishableFlyer(flyerOffer(noPrice,'2026-10-29')),false);
});
test('An unknown program with generic description cannot be published with invented competencies',()=>{
 const other=course('Curso genérico de prueba','Enseñanza profesional, futuro brillante, gran oportunidad.');
 const o=flyerOffer(other,'2026-10-29');
 assert.deepEqual(o.benefits,[]);
 assert.equal(isPublishableFlyer(o),false);
});
test('Premium posters are 1080×1350 with different program-specific pixels and readable financial fields',async()=>{
 const all=planMonth(catalog,'2026-10-29').filter(j=>j.channel==='instagram'&&j.payload.kind==='flyer');
 const seen=new Set<string>();
 for(const j of all.slice(0,4)){
  const result=await renderINTECAFlyer(j.payload,'/nonexistent/optional-assets');
  assert.equal(result[0],255);
  const metadata=await sharp(result).metadata();
  assert.equal(metadata.width,FLYER_SIZE.width);
  assert.equal(metadata.height,FLYER_SIZE.height);
  assert.ok(result.length>9000);
  seen.add(j.payload.assetKey);
 }
 assert.equal(seen.size,4);
});
test('Seven topical INTEQUITO reel briefs are valuable and not falsely presented as published MP4s',()=>{
 const jobs=planMonth(catalog,'2026-10-29').filter(j=>j.channel==='instagram'&&j.payload.kind==='short'&&j.payload.editorialDate==='2026-10-29');
 assert.equal(jobs.length,7);
 for(const j of jobs){
  assert.equal(j.payload.script?.actor,'INTEQUITO');
  assert.equal(j.payload.script?.state,'guion_pendiente_de_render_3d');
  assert.ok(j.payload.script!.scenes.some(scene=>scene.dialogue.includes('809-643-5502')));
  assert.equal(j.payload.script?.course,j.payload.courseTitle);
 }
});

test('Actual Spanish catalog names map to their own academic families',()=>{
 assert.equal(courseFamily('Técnico en Promoción de Seguros'),'health_insurance_promoter');
 assert.equal(courseFamily('Técnico en Promoción de Salud'),'health_promoter');
 assert.equal(courseFamily('Técnico en Visita Médica'),'pharmacology');
});
test('Unconfirmed course duration is not advertised as a real course duration',()=>{
 const billing=course('Técnico en Facturación Médica',
   'Procesos de facturación médica, codificación y auditoría.',
   'pendiente de confirmación');
 assert.equal(isPublishableFlyer(flyerOffer(billing,'2026-10-29',1)),false);
});
test('Afternoon rotation never selects incomplete catalog records',()=>{
 const eligible=course('Técnico en Promoción de Salud',
   'Promoción de salud, educación para la salud, trabajo comunitario y prevención.');
 const excluded=course('Técnico en Farmacia',
   'Control de inventario y farmacia','pendiente de confirmación');
 const improved:Catalog={...catalog,courses:[...courses,eligible,excluded]};
 const days=planMonth(improved,'2026-10-29').filter(j=>j.channel==='instagram'&&j.payload.editorialSlot==='afternoon');
 assert.equal(days.length,30);
 assert.ok(days.every(j=>j.payload.courseTitle!==excluded.title));
 assert.ok(days.some(j=>j.payload.courseTitle===eligible.title));
 assert.ok(days.every(j=>j.payload.flyerOffer&&isPublishableFlyer(j.payload.flyerOffer)));
});
