import { createHash } from 'node:crypto';
import type { Catalog, CatalogCourse } from './whatsapp-catalog.ts';
import { intequitoScript, INTEQUITO, type Script } from './intequito-studio.ts';
import { flyerOffer, type FlyerOffer } from './community-flyer-offer.ts';
import { courseFamily } from './community-course-topics.ts';
export const SOCIAL_CHANNELS = ['facebook','instagram','youtube'] as const;
export type SocialChannel = typeof SOCIAL_CHANNELS[number];
export type CommunityPayload = { title: string; caption: string; courseTitle: string; kind: 'flyer'|'short'|'story'|'long_brief'|'promo_video'; pillar: string; slides: string[]; assetKey: string; catalogHash: string; editorialDate?:string;campaignMonth?:string;designSeed?:number; editorialSlot?:'morning'|'afternoon'; flyerOffer?:FlyerOffer; script?: Script };
export const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// PostgreSQL jsonb reorders object keys. Keep the original field order when
// checking persisted pieces, including the first plan already saved in production.
const normalizeJson = (value:unknown):unknown => Array.isArray(value)
  ? value.map(normalizeJson)
  : value&&typeof value==='object'
    ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,v])=>[key,normalizeJson(v)]))
    : value;
export const contentHash = (p: CommunityPayload) => sha({
  title:p.title,caption:p.caption,courseTitle:p.courseTitle,kind:p.kind,pillar:p.pillar,
  slides:p.slides,assetKey:p.assetKey,catalogHash:p.catalogHash,
  ...(p.editorialDate?{editorialDate:p.editorialDate}:{}),
  ...(p.campaignMonth?{campaignMonth:p.campaignMonth}:{}),
  ...(p.designSeed!==undefined?{designSeed:p.designSeed}:{}),
  ...(p.editorialSlot?{editorialSlot:p.editorialSlot}:{}),
  ...(p.flyerOffer?{flyerOffer:normalizeJson(p.flyerOffer)}:{}),
  ...(p.script?{script:normalizeJson(p.script)}:{}),
});
/** Text actually spoken or printed for viewers; excludes production metadata and numeric resolutions. */
export const communityPublicCopy=(payload:CommunityPayload)=>[
  payload.title,payload.caption,...payload.slides,
  ...(payload.script?.scenes.flatMap(s=>[s.dialogue,s.subtitle])||[]),
].join('\n');
/** One featured program per whole calendar month, all programs in an ongoing rotation.
 * Month #0 is 2026-10. If there are more than 12 programs the complete rotation
 * takes more than one year; no course is silently dropped.
 */
export function monthCourseIndex(date:string,count:number):number{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||count<=0)throw Error('CM_DATE_OR_CATALOG');
  const year=Number(date.slice(0,4)),month=Number(date.slice(5,7));
  if(month<1||month>12)throw Error('CM_DATE_OR_CATALOG');
  const elapsed=(year-2026)*12+(month-10);
  return ((elapsed%count)+count)%count;
}
export const featuredCourseForDate=(catalog:Catalog,date:string):CatalogCourse=>catalog.courses[monthCourseIndex(date,catalog.courses.length)];

/** The morning course is fixed, NEVER the more advanced Master's program.
 * If absent, fail closed rather than marketing an unrelated course as TAM.
 */
export const morningAuthorizationsCourse=(catalog:Catalog):CatalogCourse|null=>
  catalog.courses.find(c=>courseFamily(c.title)==='authorizations')||null;

/** Reproducible pseudo-random permutations: every other program appears once
 * before the next cycle; never pick the same course on two consecutive dates.
 * Course selection must use actual catalog objects and prices.
 */
