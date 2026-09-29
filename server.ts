import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DEPLOYMENT_MODE =
  process.env.DEPLOYMENT_MODE || process.env.VITE_DEPLOYMENT_MODE || 'production';

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

const messageSchema = z.object({
  sender: z.enum(['lead', 'ai_agent', 'human_user']),
  agentName: z.string().max(100).optional(),
  content: z.string().min(1).max(8_000),
});

const chatRequestSchema = z.object({
  agentRole: z.string().max(100).optional(),
  agentName: z.string().max(100).optional(),
  systemPrompt: z.string().max(10_000).optional(),
  organizationName: z.string().max(150).optional(),
  businessContext: z.string().max(2_000).optional(),
  leadName: z.string().max(150).optional(),
  leadEmail: z.string().email().optional().or(z.literal('')),
  leadPhone: z.string().max(40).optional(),
  courseTitle: z.string().max(250).optional(),
  conversationHistory: z.array(messageSchema).max(50).optional(),
  userMessage: z.string().min(1).max(8_000),
  currentEmotion: z.string().max(50).optional(),
  buyProbability: z.number().min(0).max(100).optional(),
  isHumanOverride: z.boolean().optional(),
});

const qualifyRequestSchema = z.object({
  leadData: z.record(z.string(), z.unknown()),
});

const authLoginRequestSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

const marketingRequestSchema = z.object({
  organizationName: z.string().max(150).optional(),
  businessContext: z.string().max(2_000).optional(),
  contentType: z.string().max(100).optional(),
  targetAudience: z.string().max(1_000).optional(),
  courseTitle: z.string().max(250).optional(),
  promotionOffer: z.string().max(500).optional(),
  tone: z.string().max(200).optional(),
  tacticalMode: z.enum(['adquisicion', 'conversion', 'aceleracion', 'completo']).optional(),
});

const growthSystemRequestSchema = z.object({
  organizationName: z.string().max(150).optional(),
  productName: z.string().min(1).max(250),
  targetMarket: z.string().min(1).max(1_000),
  offerPromise: z.string().max(1_000).optional(),
  adBudget: z.number().min(0).optional(),
  dailySalesGoal: z.number().min(0).optional(),
  closeRatePercent: z.number().min(0).max(100).optional(),
  bottleneck: z.string().max(1_500).optional(),
  channels: z.array(z.string().max(80)).max(20).optional(),
});

const creativeBriefRequestSchema = z.object({
  organizationName: z.string().max(150).optional(),
  courseTitle: z.string().max(250),
  creativeType: z.enum(['Flyer', 'Video 30s', 'Video 60s', 'Carrusel', 'Landing Hero']),
  targetAudience: z.string().max(1_000),
  promotionOffer: z.string().max(500).optional(),
  launchDate: z.string().max(40).optional(),
  relaunchDate: z.string().max(40).optional(),
  brandInstructions: z.string().max(1_000).optional(),
});

const ecfInvoiceRequestSchema = z.object({
  organizationName: z.string().max(150).optional(),
  issuer: z.record(z.string(), z.unknown()),
  receiver: z.record(z.string(), z.unknown()),
  invoiceType: z.string().max(120),
  items: z.array(z.record(z.string(), z.unknown())).min(1).max(50),
  currency: z.string().max(10).default('DOP'),
  paymentStatus: z.string().max(40).optional(),
  notes: z.string().max(2_000).optional(),
});

const accountingReportRequestSchema = z.object({
  organizationName: z.string().max(150).optional(),
  period: z.string().max(80),
  reportType: z.enum([
    'Estado de resultados',
    'Balance general',
    'Estado de flujo de efectivo',
    'Orden de compra',
    'Recibo de caja',
    'Conciliación bancaria',
    'Inventario diario',
  ]),
  sourceData: z.record(z.string(), z.unknown()),
  notes: z.string().max(2_000).optional(),
});

const auditEventSchema = z.object({
  actorType: z.enum(['Sistema', 'Agente IA', 'Usuario', 'Webhook', 'Integración']),
  actorName: z.string().max(150),
  module: z.string().max(80),
  action: z.string().max(80),
  entityType: z.string().max(120),
  entityId: z.string().max(120).optional(),
  summary: z.string().max(500),
  details: z.string().max(4_000),
  sourceChannel: z.string().max(120).optional(),
  severity: z.enum(['Info', 'Éxito', 'Advertencia', 'Crítico']),
  status: z.enum(['Registrado', 'Pendiente revisión', 'Resuelto']),
});

const serverAuditEvents: Array<
  z.infer<typeof auditEventSchema> & { id: string; timestamp: string }
> = [];

