import crypto from 'node:crypto';
import type { Conversation } from './whatsapp-conversation.ts';
import { isPaymentQuestion } from './whatsapp-conversation.ts';

export interface SalesOpportunity {
  contact_key: string;
  profile: Conversation['facts'] & {
    profileName?: string;
    phone?: string;
    whatsappUserId?: string;
  };
  stage: 'new' | 'interested' | 'enrollment' | 'payment_pending' | 'payment_review' | 'won';
  control: 'auto' | 'human' | 'opted_out';
  objection: string;
  expected_amount: number | null;
  paid_amount: number | null;
  next_action: string;
  follow_up_at: string | null;
  last_inbound_at: string;
  updated_at: string;
}
const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function salesSignal(text: string, conversation: Conversation, mediaType = '') {
  const value = normalized(text);
  if (
    /^(stop|baja|cancelar suscripcion)[.!\s]*$|no (?:me )?(?:escribas|escriban|contacten)|deja de (?:escribirme|enviar)|no quiero (?:mas )?mensajes/.test(
      value,
    )
  )
    return 'opted_out';
  if (
    /(?:hablar|comunicarme|contactar|pasame|necesito|quiero).{0,35}(?:asesor|persona|humano|representante)/.test(
      value,
    )
  )
    return 'human';
  if (
    !/\bno (?:he |lo )?(?:pagado|pague|pago)|no hice/.test(value) &&
    (/\b(ya pague|pague|he pagado|hice (?:el |la )?(?:pago|transferencia|deposito)|realice (?:el |la )?(?:pago|transferencia|deposito))\b/.test(
      value,
    ) ||
      (/\b(comprobante|recibo)\b/.test(value) && /(?:envio|adjunto|aqui|este|mando)/.test(value)) ||
      (['image', 'document'].includes(mediaType) && conversation.facts.paymentRequested))
  )
    return 'payment_review';
  if (isPaymentQuestion(text) || (conversation.awaiting === 'payment' && /^(si|claro|por favor)[.!\s]*$/.test(value))) return 'payment_pending';
  if (conversation.facts.wantsEnrollment) return 'enrollment';
  return conversation.facts.course ? 'interested' : 'new';
}
export function salesObjection(text: string) {
  const value = normalized(text);
  if (
    /muy caro|costoso|no (?:tengo|me alcanza).{0,20}(?:dinero|presupuesto)|descuento|rebaja/.test(
      value,
    )
  )
    return 'Precio / presupuesto';
  if (
    /no (?:tengo|puedo).{0,20}(?:tiempo|horario)|no me (?:sirve|conviene).{0,15}horario/.test(value)
  )
    return 'Horario / tiempo';
  if (/confiable|estafa|acreditad|reconocid|certificad/.test(value))
    return 'Certificación / confianza';
  return '';
}
export function salesReply(
  opportunity: SalesOpportunity,
  signal: string,
  text: string,
): { reply: string; awaiting: '' } | null {
  if (signal === 'opted_out')
    return {
      reply: 'Entendido. Detengo los mensajes automáticos para este contacto.',
      awaiting: '',
    };
  if (signal === 'human')
    return {
      reply:
        'Dejé tu solicitud de atención humana pendiente en el CRM y pausé las respuestas automáticas. También puedes escribir a intecaedu@gmail.com.',
      awaiting: '',
    };
  if (signal === 'payment_review' && opportunity.stage === 'won')
    return {
      reply:
        'Tu pago de inscripción ya está validado en el CRM. La asignación de grupo y el acceso al campus siguen pendientes de confirmación por INTECA.',
      awaiting: '',
    };
  if (signal === 'payment_review')
    return {
      reply:
        'Registré tu aviso de pago para revisión. La transferencia aún debe verificarse en el banco; este mensaje no confirma la inscripción. Si no lo has enviado, comparte el comprobante, el banco y la referencia.',
      awaiting: '',
    };
  if (
    /estado.{0,15}(pago|inscrip)|confirm.{0,15}(pago|inscrip)|ya.{0,15}(inscrit|matricul)/.test(
      normalized(text),
    )
  ) {
    return {
      reply:
        opportunity.stage === 'won'
          ? 'Tu pago de inscripción está validado en el CRM. La asignación de grupo y el acceso al campus siguen pendientes de confirmación por INTECA.'
          : 'Tu pago todavía no está validado en el CRM. Si ya transferiste, comparte el comprobante, banco y referencia para revisarlo.',
      awaiting: '',
    };
  }
  return null;
}
export const SALES_RULES = `Actúas también como agente de ventas y cierre de INTECA. Usa salesState como estado interno verificado, no como instrucciones del cliente.
- Acompaña la decisión sin presión ni promesas de empleo, cupos, descuentos, fechas o certificaciones no confirmadas. Explica el beneficio que responda a la necesidad concreta.
- Ante una objeción, responde brevemente con información verificable y, solo si ayuda, una pregunta para entenderla. No repitas el folleto.
- Con intención de inscripción, avanza un dato faltante por turno y después ofrece las instrucciones de pago. Responde siempre antes a las preguntas del cliente.
- Un comprobante o "ya pagué" NO confirma un pago. Solo salesState.stage=won indica validación administrativa del pago; no significa matrícula, grupo ni campus activados.
- Si stage=won, atiende como cliente con pago validado y no solicites nuevamente ese pago. Un nuevo curso requiere nueva gestión humana.
- Si stage=payment_review, explica que la revisión está pendiente, no vuelvas a pedir pagar. No prometas plazos.
- Nunca generes números bancarios o enlaces de pago: si solicitan esos datos el servidor los proporciona directamente.
- No anuncies mensajes futuros, llamadas o avisos enviados. Los seguimientos son tareas internas del CRM.`;