export function afternoonCourseForDate(catalog:Catalog,date:string):CatalogCourse|null{
  const morning=morningAuthorizationsCourse(catalog);
  const others=catalog.courses.filter(c=>c.title!==morning?.title);
  if(!others.length)return null;
  const day=Math.floor(Date.parse(date+'T12:00:00Z')/86400000);
  if(!Number.isFinite(day))throw Error('CM_DATE_OR_CATALOG');
  const cycle=Math.floor(day/others.length);
  const sorted=(cy:number)=>others.map(course=>({course,weight:sha(['inteca-afternoon-v5',cy,course.title])}))
    .sort((a,b)=>a.weight.localeCompare(b.weight)).map(o=>o.course);
  const ordered=sorted(cycle);
  if(others.length>1&&cycle!==0&&ordered[0].title===sorted(cycle-1).at(-1)?.title)
    [ordered[0],ordered[1]]=[ordered[1],ordered[0]];
  const offset=((day%others.length)+others.length)%others.length;
  return ordered[offset];
}
export const editorialMonth=(date:string)=>date.slice(0,7);
export function rdDay(now: Date) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function makeContent(course: CatalogCourse, catalog: Catalog, date: string, kind: CommunityPayload['kind'], variant: number): CommunityPayload {
  const pillars = ['Educación','Educación','Educación','Educación','Educación','Educación','Empleabilidad','Empleabilidad','Empleabilidad','Empleabilidad','Empleabilidad','Demostración','Demostración','Demostración','Demostración','Confianza','Confianza','Confianza','Promoción','Promoción'];
  const pillar = pillars[(Number(date.slice(-2))*3+variant)%20];
  const hooks = [
    `¿Qué aprenderás en ${course.title}?`,
    `De la duda al aprendizaje: ${course.title}`,
    `Antes de elegir ${course.title}, conoce esto`,
    `Tu próxima habilidad: ${course.title}`,
    `Una pregunta frecuente sobre ${course.title}`,
  ];
  const seed = Number(date.slice(-2))*3+variant+(kind==='story'?2:kind==='flyer'?1:0);
  const editorialNumber=Number(date.slice(8,10));
  const offer=kind==='flyer'?flyerOffer(course,date,variant):undefined;
  const title = offer?.focus ? `Aprende sobre ${offer.focus}` : hooks[seed%hooks.length];
  const url = new URL('https://www.inteca.com.do/'); url.searchParams.set('utm_source','community');url.searchParams.set('utm_medium','organic');url.searchParams.set('utm_campaign','lisa_crecimiento');url.searchParams.set('utm_content',`${date}_${kind}_${variant}`);
  const learning = course.description || course.text.split('\n').find(l=>l.startsWith('Aprender')) || 'Consulta el contenido del programa en INTECA.';
  const facts = `Duración: ${course.duration}\nModalidad: ${course.modality || 'Consulta con INTECA'}\n${course.investment}\nHorario: ${course.schedule || catalog.generalSchedule || 'Consulta disponibilidad con INTECA'}`;
  const actions = [
    'Sigue a INTECA para descubrir más rutas de formación en salud.',
    '¿Qué te gustaría aprender de este programa? Cuéntanos tu duda en los comentarios.',
    'Guarda esta información para comparar tus opciones de formación.',
    'Comparte esta guía con alguien que esté buscando capacitarse en el sector salud.',
    'Visita el programa y consulta los pasos de inscripción en nuestro sitio oficial.',
  ];
  const cta = actions[seed%actions.length];
  const contact = `Escríbenos al WhatsApp ${INTEQUITO.phone} para solicitar información e inscribirte: ${INTEQUITO.whatsapp}`;
  const flyerCaption=offer?
    [course.title,'',offer.hook,'',
      offer.context,
      '📚 Tema destacado: '+offer.focus,
      ...offer.benefits.slice(1).map(x=>'✓ '+x),
      '',
      '⏳ Duración: '+offer.duration,
      ...(offer.modality?['💻 Modalidad: '+offer.modality]:[]),
      '💳 Inscripción: '+(offer.registration||'Por confirmar'),
      '📅 Mensualidad: '+(offer.monthly||'Por confirmar'),
      '',
      '💬 '+offer.question,
      'Cuéntanos en los comentarios y comparte esta información con alguien que quiera formarse en salud.',
      '',
      offer.cta,
      '📲 WhatsApp: '+INTEQUITO.phone,
      '💬 '+INTEQUITO.whatsapp,
      '🌐 www.inteca.com.do',
      '#INTECA #FormaciónTécnica #SectorSalud'
    ].join('\n') : null;
  const caption=(flyerCaption || [
    title, learning.slice(0,500),course.title,facts,cta,contact,url,
    '#INTECA #FormaciónTécnica #SectorSalud'
  ].join('\n\n')).slice(0,1950);
  const slides=offer?[
    [offer.hook,...offer.benefits].join('\n'),
    ['Duración: '+offer.duration,'Inscripción: '+(offer.registration||'Por confirmar'),
     'Mensualidad: '+(offer.monthly||'Por confirmar')].join('\n'),
    [offer.question,offer.cta,'WhatsApp '+INTEQUITO.phone].join('\n')
  ]:[(title+'\n'+learning).slice(0,270),facts.slice(0,400),
    cta+'\nWhatsApp '+INTEQUITO.phone+'\ninteca.com.do'];
  const editorialSlot:CommunityPayload['editorialSlot']=
    kind==='flyer'?(variant===0?'morning':'afternoon'):undefined;
  return {title:title.slice(0,95),caption,courseTitle:course.title,kind,pillar,slides,
    assetKey:sha(['inteca-premium-v5',date,course.title,kind,variant,catalog.hash]).slice(0,32),
    catalogHash:catalog.hash,editorialDate:date,campaignMonth:editorialMonth(date),
    designSeed:editorialNumber*37+variant*111,
    ...(editorialSlot?{editorialSlot}:{}),
    ...(offer?{flyerOffer:offer}:{}),
    ...(['short','promo_video'].includes(kind)?{script:intequitoScript(course,kind==='short'?'short':'long_brief',variant)}:{})};

}
/**
 * 2 original 4:5 flyers daily (9am fixed TAM; 5pm another catalog course),
 * 7 INTEQUITO reel briefs and 1 video brief. Images publish only to verified
 * Meta surfaces; scripts must NOT masquerade as finished videos.
 * 28 jobs/day, 840 jobs/30 days (fits the bounded Supabase RPC).
 */
