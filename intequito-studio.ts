/** Guion técnico, basado exclusivamente en el catálogo institucional. No representa un video renderizado. */
import type { CatalogCourse } from './whatsapp-catalog.ts';
export const INTEQUITO = Object.freeze({
  name:'INTEQUITO',
  reference:'/intequito-oficial.png',
  phone:'809-643-5502',
  whatsapp:'https://wa.me/18096435502',
  locale:'es-DO',
  style:'Personaje 3D oficial: cabello castaño, ojos marrones, audífonos azules con micrófono, polo INTECA blanco/turquesa, credencial, jeans y tenis azules. No alterar rostro, logo, proporciones ni colores.',
  voice:'Español latino natural, tono dominicano neutro, amable y profesional; misma voz y lip-sync en todos los planos.'
});
export type Scene={from:number;to:number;location:string;action:string;camera:string;dialogue:string;subtitle:string;audio:string};
export type Script={actor:'INTEQUITO';reference:string;duration:45|60;format:'9:16';course:string;objective:string;scenes:Scene[];requirements:string[];state:'guion_pendiente_de_render_3d'};
const compact=(v:string|undefined,fallback:string)=>v?.trim()||fallback;
export function intequitoScript(course:CatalogCourse,kind:'short'|'long_brief',variant=0):Script {
  const long=kind==='long_brief', duration=long?60:45;
  const courseTitle=course.title;
  const benefit=compact(course.description,'Aprende competencias aplicables al sector profesional.');
  const facts=[course.duration&&`duración de ${course.duration}`,course.modality&&`modalidad ${course.modality}`,course.investment].filter(Boolean).join(', ');
  const hooks=[
    `¿Sabías que puedes prepararte en ${courseTitle}?`,
    `Tu formación profesional puede empezar con una decisión.`,
    `¿Conoces las habilidades que desarrolla ${courseTitle}?`,
    `Una pregunta frecuente: ¿qué aprenderás en ${courseTitle}?`,
    `INTEQUITO te explica cómo dar el siguiente paso.`,
    `Explora una nueva ruta de aprendizaje en INTECA.`,
    `Conoce los datos reales de esta formación técnica.`
  ];
  const hook=hooks[variant%hooks.length];
  const timings=long?[[0,4],[4,14],[14,32],[32,45],[45,54],[54,60]]:[[0,3],[3,10],[10,25],[25,35],[35,45]];
  const locations=['Recepción moderna del instituto','Área profesional relacionada con el curso','Aula técnica con paneles informativos','Entorno de práctica ilustrativa','Pantalla institucional de datos','Cierre con logo y contacto'];
  const dialogue=long?
    [hook,`A veces lo más difícil es elegir por dónde empezar. En INTECA te orientamos con información clara.`,`Hoy te presento ${courseTitle}. ${benefit.slice(0,170)}`,`Imagina una situación formativa donde aplicas lo aprendido, siempre con ética y cuidado profesional.`,`Datos del programa: ${facts}.`,`Solicita información al 809-643-5502. ¡Soy INTEQUITO, y te esperamos en INTECA!`]:
    [hook,`Elegir una formación requiere información confiable y objetivos claros.`,`En INTECA puedes conocer ${courseTitle}. ${benefit.slice(0,145)}`,`Te muestro cómo estas competencias se relacionan con escenarios profesionales ilustrativos.`,`Consulta ${facts}. Escríbenos al 809-643-5502. ¡Te habla INTEQUITO!`];
  return {actor:'INTEQUITO',reference:INTEQUITO.reference,duration,format:'9:16',course:courseTitle,objective:'Educar, invitar a comentar o compartir y captar consultas reales para la inscripción',
    scenes:timings.map(([from,to],i)=>({from,to,location:locations[i]||locations[5],action:`INTEQUITO visible, caminando o gesticulando, expresiones faciales fluidas; continuidad estricta. ${i===timings.length-1?'Señala teléfono y logo, mira a cámara.':'Interactúa con objetos del escenario sin ocultar el uniforme.'}`,camera:i===0?'Travelling de aproximación':i===timings.length-1?'Plano medio de cierre':'Plano medio con movimiento cinematográfico suave',dialogue:dialogue[i],subtitle:dialogue[i],audio:'Voz única de INTEQUITO; doblaje en español, labios sincronizados; música instrumental de licencia comercial y ducking.'})),
    requirements:['Usar la imagen de referencia oficial suministrada, o un modelo 3D riggeado de INTEQUITO.','No inventar certificaciones, cupos, fechas ni testimonios.','Validar duración real, subtítulos SRT, lip-sync y pronunciación.','Entregar video MP4 1080 × 1920, audio, subtítulos incrustados y versión SRT.','Requerir proveedor real de animación y voz; este guion NO es un video terminado.','Toda promoción pagada requiere presupuesto y autorización explícitos.'],state:'guion_pendiente_de_render_3d'};
}
