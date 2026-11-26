import type { SalesStore, SalesOpportunity } from './sales-agent.ts';
import { buildWhatsAppTextPayload, type WhatsAppRecipient } from './whatsapp-routing.ts';
import { USD_OFFER } from './sales-policy.ts';
import { ownerCase } from './owner-agent.ts';

export interface SalesAutomationSettings {
  id: string;
  enabled: boolean;
  owner_phone: string;
  daily_goal: number;
  payment_document: string;
  international_payment_instructions: string;
  payment_instructions: string;
  followup_template: string;
  owner_template: string;
  template_language: string;
  owner_last_inbound_at: string | null;
}
export interface SalesJob {
  id: string;
  dedupe_key: string;
  contact_key: string | null;
  kind: 'followup' | 'owner';
  state: string;
  strategy: string;
  payload: { text: string };
  provider_id?: string;
}
export function followupEligibility(sale: SalesOpportunity, now = Date.now()) {
  if (sale.control !== 'auto' || sale.profile.followUpConsent === 'no') return 'CONTACT_PAUSED';
  if (sale.stage === 'won' || sale.stage === 'payment_review') return 'NO_COLLECTION';
  if (!sale.follow_up_at || Date.parse(sale.follow_up_at) > now) return 'NOT_DUE';
  if (!sale.profile.phone && !sale.profile.whatsappUserId) return 'NO_RECIPIENT';
  const age = now - Date.parse(sale.last_inbound_at);
  if (!Number.isFinite(age) || age < 0) return 'INVALID_WINDOW';
  if (age < 23 * 3600000) return 'text';
  return sale.profile.followUpConsent === 'yes' ? 'template' : 'CONSENT_REQUIRED';
}
export function followupText(sale: SalesOpportunity, strategy: string) {
  const name = sale.profile.fullName?.split(' ')[0];
  const course = sale.profile.course ? ` sobre ${sale.profile.course}` : '';
  const greeting = `Hola${name ? `, ${name}` : ''}. Soy Mariela, asistente virtual de INTECA.`;
  const prompt =
    sale.stage === 'payment_pending'
      ? '¿Necesitas orientación para completar el pago o revisar las instrucciones? Si ya pagaste, envía el comprobante para revisión; no repitas la transferencia.'
      : strategy === 'clarify'
        ? `¿Qué información te falta${course} para decidir si deseas inscribirte?`
        : `¿Te ayudaría revisar el horario o los pasos de inscripción${course}?`;
  const price =
    sale.profile.residesAbroad && sale.profile.paymentCurrency === 'USD' ? `\n${USD_OFFER}` : '';
  return `${greeting}\n${prompt}${price}\nSi prefieres que no te escribamos, responde BAJA.`;
}
export function chooseStrategy(
  key: string,
  metrics: Array<{ strategy: string; sent: number; paid: number }>,
) {
  const eligible = metrics.filter((row) => Number(row.sent) >= 20);
  if (eligible.length >= 2) {
    // Observational conversion signal, not a causal claim. Keep 20% exploration.
    const slot = [...key].reduce((a, c) => a + c.charCodeAt(0), 0);
    if (slot % 5 !== 0)
      return [...eligible].sort(
        (a, b) =>
          (Number(b.paid) + 1) / (Number(b.sent) + 2) - (Number(a.paid) + 1) / (Number(a.sent) + 2),
      )[0].strategy;
  }
  return [...key].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 ? 'clarify' : 'assist';
}
export class SalesFollowupAgent {
  private running = false;
  private cache: { at: number; data: SalesAutomationSettings } | null = null;
  private error: string | null = null;
  private templateCheckedAt = 0;
  private templateChecks: Record<string, string> = {};
  private learningSummary = 'Todavía no hay resultados suficientes para comparar estrategias.';
  learning() {
    return this.learningSummary;
  }
  private store: SalesStore;
  private env: NodeJS.ProcessEnv;
  constructor(store: SalesStore, env: NodeJS.ProcessEnv = process.env) {
    this.store = store;
    this.env = env;
  }
  status() {
    return {
      enabled: this.cache?.data.enabled ?? false,
      ready: !!this.cache && !this.error,
      error: this.error,
      dailyPaidGoal: this.cache?.data.daily_goal ?? 5,
      ownerCommandsReady: Boolean(this.env.WHATSAPP_APP_SECRET && this.env.WHATSAPP_PHONE_NUMBER_ID && this.store.configured()),
      templateChecks: this.templateChecks,
      readiness: {
        storage: !!this.cache && !this.error,
        outsideServiceWindow: !!this.cache?.data.enabled && !this.error && this.templateChecks.followup === 'APPROVED',
        ownerTemplate: !!this.cache?.data.enabled && !this.error && this.templateChecks.owner === 'APPROVED',
        requiresConsent: true,
      },
    };
  }
  async settings() {
    if (this.cache && Date.now() - this.cache.at < 30000) return this.cache.data;
    const data = (
      await this.store.request('crm_sales_automation_settings?id=eq.org_inteca_main&select=*')
    )[0];
    if (!data) throw Error('AUTOMATION_SETTINGS_MISSING');
    this.cache = { at: Date.now(), data };
    return data as SalesAutomationSettings;
  }
  async ownerInbound(phone: string) {
    const s = await this.settings();
    if (phone === s.owner_phone) {
      await this.store.request('crm_sales_automation_settings?id=eq.org_inteca_main', 'PATCH', {
        owner_last_inbound_at: new Date().toISOString(),
      });
      this.cache = null;
    }
  }
  async enqueue(
    kind: 'followup' | 'owner',
    key: string,
    text: string,
    contact: string | null = null,
    strategy = '',
  ) {
    await this.store.request('rpc/crm_enqueue_sales_message', 'POST', {
      p_kind: kind,
      p_dedupe: key,
      p_contact: contact,
      p_text: text,
      p_strategy: strategy,
    });
  }
  async notify(sale: SalesOpportunity) {
    if (sale.control === 'opted_out' && sale.stage !== 'won') return;
    if (!['payment_review', 'won'].includes(sale.stage) && sale.control !== 'human') return;
    const kind =
      sale.stage === 'won' ? 'Pago validado' : sale.stage === 'payment_review'
        ? 'Pago reportado; pendiente de revisión bancaria' : 'Atención humana solicitada';
    await this.enqueue(
      'owner',
      `${sale.contact_key}:${sale.control}:${sale.stage}`,
      `${kind}. ${ownerCase(sale)}. Puedes responder ficha ${sale.contact_key.slice(0,12)}, revisión, pendientes o ayuda. No se confirma ningún abono sin validación bancaria.`,
      sale.contact_key,
      ['won','payment_review'].includes(sale.stage) ? 'owner_payment' : '',
    );
  }
  async operationalAlert(module: string, entity: string) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(
      new Date(),
    );
    await this.enqueue(
      'owner',
      `incident:${module}:${entity}:${day}`,
      `INTECA: se registró una incidencia que requiere revisión en ${module} (${entity}). Consulta Auditoría e Historial del CRM para ver el detalle. Se agrupan avisos repetidos del mismo tipo durante el día.`,
    );
  }
  async snapshot() {
    const [settings, metrics, jobs] = await Promise.all([
      this.settings(),
      this.store.request('rpc/crm_sales_followup_metrics', 'POST', {}),
      this.store.request(
        'crm_sales_outbox?select=id,kind,state,strategy,last_error,created_at,sent_at&order=created_at.desc&limit=50',
      ),
    ]);
    return {
      settings: { ...settings, payment_document: undefined },
      metrics,
      jobs,
      status: this.status(),
    };
  }
  private async template(name: string, language: string, text: string) {
    if (!name || !this.env.WHATSAPP_BUSINESS_ACCOUNT_ID) throw Error('APPROVED_TEMPLATE_REQUIRED');
    const url = `https://graph.facebook.com/${this.env.META_GRAPH_API_VERSION || 'v26.0'}/${this.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?name=${encodeURIComponent(name)}&fields=name,status,language,components`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.json();
    if (!r.ok)
      throw Error(
        `TEMPLATE_META_${Number(body.error?.code) || r.status}_${Number(body.error?.error_subcode) || 0}`,
      );
    const found = body.data?.find((t: any) => t.name === name && t.language === language);
    if (!found) throw Error('TEMPLATE_NOT_FOUND');
    if (found.status !== 'APPROVED') throw Error('TEMPLATE_NOT_APPROVED');
    // Explicit one-body-variable template contract, no hidden required headers/buttons.
    const components = found?.components || [];
    const templateBody = components.find((c: any) => c.type === 'BODY')?.text || '';
    if (
      !found ||
      !templateBody.includes('{{1}}') ||
      /\{\{(?:[2-9]|[a-z])/i.test(templateBody) ||
      components.some(
        (c: any) =>
          c.type !== 'BODY' &&
          (JSON.stringify(c).includes('{{') ||
            c.format === 'IMAGE' ||
            c.format === 'VIDEO' ||
            c.format === 'DOCUMENT'),
      )
    )
      throw Error('TEMPLATE_SCHEMA_MISMATCH');
    return {
      name,
      language: { code: language },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: text.replace(/\s+/g, ' ').trim() }] },
      ],
    };
  }
  private async probeTemplates(settings: SalesAutomationSettings) {
    if (Date.now() - this.templateCheckedAt < 15 * 60000) return;
    this.templateCheckedAt = Date.now();
    for (const [kind, name] of Object.entries({
      followup: settings.followup_template,
      owner: settings.owner_template,
    })) {
      try {
        await this.template(name, settings.template_language, 'Comprobación de configuración');
        this.templateChecks[kind] = 'APPROVED';
      } catch (error) {
        this.templateChecks[kind] =
          error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
            ? error.message
            : 'TEMPLATE_CHECK_UNAVAILABLE';
      }
    }
  }
  async tick() {
    if (this.running || !this.store.configured()) return;
    this.running = true;
    try {
      const settings = await this.settings();
      await this.probeTemplates(settings);
      const master = await this.store.settings();
      if (!settings.enabled || !master?.enabled || this.env.WHATSAPP_AUTO_REPLY_ENABLED === 'false')
        return;
      const hour = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Santo_Domingo',
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(new Date()),
      );
      const contactHours = hour >= 9 && hour < 20;
      if (!contactHours) {
        // Payment events belong to the director; customer outreach remains subject to contact hours.
        for(let i=0;i<5;i++){
          const rows=await this.store.request('rpc/crm_claim_director_payment_message','POST',{});
          if(!rows?.[0])break;
          await this.deliver(rows[0],settings);
        }
        return;
      }
      const metrics = await this.store.request('rpc/crm_sales_followup_metrics', 'POST', {});
      this.learningSummary = JSON.stringify({
        dailyPaidGoal: settings.daily_goal,
        paidToday: metrics.paid_today,
        strategies: metrics.strategies,
        interpretation: metrics.measurement,
      });
      // Recover the alert if a process stopped between bank verification and the outbox enqueue.
      const recentPaid:SalesOpportunity[]=await this.store.request(`crm_sales_opportunities?stage=eq.won&updated_at=gte.${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}&limit=100`);
      for(const sale of recentPaid)if(sale.profile.phone!==settings.owner_phone)await this.notify(sale);
      const sales: SalesOpportunity[] = await this.store.request(
        `crm_sales_opportunities?control=neq.opted_out&or=(follow_up_at.lte.${encodeURIComponent(new Date().toISOString())},stage.eq.payment_review,control.eq.human)&order=follow_up_at.asc.nullslast&limit=100`,
      );
      for (const sale of sales) {
        if (sale.profile.phone === settings.owner_phone) continue;
        await this.notify(sale);
        const eligible = followupEligibility(sale);
        if (!['text', 'template'].includes(eligible)) continue;
        const history: Array<{ state: string; sent_at: string | null }> = await this.store.request(
          `crm_sales_outbox?contact_key=eq.${encodeURIComponent(sale.contact_key)}&kind=eq.followup&select=state,sent_at`,
        );
        if (
          history.filter((j) => j.sent_at || ['sending', 'unknown'].includes(j.state)).length >=
            3 ||
          history.some((j) => j.sent_at && Date.now() - Date.parse(j.sent_at) < 86400000)
        )
          continue;
        const strategy = chooseStrategy(sale.contact_key, metrics.strategies || []);
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(
          new Date(),
        );
        await this.enqueue(
          'followup',
          `followup:${sale.contact_key}:${day}`,
          followupText(sale, strategy),
          sale.contact_key,
          strategy,
        );
      }
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(
        new Date(),
      );
      if (hour >= 18)
        await this.enqueue(
          'owner',
          `daily:${day}`,
          `Resumen INTECA: ${metrics.paid_today || 0} ventas con pago validado hoy / meta ${settings.daily_goal}. Pendientes de pago: ${metrics.payment_pending || 0}; revisión: ${metrics.payment_review || 0}; atención humana: ${metrics.human || 0}. Consulta el CRM para ver casos y resultados por estrategia.`,
        );
      for (let i = 0; i < 10; i++) {
        const claimed = await this.store.request('rpc/crm_claim_sales_message', 'POST', {});
        const job = Array.isArray(claimed) ? claimed[0] : claimed;
        if (!job) break;
        await this.deliver(job, settings);
      }
      this.error = null;
    } catch {
      this.error = 'SALES_AUTOMATION_UNAVAILABLE';
      console.warn('Sales follow-up tick unavailable');
    } finally {
      this.running = false;
    }
  }
  private async deliver(job: SalesJob, settings: SalesAutomationSettings) {
    let attempted = false;
    let accepted = false;
    const update = (body: object) =>
      this.store.request(`crm_sales_outbox?id=eq.${job.id}`, 'PATCH', body);
    try {
      const master = await this.store.settings();
      const fresh = (
        await this.store.request('crm_sales_automation_settings?id=eq.org_inteca_main&select=*')
      )[0] as SalesAutomationSettings;
      if (!master?.enabled || !fresh.enabled || this.env.WHATSAPP_AUTO_REPLY_ENABLED === 'false') {
        await update({
          state: 'blocked',
          last_error: 'AUTOMATION_PAUSED',
          available_at: new Date(Date.now() + 3600000).toISOString(),
        });
        return;
      }
      let recipient: WhatsAppRecipient = { kind: 'phone', id: fresh.owner_phone };
      let mode =
        fresh.owner_last_inbound_at &&
        Date.now() - Date.parse(fresh.owner_last_inbound_at) < 23 * 3600000
          ? 'text'
          : 'template';
      let sale: SalesOpportunity | undefined;
      if (job.kind === 'followup') {
        sale = job.contact_key ? await this.store.get(job.contact_key) : undefined;
        if (sale?.profile.phone === fresh.owner_phone) { await update({state:'cancelled',last_error:'OWNER_NOT_A_PROSPECT'}); return; }
        mode = sale ? followupEligibility(sale) : 'NO_RECIPIENT';
        if (!sale || !['text', 'template'].includes(mode)) {
          await update({ state: 'cancelled', last_error: mode });
          return;
        }
        const recent: Array<{ state: string; sent_at: string | null }> = await this.store.request(
          `crm_sales_outbox?contact_key=eq.${encodeURIComponent(sale.contact_key)}&kind=eq.followup&id=neq.${job.id}&select=state,sent_at`,
        );
        if (
          recent.some(
            (j) =>
              ['sending', 'unknown'].includes(j.state) ||
              (j.sent_at && Date.now() - Date.parse(j.sent_at) < 86400000),
          ) ||
          recent.filter((j) => j.sent_at).length >= 3
        ) {
          await update({ state: 'cancelled', last_error: 'CONTACT_FREQUENCY_LIMIT' });
          return;
        }
        recipient = sale.profile.whatsappUserId
          ? { kind: 'bsuid', id: sale.profile.whatsappUserId }
          : { kind: 'phone', id: sale.profile.phone! };
        job.payload.text = followupText(sale, job.strategy);
      }
      if (!this.env.WHATSAPP_ACCESS_TOKEN || !this.env.WHATSAPP_PHONE_NUMBER_ID)
        throw Error('WHATSAPP_NOT_CONFIGURED');
      if (recipient.kind === 'phone' && !/^\d{7,15}$/.test(recipient.id))
        throw Error('INVALID_RECIPIENT');
      const payload =
        mode === 'text'
          ? buildWhatsAppTextPayload(recipient, job.payload.text)
          : {
              messaging_product: 'whatsapp',
              ...(recipient.kind === 'phone' ? { to: recipient.id } : { recipient: recipient.id }),
              type: 'template',
              template: await this.template(
                job.kind === 'owner' ? fresh.owner_template : fresh.followup_template,
                fresh.template_language,
                job.payload.text,
              ),
            };
      // Once delivery starts, ambiguous network outcomes are never blindly retried.
      attempted = true;
      const response = await fetch(
        `https://graph.facebook.com/${this.env.META_GRAPH_API_VERSION || 'v26.0'}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...payload, biz_opaque_callback_data: `sales:${job.id}` }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        await update({
          state: 'failed',
          last_error: `META_${result.error?.code || response.status}`,
        });
        return;
      }
      if (!result.messages?.[0]?.id) throw Error('NO_PROVIDER_ID');
      accepted = true;
      await update({
        state: 'sent',
        sent_at: new Date().toISOString(),
        provider_id: result.messages[0].id,
        last_error: null,
      });
      if (sale && job.contact_key) {
        try {
          await this.store.request('crm_sales_events', 'POST', {
            contact_key: job.contact_key,
            external_id: `followup:${job.id}`,
            kind: 'followup_sent',
            actor: 'Agente de seguimiento',
            details: { text: job.payload.text, strategy: job.strategy },
          });
          await this.store.request(
            `crm_sales_opportunities?contact_key=eq.${job.contact_key}&last_inbound_at=eq.${encodeURIComponent(sale.last_inbound_at)}`,
            'PATCH',
            { follow_up_at: new Date(Date.now() + 48 * 3600000).toISOString() },
          );
        } catch {
          console.warn('Follow-up accepted; audit needs reconciliation');
        }
      }
    } catch (e) {
      await update({
        state: attempted || accepted ? 'unknown' : 'blocked',
        last_error: attempted
          ? 'VERIFY_DELIVERY_BEFORE_RETRY'
          : e instanceof Error && /^[A-Z0-9_]+$/.test(e.message)
            ? e.message
            : 'PRE_SEND_CHECK_FAILED',
        available_at: new Date(Date.now() + 3600000).toISOString(),
      });
    }
  }
}
