import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CatalogStore } from './whatsapp-catalog.ts';

const money = z.number().finite().positive().max(1000000).multipleOf(0.01);
export const adPlanSchema = z.object({
  courseTitle: z.string().trim().min(3).max(250),
  totalBudgetDop: money.min(1000),
  dailyLimitDop: money,
  durationDays: z.number().int().min(3).max(30),
  targetCacDop: money,
  channels: z.array(z.enum(['meta_ads', 'google_ads'])).min(1).max(2),
}).strict().refine(p => p.dailyLimitDop <= p.totalBudgetDop, 'El límite diario supera el total.');
export type AdPlanInput = z.infer<typeof adPlanSchema>;
export type AdPlan = { id: string; payload: AdPlanInput; strategy: ReturnType<typeof strategy>; content_hash: string; catalog_hash: string; state: string; approved_by: string | null; approved_at: string | null; created_at: string };
type Store = { request(resource: string, method?: string, body?: unknown): Promise<any> };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const round = (value: number) => Math.round(value * 100) / 100;

export function strategy(p: AdPlanInput, course: { description: string; investment: string; duration: string }) {
  const test = round(p.totalBudgetDop * 0.2), reserve = round(p.totalBudgetDop * 0.1);
  return {
    objective: 'Matrículas con pago verificado y atribuido al anuncio; los clics no cuentan como ventas.',
    audience: 'Personas adultas en República Dominicana interesadas en formación técnica y en el área profesional del curso. Validar público y ubicación antes de activar.',
    courseFacts: { description: course.description, investment: course.investment, duration: course.duration },
    testBudgetDop: test, winnerBudgetDop: round(p.totalBudgetDop - test - reserve), reserveDop: reserve,
    variants: [
      { name: 'A · Aprendizaje', hypothesis: `Presentar lo que se aprende en ${p.courseTitle}, usando el catálogo y una llamada a solicitar información.` },
      { name: 'B · Decisión de inscripción', hypothesis: 'Presentar modalidad, duración, inversión y horarios vigentes. Resolver dudas y dirigir al proceso de inscripción.' },
    ],
    steps: [
      'Antes de invertir: confirmar fecha y cupos, destino del anuncio, respuesta de WhatsApp, pago configurado y límites del proveedor.',
      `Prueba inicial: repartir RD$${test} entre dos variantes sin descuentos; no repartir un presupuesto pequeño entre muchos canales.`,
      'Usar identificadores de campaña y anuncio para relacionar cada contacto con su matrícula y pago validado.',
      `Evaluar después de al menos 72 horas y 5 matrículas atribuidas. Costo objetivo máximo: RD$${p.targetCacDop} por matrícula.`,
      'Proponer aumentos de hasta 20% por revisión, como máximo una revisión cada 24 horas, dentro del saldo y el límite diario autorizados.',
      'Si no hay matrículas al consumir dos veces el costo objetivo, proponer pausa y revisar anuncio, público y conversación antes de invertir más.',
    ],
    measurement: 'Costo por matrícula validada y retorno sobre ingresos cobrados. Revisar también margen del curso; retorno de ingresos no equivale a ganancia.',
    activation: 'Pendiente de conexión, facturación, atribución y límite externo verificados. El CRM prepara campañas en pausa y no activa gasto.',
  };
}

