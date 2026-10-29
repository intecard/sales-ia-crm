import type { CatalogCourse } from './whatsapp-catalog.ts';
import { verifiedCourseTopics, type CourseFamily } from './community-course-topics.ts';

export type FlyerOffer = {
  course: string;
  duration: string;
  modality: string | null;
  registration: string | null;
  monthly: string | null;
  benefits: string[];
  focus: string;
  hook: string;
  context: string;
  question: string;
  visual: string;
  family: CourseFamily;
  cta: string;
  dailyVariant: number;
};

const clean=(s:string)=>s.replace(/\s+/g,' ').trim().replace(/^(?:[-•*]\s*|\d+[.)]\s+)/,'').trim();
function amountFromInvestment(text:string,kind:'inscripcion'|'mensualidad'):string|null {
  const re=kind==='inscripcion'
    ? /inscripci[oó]n\s*(?:de\s*)?[:\-]?\s*RD\s*\$?\s*([\d.,]+)/i
    : /mensualidad\s*(?:de\s*)?[:\-]?\s*RD\s*\$?\s*([\d.,]+)/i;
  const found=text.match(re);
  if(!found)return null;
  const digits=found[1].replace(/[.,](?=\d{3}(?:[.,]|$))/g,'').replace(',','.');
  const value=Number(digits);
  if(!Number.isFinite(value)||value<=0||value>=1_000_000)return null;
  return 'RD$'+new Intl.NumberFormat('en-US',{maximumFractionDigits:2,minimumFractionDigits:0}).format(value);
}
export function flyerOffer(course:CatalogCourse,date:string,variant=0):FlyerOffer {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('CM_FLYER_DATE_INVALID');
  const verified=verifiedCourseTopics(course,date,variant);
  const {benefits,focus,question,hook,context,visual,family}=verified;
  const day=Number(date.slice(8,10));
  const exactModality=/^(?:virtual|presencial|semipresencial|h[ií]brida|en l[ií]nea|online)(?:[., ]*)$/i.test(course.modality.trim())
    ? clean(course.modality):null;
  const cta=[
    '¡Escríbenos hoy y conoce cómo matricularte!',
    '¡Solicita orientación para inscribirte!',
    '¡Pregúntanos por tu próximo grupo!',
    '¡Da el primer paso hacia tu formación!',
    '¡Recibe los requisitos de inscripción por WhatsApp!',
    '¡Consulta fechas disponibles y cómo inscribirte!',
  ][(day-1+variant)%6];
  return {
    course:course.title, duration:clean(course.duration),
    modality:exactModality,
    registration:amountFromInvestment(course.investment,'inscripcion'),
    monthly:amountFromInvestment(course.investment,'mensualidad'),
    benefits,focus,question,hook,context,visual,family,cta,dailyVariant:day+variant*37,
  };
}
export const isPublishableFlyer=(offer:FlyerOffer)=>{
  return Boolean(offer.course&&offer.duration&&!/pendiente|por confirmar|sin definir|no establecido|consulta con/i.test(offer.duration)&&offer.registration&&offer.monthly&&offer.benefits.length&&offer.focus&&offer.hook&&offer.question);
};
