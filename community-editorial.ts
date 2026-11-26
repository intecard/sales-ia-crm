import {illustrationMotif,type EditorialArt} from './community-illustration.ts';
import type {CatalogCourse} from './whatsapp-catalog.ts';
import {officialCourseEditorial} from './community-course-topics.ts';

export const CREATIVE_VERSION='v8';
export const EDITORIAL_LAYOUTS=['editorial','checklist','split','path','cards','spotlight','notebook','question','columns','dispatch','briefing','diagram','index','steps','postcard','flashcard'] as const;
export const EDITORIAL_ANGLES=['Idea clave','Error y solución','Caso ilustrativo','Lista práctica','Compara','Mini ejercicio','Pregunta resuelta','Paso a paso','Explica con claridad','Antes de actuar','Reto de aprendizaje','Guía para guardar','Decisión práctica','Claves para revisar','Verdadero o falso','Microclase','Prueba de criterio','Lo que cambia','Conversación guiada','Preparación de práctica'] as const;
export type EditorialCreative={version:'v7'|'v8';illustration?:EditorialArt;layout:typeof EDITORIAL_LAYOUTS[number];palette:number;angle:string;topic:string;headline:string;points:string[];takeaway:string;question:string;cta:string;lessonKey:string;visualKey:string};
const mod=(n:number,d:number)=>((n%d)+d)%d;
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
type Lesson={match:RegExp;meaning:string;check:string;mistake:string;action:string;example:string};
// Editorial teaching notes: process literacy, not clinical advice or a promise of coverage.
const lessons:Lesson[]=[
 {match:/cie|codific/,meaning:'Un código describe información; por sí solo no confirma cobertura.',check:'Compara la descripción del código con la documentación del caso.',mistake:'Elegir un código solo porque se parece al nombre del servicio.',action:'Consulta la clasificación aplicable y documenta las dudas para revisión.',example:'Dos descripciones parecidas pueden necesitar códigos diferentes.'},
 {match:/pdss|cobertura|seguro/,meaning:'Una cobertura debe verificarse para el servicio y el caso concretos.',check:'Identifica el plan, el servicio solicitado y la fuente consultada.',mistake:'Prometer aprobación basándose en un caso anterior.',action:'Distingue información confirmada de requisitos aún pendientes.',example:'Una persona pregunta si su servicio está cubierto: consulta antes de asegurar.'},
 {match:/87-01|ley/,meaning:'Para estudiar una norma conviene separar instituciones, funciones y procedimientos.',check:'Identifica quién participa y qué función cumple en el proceso.',mistake:'Memorizar siglas sin relacionarlas con sus funciones.',action:'Prepara un mapa de instituciones y verifica cada función en la fuente oficial.',example:'En un ejercicio, explica a qué institución dirigirías una consulta y por qué.'},
 {match:/simon/,meaning:'El resultado de una consulta debe interpretarse junto con los datos del trámite.',check:'Comprueba que la búsqueda corresponde al servicio solicitado.',mistake:'Copiar un resultado sin revisar a qué servicio corresponde.',action:'Registra la referencia consultada y las dudas que requieren confirmación.',example:'Si dos resultados se parecen, revisa sus descripciones antes de continuar.'},
 {match:/document|expediente|pre-certific|procedimiento/,meaning:'Un expediente organizado permite identificar qué información está pendiente.',check:'Revisa identificación, solicitud y documentos según el procedimiento vigente.',mistake:'Dar por completo un expediente porque contiene muchos documentos.',action:'Usa una lista de requisitos y señala lo recibido y lo pendiente.',example:'En un caso ficticio falta un documento: explica cuál se necesita y el siguiente paso.'},
 {match:/hospital|emergencia|autoriz/,meaning:'Recibir una solicitud no equivale a tener una autorización confirmada.',check:'Diferencia recepción, revisión y respuesta en el seguimiento del trámite.',mistake:'Comunicar una solicitud como aprobada antes de recibir confirmación.',action:'Registra el estado real y deriva las dudas al responsable del proceso.',example:'Un trámite sigue en revisión: comunica ese estado sin prometer un resultado.'},
 {match:/comunic|visita|promocion medica/,meaning:'Una explicación clara adapta el lenguaje a la persona que escucha.',check:'Pregunta qué necesita saber antes de ofrecer una explicación extensa.',mistake:'Usar términos técnicos sin comprobar que se entendieron.',action:'Explica una idea a la vez y pide a la persona resumir el siguiente paso.',example:'Practica una explicación breve y después reformúlala con palabras sencillas.'},
 {match:/queja|inquietud/,meaning:'Escuchar una queja permite distinguir el problema de la solución solicitada.',check:'Resume lo ocurrido y confirma que comprendiste la inquietud.',mistake:'Prometer una solución que depende de otra área.',action:'Registra la solicitud, explica el canal de revisión y comunica cómo dar seguimiento.',example:'En una simulación, responde a una inconformidad sin discutir ni inventar plazos.'},
 {match:/atencion|empati|humaniz|orientacion/,meaning:'Orientar bien significa escuchar, explicar y confirmar el siguiente paso.',check:'Identifica la necesidad de la persona antes de responder.',mistake:'Dar una respuesta automática sin escuchar la pregunta completa.',action:'Reformula la inquietud y ofrece una indicación concreta que puedas confirmar.',example:'Una persona no entiende un requisito: explícalo sin culparla por la confusión.'},
 {match:/farmacovigilancia/,meaning:'Comunicar información de seguridad exige precisión y un canal adecuado.',check:'Distingue lo observado de una interpretación no confirmada.',mistake:'Presentar una sospecha como una conclusión comprobada.',action:'Consulta el procedimiento de notificación y remite la información al responsable.',example:'Practica un registro objetivo, sin diagnosticar ni recomendar un tratamiento.'},
 {match:/farmacolog|medicamento|cientifica/,meaning:'La información sobre medicamentos debe distinguir evidencia de promoción.',check:'Identifica la fuente y separa los datos comprobables de las opiniones.',mistake:'Repetir una afirmación comercial como si fuera evidencia.',action:'Consulta la información oficial y deriva las preguntas clínicas al profesional competente.',example:'Compara dos textos: señala cuál identifica su fuente y cuál hace promesas.'},
 {match:/inventario/,meaning:'Un inventario útil registra movimientos, no solo cantidades finales.',check:'Contrasta entradas, salidas y existencias registradas.',mistake:'Corregir una diferencia sin investigar su origen.',action:'Documenta la diferencia y sigue el procedimiento de revisión.',example:'En un ejercicio con datos ficticios, identifica dónde dejó de coincidir el registro.'},
 {match:/dispens|farmacia/,meaning:'La atención en farmacia requiere precisión y respeto por el rol profesional.',check:'Comprueba la información del producto y los requisitos del procedimiento.',mistake:'Resolver una duda clínica fuera de tus competencias.',action:'Consulta al profesional responsable y comunica información verificada.',example:'Practica cómo derivar una consulta sin recomendar cambios de tratamiento.'},
 {match:/bioseguridad/,meaning:'La bioseguridad se aprende siguiendo protocolos y reconociendo los límites del rol.',check:'Identifica el protocolo aplicable antes de realizar una tarea.',mistake:'Sustituir un protocolo por una costumbre informal.',action:'Consulta al responsable cuando falte formación o una indicación clara.',example:'En una simulación, explica qué harías si no conoces el procedimiento.'},
 {match:/signos|enfermer|cuidado|auxilio/,meaning:'Un registro de cuidado debe diferenciar observaciones de interpretaciones.',check:'Describe lo observado con claridad y comunica dudas al supervisor.',mistake:'Añadir conclusiones clínicas que no te corresponde establecer.',action:'Sigue las instrucciones y protocolos del equipo responsable.',example:'Practica un reporte ficticio claro, ordenado y sin datos personales reales.'},
 {match:/factura|auditoria/,meaning:'Revisar una factura implica contrastar el registro con su soporte.',check:'Compara descripción del servicio, fecha y documentación disponible.',mistake:'Suponer que una factura es correcta porque el total parece razonable.',action:'Señala las diferencias y solicita revisión antes de confirmar.',example:'En una factura ficticia, busca un dato que no coincide con el soporte.'},
 {match:/afilia|promocion responsable/,meaning:'Orientar sobre afiliación exige distinguir requisitos de beneficios confirmados.',check:'Identifica qué información está verificada y cuál debe consultarse.',mistake:'Ofrecer beneficios que no aparecen en la información oficial.',action:'Explica los requisitos vigentes y remite dudas por el canal correspondiente.',example:'Ensaya una respuesta a una pregunta sobre beneficios sin prometer cobertura.'},
 {match:/comunit|promocion|educacion|prevencion/,meaning:'Un mensaje educativo funciona mejor cuando propone una acción comprensible.',check:'Define a quién va dirigido y qué idea necesita comprender.',mistake:'Compartir consejos sin revisar su fuente ni su pertinencia.',action:'Utiliza información confiable y adapta las palabras al público.',example:'Convierte un texto técnico en una explicación breve, sin dar indicaciones clínicas.'},
];
const fallback:Lesson={match:/.*/,meaning:'Aprender un tema implica explicarlo y practicarlo, además de recordarlo.',check:'Identifica una pregunta concreta del contenido del programa.',mistake:'Confundir conocer un término con saber aplicarlo.',action:'Escribe una explicación propia y contrástala con el material de estudio.',example:'Plantea un ejercicio ficticio y señala qué información necesitas para resolverlo.'};
export function publicationOrdinal(kind:string,variant:number){
 if(kind==='flyer')return variant===0?1:6;
 if(kind==='short')return [0,2,3,4,5,7,9,11][mod(variant,8)];
 return kind==='promo_video'?8:10;
}
export function createEditorial(course:CatalogCourse,date:string,kind:string,variant=0,revision=0):EditorialCreative{
 const day=Math.floor(Date.parse(date+'T12:00:00Z')/86400000);
 if(!Number.isFinite(day))throw Error('CM_DATE_OR_CATALOG');
 const ordinal=publicationOrdinal(kind,variant)+revision*13;
 const topics=officialCourseEditorial(course).topics;
 const index=mod(day*5+ordinal+Math.floor(revision/20),Math.max(1,topics.length));
 const topic=topics[index]?.label||'Cómo estudiar este programa';
 const question=topics[index]?.question||'¿Qué concepto te gustaría practicar?';
 const lesson=lessons.find(l=>l.match.test(norm(topic)))||fallback;
 const angleIndex=mod(day+ordinal,EDITORIAL_ANGLES.length);
 const hookTopic=topic.replace(/^./,c=>c.toLocaleLowerCase('es'));
 const variants=[
  {headline:`Una idea clave sobre ${hookTopic}`,points:[lesson.meaning,lesson.check],takeaway:lesson.action},
  {headline:`Evita este error en ${hookTopic}`,points:['Error: '+lesson.mistake,'Mejor práctica: '+lesson.action],takeaway:lesson.meaning},
  {headline:`¿Cómo resolverías este caso de ${hookTopic}?`,points:[lesson.example,lesson.check],takeaway:lesson.action},
  {headline:`Antes de empezar: ${hookTopic}`,points:[lesson.check,lesson.action],takeaway:'Anota qué puedes confirmar y qué necesitas consultar.'},
  {headline:`No es lo mismo: ${hookTopic}`,points:[lesson.meaning,'Evita: '+lesson.mistake],takeaway:lesson.action},
  {headline:`Ponlo en práctica: ${hookTopic}`,points:[lesson.example,'Tu tarea: '+lesson.action],takeaway:'Explica el motivo de tu decisión con tus propias palabras.'},
  {headline:question,points:[lesson.meaning,lesson.action],takeaway:'Comprueba tu explicación con el material oficial del programa.'},
  {headline:`Tu ruta para comprender ${hookTopic}`,points:['Primero: '+lesson.check,'Después: '+lesson.action],takeaway:lesson.meaning},
  {headline:`¿Puedes explicar ${hookTopic} sin tecnicismos?`,points:[lesson.meaning,'Ensaya: '+lesson.example],takeaway:'Resume la idea y pide a otra persona que la explique.'},
  {headline:`Una pausa útil en ${hookTopic}`,points:['Revisa: '+lesson.check,'No supongas: '+lesson.mistake],takeaway:lesson.action},
  {headline:`Reto: detecta el problema en ${hookTopic}`,points:[lesson.example,'Busca este riesgo: '+lesson.mistake],takeaway:'Propón una mejora: '+lesson.action},
  {headline:`Guarda esta guía de ${hookTopic}`,points:[lesson.meaning,lesson.check,lesson.action],takeaway:'Vuelve a esta guía cuando repases el tema.'},
  {headline:`¿Qué harías primero en ${hookTopic}?`,points:[lesson.example,'Antes de decidir: '+lesson.check],takeaway:lesson.action},
  {headline:`Dos claves para revisar ${hookTopic}`,points:[lesson.check,lesson.action],takeaway:lesson.meaning},
  {headline:`Verdadero o falso: ¿basta con memorizar ${hookTopic}?`,points:[lesson.mistake,'Comprueba tu respuesta: '+lesson.check],takeaway:lesson.meaning},
  {headline:`Microclase: ${hookTopic}`,points:[lesson.meaning,'Llévalo a la práctica: '+lesson.example],takeaway:lesson.check},
  {headline:`¿Qué dato cambiaría tu decisión sobre ${hookTopic}?`,points:[lesson.example,lesson.action],takeaway:lesson.check},
  {headline:`Lo que cambia cuando verificas ${hookTopic}`,points:[lesson.mistake,lesson.check],takeaway:'Separa lo que sabes de lo que queda por confirmar.'},
  {headline:`Así puedes explicar ${hookTopic} a otra persona`,points:[lesson.meaning,lesson.action],takeaway:lesson.example},
  {headline:`Una práctica breve sobre ${hookTopic}`,points:[lesson.example,'Antes de entregar: '+lesson.check],takeaway:'Explica qué corregirías y por qué.'},
 ];
 const selected=variants[angleIndex];
 const layout=EDITORIAL_LAYOUTS[mod(day*5+ordinal*3,EDITORIAL_LAYOUTS.length)];
 const palette=mod(day+ordinal*5,6);
 const ctas=['Guarda esta guía para tu próxima práctica.','Cuéntanos qué paso te gustaría aprender.','Comparte esta idea con alguien que esté estudiando.','¿Qué harías tú en este ejercicio?','Pide el programa y compara sus contenidos.','Escríbenos para recibir orientación sobre el curso.', 'Pide el temario y decide qué habilidad quieres practicar primero.', 'Si este es tu próximo paso, consulta horarios y opciones de inscripción.', 'Resuelve el caso y contrasta tu respuesta con la guía del programa.', 'Envíanos tu pregunta y revisamos contigo cuál programa encaja.'];
 const artSeed=(Math.imul(day,2654435761)^Math.imul(ordinal+1,1597334677)^Math.imul(index+1,2246822519))>>>0;
 const illustration={motif:illustrationMotif(topic,artSeed),seed:artSeed,frame:mod(day*3+ordinal,4)};
 return {version:'v8',illustration,layout,palette,angle:EDITORIAL_ANGLES[angleIndex],topic,...selected,question,cta:ctas[mod(day+ordinal,ctas.length)],lessonKey:`${norm(topic)}:${angleIndex}`,visualKey:`${layout}:${palette}:${index}:${day}:${ordinal}`};
}
/** Compare viewer-facing teaching content only, not dates, hashes, prices or brand boilerplate. */
export function editorialSimilarity(a:EditorialCreative,b:EditorialCreative){
 const tokens=(c:EditorialCreative)=>new Set(norm([c.headline,...c.points,c.takeaway].join(' ')).match(/[a-z0-9]+/g)||[]);
 const x=tokens(a),y=tokens(b);let overlap=0;for(const t of x)if(y.has(t))overlap++;
 return overlap/Math.max(1,new Set([...x,...y]).size);
}
export function repeatedEditorial(current:EditorialCreative,recent:EditorialCreative[]){
 return recent.some(old=>norm(old.headline)===norm(current.headline)||editorialSimilarity(current,old)>.92);
}