export class AdvertisingPlans {
  private store: Store;
  private catalog: Pick<CatalogStore, 'get'>;
  constructor(store: Store, catalog: Pick<CatalogStore, 'get'>) { this.store = store; this.catalog = catalog; }
  async list(): Promise<AdPlan[]> { return this.store.request('crm_ad_plans?order=created_at.desc&limit=100'); }
  async get(id: string): Promise<AdPlan> {
    if (!z.string().uuid().safeParse(id).success) throw Error('AD_PLAN');
    const row = (await this.store.request(`crm_ad_plans?id=eq.${id}&limit=1`))[0];
    if (!row) throw Error('AD_PLAN'); return row;
  }
  async create(input: AdPlanInput) {
    const payload = adPlanSchema.parse(input); payload.channels = [...new Set(payload.channels)];
    const catalog = await this.catalog.get(); const course = catalog?.courses.find(c => c.title === payload.courseTitle);
    if (!catalog || !course) throw Error('AD_CATALOG');
    const plan = strategy(payload, course);
    return (await this.store.request('crm_ad_plans', 'POST', { payload, strategy: plan, catalog_hash: catalog.hash, content_hash: digest({ payload, strategy: plan, catalogHash: catalog.hash }) }))[0];
  }
  async approve(id: string, expectedHash: string, actor: string) {
    const row = await this.get(id); const catalog = await this.catalog.get();
    if (!actor || row.state !== 'draft' || row.content_hash !== expectedHash || digest({ payload: row.payload, strategy: row.strategy, catalogHash: row.catalog_hash }) !== expectedHash) throw Error('AD_APPROVAL');
    if (!catalog || catalog.hash !== row.catalog_hash) throw Error('AD_CHANGED');
    const result = await this.store.request(`crm_ad_plans?id=eq.${id}&state=eq.draft`, 'PATCH', { state: 'approved', approved_by: actor, approved_at: new Date().toISOString() });
    if (!result.length) throw Error('AD_STATE'); return result[0];
  }
  async validateCampaign(planId: string | null | undefined, courseTitle: string, channel: string, total: number, daily: number) {
    if (!planId) throw Error('AD_PLAN');
    const plan = await this.get(planId); const catalog = await this.catalog.get();
    if (plan.state !== 'approved' || !plan.approved_by || plan.payload.courseTitle !== courseTitle || !plan.payload.channels.includes(channel as any)) throw Error('AD_PLAN');
    if (!catalog || plan.catalog_hash !== catalog.hash) throw Error('AD_CHANGED');
    if (!Number.isFinite(total) || !Number.isFinite(daily) || total <= 0 || daily <= 0 || total > plan.payload.totalBudgetDop || daily > plan.payload.dailyLimitDop || daily > total) throw Error('AD_BUDGET');
    return plan;
  }
}

// Recommendations never send provider writes. Paid enrollment attribution is mandatory.
export function evaluatePerformance(input: { spentDop: number; paidEnrollments: number | null; paidRevenueDop: number | null; attributionVerified: boolean; complete: boolean; ageHours: number; lastIncreaseHours: number; currentDailyDop: number; dailyLimitDop: number; remainingDop: number; targetCacDop: number }) {
  const result = (action: string, reason: string, extra: { proposedDailyDop?: number; cacDop?: number } = {}): { action: string; reason: string; applied: false; proposedDailyDop?: number; cacDop?: number } => ({ action, reason, applied: false, ...extra });
  const numbers = [input.spentDop, input.ageHours, input.lastIncreaseHours, input.currentDailyDop, input.dailyLimitDop, input.remainingDop, input.targetCacDop];
  if (!input.complete || numbers.some(x => !Number.isFinite(x) || x < 0) || input.targetCacDop <= 0) return result('hold', 'Datos incompletos o no válidos: no aumentar inversión.');
  if (input.remainingDop <= 0) return result('pause', 'Presupuesto agotado: no autorizar más inversión.');
  if (!input.attributionVerified || input.paidEnrollments === null || input.paidRevenueDop === null || !Number.isInteger(input.paidEnrollments) || input.paidEnrollments < 0 || !Number.isFinite(input.paidRevenueDop) || input.paidRevenueDop < 0) return result('hold', 'Falta atribuir matrículas y pagos verificados; clics y conversiones del proveedor no prueban ventas.');
  if (input.ageHours < 72) return result('hold', 'La prueba necesita al menos 72 horas para evaluarse.');
  if (input.paidEnrollments === 0 && input.spentDop >= input.targetCacDop * 2) return result('pause', 'Se consumió dos veces el costo objetivo sin matrículas verificadas.');
  const cac = input.paidEnrollments > 0 ? round(input.spentDop / input.paidEnrollments) : 0;
  if (cac > input.targetCacDop) return result('pause', 'El costo por matrícula supera el máximo definido.', { cacDop: cac });
  if (input.paidEnrollments < 5 || input.spentDop <= 0 || input.paidRevenueDop <= input.spentDop || input.lastIncreaseHours < 24) return result('hold', 'Todavía no hay evidencia suficiente de retorno para aumentar.', { cacDop: cac });
  const proposedDailyDop = round(Math.min(input.currentDailyDop * 1.2, input.dailyLimitDop, input.remainingDop));
  if (proposedDailyDop <= input.currentDailyDop) return result('hold', 'No hay margen dentro de los límites autorizados.', { cacDop: cac });
  return result('propose_increase', 'Buen costo y retorno observado; propuesta limitada al 20%, pendiente de autorización y límite externo.', { proposedDailyDop, cacDop: cac });
}