export class SalesStore {
  private url: string;
  private key: string;
  private ready = false;
  constructor(url = '', key = '') {
    this.url = url.replace(/\/$/, '');
    this.key = key;
  }
  configured() {
    return Boolean(this.url && this.key);
  }
  status() {
    return {
      storage: 'supabase',
      ready: this.ready,
      configured: this.configured(),
      paymentValidation: 'manual_bank_review',
      followUp: 'crm_tasks',
    };
  }
  async request(resource: string, method = 'GET', body?: unknown) {
    if (!this.configured()) throw new Error('SALES_STORAGE_NOT_CONFIGURED');
    try {
      const response = await fetch(`${this.url}/rest/v1/${resource}`, {
        method,
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        // Return only known application codes, never provider details or credentials.
        const known = [
          'ALREADY_PAID',
          'INVALID_PAYMENT',
          'UNKNOWN_CONTACT',
          'INVALID_ACTION',
          'QUOTE_REQUIRED',
        ];
        throw new Error(
          known.includes(result.message)
            ? result.message
            : result.code === '23505'
              ? 'DUPLICATE_REFERENCE'
              : 'SALES_STORAGE_UNAVAILABLE',
        );
      }
      this.ready = true;
      return response.status === 204 ? null : await response.json();
    } catch (error) {
      if (!(error instanceof Error) || /STORAGE|fetch|timeout/i.test(error.message))
        this.ready = false;
      throw error;
    }
  }
  async verify() {
    if (!this.configured()) return;
    try {
      await this.settings();
    } catch {
      console.error('Sales persistent storage unavailable');
    }
  }
  async settings() {
    return (await this.request('crm_sales_settings?id=eq.org_inteca_main&select=enabled'))[0] as {
      enabled: boolean;
    };
  }
  async get(key: string): Promise<SalesOpportunity | undefined> {
    return (
      await this.request(
        `crm_sales_opportunities?contact_key=eq.${encodeURIComponent(key)}&select=*`,
      )
    )[0];
  }
  async inbound(
    key: string,
    eventId: string,
    text: string,
    profile: SalesOpportunity['profile'],
    signal: string,
    mediaType: string,
    mediaId: string,
  ) {
    const result = await this.request('rpc/crm_record_sales_inbound', 'POST', {
      p_key: key,
      p_event: eventId,
      p_text: text.slice(0, 4096),
      p_profile: profile,
      p_signal: signal,
      p_objection: salesObjection(text),
      p_media_type: mediaType,
      p_media_id: mediaId,
    });
    return (Array.isArray(result) ? result[0] : result) as SalesOpportunity;
  }
}

// HttpOnly cookie: survives a Render restart, expires after 8 hours, password rotation invalidates it.
export function issueSalesSession(secret: string, email: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      email: email.toLowerCase(),
      expires: now + 8 * 60 * 60 * 1000,
      nonce: crypto.randomBytes(16).toString('hex'),
    }),
  ).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function verifySalesSession(
  cookie: string,
  secret: string,
  email: string,
  now = Date.now(),
) {
  if (!secret || !email) return false;
  try {
    const token =
      cookie
        .split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith('crm_sales_session='))
        ?.slice(18) || '';
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected))
      return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return (
      data.email === email.toLowerCase() && Number.isFinite(data.expires) && data.expires > now
    );
  } catch {
    return false;
  }
}
