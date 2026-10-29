import type {CatalogCourse} from './whatsapp-catalog.ts';

/**
 * Per-program editorial allowlists. Never treat a shared word in the catalog
 * as permission to market one course with a DIFFERENT course's competencies.
 * A topic is allowed only when its regex is present in THAT course's own
 * parsed program record. No cross-course fallbacks, no invented assurances.
 */
export type CourseFamily =
 'authorizations'|'master_authorizations'|'precertification'|'patient_service'|
 'pharmacology'|'nursing'|'health_insurance_promoter'|'health_promoter'|
 'medical_billing'|'pharmacy'|'unknown';
type TopicSpec={pattern:RegExp;label:string;question:string};
type Profile={hook:string;context:string;topics:TopicSpec[];visual:string};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function courseFamily(title:string):CourseFamily{
 const t=norm(title);
 if(/pre[\s-]?certific/.test(t))return 'precertification';
 if(/atencion al (?:usuario|paciente)/.test(t))return 'patient_service';
 if(/farmacologia|visitador|visita medica/.test(t))return 'pharmacology';
 if(/enfermer/.test(t))return 'nursing';
 if(/promotor.*segur|promocion de seguros/.test(t))return 'health_insurance_promoter';
 if(/promotor.*salud|promocion de salud/.test(t))return 'health_promoter';
 if(/master.*autoriz/.test(t))return 'master_authorizations';
 if(/autoriz/.test(t))return 'authorizations';
 if(/factur/.test(t))return 'medical_billing';
 if(/farmacia/.test(t))return 'pharmacy';
 return 'unknown';
}
const topic=(pattern:RegExp,label:string,question:string):TopicSpec=>({pattern,label,question});
const profiles:Record<CourseFamily,Profile>={
 authorizations:{
  hook:'¡Aprende a gestionar autorizaciones médicas con criterio!',
  context:'Conoce los procesos que conectan cobertura, prestación y gestión de servicios de salud.',
  visual:'GESTIÓN DE AUTORIZACIONES',
  topics:[
   topic(/autorizaci[oó]n|autorizaciones/i,'Gestión de autorizaciones médicas','¿Qué datos revisarías antes de solicitar una autorización?'),
   topic(/\bPDSS\b/i,'Coberturas del PDSS','¿Sabes qué es el PDSS y cómo se consulta una cobertura?'),
   topic(/\bley\s*87[\s-]?01\b|\b87[\s-]?01\b/i,'Ley 87-01 del sistema de salud','¿Conoces lo que regula la Ley 87-01?'),
   topic(/\bCIE[\s-]?10\b/i,'Clasificación CIE-10','¿Para qué se utiliza la clasificación CIE-10?'),
   topic(/\bSIMON\b/i,'Herramienta SIMON','¿Has utilizado SIMON para consultar información?'),
   topic(/hospitalizaci[oó]n/i,'Autorizaciones de hospitalización','¿Qué diferencia una autorización hospitalaria?'),
   topic(/emergencia/i,'Procesos de emergencias','¿Cómo se gestiona una autorización en emergencias?'),
   topic(/cobertur/i,'Validación de coberturas','¿Por qué es importante comprobar la cobertura antes de gestionar?'),
  ],
 },
 master_authorizations:{
  hook:'Profundiza en la gestión especializada de autorizaciones médicas.',
  context:'Amplía tus conocimientos de procesos administrativos y cobertura en salud.',
  visual:'ESPECIALIZACIÓN EN AUTORIZACIONES',
  topics:[
   topic(/autorizaci[oó]n|autorizaciones/i,'Procesos avanzados de autorizaciones','¿Qué decisiones requieren una revisión cuidadosa?'),
   topic(/\bPDSS\b/i,'Análisis del PDSS','¿Conoces cómo se estructura la cobertura del PDSS?'),
   topic(/\bCIE[\s-]?10\b/i,'Codificación CIE-10','¿Cómo influye la codificación en los trámites?'),
   topic(/cobertur/i,'Evaluación de coberturas','¿Cuándo debes revisar los límites de cobertura?'),
   topic(/pre[\s-]?certific/i,'Pre-certificaciones médicas','¿Qué cambia entre autorizaciones y pre-certificaciones?'),
   topic(/hospitalizaci[oó]n/i,'Procesos de hospitalización','¿Qué documentación puede requerirse en una hospitalización?'),
  ],
 },
 precertification:{
  hook:'Comprende cómo funcionan las pre-certificaciones médicas.',
  context:'Aprende a revisar requisitos y documentación previa a determinados servicios.',
  visual:'PRE-CERTIFICACIÓN CLÍNICA',
  topics:[
   topic(/pre[\s-]?certific/i,'Procesos de pre-certificación','¿Qué se verifica antes de una pre-certificación?'),
   topic(/documentaci[oó]n|expediente/i,'Revisión de documentos','¿Qué información debe estar completa en un expediente?'),
   topic(/cobertur/i,'Validación previa de coberturas','¿Por qué revisar la cobertura antes de un procedimiento?'),
   topic(/\bPDSS\b/i,'Consulta del PDSS','¿Sabías que el PDSS describe coberturas del plan?'),
   topic(/procedimiento/i,'Gestión de procedimientos','¿Qué pasos debes verificar antes de tramitar un servicio?'),
  ],
 },
 patient_service:{
  hook:'Aprende a ofrecer una atención humana y profesional.',
  context:'La calidad de la atención comienza por escuchar, orientar y comunicar.',
  visual:'ATENCIÓN AL USUARIO',
  topics:[
   topic(/atenci[oó]n al (?:usuario|paciente)|servicio al (?:usuario|paciente)/i,'Atención al usuario y al paciente','¿Qué hace que un paciente se sienta bien atendido?'),
   topic(/comunicaci[oó]n/i,'Comunicación efectiva','¿Cómo explicarías un trámite de manera clara?'),
   topic(/empat[ií]a|humaniz/i,'Atención empática y humanizada','¿Por qué importa la empatía en los servicios de salud?'),
   topic(/queja|reclamo/i,'Manejo de inquietudes y quejas','¿Cómo responderías a un usuario inconforme?'),
   topic(/orientaci[oó]n|afiliad/i,'Orientación al afiliado','¿Sabes cómo orientar sin prometer una cobertura no confirmada?'),
  ],
 },
 pharmacology:{
  hook:'Domina los fundamentos de farmacología para la visita médica.',
  context:'Comprende la información farmacológica y su comunicación profesional.',
  visual:'FARMACOLOGÍA APLICADA',
  topics:[
   topic(/farmacolog/i,'Fundamentos de farmacología','¿Por qué es importante comprender la acción de los medicamentos?'),
   topic(/medicamentos|f[aá]rmacos/i,'Conocimiento de medicamentos','¿Qué información sobre un medicamento debe comunicarse con rigor?'),
   topic(/visitad|visita m[eé]dica/i,'Comunicación en la visita médica','¿Qué cualidad es clave en una visita médica profesional?'),
   topic(/farmacovigilancia/i,'Farmacovigilancia','¿Por qué deben notificarse posibles reacciones adversas?'),
   topic(/promoci[oó]n m[eé]dica/i,'Información científica para promoción médica','¿Cómo diferenciar evidencia de una promesa comercial?'),
  ],
 },
 nursing:{
  hook:'Prepárate para apoyar el cuidado seguro del paciente.',
  context:'Conoce fundamentos de asistencia y cuidado dentro de las competencias del auxiliar.',
  visual:'CUIDADO Y ENFERMERÍA',
  topics:[
   topic(/enfermer|auxiliar/i,'Fundamentos de enfermería','¿Cuál es el papel de un auxiliar de enfermería?'),
   topic(/signos vitales/i,'Control de signos vitales','¿Por qué es importante el registro de signos vitales?'),
   topic(/bioseguridad/i,'Principios de bioseguridad','¿Cómo contribuye la bioseguridad al cuidado del paciente?'),
   topic(/cuidado del paciente/i,'Cuidados básicos del paciente','¿Qué significa brindar cuidados con respeto?'),
   topic(/primeros auxilios/i,'Fundamentos de primeros auxilios','¿Por qué importa aprender a actuar de forma segura?'),
   topic(/\bPAE\b|proceso de atenci[oó]n/i,'Proceso de atención de enfermería','¿Conoces las etapas del proceso de atención de enfermería?'),
  ],
 },
 health_insurance_promoter:{
  hook:'Conoce cómo funciona la orientación en seguros de salud.',
  context:'Aprende conceptos útiles para comprender los seguros y la afiliación.',
  visual:'SEGUROS DE SALUD',
  topics:[
   topic(/segur(o|os) de salud/i,'Conceptos de seguros de salud','¿Qué diferencia un seguro de salud de un servicio particular?'),
   topic(/afiliaci[oó]n|afiliad/i,'Orientación sobre afiliación','¿Qué información necesita una persona antes de afiliarse?'),
   topic(/cobertur/i,'Información de coberturas','¿Por qué debe verificarse una cobertura antes de prometerla?'),
   topic(/\b87[\s-]?01\b/i,'Bases de la Ley 87-01','¿Qué instituciones participan en el sistema de seguridad social?'),
   topic(/promoci[oó]n|promotor/i,'Promoción responsable de seguros','¿Qué significa orientar a un afiliado de manera responsable?'),
  ],
 },
 health_promoter:{
  hook:'Ayuda a impulsar la educación y prevención en salud.',
  context:'La promoción de salud comienza con información comprensible y responsable.',
  visual:'PROMOCIÓN DE SALUD',
  topics:[
   topic(/promoci[oó]n de salud|promotor/i,'Promoción de salud','¿Cómo ayudarías a difundir información útil en tu comunidad?'),
   topic(/prevenci[oó]n/i,'Prevención en salud','¿Por qué prevenir es tan importante como atender?'),
   topic(/educaci[oó]n/i,'Educación para la salud','¿Qué hábito saludable enseñarías hoy?'),
   topic(/comunidad|comunitari/i,'Trabajo comunitario','¿Cómo construirías confianza con tu comunidad?'),
  ],
 },
 medical_billing:{
  hook:'Conoce los fundamentos de facturación en salud.',
  context:'Aprende a organizar y revisar procesos de facturación médica.',
  visual:'FACTURACIÓN MÉDICA',
  topics:[
   topic(/facturaci[oó]n/i,'Procesos de facturación médica','¿Por qué es importante registrar correctamente un servicio?'),
   topic(/auditor[ií]a/i,'Revisión de facturas','¿Qué datos revisarías antes de presentar una factura?'),
   topic(/codificaci[oó]n|\bCIE[\s-]?10\b/i,'Codificación relacionada con facturación','¿Qué papel cumplen los códigos en la facturación médica?'),
   topic(/cobertur/i,'Validación de cobertura','¿Qué sucede cuando una cobertura se registra incorrectamente?'),
  ],
 },
 pharmacy:{
  hook:'Conoce las bases de una gestión responsable en farmacia.',
  context:'Aprende sobre productos farmacéuticos y atención responsable.',
  visual:'FORMACIÓN EN FARMACIA',
  topics:[
   topic(/farmacia/i,'Procesos de farmacia','¿Qué implica una atención profesional en farmacia?'),
   topic(/medicamentos/i,'Conocimiento de medicamentos','¿Por qué es importante comprobar la información de un medicamento?'),
   topic(/inventario/i,'Control de inventario','¿Qué riesgos reduce un buen control de inventario?'),
   topic(/dispensaci[oó]n/i,'Procedimientos de dispensación','¿Qué debe verificarse al dispensar un producto?'),
  ],
 },
 unknown:{hook:'Conoce una nueva formación técnica.',context:'Consulta los contenidos y requisitos oficiales.',visual:'FORMACIÓN TÉCNICA',topics:[]},
};
export function officialCourseEditorial(course:CatalogCourse){
 const family=courseFamily(course.title);
 const profile=profiles[family];
 const contents=(course.text||'').normalize('NFC');
 const topics=profile.topics.filter(t=>t.pattern.test(contents));
 return {family,hook:profile.hook,context:profile.context,visual:profile.visual,topics};
}
export function verifiedCourseTopics(course:CatalogCourse,date:string,variant=0){
 const editorial=officialCourseEditorial(course);
 const day=Math.floor(Date.parse(date+'T12:00:00Z')/86400000);
 const len=editorial.topics.length;
 if(!len)return {...editorial,benefits:[] as string[],focus:'',question:''};
 const start=((day+variant)%len+len)%len;
 const ordered=[...editorial.topics.slice(start),...editorial.topics.slice(0,start)];
 return {...editorial,benefits:ordered.slice(0,3).map(t=>t.label),focus:ordered[0].label,question:ordered[0].question};
}