function recordServerAudit(event: z.infer<typeof auditEventSchema>) {
  const entry = {
    id: `srv_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  serverAuditEvents.unshift(entry);
  serverAuditEvents.splice(500);
  console.log('Audit event recorded', {
    id: entry.id,
    module: entry.module,
    action: entry.action,
    entityType: entry.entityType,
  });
  return entry;
}

// Lazy initialization of Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('AI_NOT_CONFIGURED');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Sales AI CRM',
    deploymentMode: DEPLOYMENT_MODE,
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    authConfigured: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
    integrations: {
      whatsappConfigured: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
      ),
      metaConfigured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
      googleAdsConfigured: Boolean(
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_REFRESH_TOKEN,
      ),
      paymentsConfigured: Boolean(
        process.env.PAYMENT_PROVIDER && process.env.PAYMENT_WEBHOOK_SECRET,
      ),
      adPaymentsConfigured: Boolean(
        process.env.AD_PAYMENT_PROVIDER && process.env.AD_PAYMENT_WEBHOOK_SECRET,
      ),
      dgiiConfigured: Boolean(
        process.env.DGII_ECF_PROVIDER_API_KEY || process.env.DGII_ECF_CERTIFICATE_PATH,
      ),
    },
  });
});

app.get('/api/runtime/config', (_req, res) => {
  res.json({
    app: 'Sales AI CRM',
    deploymentMode: DEPLOYMENT_MODE,
    appUrl: process.env.APP_URL || `http://localhost:${PORT}`,
    authLoginPath: '/api/auth/login',
    authLogoutPath: '/api/auth/logout',
    whatsappWebhookPath: '/api/webhooks/meta/whatsapp',
    metaLeadWebhookPath: '/api/webhooks/meta/leadgen',
    googleAdsWebhookPath: '/api/webhooks/google-ads/leads',
    youtubeWebhookPath: '/api/webhooks/youtube/events',
    webFormsWebhookPath: '/api/webhooks/web/forms',
    paymentsWebhookPath: '/api/webhooks/payments',
    dgiiWebhookPath: '/api/webhooks/dgii/ecf-status',
    growthSystemAiPath: '/api/ai/generate-growth-system',
    ecfInvoiceAiPath: '/api/ai/generate-ecf-invoice',
    accountingReportAiPath: '/api/ai/generate-accounting-report',
  });
});

app.post('/api/auth/login', (req, res) => {
  const parsed = authLoginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, error: 'INVALID_LOGIN_REQUEST', details: parsed.error.flatten() });
  }

  const configuredEmail = process.env.ADMIN_EMAIL || process.env.CRM_ADMIN_EMAIL;
  const configuredPassword = process.env.ADMIN_PASSWORD || process.env.CRM_ADMIN_PASSWORD;
  const isProductionLike =
    process.env.NODE_ENV === 'production' || DEPLOYMENT_MODE === 'production';

  if (!configuredEmail || !configuredPassword) {
    if (isProductionLike) {
      return res.status(503).json({
        success: false,
        error: 'AUTH_NOT_CONFIGURED',
        message: 'Configura ADMIN_EMAIL y ADMIN_PASSWORD en Render Environment.',
      });
    }
  }

  const expectedEmail = configuredEmail || 'admin@inteca.com.do';
  const expectedPassword = configuredPassword || 'Inteca2026!';
  const emailMatches =
    parsed.data.email.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  const passwordMatches = parsed.data.password === expectedPassword;

  if (!emailMatches || !passwordMatches) {
    recordServerAudit({
      actorType: 'Usuario',
      actorName: parsed.data.email,
      module: 'Seguridad',
      action: 'Falló',
      entityType: 'LoginAttempt',
      summary: 'Intento de inicio de sesión rechazado.',
      details: `Correo: ${parsed.data.email}.`,
      sourceChannel: 'Web',
      severity: 'Advertencia',
      status: 'Registrado',
    });

    return res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos.',
    });
  }

  const session = {
    mode: 'real',
    userName: process.env.ADMIN_NAME || 'Luis Ramirez',
    email: expectedEmail,
    role: 'Super Admin CRM',
    organizationName: process.env.ADMIN_ORGANIZATION || 'INTECA SRL',
    token: `crm_${crypto.randomBytes(24).toString('hex')}`,
    loginAt: new Date().toISOString(),
  };

  recordServerAudit({
    actorType: 'Usuario',
    actorName: session.userName,
    module: 'Seguridad',
    action: 'Validó',
    entityType: 'LoginSession',
    summary: 'Inicio de sesión real aprobado.',
    details: `Organización: ${session.organizationName}. Correo: ${session.email}.`,
    sourceChannel: 'Web',
    severity: 'Éxito',
    status: 'Registrado',
  });

  return res.json({ success: true, session });
});

app.post('/api/auth/logout', (_req, res) => {
  recordServerAudit({
    actorType: 'Usuario',
    actorName: 'Usuario CRM',
    module: 'Seguridad',
    action: 'Cerró',
    entityType: 'LoginSession',
    summary: 'Sesión cerrada desde la interfaz del CRM.',
    details: 'El cliente limpió la sesión local. No se conservaron credenciales en el navegador.',
    sourceChannel: 'Web',
    severity: 'Info',
    status: 'Registrado',
  });

  return res.json({ success: true });
});