export function planMonth(catalog:Catalog,start:string){
 const result:Array<{slot:string;channel:SocialChannel;scheduled_at:string;payload:CommunityPayload}>=[];
 if(!catalog.courses.length)return result;
 for(let day=0;day<30;day++){
   const date=new Date(start+'T12:00:00-04:00');
   date.setUTCDate(date.getUTCDate()+day);
   const d=rdDay(date);
   const morning=morningAuthorizationsCourse(catalog);
   const afternoon=afternoonCourseForDate(catalog,d);
   const slots:Array<{kind:CommunityPayload['kind'];variant:number;hour:number;minute:number;course:CatalogCourse|null}>= [
     {kind:'flyer',variant:0,hour:9,minute:0,course:morning},
     {kind:'flyer',variant:1,hour:17,minute:0,course:afternoon},
     ...[8,10,12,14,16,18,20].map((hour,i)=>({
       kind:'short' as const,variant:i,hour,minute:0,
       course:(i<4?morning:afternoon)||afternoon||morning,
     })),
     {kind:'promo_video',variant:0,hour:19,minute:30,course:afternoon||morning},
   ];
   for(const {kind,variant,hour,minute,course} of slots){
     if(!course)continue;
     const payload=makeContent(course,catalog,d,kind,variant);
     const channels:SocialChannel[]=kind==='flyer'?['facebook','instagram']:[...SOCIAL_CHANNELS];
     for(const channel of channels)result.push({
       slot:'v5:'+d+':'+kind+':'+variant+':'+channel+':'+catalog.hash.slice(0,12),
       channel,
       scheduled_at:new Date(
         d+'T'+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':00-04:00'
       ).toISOString(),
       payload,
     });
   }
 }
 return result;
}
