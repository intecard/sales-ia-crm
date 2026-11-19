import type { Conversation } from './whatsapp-conversation.ts';
import { catalogReply, findCourses, type Catalog } from './whatsapp-catalog.ts';
import type { SalesOpportunity } from './sales-agent.ts';

// Verified, brief sales guidance remains available during AI provider outages.
export function salesCoachingReply(
  catalog: Catalog | null,
  conversation: Conversation,
  text: string,
  state?: Pick<SalesOpportunity, 'stage' | 'control'>,
) {
  if (
    !catalog ||
    state?.control === 'human' ||
    state?.control === 'opted_out' ||
    state?.stage === 'won' ||
    state?.stage === 'payment_review'
  )
    return null;
  const value = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const matches = findCourses(
    catalog,
    conversation.facts.lastDiscussedCourse || conversation.facts.course || '',
  );
  const course = matches.length === 1 ? matches[0] : null;
  if (
    /muy caro|costoso|no (?:tengo|me alcanza).{0,20}(?:dinero|presupuesto)|descuento|rebaja/.test(
      value,
    )
  ) {
    return {
      reply: course?.investment
        ? `Entiendo que necesitas cuidar tu presupuesto. Para ${course.title}, el plan oficial es: ${course.investment}\n\nNo tengo un descuento autorizado. ¿Lo que se te dificulta es la inscripción o los pagos posteriores?`
        : 'Entiendo que necesitas cuidar tu presupuesto. ¿Qué programa estás considerando para revisar su plan de pagos oficial?',
      awaiting: '' as const,
    };
  }
  if (
    /no (?:tengo|puedo).{0,20}(?:tiempo|horario)|no me (?:sirve|conviene).{0,15}horario/.test(value)
  ) {
    const schedule = course
      ? catalogReply(catalog, conversation, `¿Cuál es el horario de ${course.title}?`)
      : null;
    return {
      reply: schedule
        ? `Revisemos una opción que se ajuste a tu tiempo.\n\n${schedule.reply}\n\n¿Qué día y turno te sería posible?`
        : '¿Qué programa y horario necesitas? Revisaré las opciones publicadas antes de proponerte una.',
      awaiting: '' as const,
    };
  }
  if (/lo (?:voy a )?pensar[eé]|lo pienso|no estoy segur|tengo dudas/.test(value))
    return {
      reply:
        'Claro, puedes tomar tu decisión con calma. ¿Qué necesitas aclarar primero: el contenido del programa, el horario o el plan de pagos?',
      awaiting: '' as const,
    };
  if (/estafa|es confiable|como se que|tienen aval|esta acreditad/.test(value))
    return {
      reply:
        'Es razonable verificar antes de pagar. Puedo explicarte lo que figura en el catálogo y pedir revisión humana de la documentación institucional. ¿Qué aval o documento necesitas comprobar?',
      awaiting: '' as const,
    };
  return null;
}