// Meta WhatsApp Cloud API webhook verification.
app.get('/api/webhooks/meta/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expectedToken && typeof challenge === 'string') {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Meta expects a quick 200 response. Store/process asynchronously when persistence is wired.
app.post('/api/webhooks/meta/whatsapp', (req, res) => {
  const event = req.body;

  try {
    if (event?.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    const messages =
      event.entry?.flatMap(
        (entry: any) => entry.changes?.flatMap((change: any) => change.value?.messages || []) || [],
      ) || [];

    const statuses =
      event.entry?.flatMap(
        (entry: any) => entry.changes?.flatMap((change: any) => change.value?.statuses || []) || [],
      ) || [];

    recordServerAudit({
      actorType: 'Webhook',
      actorName: 'Meta WhatsApp Cloud API',
      module: 'Integraciones',
      action: 'Recibió',
      entityType: 'WhatsAppEvent',
      summary: 'Evento recibido desde WhatsApp Cloud API.',
      details: `Mensajes: ${messages.length}. Estados: ${statuses.length}.`,
      sourceChannel: 'WhatsApp',
      severity: 'Info',
      status: 'Registrado',
    });

    console.log('Meta WhatsApp webhook received', {
      messages: messages.length,
      statuses: statuses.length,
      receivedAt: new Date().toISOString(),
    });

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error processing Meta WhatsApp webhook:', error);
    return res.sendStatus(200);
  }
});

// Audit API prepared for database persistence once production storage is connected.
app.get('/api/audit/events', (_req, res) => {
  res.json({
    success: true,
    events: serverAuditEvents,
    persistence: process.env.DATABASE_URL ? 'database-ready' : 'memory-runtime',
    deploymentMode: DEPLOYMENT_MODE,
  });
});

app.post('/api/audit/events', (req, res) => {
  const parsed = auditEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, error: 'INVALID_AUDIT_EVENT', details: parsed.error.flatten() });
  }

  const entry = recordServerAudit(parsed.data);
  return res.status(201).json({ success: true, event: entry });
});

