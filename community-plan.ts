import { createHash } from 'node:crypto';
import type { Catalog, CatalogCourse } from './whatsapp-catalog.ts';
import { intequitoScript, INTEQUITO, type Script } from './intequito-studio.ts';
import { flyerOffer, isPublishableFlyer, type FlyerOffer } from './community-flyer-offer.ts';
import { createEditorial, type EditorialCreative } from './community-editorial.ts';
import { courseFamily } from './community-course-topics.ts';
export const SOCIAL_CHANNELS = ['facebook','instagram','youtube'] as const;
/** Bounded rolling preview, replenished every Dominican calendar day without an end date. */
export const COMMUNITY_ROLLING_HORIZON_DAYS = 30;
export const COMMUNITY_SCHEDULE_MODE = 'rolling_perpetual' as const;
export type SocialChannel = typeof SOCIAL_CHANNELS[number];
export type CommunityPayload = { creative?:EditorialCreative; title: string; caption: string; courseTitle: string; kind: 'flyer'|'short'|'story'|'long_brief'|'promo_video'|'avatar_video'; pillar: string; slides: string[]; assetKey: string; catalogHash: string; editorialDate?:string;campaignMonth?:string;designSeed?:number; editorialSlot?:'morning'|'afternoon'; flyerOffer?:FlyerOffer; script?: Script };
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
  ...(p.creative?{creative:normalizeJson(p.creative)}:{}),
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
  const others=catalog.courses.filter(c=>c.title!==morning?.title&&isPublishableFlyer(flyerOffer(c,date,1)));
  if(!others.length)return null;
  const day=Math.floor(Date.parse(date+'T12:00:00Z')/86400000);
  if(!Number.isFinite(day))throw Error('CM_DATE_OR_CATALOG');
  const cycle=Math.floor(day/others.length);
  const sorted=(cy:number)=>others.map(course=>({course,weight:sha(['inteca-afternoon-v6',cy,course.title])}))
    .sort((a,b)=>a.weight.localeCompare(b.weight)).map(o=>o.course);
  const ordered=sorted(cycle);
  if(others.length>1&&cycle!==0&&ordered[0].title===sorted(cycle-1).at(-1)?.title)
    [ordered[0],ordered[1]]=[ordered[1],ordered[0]];
  const offset=((day%others.length)+others.length)%others.length;
  return ordered[offset];
}
export const editorialMonth=(date:string)=>date.slice(0,7);
export function rdDay(now: Date) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function makeContent(course: CatalogCourse, catalog: Catalog, date: string, kind: CommunityPayload['kind'], variant: number, revision=0): CommunityPayload {
  const editorialNumber=Number(date.slice(8,10));
  const offer=kind==='flyer'?flyerOffer(course,date,variant):undefined;
  const url = new URL('https://www.inteca.com.do/');
  url.searchParams.set('utm_source','community');url.searchParams.set('utm_medium','organic');
  url.searchParams.set('utm_campaign','aprende_con_inteca');url.searchParams.set('utm_content',`${date}_${kind}_${variant}`);
  const investment=offer?`Inscripción: ${offer.registration||'Por confirmar'}\nMensualidad: ${offer.monthly||'Por confirmar'}`:course.investment;
  const facts = `Duración: ${course.duration}\nModalidad: ${offer?(offer.modality||'Consulta con INTECA'):(course.modality||'Consulta con INTECA')}\n${investment}\nHorario: ${course.schedule || catalog.generalSchedule || 'Consulta disponibilidad con INTECA'}`;
  const contact = `📲 WhatsApp: ${INTEQUITO.phone} · Información e inscripción: ${INTEQUITO.whatsapp}`;
  const editorialSlot:CommunityPayload['editorialSlot']=
    kind==='flyer'?(variant===0?'morning':'afternoon'):undefined;
  const creative=createEditorial(course,date,kind,variant,revision);
  const educationalCaption=[creative.headline,'Tema del programa: '+creative.topic,...creative.points,
    creative.takeaway,creative.question,creative.cta,course.title,facts,contact,url,
    '#INTECA #AprendeConINTECA #FormaciónTécnica'].join('\n\n').slice(0,1950);
  const educationalSlides=[creative.headline+'\n'+creative.points[0],creative.points.join('\n'),creative.takeaway+'\n'+creative.question];
  const script=['short','promo_video','avatar_video'].includes(kind)?intequitoScript(course,kind==='short'?'short':'long_brief',variant):undefined;
  if(script){
    const dialogues=[creative.headline,'Soy INTEQUITO, de INTECA. Hoy: '+creative.topic,
      creative.points.join(' '),creative.takeaway,creative.question+' '+creative.cta,
      course.title+'. '+facts.replace(/\n/g,', ')+'. WhatsApp 809-643-5502.'];
    if(script.scenes.length===5)dialogues.splice(3,2,creative.takeaway+' '+creative.question);
    script.scenes=script.scenes.map((scene,i)=>({...scene,dialogue:dialogues[Math.min(i,dialogues.length-1)],subtitle:dialogues[Math.min(i,dialogues.length-1)]}));
  }
  return {creative,title:creative.headline.slice(0,95),caption:educationalCaption,courseTitle:course.title,kind,pillar:creative.angle,slides:educationalSlides,
    assetKey:sha(['inteca-editorial-v8',date,course.title,kind,variant,revision,catalog.hash]).slice(0,32),
    catalogHash:catalog.hash,editorialDate:date,campaignMonth:editorialMonth(date),
    designSeed:editorialNumber*37+variant*111,
    ...(editorialSlot?{editorialSlot}:{}),
    ...(offer?{flyerOffer:offer}:{}),
    ...(script?{script}:{})};

}
/**
 * 2 original 4:5 flyers daily (9am fixed TAM; 5pm another catalog course),
 * 8 original vertical reels daily on Facebook and Instagram, 1 standard YouTube
 * video plus 1 INTEQUITO speaking-avatar script daily at 21:00 RD.
 * Standard MP4s are rendered locally; avatar scripts are prepared for approved
 * professional production, NOT auto-billed, silently rendered, or published.
 * The 30-day database horizon renews DAILY, so the schedule never expires.
 * 22 jobs/day, 660 in the renewable 30-day window.
 */
