import { createHash } from 'node:crypto';
import type { Catalog, CatalogCourse } from './whatsapp-catalog.ts';
import { intequitoScript, INTEQUITO, type Script } from './intequito-studio.ts';
export const SOCIAL_CHANNELS = ['facebook','instagram','youtube'] as const;
export type SocialChannel = typeof SOCIAL_CHANNELS[number];
export type CommunityPayload = { title: string; caption: string; courseTitle: string; kind: 'flyer'|'short'|'story'|'long_brief'|'promo_video'; pillar: string; slides: string[]; assetKey: string; catalogHash: string; script?: Script };
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
  ...(p.script?{script:normalizeJson(p.script)}:{}),
});
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
  const title = hooks[seed%hooks.length];
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
  const caption = `${title}\n\n${learning.slice(0,650)}\n\n${course.title}\n${facts}\n\n${cta}\n${contact}\n${url}\n\n#INTECA #FormaciónTécnica #SectorSalud`.slice(0,1950);
  return {title:title.slice(0,95),caption,courseTitle:course.title,kind,pillar,slides:[`${title}\n${learning}`.slice(0,270), facts.slice(0,400),`${cta}\nWhatsApp ${INTEQUITO.phone}\ninteca.com.do`],assetKey:sha(['intequito-v2',date,course.title,kind,variant,catalog.hash]).slice(0,32),catalogHash:catalog.hash,...(['short','promo_video'].includes(kind)?{script:intequitoScript(course,kind==='short'?'short':'long_brief',variant)}:{})};
}
/**
 * 9 obras creativas por día, reutilizables entre plataformas:
 * 1 post, 7 reels, 1 vídeo informativo/promocional.
 * Los vídeos son GUIONES (brief) hasta habilitar la animación 3D real; nunca publicarlos como slideshows.
 * El post sí se publica por canales de imagen si las credenciales están verificadas.
 */
export function planMonth(catalog: Catalog, start: string) {
  const result: Array<{slot:string;channel:SocialChannel;scheduled_at:string;payload:CommunityPayload}> = [];
  if(!catalog.courses.length) return result;
  for(let day=0;day<30;day++) {
    const date = new Date(`${start}T12:00:00-04:00`);date.setUTCDate(date.getUTCDate()+day);const d=rdDay(date);
    const slots:Array<[CommunityPayload['kind'],number,number,number]> = [
      ['flyer',0,9,0],
      ['short',0,10,0],['short',1,11,1],['short',2,12,2],
      ['short',3,13,3],['short',4,15,4],['short',5,17,5],['short',6,19,6],
      ['promo_video',0,20,7],
    ];
    for(const [kind,variant,hour,offset] of slots) {
      const course=catalog.courses[(day+offset)%catalog.courses.length];
      const payload=makeContent(course,catalog,d,kind,variant);
      const channels:SocialChannel[]=kind==='flyer'?['facebook','instagram']:[...SOCIAL_CHANNELS];
      for(const channel of channels) result.push({
        slot:`v2:${d}:${kind}:${variant}:${channel}`,
        channel,
        scheduled_at:new Date(`${d}T${String(hour).padStart(2,'0')}:00:00-04:00`).toISOString(),
        payload,
      });
    }
  }
  return result;
}