// Meta Lead Ads / Facebook / Instagram webhook verification.
app.get('/api/webhooks/meta/leadgen', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expectedToken && typeof challenge === 'string') {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post('/api/webhooks/meta/leadgen', (req, res) => {
  const entries = Array.isArray(req.body?.entry) ? req.body.entry.length : 0;
  recordServerAudit({
    actorType: 'Webhook',
    actorName: 'Meta Lead Ads',
    module: 'Integraciones',
    action: 'Recibió',
    entityType: 'MetaLeadEvent',
    summary: 'Evento recibido desde Facebook/Instagram/Meta Lead Ads.',
    details:
      'El CRM está preparado para mapear formularios instantáneos a leads cuando se conecten página, cuenta publicitaria y permisos.',
    sourceChannel: 'Meta Ads',
    severity: 'Info',
    status: 'Registrado',
  });
  return res.status(200).json({ success: true, receivedEntries: entries });
});

app.post('/api/webhooks/google-ads/leads', (req, res) => {
  recordServerAudit({
    actorType: 'Webhook',
    actorName: 'Google Ads',
    module: 'Integraciones',
    action: 'Recibió',
    entityType: 'GoogleAdsLead',
    summary: 'Lead o conversión recibida desde Google Ads.',
    details:
      'El endpoint está listo para registrar campaña, keyword, UTM, conversión y costo cuando se conecte OAuth/Developer Token.',
    sourceChannel: 'Google Ads',
    severity: 'Info',
    status: 'Registrado',
  });
  return res.status(200).json({ success: true, payloadAccepted: Boolean(req.body) });
});

app.post('/api/webhooks/youtube/events', (req, res) => {
  recordServerAudit({
    actorType: 'Webhook',
    actorName: 'YouTube',
    module: 'Integraciones',
    action: 'Recibió',
    entityType: 'YouTubeEvent',
    summary: 'Evento de video o campaña recibido desde YouTube.',
    details:
      'El CRM está preparado para asociar videos, Shorts y anuncios a campañas y leads cuando se conecte canal/API.',
    sourceChannel: 'YouTube',
    severity: 'Info',
    status: 'Registrado',
  });
  return res.status(200).json({ success: true, payloadAccepted: Boolean(req.body) });
});

app.post('/api/webhooks/web/forms', (req, res) => {
  recordServerAudit({
    actorType: 'Webhook',
    actorName: 'Landing Page / Web Form',
    module: 'Leads',
    action: 'Recibió',
    entityType: 'WebFormLead',
    summary: 'Formulario web recibido para crear o actualizar lead.',
    details:
      'El payload puede mapear nombre, WhatsApp, correo, curso, campaña, UTM y consentimiento cuando se conecte la landing.',
    sourceChannel: 'Web Form',
    severity: 'Info',
    status: 'Registrado',
  });
  return res.status(200).json({ success: true, payloadAccepted: Boolean(req.body) });
});

app.post('/api/webhooks/payments', (req, res) => {
  recordServerAudit({
    actorType: 'Webhook',
    actorName: 'Payment Provider',
    module: 'Pagos',
    action: 'Recibió',
    entityType: 'PaymentWebhook',
    summary: 'Evento de pago recibido.',
    details:
      'El CRM está preparado para validar firma, confirmar pago, actualizar oportunidad, disparar factura y notificar al dueño cuando se conecte la pasarela.',
    sourceChannel: 'API',
    severity: 'Advertencia',
    status: 'Pendiente revisión',
  });
  return res.status(200).json({ success: true, payloadAccepted: Boolean(req.body) });
});

app.post('/api/webhooks/dgii/ecf-status', (req, res) => {
  recordServerAudit({
    actorType: 'Webhook',
    actorName: 'DGII / Proveedor e-CF',
    module: 'Facturación',
    action: 'Recibió',
    entityType: 'ElectronicInvoiceStatus',
    summary: 'Estado de factura electrónica recibido.',
    details:
      'El CRM está preparado para registrar aceptaciones, rechazos y observaciones cuando se conecte proveedor/certificado fiscal.',
    sourceChannel: 'API',
    severity: 'Advertencia',
    status: 'Pendiente revisión',
  });
  return res.status(200).json({ success: true, payloadAccepted: Boolean(req.body) });
});

// 1. AI Multi-Agent Sales & Negotiation Endpoint
app.post('/api/ai/chat-agent', async (req, res) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    }
    const {
      agentRole,
      agentName,
      systemPrompt,
      leadName,
      leadEmail,
      leadPhone,
      courseTitle,
      conversationHistory,
      userMessage,
      currentEmotion,
      buyProbability,
      organizationName,
      businessContext,
    } = parsed.data;

    const ai = getGeminiClient();

    const formattedHistory = Array.isArray(conversationHistory)
      ? conversationHistory
          .map(
            (m: any) =>
              `${m.sender === 'lead' ? leadName || 'Cliente' : m.agentName || 'Agente'}: ${m.content}`,
          )
          .join('\n')
      : '';

    const promptInstruction = `
${systemPrompt || 'Eres un asesor comercial profesional. No inventes precios, promociones, disponibilidad ni condiciones.'}

ORGANIZACIÓN: ${organizationName || 'Organización principal'}
CONTEXTO DEL NEGOCIO: ${businessContext || 'No especificado'}

CONTEXTO DEL LEAD:
- Nombre: ${leadName || 'Cliente'}
- Correo: ${leadEmail || 'No especificado'}
- Teléfono/WhatsApp: ${leadPhone || 'No especificado'}
- Producto o servicio de interés: ${courseTitle || 'No especificado'}
- Emoción Detectada: ${currentEmotion || 'Interesado'}
- Probabilidad de Compra: ${buyProbability || 75}%

HISTORIAL PREVIO:
${formattedHistory}

MENSAJE MÁS RECIENTE DEL CLIENTE:
"${userMessage}"

INSTRUCCIONES DE RESPUESTA:
1. Responde de manera sumamente natural, profesional, persuasiva y empática.
2. Utiliza únicamente la información proporcionada en el contexto y el historial.
3. No prometas descuentos, disponibilidad, pagos o condiciones que no estén expresamente autorizados.
4. Mantén una llamada a la acción clara, sin afirmar que ejecutaste acciones externas.
5. Si falta información, indícalo y solicita intervención humana.
6. Detecta la necesidad principal del cliente y adapta la oferta a esa necesidad.
7. Explica el beneficio práctico: qué aprenderá/recibirá, cómo mejora su vida, empleo, ventas u operación.
8. Crea urgencia ética mostrando el costo de no actuar y el siguiente paso concreto.
9. Si el cliente está listo para pagar, orienta hacia pago validado; no marques cliente/matriculado sin confirmación real.
10. Sugiere próxima acción de seguimiento si no compra ahora.
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: promptInstruction,
      config: {
        temperature: 0.7,
      },
    });

    const replyText = response.text?.trim();
    if (!replyText) throw new Error('AI_EMPTY_RESPONSE');

    res.json({
      success: true,
      agentName: agentName || 'Agente comercial IA',
      agentRole: agentRole || 'Closer de Ventas',
      reply: replyText,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/ai/chat-agent:', error);
    const notConfigured = error instanceof Error && error.message === 'AI_NOT_CONFIGURED';
    res.status(notConfigured ? 503 : 500).json({
      success: false,
      error: notConfigured ? 'AI_NOT_CONFIGURED' : 'AI_REQUEST_FAILED',
      requiresHumanReview: true,
    });
  }
});

// 2. AI Predictive Lead Scoring & Profiling Endpoint
app.post('/api/ai/qualify-lead', async (req, res) => {
  try {
    const parsed = qualifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    }
    const { leadData } = parsed.data;
    const ai = getGeminiClient();

    const prompt = `
Analiza la siguiente información comercial y realiza una calificación orientativa. No uses características sensibles y no inventes datos ausentes:

DATOS DEL LEAD:
${JSON.stringify(leadData, null, 2)}

Infiere y genera en formato JSON estricto los siguientes campos:
1. aiScore (número de 0 a 100)
2. buyProbability (número de 0 a 100)
3. recommendedCourseId (ID del curso más afín)
4. currentEmotion ("Muy Entusiasta", "Interesado", "Neutral", "Indeciso", "Escéptico", "Urgente", "Molesto")
5. discType ("Dominante", "Influyente", "Estable", "Concienzudo")
6. decisionSpeed ("Rápida", "Analítica", "Basada en Precio", "Lenta")
7. dominantPainPoint (resumen corto de su dolor o necesidad principal)
8. buyingMotivation (motivación de compra principal)
9. recommendedNextAction (siguiente paso sugerido para el vendedor o agente IA)
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiScore: { type: Type.NUMBER },
            buyProbability: { type: Type.NUMBER },
            recommendedCourseId: { type: Type.STRING },
            currentEmotion: { type: Type.STRING },
            discType: { type: Type.STRING },
            decisionSpeed: { type: Type.STRING },
            dominantPainPoint: { type: Type.STRING },
            buyingMotivation: { type: Type.STRING },
            recommendedNextAction: { type: Type.STRING },
          },
          required: [
            'aiScore',
            'buyProbability',
            'currentEmotion',
            'discType',
            'recommendedNextAction',
          ],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      analysis: parsedJson,
    });
  } catch (error: unknown) {
    console.error('Error in /api/ai/qualify-lead:', error);
    const notConfigured = error instanceof Error && error.message === 'AI_NOT_CONFIGURED';
    res.status(notConfigured ? 503 : 500).json({
      success: false,
      error: notConfigured ? 'AI_NOT_CONFIGURED' : 'AI_QUALIFICATION_FAILED',
      requiresHumanReview: true,
    });
  }
});

