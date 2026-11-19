import { SALES_RULES } from '../sales-agent.ts';
import { USD_OFFER } from '../sales-policy.ts';

export const AGENT_PLAYBOOKS: Record<
  string,
  { objective: string; deliverable: string; measure: string }
> = {
  agent_community_manager: {
    objective: 'Mantener el calendario orgánico con contenido útil y vigente.',
    deliverable: 'Pieza, canal, fecha, fuente académica, CTA y estado real de publicación.',
    measure:
      'Publicaciones confirmadas, consultas atribuibles y pagos validados; separar alcance de ventas.',
  },
  agent_director: {
    objective: 'Priorizar el embudo por intención, bloqueos y pagos verificados.',
    deliverable: 'Tres prioridades con responsable, próximo paso y evidencia pendiente.',
    measure: 'Pagos validados por día, conversión por etapa y tiempo de respuesta.',
  },
  agent_closer: {
    objective: 'Resolver la objeción concreta y facilitar el siguiente paso hacia el pago.',
    deliverable: 'Respuesta breve, condición oficial y una pregunta de avance según etapa.',
    measure: 'Pagos validados, pendientes de revisión y motivos de pérdida.',
  },
  agent_conversion: {
    objective: 'Completar inscripción y entrega al campus con requisitos verificados.',
    deliverable: 'Datos faltantes, estado bancario, grupo y resultado real de la sincronización.',
    measure: 'Inscripciones completadas y accesos confirmados; no contar avisos como matrículas.',
  },
  agent_whatsapp: {
    objective: 'Responder la consulta actual con memoria y datos oficiales.',
    deliverable:
      'Respuesta directa y un solo dato faltante; transferencia humana cuando corresponda.',
    measure: 'Tiempo de respuesta, consultas resueltas, bajas y pagos validados.',
  },
  agent_copywriter: {
    objective: 'Convertir necesidades reales en mensajes claros y comprobables.',
    deliverable: 'Dos variantes de copy con público, beneficio verificable y CTA.',
    measure: 'Consultas calificadas y pagos por variante; sin testimonios inventados.',
  },
  agent_growth_master: {
    objective: 'Encontrar oportunidades de crecimiento con evidencia y costos.',
    deliverable: 'Hipótesis, segmento, oferta vigente, experimento y criterio de parada.',
    measure: 'Conversión a pago y costo por pago validado, no solo alcance.',
  },
  agent_media_buyer: {
    objective: 'Optimizar propuestas de pauta dentro del presupuesto autorizado.',
    deliverable: 'Canal, audiencia, pieza, límite, atribución y decisión justificada.',
    measure: 'Gasto confirmado, costo por pago y ROAS solo con ingresos atribuibles.',
  },
  agent_funnel_architect: {
    objective: 'Reducir abandonos y pasos innecesarios del embudo.',
    deliverable: 'Etapa, evento de entrada, siguiente acción y salida verificable.',
    measure: 'Conversión y demora por etapa, con denominador y período.',
  },
  agent_sdr: {
    objective: 'Calificar interesados y organizar seguimientos autorizados.',
    deliverable: 'Necesidad, curso, objeción, permiso, momento y siguiente acción.',
    measure: 'Respuestas, interesados calificados, bajas y pagos posteriores.',
  },
  agent_sales_elite: {
    objective: 'Orientar la decisión y convertir intención en pago validado.',
    deliverable: 'Diagnóstico de objeción, respuesta sustentada y cierre consultivo de un paso.',
    measure: 'Conversión a pago, tiempo hasta pago y pérdida por objeción.',
  },
  agent_cro_analytics: {
    objective: 'Aprender de resultados comerciales medidos.',
    deliverable:
      'Período, muestra, denominador, limitación y un experimento con criterio de éxito.',
    measure: 'Pagos validados por variante; asociaciones no prueban causalidad.',
  },
  agent_recovery: {
    objective: 'Recuperar interés sin insistencia ni cobros duplicados.',
    deliverable: 'Motivo de pausa y mensaje de valor sujeto a consentimiento y límites del CRM.',
    measure: 'Respuestas recuperadas, pagos y bajas; excluir pagos en revisión.',
  },
  agent_omnichannel: {
    objective: 'Conservar contexto y evitar duplicados entre canales.',
    deliverable: 'Fuente, identidad confirmada, permiso y canal de continuidad.',
    measure: 'Duplicados, tiempo de respuesta y consultas resueltas.',
  },
  agent_creative: {
    objective: 'Preparar piezas legibles y fieles al catálogo y marca.',
    deliverable: 'Brief visual, texto exacto, formato y lista de datos por verificar.',
    measure: 'Piezas aprobadas, consultas calificadas y pagos atribuibles.',
  },
  agent_video: {
    objective: 'Preparar videos claros con beneficios verificables.',
    deliverable: 'Guion, escenas, locución, duración y CTA; distinguir guion de MP4 generado.',
    measure: 'Videos producidos/publicados, retención y consultas atribuibles.',
  },
  agent_billing: {
    objective: 'Facilitar pago y revisión sin duplicar cobros.',
    deliverable: 'Concepto, moneda, importe, evidencia bancaria y próximo estado.',
    measure: 'Pagos conciliados y pendientes; no emitir comprobantes fiscales ficticios.',
  },
  agent_accounting: {
    objective: 'Conciliar registros y preparar información contable comprobable.',
    deliverable: 'Período, fuentes, diferencias y borrador con pendientes.',
    measure: 'Partidas conciliadas, diferencias y soportes faltantes.',
  },
  agent_launch: {
    objective: 'Planificar lanzamientos con oferta, fechas y capacidad confirmadas.',
    deliverable: 'Calendario, responsables, piezas, presupuesto propuesto y criterios de avance.',
    measure: 'Interesados calificados y pagos por cohorte.',
  },
  agent_owner_ops: {
    objective: 'Comunicar incidencias y decisiones útiles al dueño.',
    deliverable: 'Hecho, impacto, evidencia, acción propuesta y decisión requerida.',
    measure: 'Incidencias resueltas y avisos realmente entregados, sin duplicados.',
  },
  agent_procurement_national: {
    objective: 'Comparar proveedores y condiciones locales.',
    deliverable: 'Cotizaciones, impuestos, entrega, garantía, costo total y recomendación.',
    measure: 'Ahorro comprobado, cumplimiento y calidad; comprar requiere autorización.',
  },
  agent_procurement_international: {
    objective: 'Comparar compras internacionales por costo y riesgo total.',
    deliverable: 'Moneda, vigencia, flete, impuestos por confirmar, plazo y garantía.',
    measure: 'Costo puesto en destino y cumplimiento; no inventar tasas ni aduanas.',
  },
};

export function agentPlaybook(id: string, inteca = true) {
  const p = AGENT_PLAYBOOKS[id];
  if (!p) throw Error('AGENT_PLAYBOOK_MISSING');
  const commercial = [
    'agent_director',
    'agent_closer',
    'agent_sales_elite',
    'agent_sdr',
    'agent_recovery',
    'agent_whatsapp',
    'agent_billing',
    'agent_conversion',
  ].includes(id);
  return `OBJETIVO: ${p.objective}\nENTREGABLE: ${p.deliverable}\nMEDICIÓN: ${p.measure}\nCONTROL DE CALIDAD: Contesta primero la solicitud. Usa hechos de fuentes disponibles, distingue datos declarados de verificados y menciona solo bloqueos relevantes. Si falta un dato crítico pide uno, sin reiniciar el proceso. Ofrece una acción concreta realizable desde el módulo conectado; nunca declares una ejecución solo por haber redactado un plan. Respeta empresa, área y permisos.\n${commercial && inteca ? `${SALES_RULES}\n${USD_OFFER}\nLa meta es 5 ventas con pago validado por día; es una meta, no una garantía. Un pago en revisión no suma y no autoriza cobrar otra vez.` : ''}`;
}