export function planMonth(catalog:Catalog,start:string){
 const result:Array<{slot:string;channel:SocialChannel;scheduled_at:string;payload:CommunityPayload}>=[];
 if(!catalog.courses.length)return result;
 for(let day=0;day<COMMUNITY_ROLLING_HORIZON_DAYS;day++){
   const date=new Date(start+'T12:00:00-04:00');
   date.setUTCDate(date.getUTCDate()+day);
   const d=rdDay(date);
   const morning=morningAuthorizationsCourse(catalog);
   const afternoon=afternoonCourseForDate(catalog,d);
   const slots:Array<{kind:CommunityPayload['kind'];variant:number;hour:number;minute:number;course:CatalogCourse|null}>= [
     {kind:'flyer',variant:0,hour:9,minute:0,course:morning},
     {kind:'flyer',variant:1,hour:17,minute:0,course:afternoon},
     ...[8,10,12,14,16,18,20,22].map((hour,i)=>({
       kind:'short' as const,variant:i,hour,minute:0,
       course:(i<4?morning:afternoon)||afternoon||morning,
     })),
     {kind:'promo_video',variant:0,hour:19,minute:30,course:afternoon||morning},
     // Prepared indefinitely, but never sent to paid avatar API without consent/credits.
     {kind:'avatar_video',variant:0,hour:21,minute:0,course:morning||afternoon},
   ];
   for(const {kind,variant,hour,minute,course} of slots){
     if(!course)continue;
     const payload=makeContent(course,catalog,d,kind,variant);
     const channels:SocialChannel[]=(kind==='promo_video'||kind==='avatar_video')?['youtube']:['facebook','instagram'];
     for(const channel of channels)result.push({
       slot:'v6:'+d+':'+kind+':'+variant+':'+channel+':'+catalog.hash.slice(0,12)+(kind==='short'||kind==='promo_video'?':autorender-20261029':kind==='avatar_video'?':avatar-brief-20261030':'')+':editorial-v8',
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