// 3. AI Marketing Generator (Emails, WhatsApp Blasts, Ad Copies, Landing Pages)
app.post('/api/ai/generate-marketing', async (req, res) => {
  try {
    const parsed = marketingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    }
    const {
      contentType,
      targetAudience,
      courseTitle,
      promotionOffer,
      tone,
      organizationName,
      businessContext,
      tacticalMode,
    } = parsed.data;
    const ai = getGeminiClient();

    const prompt = `
Eres especialista de marketing de ${organizationName || 'una organización comercial'}. Genera contenido publicitario sin inventar beneficios, certificaciones, precios ni promociones.

CONTEXTO DEL NEGOCIO: ${businessContext || 'No especificado'}

TIPO DE CONTENIDO: ${contentType || 'WhatsApp Campaign'}
PÚBLICO OBJETIVO: ${targetAudience || 'Profesionales interesados en IA'}
PRODUCTO O SERVICIO: ${courseTitle || 'No especificado'}
PROMOCIÓN / OFERTA AUTORIZADA: ${promotionOffer || 'Ninguna'}
TONO DE VOZ: ${tone || 'Persuasivo, Profesional y Urgente'}
MODO TÁCTICO: ${tacticalMode || 'completo'}

Instrucciones:
1. Diseña el mensaje para adquisición, conversión y aceleración, según aplique.
2. Identifica una ventaja injusta del negocio a partir del contexto y úsala sin exagerar ni inventar.
3. Explica la función práctica del técnico, producto o servicio; qué aprenderá/recibirá el cliente; cómo mejora su vida, empleo, ingresos u operación.
4. Crea urgencia ética: oportunidad clara, beneficio fuerte y costo de no actuar.
5. No prometas resultados garantizados ni cifras irreales. Si una meta es aspiracional, preséntala como objetivo operativo.

Proporciona el resultado estructurado en JSON con los campos:
- title: Título o asunto de la campaña
- bodyText: Texto principal persuasivo con emojis adecuados, ganchos AIDA/PAS y llamada a la acción
- callToAction: Texto de botón o respuesta rápida
- suggestedImagePrompt: Un prompt descriptivo en inglés para generar una imagen/banner publicitario impactante.
- flyerSpec: Objeto con headline, visual y requiredElements para que una IA de imagen genere el flyer.
- videoScript: Guion por escenas para video de 30 a 60 segundos si aplica.
- adAngles: Ángulos de anuncios para probar en Meta Ads, Google Ads y YouTube.
- ownerNextActions: Acciones que el dueño debe aprobar o revisar.
- funnelPlan: Tres pasos concretos para adquisición, conversión y aceleración.
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            bodyText: { type: Type.STRING },
            callToAction: { type: Type.STRING },
            suggestedImagePrompt: { type: Type.STRING },
            flyerSpec: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                visual: { type: Type.STRING },
                requiredElements: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
            videoScript: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            adAngles: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            ownerNextActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            funnelPlan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'bodyText', 'callToAction'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      content: parsedJson,
    });
  } catch (error: unknown) {
    console.error('Error in /api/ai/generate-marketing:', error);
    const notConfigured = error instanceof Error && error.message === 'AI_NOT_CONFIGURED';
    res.status(notConfigured ? 503 : 500).json({
      success: false,
      error: notConfigured ? 'AI_NOT_CONFIGURED' : 'AI_MARKETING_FAILED',
    });
  }
});

// 4. AI Growth, Marketing, Advertising and Sales System Generator
app.post('/api/ai/generate-growth-system', async (req, res) => {
  try {
    const parsed = growthSystemRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    }

    const {
      organizationName,
      productName,
      targetMarket,
      offerPromise,
      adBudget,
      dailySalesGoal,
      closeRatePercent,
      bottleneck,
      channels,
    } = parsed.data;
    const ai = getGeminiClient();

    const prompt = `
Eres un director senior de crecimiento, marketing, publicidad, embudos y ventas para ${organizationName || 'la empresa'}.
Tu trabajo es preparar un sistema comercial completo para vender cualquier producto o servicio con ejecucion 24/7, medicion, auditoria y enfoque a resultados.

PRODUCTO / SERVICIO: ${productName}
NICHO / MERCADO: ${targetMarket}
PROMESA AUTORIZADA: ${offerPromise || 'No especificada'}
PRESUPUESTO DE PAUTA: ${adBudget || 0}
META DE VENTAS DIARIAS: ${dailySalesGoal || 5}
TASA DE CIERRE ESTIMADA: ${closeRatePercent || 12}%
CUELLO DE BOTELLA: ${bottleneck || 'No especificado'}
CANALES: ${(channels || ['Meta Ads', 'Google Ads', 'YouTube', 'WhatsApp', 'Landing Page']).join(', ')}

Reglas:
1. Trata las metas de ventas, ROAS o 80% como objetivos operativos, nunca como garantias.
2. No inventes avales, testimonios, descuentos, fechas, certificaciones ni resultados que no fueron suministrados.
3. Crea necesidad de forma etica: dolor real, oportunidad, costo de no actuar y siguiente paso claro.
4. Explica funcion practica, resultado esperado, mejora de vida, empleo, ingresos u operacion.
5. Incluye adquisicion, conversion y aceleracion con tacticas accionables.
6. Debe servir para Meta Ads, Google Ads, YouTube, WhatsApp, landing, email y retargeting.
7. Indica que debe aprobar el dueno y que puede ejecutar cada agente de IA.
8. Incluye plan para romper el cuello de botella y escalar sin depender de trabajo manual del dueno.

Devuelve JSON estricto con:
- marketDiagnosis: diagnostico del nicho, dolores, deseos, disparadores y objeciones.
- unfairAdvantage: ventaja injusta o diferenciador defendible.
- offerArchitecture: promesa, stack de valor, urgencia, bonos permitidos, prueba de valor y CTA.
- acquisitionPlan: acciones de pauta, contenido y segmentacion por canal.
- adAngles: angulos de anuncio imposibles de ignorar para frio, tibio y caliente.
- creativeBriefs: briefs para flyer, carrusel, Reels/Shorts y video 30-60 segundos.
- funnelStages: etapas anuncio -> landing/WhatsApp -> diagnostico -> oferta -> pago -> onboarding -> referidos.
- salesScripts: guiones de prospeccion, calificacion, cierre y recuperacion.
- objectionMap: objeciones principales y respuestas consultivas.
- followUpCadence: secuencia 0h, 24h, 72h, 7 dias y reactivacion.
- kpiPlan: CPL, CAC, ROAS, CTR, tasa de conversion, tasa de cierre, ventas diarias y alertas.
- bottleneckBreakers: acciones para desbloquear el principal cuello de botella.
- ownerNotifications: exactamente que debe recibir el dueno: pagos, llamadas a realizar, bloqueos y aprobaciones.
- implementationChecklist: pasos de ejecucion para dejar el sistema listo.
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            marketDiagnosis: { type: Type.OBJECT },
            unfairAdvantage: { type: Type.STRING },
            offerArchitecture: { type: Type.OBJECT },
            acquisitionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            adAngles: { type: Type.ARRAY, items: { type: Type.STRING } },
            creativeBriefs: { type: Type.ARRAY, items: { type: Type.STRING } },
            funnelStages: { type: Type.ARRAY, items: { type: Type.STRING } },
            salesScripts: { type: Type.ARRAY, items: { type: Type.STRING } },
            objectionMap: { type: Type.ARRAY, items: { type: Type.STRING } },
            followUpCadence: { type: Type.ARRAY, items: { type: Type.STRING } },
            kpiPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            bottleneckBreakers: { type: Type.ARRAY, items: { type: Type.STRING } },
            ownerNotifications: { type: Type.ARRAY, items: { type: Type.STRING } },
            implementationChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'marketDiagnosis',
            'unfairAdvantage',
            'offerArchitecture',
            'funnelStages',
            'salesScripts',
            'kpiPlan',
            'ownerNotifications',
          ],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    recordServerAudit({
      actorType: 'Agente IA',
      actorName: 'Máximo Growth Strategist',
      module: 'Marketing',
      action: 'Generó',
      entityType: 'GrowthSystem',
      summary: `Sistema de marketing, publicidad y ventas generado para ${productName}.`,
      details: `Mercado: ${targetMarket}. Presupuesto: ${adBudget || 0}. Meta diaria: ${dailySalesGoal || 5}. Canales: ${(channels || []).join(', ') || 'No especificados'}.`,
      sourceChannel: 'Sistema',
      severity: 'Éxito',
      status: 'Registrado',
    });

    res.json({ success: true, growthSystem: parsedJson });
  } catch (error: unknown) {
    console.error('Error in /api/ai/generate-growth-system:', error);
    const notConfigured = error instanceof Error && error.message === 'AI_NOT_CONFIGURED';
    res.status(notConfigured ? 503 : 500).json({
      success: false,
      error: notConfigured ? 'AI_NOT_CONFIGURED' : 'AI_GROWTH_SYSTEM_FAILED',
      requiresHumanReview: true,
    });
  }
});

