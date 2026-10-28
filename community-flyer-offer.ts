import type { CatalogCourse } from './whatsapp-catalog.ts';

export type FlyerOffer = {
  course: string;
  duration: string;
  modality: string | null;
  registration: string | null;
  monthly: string | null;
  benefits: string[];
  focus: string;
  cta: string;
  dailyVariant: number;
};

const clean=(s:string)=>s.replace(/\s+/g,' ').replace(/^[\s\-•*0-9.)]+/,'').trim();
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

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
function learningSection(text:string):string[]{
  const match=text.match(/(?:^|\n)(?:Lo que aprender[aá] el estudiante|Contenidos principales|Competencias al concluir|Temas del programa)\s*:\s*([\s\S]*?)(?=\n(?:Beneficios formativos|Oportunidades laborales|Inversi[oó]n|Horario|Duraci[oó]n|Modalidad|Requisitos|Avales|Fuentes|Descripción)\s*:|$)/i);
  if(!match)return [];
  return match[1].split(/[\n;•]+/).map(clean).filter(x=>x.length>=9&&x.length<=130);
}
const concreteTopics:Array<[RegExp,string]>=[
  [/\bPDSS\b/i,'Coberturas del PDSS'],
  [/\bCIE[\s-]?10\b/i,'Clasificación CIE-10'],
  [/autorizaciones? (?:m[eé]dicas?|de servicios?)/i,'Procesos de autorizaciones médicas'],
  [/pre[\s-]?certificaci[oó]n/i,'Procesos de pre-certificación médica'],
  [/hospitalizaci[oó]n/i,'Gestión de hospitalizaciones'],
  [/emergencias?/i,'Procedimientos en emergencias'],
  [/afiliad[oa]s?/i,'Atención a los afiliados'],
  [/servicio al (?:paciente|usuario)|atenci[oó]n al (?:usuario|paciente)/i,'Atención al usuario y paciente'],
  [/farmacolog[ií]a/i,'Fundamentos de farmacología'],
  [/farmacovigilancia/i,'Farmacovigilancia'],
  [/facturaci[oó]n m[eé]dica/i,'Facturación médica'],
  [/bio[eé]tica|[eé]tica profesional/i,'Ética en el sector salud'],
  [/signos vitales/i,'Toma de signos vitales'],
  [/medicamentos/i,'Conocimiento de medicamentos'],
  [/\b87-?01\b/i,'Ley 87-01 del sistema de salud'],
  [/promoci[oó]n de salud/i,'Promoción de salud y prevención'],
  [/\bSIMON\b/i,'Herramientas de autorización SIMON'],
];
export function flyerOffer(course:CatalogCourse,date:string,variant=0):FlyerOffer {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('CM_FLYER_DATE_INVALID');
  const fromSection=learningSection(course.text);
  const topics=concreteTopics.filter(([re])=>re.test(course.text)).map(([,label])=>label);
  // Never add promises of jobs, allowances, special prices, avals or clinical
  // competencies not actually present in the official academic catalog.
  const fromDescription=(course.description||'').split(/[.;]\s+/).map(clean)
    .filter(line=>line.length>=25&&line.length<=105&&!/opciones? formativas|oferta institucional|consulta|apertura|sujeto a|formaci[oó]n profesional|sector salud dominicano|educaci[oó]n accesible/i.test(line));
  const all=[...topics,...fromSection,...fromDescription];
  const unique=all.filter((value,index)=>all.findIndex(x=>normalized(x)===normalized(value))===index);
  const day=Number(date.slice(8,10));
  const start=unique.length?((day-1+variant)%unique.length):0;
  const benefits=unique.length
    ? [unique[start],...unique.slice(start+1),...unique.slice(0,start)].slice(0,2)
    : [];
  // No generic learning claims: a course without confirmed topics is held for editorial review.
  const focus=benefits[0]||'';
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
    benefits,focus,cta,dailyVariant:day+variant*37,
  };
}
export const isPublishableFlyer=(offer:FlyerOffer)=>{
  return Boolean(offer.course&&offer.duration&&offer.registration&&offer.monthly&&offer.benefits.length&&offer.focus);
};
