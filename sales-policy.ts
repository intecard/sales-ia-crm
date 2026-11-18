import type { Conversation } from './whatsapp-conversation.ts';

export const USD_OFFER =
  'Para residentes fuera de República Dominicana que pagan en dólares: inscripción US$60 y 5 pagos de US$30. Total del plan: US$210. Las comisiones y la conversión bancaria se confirman antes de transferir.';
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function rememberSalesPreferences(conversation: Conversation, text: string) {
  const value = normalize(text);
  const facts = conversation.facts;
  if (/\b(?:no vivo fuera|vivo en (?:rd|republica dominicana|santo domingo))\b/.test(value))
    facts.residesAbroad = false;
  else if (
    /\b(?:vivo|resido|estoy|soy residente)\b.{0,35}\b(?:fuera|extranjero|estados unidos|usa|ee\.?uu|espana|puerto rico|canada|europa|new york|nueva york|miami|colombia|mexico|chile|argentina|venezuela|peru|ecuador|panama|costa rica|alemania|italia|francia|suiza|reino unido)\b/.test(
      value,
    )
  )
    facts.residesAbroad = true;
  if (
    /\b(?:pagar|pago|pagare|prefiero)\b.{0,20}(?:pesos|dop)|no (?:pago|pagare|quiero pagar) en dolares/.test(
      value,
    )
  )
    facts.paymentCurrency = 'DOP';
  else if (
    /\b(?:pagar|pago|pagare|prefiero|precio|cuesta|costo)\b.{0,25}(?:dolares|usd)|(?:dolares|usd).{0,20}(?:pagar|pago)/.test(
      value,
    )
  )
    facts.paymentCurrency = 'USD';
  if (
    /no (?:me )?(?:escribas|contactes|envies)|no quiero (?:mas )?(?:mensajes|seguimiento|recordatorios)/.test(
      value,
    )
  )
    facts.followUpConsent = 'no';
  else if (
    /puedes? (?:escribirme|contactarme|recordarme)|escribeme (?:luego|manana|despues)|autorizo.{0,30}(?:seguimiento|mensajes)|si.{0,15}(?:envienme|enviame).{0,20}recordatorio/.test(
      value,
    )
  )
    facts.followUpConsent = 'yes';
}

export const usesInternationalUsd = (conversation: Conversation) =>
  conversation.facts.residesAbroad === true && conversation.facts.paymentCurrency === 'USD';
export function internationalCatalog<
  T extends { text: string; courses: Array<{ investment: string; text: string }> },
>(catalog: T, conversation: Conversation): T {
  if (!usesInternationalUsd(conversation)) return catalog;
  return {
    ...catalog,
    text: catalog.text.replace(/^Inversión:.*$/gm, `Inversión: ${USD_OFFER}`),
    courses: catalog.courses.map((course) => ({
      ...course,
      investment: USD_OFFER,
      text: course.text.replace(/^Inversión:.*$/gm, `Inversión: ${USD_OFFER}`),
    })),
  };
}

export function internationalPriceReply(conversation: Conversation, text: string) {
  const value = normalize(text);
  const relevant = /dolar|usd|extranj|fuera|vivo|resido|residente/.test(value);
  if (!relevant) return null;
  if (usesInternationalUsd(conversation)) return { reply: USD_OFFER, awaiting: '' as const };
  if (conversation.facts.residesAbroad && !conversation.facts.paymentCurrency)
    return {
      reply: `${USD_OFFER}\n\n¿Pagarás en dólares o en pesos dominicanos?`,
      awaiting: '' as const,
    };
  if (
    conversation.facts.paymentCurrency === 'USD' &&
    conversation.facts.residesAbroad === undefined
  )
    return {
      reply: `${USD_OFFER}\n\n¿Resides fuera de República Dominicana?`,
      awaiting: '' as const,
    };
  return null;
}