// 5. AI Creative Brief Generator (flyers, images, video scripts and launch assets)
app.post('/api/ai/generate-creative-brief', async (req, res) => {
  try {
    const parsed = creativeBriefRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    }

    const {
      organizationName,
      courseTitle,
      creativeType,
      targetAudience,
      promotionOffer,
      launchDate,
      relaunchDate,
      brandInstructions,
    } = parsed.data;

    const ai = getGeminiClient();

    const prompt = `
Eres un director creativo de performance marketing para ${organizationName || 'INTECA'}.
Debes crear un brief listo para una herramienta de generación de imágenes o video.

PIEZA: ${creativeType}
CURSO / PRODUCTO: ${courseTitle}
PÚBLICO: ${targetAudience}
OFERTA AUTORIZADA: ${promotionOffer || 'No especificada'}
LANZAMIENTO: ${launchDate || 'No especificado'}
RELANZAMIENTO: ${relaunchDate || 'No especificado'}
MARCA: ${brandInstructions || 'Usar logo INTECA, tono profesional, claro, educativo y orientado a resultados.'}

Reglas:
1. No inventes avales, precios, fechas ni garantías no indicadas.
2. La pieza debe crear deseo y necesidad de forma ética, con beneficio práctico y CTA fuerte.
3. Si es flyer, incluye escena visual, texto principal, CTA, elementos obligatorios y prompt de imagen en inglés.
4. Si es video, incluye guion por segundos, texto en pantalla, voz en off, escenas, portada y CTA.
5. Debe ser útil para Meta Ads, WhatsApp, YouTube Shorts/Reels y landing.

Devuelve JSON estricto con:
- title
- creativeType
- imagePrompt
- flyerSpec: { headline, subheadline, visual, layout, requiredElements }
- videoScript: lista de escenas por tiempo
- storyboard: lista de escenas visuales
- copyBlocks: lista de textos utilizables en la pieza
- recommendedFormats: lista de formatos
- requiredApprovals: lista de cosas que debe aprobar el dueño antes de publicar
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            creativeType: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
            flyerSpec: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                subheadline: { type: Type.STRING },
                visual: { type: Type.STRING },
                layout: { type: Type.STRING },
                requiredElements: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
            videoScript: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            storyboard: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            copyBlocks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendedFormats: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            requiredApprovals: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'creativeType', 'imagePrompt', 'copyBlocks'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    recordServerAudit({
      actorType: 'Agente IA',
      actorName: creativeType.includes('Video') ? 'Dante Video Ads' : 'Isabella Creativa',
      module: creativeType.includes('Video') ? 'Creativos' : 'Marketing',
      action: 'Generó',
      entityType: 'CreativeBrief',
      summary: `Brief creativo generado para ${courseTitle}.`,
      details: `Tipo: ${creativeType}. Público: ${targetAudience}. Oferta: ${promotionOffer || 'No especificada'}.`,
      sourceChannel: creativeType.includes('Video') ? 'YouTube' : 'Meta Ads',
      severity: 'Éxito',
      status: 'Registrado',
    });

    res.json({
      success: true,
      creative: parsedJson,
    });
  } catch (error: unknown) {
    console.error('Error in /api/ai/generate-creative-brief:', error);
    const notConfigured = error instanceof Error && error.message === 'AI_NOT_CONFIGURED';
    res.status(notConfigured ? 503 : 500).json({
      success: false,
      error: notConfigured ? 'AI_NOT_CONFIGURED' : 'AI_CREATIVE_BRIEF_FAILED',
    });
  }
});

// 6. AI e-CF Invoice Builder
app.post('/api/ai/generate-ecf-invoice', async (req, res) => {
  try {
    const parsed = ecfInvoiceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    }

    const {
      organizationName,
      issuer,
      receiver,
      invoiceType,
      items,
      currency,
      paymentStatus,
      notes,
    } = parsed.data;
    const ai = getGeminiClient();

    const prompt = `
Eres Sofía e-CF, agente de facturación electrónica para ${organizationName || 'la empresa'}.
Debes preparar la estructura de una factura electrónica e-CF dominicana lista para XML, PDF, firma digital y QR.

EMISOR:
${JSON.stringify(issuer, null, 2)}

RECEPTOR:
${JSON.stringify(receiver, null, 2)}

TIPO DE COMPROBANTE: ${invoiceType}
MONEDA: ${currency}
ESTADO DE PAGO: ${paymentStatus || 'Pendiente'}
NOTAS: ${notes || 'Sin notas'}

ITEMS:
${JSON.stringify(items, null, 2)}

Reglas:
1. Incluye encabezado fiscal con emisor, receptor, RNC, dirección fiscal y fecha.
2. Incluye número e-CF pendiente de secuencia real si no fue suministrado.
3. Incluye detalle comercial: cantidad, descripción, precio unitario, descuentos y total.
4. Desglosa impuestos: gravado, exento, ITBIS, ISC, otros cargos y total.
5. Incluye campos de firma digital y QR como pendientes si no hay certificado conectado.
6. No afirmes envío a DGII sin credenciales reales.
7. Devuelve JSON estricto y auditable.
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fiscalHeader: { type: Type.OBJECT },
            eCfNumber: { type: Type.STRING },
            lineItems: { type: Type.ARRAY, items: { type: Type.OBJECT } },
            taxBreakdown: { type: Type.OBJECT },
            xmlDraft: { type: Type.STRING },
            pdfSummary: { type: Type.STRING },
            digitalSignatureStatus: { type: Type.STRING },
            qrPayload: { type: Type.STRING },
            requiredApprovals: { type: Type.ARRAY, items: { type: Type.STRING } },
            auditNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['fiscalHeader', 'eCfNumber', 'lineItems', 'taxBreakdown', 'auditNotes'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    recordServerAudit({
      actorType: 'Agente IA',
      actorName: 'Sofía e-CF',
      module: 'Facturación',
      action: 'Generó',
      entityType: 'ElectronicInvoiceDraft',
      summary: `Factura e-CF preparada para ${String(receiver?.legalName || receiver?.name || 'cliente')}.`,
      details: `Tipo: ${invoiceType}. Items: ${items.length}. Moneda: ${currency}.`,
      sourceChannel: 'Sistema',
      severity: 'Éxito',
      status: 'Pendiente revisión',
    });

    res.json({ success: true, invoiceDraft: parsedJson });
  } catch (error: unknown) {
    console.error('Error in /api/ai/generate-ecf-invoice:', error);
    const notConfigured = error instanceof Error && error.message === 'AI_NOT_CONFIGURED';
    res.status(notConfigured ? 503 : 500).json({
      success: false,
      error: notConfigured ? 'AI_NOT_CONFIGURED' : 'AI_ECF_INVOICE_FAILED',
      requiresHumanReview: true,
    });
  }
});

