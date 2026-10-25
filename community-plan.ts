import { createHash } from 'node:crypto';
import type { Catalog, CatalogCourse } from './whatsapp-catalog.ts';
export const SOCIAL_CHANNELS = ['facebook','instagram','youtube'] as const;
export type SocialChannel = typeof SOCIAL_CHANNELS[number];
export type CommunityPayload = { title: string; caption: string; courseTitle: string; kind: 'flyer'|'short'|'story'|'long_brief'; pillar: string; slides: string[]; assetKey: string; catalogHash: string };
export const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// PostgreSQL jsonb reorders object keys. Keep the original field order when
// checking persisted pieces, including the first plan already saved in production.
export const contentHash = (p: CommunityPayload) => sha({title:p.title,caption:p.caption,courseTitle:p.courseTitle,kind:p.kind,pillar:p.pillar,slides:p.slides,assetKey:p.assetKey,catalogHash:p.catalogHash});
export function rdDay(now: Date) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function makeContent(course: CatalogCourse, catalog: Catalog, date: string, kind: CommunityPayload['kind'], variant: number): CommunityPayload {
  const pillars = ['Educación','Educación','Educación','Educación','Educación','Educación','Empleabilidad','Empleabilidad','Empleabilidad','Empleabilidad','Empleabilidad','Demostración','Demostración','Demostración','Demostración','Confianza','Confianza','Confianza','Promoción','Promoción'];
  const pillar = pillars[(Number(date.slice(-2))*3+variant)%20];
  const title = (kind==='story' ? '¿Qué quieres aprender sobre ' : variant===1 ? 'Conoce tu ruta de formación: ' : 'Qué aprenderás en ') + course.title;
  const url = new URL('https://www.inteca.com.do/'); url.searchParams.set('utm_source','community');url.searchParams.set('utm_medium','organic');url.searchParams.set('utm_campaign','lisa_30_dias');url.searchParams.set('utm_content',`${date}_${kind}_${variant}`);
  const learning = course.description || course.text.split('\n').find(l=>l.startsWith('Aprender')) || 'Consulta el contenido del programa en INTECA.';
  const facts = `Duración: ${course.duration}\nModalidad: ${course.modality || 'Consulta con INTECA'}\n${course.investment}\nHorario: ${course.schedule || catalog.generalSchedule || 'Consulta disponibilidad con INTECA'}`;
  const cta = 'Consulta el programa y los pasos de inscripción en INTECA.';
  const caption = `${learning.slice(0,650)}\n\n${course.title}\n${facts}\n\n${cta}\n${url}\n\n#INTECA #FormaciónTécnica #SectorSalud`.slice(0,1950);
  return {title:title.slice(0,95),caption,courseTitle:course.title,kind,pillar,slides:[learning.slice(0,270), facts.slice(0,400),`${cta}\ninteca.com.do`],assetKey:sha([date,course.title,kind,variant,catalog.hash]).slice(0,32),catalogHash:catalog.hash};
}
export function planMonth(catalog: Catalog, start: string) {
  const result: Array<{slot:string;channel:SocialChannel;scheduled_at:string;payload:CommunityPayload}> = [];
  for(let day=0;day<30;day++) {
    const date = new Date(`${start}T12:00:00-04:00`);date.setUTCDate(date.getUTCDate()+day);const d=rdDay(date);
    const course=catalog.courses[day%catalog.courses.length];
    const slots: Array<[CommunityPayload['kind'],number,number]> = [['short',0,12],['flyer',0,17],['short',1,19],['story',0,9],['story',1,15],['story',2,20]];
    if(day%7===0&&day<28)slots.push(['long_brief',0,11]);
    for(const [kind,variant,hour] of slots) {
      const payload=makeContent(course,catalog,d,kind,variant);
      const channels: SocialChannel[]=kind==='story'?['instagram']:kind==='flyer'?['facebook','instagram']:kind==='long_brief'?['youtube']:[...SOCIAL_CHANNELS];
      for(const channel of channels) result.push({slot:`${d}:${kind}:${variant}:${channel}`,channel,scheduled_at:new Date(`${d}T${String(hour).padStart(2,'0')}:00:00-04:00`).toISOString(),payload});
    }
  }
  return result;
}