// 7. AI Accounting Report Builder
app.post('/api/ai/generate-accounting-report', async (req, res) => {
  try {
    const parsed = accountingReportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    }

    const { organizationName, period, reportType, sourceData, notes } = parsed.data;
    const ai = getGeminiClient();

    const prompt = `
Eres Bruno Contable IA, agente contable autónomo para ${organizationName || 'la empresa'}.
Debes preparar un documento contable estructurado, auditable y listo para revisión.

TIPO DE REPORTE/DOCUMENTO: ${reportType}
PERIODO: ${period}
NOTAS: ${notes || 'Sin notas'}

DATOS FUENTE:
${JSON.stringify(sourceData, null, 2)}

Reglas:
1. Para Estado de resultados, resume ingresos, costos, gastos y utilidad.
2. Para Balance general, presenta activos, pasivos y patrimonio. Usa estructura compatible con NIF B-6.
3. Para Flujo de efectivo, separa entradas, salidas y flujo neto.
4. Para órdenes de compra, recibos, conciliaciones e inventarios, genera campos completos y estado.
5. Si aplica adquisición de negocios, menciona NIF B-7 y los puntos de valuación.
6. No marques documento como aprobado sin revisión humana autorizada.
7. Devuelve JSON estricto con resumen, tablas, alertas y próximos pasos.
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reportTitle: { type: Type.STRING },
            period: { type: Type.STRING },
            executiveSummary: { type: Type.STRING },
            totals: { type: Type.OBJECT },
            tableRows: { type: Type.ARRAY, items: { type: Type.OBJECT } },
            alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
            nifReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            approvalStatus: { type: Type.STRING },
          },
          required: ['reportTitle', 'period', 'executiveSummary', 'totals', 'nextActions'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    recordServerAudit({
      actorType: 'Agente IA',
      actorName: 'Bruno Contable IA',
      module: 'Contabilidad',
      action: 'Generó',
      entityType: 'AccountingReport',
      summary: `${reportType} preparado para ${period}.`,
      details: `Reporte generado con datos fuente y pendiente de revisión/aprobación autorizada.`,
      sourceChannel: 'Sistema',
      severity: 'Éxito',
      status: 'Pendiente revisión',
    });

    res.json({ success: true, accountingReport: parsedJson });
  } catch (error: unknown) {
    console.error('Error in /api/ai/generate-accounting-report:', error);
    const notConfigured = error instanceof Error && error.message === 'AI_NOT_CONFIGURED';
    res.status(notConfigured ? 503 : 500).json({
      success: false,
      error: notConfigured ? 'AI_NOT_CONFIGURED' : 'AI_ACCOUNTING_REPORT_FAILED',
      requiresHumanReview: true,
    });
  }
});

// Server Initialization
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sales AI CRM listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
