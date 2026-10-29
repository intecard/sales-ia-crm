import { createServer } from 'node:http';
import { VoiceSalesAgent } from './voice/agent';
import { VoiceProvider } from './voice/provider';
import { voiceAdminRouter, voiceProviderRouter, attachVoiceRelay } from './voice/routes';
import { CommunityManager } from './community-manager';
import { CommunityPublisher } from './community-publisher';
import { CommunityDiagnostics } from './community-diagnostics';
import { GatewayPrecontract } from './payment-gateway-precontract';
import { gatewayAdminRouter, gatewayPublicRouter } from './payment-gateway-routes';
import { LocalVideoEngine } from './local-video-engine';
import { integratedReadiness } from './advertising-operational-readiness';
import {activationAudit} from './integration-activation-audit';
import { localVideoAdminRouter, localVideoWorkerRouter } from './local-video-routes';
import { IntequitoVideoProvider } from './intequito-video-provider';
import { HeyGenVideoProvider } from './heygen-video-provider';
import { contentHash } from './community-plan';
import { createTeamStudio } from './team/routes';
import { createAccountingRouter } from './accounting/routes';
import { probeMetaClient } from './meta-oauth-diagnostics';
import { FISCAL_RULE_VERSION } from './fiscal/engine';
import { AgentConnections } from './agent-connections';
import { createIntegrationOAuth } from './integration-oauth';
import { renderRequest, probeRenderPersistence, RenderPersistenceError } from './render-persistence';
import { createFiscalRouter } from './fiscal/routes';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { buildWhatsAppTextPayload, extractWhatsAppMessages, resolveWhatsAppRecipient, type WhatsAppRecipient } from './whatsapp-routing';

import { ConversationStore, conversationKey, rememberUser, rememberReply, isPaymentQuestion, CONVERSATION_RULES, type Conversation, type AwaitingField } from './whatsapp-conversation';

import { SalesStore, salesSignal, salesReply, SALES_RULES, issueSalesSession, verifySalesSession, type SalesOpportunity } from './sales-agent';

import { whatsAppGenerationConfig, parseWhatsAppAnswer, splitWhatsAppText } from './whatsapp-ai';

import { CatalogStore, catalogReply, catalogPaymentReply, catalogFallback, catalogPrompt, rememberCatalogCourse, unavailableCatalog, findCourses } from './whatsapp-catalog';

import { EnrollmentAgent, ENROLLMENT_ERRORS, enrollmentError, welcomeText } from './enrollment-agent';
import { adPlanSchema } from './advertising-plans';
import { AdvertisingAgent, ProviderAccessError, googleAdsAccessHelp, GOOGLE_ADS_CLOUD_CONSOLE, AD_RULES, AD_ERRORS, CHANNELS, campaignSchema, hasDiscount, hasUnlistedPrice, adError } from './advertising-agent';

dotenv.config();
const whatsAppCatalog = new CatalogStore();
void whatsAppCatalog.get();
const salesStore = new SalesStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const gatewayPrecontract=new GatewayPrecontract(salesStore);
void salesStore.verify();
const enrollmentAgent = new EnrollmentAgent(salesStore);
const advertisingAgent = new AdvertisingAgent(salesStore, whatsAppCatalog);
const agentConnections = new AgentConnections(advertisingAgent);
agentConnections.startMonitoring();
const communityPublisher = new CommunityPublisher(advertisingAgent);
const communityManager = new CommunityManager(salesStore, whatsAppCatalog, communityPublisher);
const communityDiagnostics = new CommunityDiagnostics(whatsAppCatalog,communityPublisher);
const localVideoEngine = new LocalVideoEngine(salesStore, whatsAppCatalog);
const intequitoVideoProvider = new IntequitoVideoProvider();
const heygenVideoProvider = new HeyGenVideoProvider();
const voiceSalesAgent = new VoiceSalesAgent(salesStore, whatsAppCatalog, new VoiceProvider(), async prompt => { const r=await generateGeminiContentWithFallback(prompt,{responseMimeType:'application/json',httpOptions:{timeout:12000,retryOptions:{attempts:1}},maxOutputTokens:512},true); return r.text||''; });
const voiceTimer=setInterval(()=>void voiceSalesAgent.tick(),60000);voiceTimer.unref();
const communityTimer = setInterval(() => { void communityManager.tick().then(() => communityManager.observe()); }, 60000);
communityTimer.unref();
const localVideoTimer = setInterval(() => { void localVideoEngine.autoTick().catch(() => {}); }, 60_000);
localVideoTimer.unref();
setTimeout(() => void communityManager.tick(), 20000).unref();
const advertisingTimer = setInterval(() => void advertisingAgent.tick(), 60000);
advertisingTimer.unref();
const enrollmentTimer = setInterval(() => void enrollmentAgent.tick(), 60000);
enrollmentTimer.unref();
setTimeout(() => void enrollmentAgent.tick(), 10000).unref();
const whatsAppConversations = new ConversationStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
void whatsAppConversations.verify();

const app = express();
const PORT = Number(process.env.PORT || 3000);
let DEPLOYMENT_MODE =
  process.env.DEPLOYMENT_MODE || process.env.VITE_DEPLOYMENT_MODE || 'production';

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const DEFAULT_GEMINI_FALLBACK_MODELS = [
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b'
];
const GEMINI_MODEL_RETRY_DELAY_MS = Number(process.env.GEMINI_MODEL_RETRY_DELAY_MS || 120_000);

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1' || process.env.RENDER) {
  app.set('trust proxy', 1);
}
app.use(helmet({ contentSecurityPolicy: false }));
app.use('/api/sales/:key/receipts', express.json({ limit: '8mb' }));
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

const integrationConfigureRequestSchema = z.object({
  adminEmail: z.string().email().max(200),
  adminPassword: z.string().min(1).max(200),
  forceProduction: z.boolean().optional(),
  redeploy: z.boolean().optional(),
  variables: z.record(z.string(), z.string().max(20_000)).default({}),
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

const conversionLeadRequestSchema = z.object({
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  fullName: z.string().max(240).optional(),
  name: z.string().max(240).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(60).optional(),
  whatsapp: z.string().max(60).optional(),
  whatsappUserId: z.string().max(140).optional(),
  courseId: z.string().max(120).optional(),
  courseTitle: z.string().max(250).optional(),
  source: z.string().max(120).optional(),
  message: z.string().max(4_000).optional(),
  campaign: z.string().max(250).optional(),
  organizationId: z.string().max(120).optional(),
  paymentConfirmed: z.boolean().optional(),
  paymentAmount: z.number().min(0).optional(),
  paymentTransactionId: z.string().max(180).optional(),
});

type ConversionLeadInput = z.infer<typeof conversionLeadRequestSchema>;

interface ServerConversionLead {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  whatsappUserId?: string;
  courseId?: string;
  courseTitle: string;
  source: string;
  campaign?: string;
  message?: string;
  organizationId: string;
  stageId: string;
  status: string;
  scoreAI: number;
  assignedAgentId: string;
  missingFields: string[];
  createdAt: string;
  updatedAt: string;
  lastInteractionAt: string;
  nextFollowUpAt: string;
}

interface ServerStudentEnrollment {
  id: string;
  leadId: string;
  studentCode: string;
  courseId?: string;
  courseTitle: string;
  paymentTransactionId: string;
  paymentAmount?: number;
  paidAt: string;
  status: string;
  campusUrl: string;
  campusEmail: string;
  campusTemporaryPassword: string;
  courseAccessCode: string;
  welcomeMessage: string;
  credentialsSentAt: string;
  nextAcademicFollowUpAt: string;
  campusSyncStatus: 'synced_or_ready' | 'pending_external_campus_api';
}

const serverAuditEvents: Array<
  z.infer<typeof auditEventSchema> & { id: string; timestamp: string }
> = [];

const serverConversionLeads: ServerConversionLead[] = [];
const serverStudentEnrollments: ServerStudentEnrollment[] = [];
const processedWhatsAppMessageIds = new Set<string>();
const inFlightWhatsAppMessageIds = new Set<string>();

function getConfiguredAdminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL || process.env.CRM_ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD || process.env.CRM_ADMIN_PASSWORD,
  };
}

function validateAdminCredentials(email: string, password: string) {
  const configuredCredentials = getConfiguredAdminCredentials();
  if (!configuredCredentials.email || !configuredCredentials.password) return false;
  return (
    email.trim().toLowerCase() === configuredCredentials.email.trim().toLowerCase() &&
    password === configuredCredentials.password
  );
}

const INTECA_AGENT_KNOWLEDGE_BASE = `
INTECA SRL, tambien conocida como Instituto Tecnico del Caribe, es una institucion de formacion tecnica en Republica Dominicana enfocada en cursos del sector salud, autorizaciones medicas, atencion al usuario, facturacion medica, Ley 87-01, farmacologia aplicada, enfermeria y capacitacion profesional.

Canales oficiales:
- Sitio web: https://www.inteca.com.do
- Instagram: @formacion.inteca
- WhatsApp principal: 809-643-5502
- Correo institucional actual: intecaedu@gmail.com

Instrucciones de pago: usar únicamente la configuración privada del servidor.

Reglas comerciales para agentes:
- Responder con tono dominicano profesional, claro, empatico y orientado a cierre.
- Explicar que aprendera la persona, como puede mejorar sus oportunidades laborales y por que conviene iniciar.
- Crear urgencia etica sin prometer empleo garantizado, ingresos garantizados, cupos falsos ni resultados irreales.
- Si el prospecto muestra interes, pedir nombre, telefono, curso de interes, horario preferido y si desea iniciar con la inscripcion.
- Si pregunta por pagos, orientar a que un asesor confirme el metodo de pago disponible o compartir instrucciones solo si estan configuradas oficialmente.
- Si falta informacion, reconocerlo y solicitar que un asesor humano confirme antes de prometer.
- Nunca inventar certificaciones, alianzas, descuentos, fechas de inicio, testimonios o beneficios no aprobados.
`;

const INTECA_AGENT_KNOWLEDGE_FILES = [
  'docs/knowledge/base_conocimiento_agentes_inteca.md',
  'docs/knowledge/inteca_guia_institucional_cursos_y_areas_laborales.md',
];

let cachedIntecaAgentKnowledgeBase: string | null = null;

function getAgentKnowledgeMaxChars() {
  const configuredLimit = Number(process.env.AGENT_KNOWLEDGE_MAX_CHARS || 48_000);
  if (!Number.isFinite(configuredLimit) || configuredLimit < 10_000) {
    return 48_000;
  }
  return configuredLimit;
}

function readAgentKnowledgeFile(relativePath: string) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    return '';
  }

  return readFileSync(absolutePath, 'utf-8').trim();
}

function getIntecaAgentKnowledgeBase() {
  if (cachedIntecaAgentKnowledgeBase) {
    return cachedIntecaAgentKnowledgeBase;
  }

  const fileKnowledge = INTECA_AGENT_KNOWLEDGE_FILES.map((relativePath) => {
    const content = readAgentKnowledgeFile(relativePath);
    if (!content) return '';
    return `FUENTE SECUNDARIA: ${relativePath}\n${content}`;
  }).filter(Boolean);

  const combinedKnowledge = [INTECA_AGENT_KNOWLEDGE_BASE.trim(), ...fileKnowledge]
    .join('\n\n---\n\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  const maxChars = getAgentKnowledgeMaxChars();
  cachedIntecaAgentKnowledgeBase =
    combinedKnowledge.length > maxChars
      ? `${combinedKnowledge.slice(0, maxChars)}\n\n[Base de conocimiento recortada por limite operativo. Prioriza datos confirmados y escala si falta informacion.]`
      : combinedKnowledge;

  return cachedIntecaAgentKnowledgeBase;
}

function buildAgentKnowledgePrompt(scope: string) {
  void whatsAppCatalog.get();
  const catalog = whatsAppCatalog.current();
  return `
BASE DE CONOCIMIENTO INSTITUCIONAL PARA TODOS LOS AGENTES DE INTECA
Alcance de uso: ${scope}.

${catalog ? catalogPrompt(catalog) : getIntecaAgentKnowledgeBase()}

REGLAS ESTRICTAS DE CONVERSACION Y SEGURIDAD:
1. IDENTIDAD Y SALUDO INICIAL: Si el usuario te saluda por primera vez o es el inicio de la conversación, DEBES responder textualmente con este formato: "¡Hola, [Nombre del cliente]! Un placer saludarte. Mi nombre es Mariela López, representante de información de INTECA. ¿En cuál de nuestros programas de capacitación te gustaría recibir información hoy?"
2. EXTRACCIÓN DE DATOS: Cuando un prospecto pregunte por un curso (ej: Atención al Usuario en Salud), DEBES leer la FUENTE PRINCIPAL (CATÁLOGO OFICIAL DE SUPABASE) y darle EXACTAMENTE la duración, los horarios disponibles y el precio que dice ahí. NO INVENTES horarios generales de fines de semana. Si el catálogo dice un horario específico, da ese. Si el catálogo NO menciona un horario o curso, di "Actualmente no tengo información confirmada sobre ese curso/horario, déjame que un asesor lo verifique."
3. PAGOS: No inventes cuentas ni métodos. Las instrucciones oficiales se proporcionan desde la configuración privada del servidor o, si existen, desde la sección de pagos del catálogo.
4. Sé amable, humano y dominicano neutral.
5. Puedes conversar de forma fluida, pero NUNCA asumas precios u horarios que no estén explícitamente en el Catálogo de Supabase.
`;
}

function getIntecaKnowledgeSourcesStatus() {
  return INTECA_AGENT_KNOWLEDGE_FILES.map((relativePath) => ({
    path: relativePath,
    loaded: Boolean(readAgentKnowledgeFile(relativePath)),
  }));
}

function getWhatsAppMessageText(message: any) {
  if (message?.type === 'text' && typeof message.text?.body === 'string') {
    return message.text.body.trim();
  }

  if (message?.type === 'button' && typeof message.button?.text === 'string') {
    return message.button.text.trim();
  }

  const interactive = message?.interactive;
  if (message?.type === 'interactive') {
    const buttonText = interactive?.button_reply?.title;
    const listText = interactive?.list_reply?.title;
    if (typeof buttonText === 'string') return buttonText.trim();
    if (typeof listText === 'string') return listText.trim();
  }

  if (typeof message?.[message?.type]?.caption === 'string') return message[message.type].caption.trim();

  return `Mensaje recibido de tipo ${message?.type || 'desconocido'}.`;
}

function findWhatsAppContactName(event: any, waId: string) {
  const contacts =
    event.entry?.flatMap(
      (entry: any) => entry.changes?.flatMap((change: any) => change.value?.contacts || []) || [],
    ) || [];
  const contact = contacts.find((item: any) =>
    item?.wa_id === waId || item?.user_id === waId || item?.parent_user_id === waId,
  );
  return contact?.profile?.name;
}

async function generateWhatsAppAutoReply(userMessage: string, conversation: Conversation, customerName?: string, hasPhone = false, salesState?: SalesOpportunity) {
  const instructions = process.env.WHATSAPP_PAYMENT_INSTRUCTIONS || '';

  if (salesState?.stage === 'won' && isPaymentQuestion(userMessage)) return { reply: 'Tu pago de inscripción ya está validado. El grupo y el acceso al campus están pendientes de confirmación. Si deseas pagar otro concepto, indícalo para que INTECA lo revise.', awaiting: '' as AwaitingField };
  if (salesState?.stage === 'payment_review' && isPaymentQuestion(userMessage)) return { reply: 'Tu aviso de pago está pendiente de revisión. No hace falta repetir la transferencia mientras INTECA verifica el comprobante.', awaiting: '' as AwaitingField };
  
  const catalog = await whatsAppCatalog.get();
  if (isPaymentQuestion(userMessage) || (conversation.awaiting === 'payment' && /^(sí|si|claro|por favor)[.!\s]*$/i.test(userMessage))) {
    const payment = catalogPaymentReply(catalog, conversation, instructions);
    const facts = catalogReply(catalog, conversation, userMessage);
    return facts ? { reply: `${facts.reply}\n\n${payment.reply}`, awaiting: payment.awaiting } : payment;
  }
  const factualAnswer = catalogReply(catalog, conversation, userMessage);
  if (factualAnswer) return factualAnswer;
  const fallback = salesState?.stage === 'won' ? { reply: 'Tu pago de inscripción está validado. Para otra consulta sobre tu matrícula puedes escribir a intecaedu@gmail.com.', awaiting: '' as AwaitingField } : salesState?.stage === 'payment_review' ? { reply: 'La revisión de tu pago está pendiente. No necesitas repetir la transferencia.', awaiting: '' as AwaitingField } : catalogFallback(conversation, userMessage, catalog);
  if (!catalog) return /^(hola|buenas|gracias)[!.\s]*$/i.test(userMessage) ? fallback : unavailableCatalog();
  if (!process.env.GEMINI_API_KEY) return fallback;
  try {
    const contents = JSON.stringify({
      salesState: salesState ? { stage: salesState.stage, objection: salesState.objection, expectedAmountDOP: salesState.expected_amount, nextAction: salesState.next_action } : null,
      profileName: customerName || null,
      phoneAlreadyKnown: hasPhone,
      rememberedFacts: conversation.facts,
      previousQuestionRequested: conversation.awaiting,
      history: conversation.turns,
    });
    const response = await generateGeminiContentWithFallback(contents, {
      systemInstruction: `${catalogPrompt(catalog)}\n\n${CONVERSATION_RULES}\n\n${SALES_RULES}`,
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          awaiting: { type: Type.STRING, enum: ['none', 'course', 'fullName', 'schedule', 'email', 'payment'], description: 'Usa none cuando la respuesta no solicite un dato.' },
        },
        required: ['reply', 'awaiting'],
      },
    }, true);
    return parseWhatsAppAnswer(response.text || '', response.candidates?.[0]?.finishReason, conversation);
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith('WHATSAPP_AI_') ? error.message : 'WHATSAPP_AI_PROVIDER_ERROR';
    console.warn('WhatsApp AI fallback', { reason });
    return fallback;
  }
}

async function sendWhatsAppTextMessage(recipient: WhatsAppRecipient, body: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphApiVersion = process.env.META_GRAPH_API_VERSION || 'v26.0';

  if (!accessToken || !phoneNumberId) {
    console.error(`🚨 ERROR CRÍTICO: Faltan credenciales de WhatsApp. Access Token presente: ${!!accessToken}, Phone ID presente: ${!!phoneNumberId}`);
    throw new Error('WHATSAPP_SEND_NOT_CONFIGURED');
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildWhatsAppTextPayload(recipient, body)),
    },
  );

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('🚨 WhatsApp Cloud API send failed', {
      status: response.status,
      responseBody,
    });
    throw new Error('WHATSAPP_SEND_FAILED');
  }

  return responseBody;
}

// Support phone-number and BSUID identities without converting IDs into phone numbers.
async function processWhatsAppInboundMessages(messages: any[], event: any) {
  console.log(`[DEBUG] WHATSAPP_AUTO_REPLY_ENABLED en Render: '${process.env.WHATSAPP_AUTO_REPLY_ENABLED}'`);

  if (process.env.WHATSAPP_AUTO_REPLY_ENABLED === 'false') {
    return;
  }

  for (const message of messages) {
    const messageId = message?.id;
    const recipient = resolveWhatsAppRecipient(message);
    if (!recipient || typeof messageId !== 'string' || !messageId) {
      console.warn('WhatsApp message skipped: unsupported type or missing sender/message ID', {
        type: message?.type,
        hasPhone: typeof message?.from === 'string',
        hasUserId: typeof message?.from_user_id === 'string',
      });
      continue;
    }

    const memoryKey = conversationKey(process.env.WHATSAPP_PHONE_NUMBER_ID || '', recipient.kind, recipient.id);
    await whatsAppConversations.serial(memoryKey, async () => {
      const senderPhone = recipient.kind === 'phone' ? recipient.id : '';
      const whatsappUserId = recipient.kind === 'bsuid' ? recipient.id : undefined;

      console.log('WhatsApp message accepted', { recipientKind: recipient.kind });

      if (processedWhatsAppMessageIds.has(messageId) || inFlightWhatsAppMessageIds.has(messageId)) {
        return;
      }

      inFlightWhatsAppMessageIds.add(messageId);
      try {

        const userMessage = getWhatsAppMessageText(message);
        const profileName = findWhatsAppContactName(event, recipient.id);
        const conversation = await whatsAppConversations.get(memoryKey);
        if (conversation.turns.some(turn => turn.role === 'assistant' && turn.id === messageId)) return;
        const previousSale = salesStore.configured() ? await salesStore.get(memoryKey) : undefined;
        if (previousSale) conversation.facts = { ...previousSale.profile, ...conversation.facts };
        rememberUser(conversation, userMessage, messageId, false);
        rememberCatalogCourse(await whatsAppCatalog.get(), conversation, userMessage);
        await whatsAppConversations.save(memoryKey, conversation);
        const customerName = conversation.facts.fullName || profileName;
        let sale: SalesOpportunity | undefined;
        const signal = salesSignal(userMessage, conversation, message.type);
        if (salesStore.configured()) {
          const settings = await salesStore.settings();
          sale = await salesStore.inbound(memoryKey, messageId, userMessage, {
            ...conversation.facts, profileName, ...(senderPhone ? { phone: senderPhone } : {}), ...(whatsappUserId ? { whatsappUserId } : {}),
          }, signal, String(message.type || ''), String(message[message.type]?.id || ''));
          // A paused or opted-out contact stays silent until a human intervenes.
          if (!settings?.enabled || (previousSale && previousSale.control !== 'auto')) return;
        }
    
        console.log('Processing incoming WhatsApp lead');

        const conversionResult = processConversionLead(
          {
            fullName: customerName,
            whatsapp: senderPhone,
            phone: senderPhone,
            whatsappUserId,
            source: 'WhatsApp',
            message: userMessage,
            courseTitle: conversation.facts.course || inferCourseTitle({ message: userMessage }),
            email: conversation.facts.email,
            organizationId: 'org_inteca_main',
          },
          'WhatsApp',
        );
    
        console.log('🧠 Generando respuesta con Gemini...');
    
        let enrollmentAnswer: { reply: string; awaiting: AwaitingField } | undefined;
        if (sale?.stage === 'won') {
          await enrollmentAgent.ensure(memoryKey);
          const enrollment = await enrollmentAgent.get(memoryKey);
          if (enrollment?.campus_status === 'active' && /matr[ií]cul|inscrip|acceso|campus|pago|curso/i.test(userMessage)) enrollmentAnswer = { reply: welcomeText(enrollment, process.env.INTECA_CAMPUS_BASE_URL || 'https://campus.inteca.com.do'), awaiting: '' };
        }
        const answer = enrollmentAnswer || (sale && salesReply(sale, signal, userMessage)) || await generateWhatsAppAutoReply(userMessage, conversation, customerName, Boolean(senderPhone), sale);
        const reply = answer.reply;

        console.log('Sending WhatsApp reply', { recipientKind: recipient.kind });
        for (const chunk of splitWhatsAppText(reply)) await sendWhatsAppTextMessage(recipient, chunk);
        rememberReply(conversation, reply, answer.awaiting, messageId);
        await whatsAppConversations.save(memoryKey, conversation);
        if (sale) {
          try { await salesStore.request('crm_sales_events', 'POST', { contact_key: memoryKey, external_id: `reply:${messageId}`, kind: 'reply', actor: 'Agente de Ventas INTECA', details: { text: reply } }); }
          catch { console.warn('Sales reply audit unavailable; WhatsApp response already sent and remembered'); }
        }
        processedWhatsAppMessageIds.add(messageId);
        if (processedWhatsAppMessageIds.size > 1_000) {
          const firstMessageId = processedWhatsAppMessageIds.values().next().value;
          if (firstMessageId) processedWhatsAppMessageIds.delete(firstMessageId);
        }
        console.log('✅ Respuesta enviada exitosamente.');

        recordServerAudit({
          actorType: 'Agente IA',
          actorName: 'Agente WhatsApp INTECA',
          module: 'WhatsApp',
          action: 'Respondió',
          entityType: 'WhatsAppMessage',
          entityId: messageId,
          summary: 'Respuesta automatizada enviada por WhatsApp Cloud API.',
          details: `Prospecto: ${customerName || senderPhone}. Mensaje recibido: ${userMessage}. Respuesta: ${reply}`,
          sourceChannel: 'WhatsApp',
          severity: 'Éxito',
          status: 'Registrado',
        });

        if (conversionResult.lead.missingFields.length === 0) {
          recordServerAudit({
            actorType: 'Agente IA',
            actorName: 'Agente IA Conversión y Matrícula',
            module: 'Leads',
            action: 'Calificó',
            entityType: 'ConversionLead',
            entityId: conversionResult.lead.id,
            summary: 'Lead de WhatsApp quedó listo para solicitar inscripción.',
            details: `Curso: ${conversionResult.lead.courseTitle}. Próximo seguimiento: ${conversionResult.lead.nextFollowUpAt}.`,
            sourceChannel: 'WhatsApp',
            severity: 'Info',
            status: 'Registrado',
          });
        }
      } catch (error) {
        // One failed message must not discard the rest of this webhook batch.
        console.error('WhatsApp auto reply failed', error);
        recordServerAudit({
          actorType: 'Agente IA', actorName: 'Agente WhatsApp INTECA', module: 'WhatsApp',
          action: 'Falló', entityType: 'WhatsAppAutoReply', entityId: messageId,
          summary: 'No se pudo enviar la respuesta automatizada por WhatsApp.',
          details: error instanceof Error ? error.message : 'Error desconocido',
          sourceChannel: 'WhatsApp', severity: 'Crítico', status: 'Pendiente revisión',
        });
      } finally {
        inFlightWhatsAppMessageIds.delete(messageId);
      }
    });
  }
}

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

function normalizeConversionToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

function normalizeContactValue(value?: string) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitLeadName(payload: ConversionLeadInput) {
  const explicitFirstName = normalizeContactValue(payload.firstName);
  const explicitLastName = normalizeContactValue(payload.lastName);
  if (explicitFirstName) {
    return {
      firstName: explicitFirstName,
      lastName: explicitLastName,
      fullName: [explicitFirstName, explicitLastName].filter(Boolean).join(' '),
    };
  }

  const rawFullName = normalizeContactValue(payload.fullName || payload.name);
  const parts = rawFullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Prospecto',
    lastName: parts.slice(1).join(' ') || 'INTECA',
    fullName: rawFullName || 'Prospecto INTECA',
  };
}

function inferCourseTitle(payload: ConversionLeadInput) {
  const directCourse = normalizeContactValue(payload.courseTitle);
  if (directCourse) return directCourse;

  const message = normalizeContactValue(payload.message).toLowerCase();
  if (message.includes('autoriz')) return 'Técnico en Autorizaciones Médicas';
  if (message.includes('factur')) return 'Facturación Médica';
  if (message.includes('enfermer')) return 'Enfermería';
  if (message.includes('farmac')) return 'Farmacología Aplicada';
  if (message.includes('precert')) return 'Precertificaciones Médicas';

  return 'Curso INTECA por confirmar';
}

function findExistingConversionLead(payload: ConversionLeadInput) {
  const email = normalizeContactValue(payload.email).toLowerCase();
  const whatsapp = normalizeContactValue(payload.whatsapp || payload.phone).replace(/\D/g, '');
  return serverConversionLeads.find((lead) => {
    if (lead.organizationId !== (payload.organizationId || 'org_inteca_main')) return false;
    const leadWhatsapp = (lead.whatsapp || lead.phone).replace(/\D/g, '');
    return Boolean(
      (payload.whatsappUserId && lead.whatsappUserId === payload.whatsappUserId) ||
      (email && lead.email.toLowerCase() === email) || (whatsapp && leadWhatsapp === whatsapp),
    );
  });
}

function buildConversionLeadFromPayload(payload: ConversionLeadInput) {
  const now = new Date().toISOString();
  const existingLead = findExistingConversionLead(payload);
  const { firstName, lastName, fullName } = splitLeadName(payload);
  const email = normalizeContactValue(payload.email);
  const phone = normalizeContactValue(payload.phone || payload.whatsapp);
  const whatsapp = normalizeContactValue(payload.whatsapp || payload.phone);
  const courseTitle = inferCourseTitle(payload);
  const source = normalizeContactValue(payload.source) || 'API';
  const missingFields = [
    !firstName || firstName === 'Prospecto' ? 'nombre real' : '',
    !email ? 'correo' : '',
    !whatsapp && !phone ? 'WhatsApp o teléfono' : '',
    courseTitle === 'Curso INTECA por confirmar' ? 'curso de interés' : '',
  ].filter(Boolean);
  const stageId = payload.paymentConfirmed
    ? 'venta_realizada'
    : missingFields.length === 0
      ? 'calificado'
      : 'contactado';

  const lead: ServerConversionLead = {
    id: existingLead?.id || `lead_conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    firstName,
    lastName,
    fullName,
    email,
    phone,
    whatsapp,
    whatsappUserId: payload.whatsappUserId || existingLead?.whatsappUserId,
    courseId: normalizeContactValue(payload.courseId) || existingLead?.courseId,
    courseTitle,
    source,
    campaign: normalizeContactValue(payload.campaign) || existingLead?.campaign,
    message: normalizeContactValue(payload.message) || existingLead?.message,
    organizationId: normalizeContactValue(payload.organizationId) || 'org_inteca_main',
    stageId,
    status: payload.paymentConfirmed ? 'Pago validado' : 'Seguimiento activo',
    scoreAI: missingFields.length === 0 ? 88 : 72,
    assignedAgentId: 'agent_conversion',
    missingFields,
    createdAt: existingLead?.createdAt || now,
    updatedAt: now,
    lastInteractionAt: now,
    nextFollowUpAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
  };

  return lead;
}

function upsertConversionLead(lead: ServerConversionLead) {
  const existingIndex = serverConversionLeads.findIndex((item) => item.id === lead.id);
  if (existingIndex >= 0) {
    serverConversionLeads[existingIndex] = lead;
  } else {
    serverConversionLeads.unshift(lead);
  }

  serverConversionLeads.splice(300);
  return lead;
}

function processConversionLead(payload: ConversionLeadInput, sourceChannel = 'API') {
  // Lead intake from public forms/ads is never evidence of a verified payment.
  // Only the authenticated sales transaction can register a bank-verified close.
  payload = { ...payload, paymentConfirmed: false };
  const lead = upsertConversionLead(buildConversionLeadFromPayload(payload));

  recordServerAudit({
    actorType: 'Agente IA',
    actorName: 'Agente IA Conversión y Matrícula',
    module: 'Leads',
    action: payload.paymentConfirmed ? 'Actualizó' : 'Registró',
    entityType: 'ConversionLead',
    entityId: lead.id,
    summary: payload.paymentConfirmed
      ? `Lead actualizado por pago validado: ${lead.fullName}`
      : `Lead registrado por agente de conversión: ${lead.fullName}`,
    details: `Fuente: ${lead.source}. Curso: ${lead.courseTitle}. Campos pendientes: ${lead.missingFields.join(', ') || 'ninguno'}.`,
    sourceChannel,
    severity: 'Éxito',
    status: 'Registrado',
  });

  const enrollment: ServerStudentEnrollment | null = null;

  return {
    lead,
    enrollment,
    nextActions: ['Continuar la conversación y completar los datos.', 'Revisar el recibo y validar el abono en Ventas y Cierre antes de matricular.'],
  };
}

// Lazy initialization of Gemini Client
let aiClient: GoogleGenAI | null = null;
const temporarilyUnavailableGeminiModels = new Map<string, number>();

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

function getGeminiModelCandidates() {
  const fallbackModels =
    process.env.GEMINI_FALLBACK_MODELS?.split(',').map((model) => model.trim()).filter(Boolean) ||
    DEFAULT_GEMINI_FALLBACK_MODELS;

  return Array.from(new Set([process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, ...fallbackModels]));
}

function getAvailableGeminiModelCandidates() {
  const now = Date.now();
  return getGeminiModelCandidates().filter((model) => {
    const retryAfter = temporarilyUnavailableGeminiModels.get(model) || 0;
    return retryAfter <= now;
  });
}

function summarizeGeminiError(error: unknown) {
  if (error && typeof error === 'object') {
    const errorLike = error as { message?: unknown; name?: unknown; status?: unknown };
    return {
      name: typeof errorLike.name === 'string' ? errorLike.name : 'Error',
      status: errorLike.status,
      message: typeof errorLike.message === 'string' ? errorLike.message : 'Sin mensaje',
    };
  }

  return {
    name: 'Error',
    status: undefined,
    message: String(error),
  };
}

async function generateGeminiContentWithFallback(contents: string, config?: Record<string, unknown>, whatsApp = false) {
  let lastError: unknown;
  const modelCandidates = getAvailableGeminiModelCandidates();

  if (modelCandidates.length === 0) {
    throw new Error('GEMINI_MODELS_TEMPORARILY_UNAVAILABLE');
  }

  for (const model of modelCandidates) {
    try {
      const ai = getGeminiClient();
      return await ai.models.generateContent({
        model,
        contents,
        config: whatsApp ? whatsAppGenerationConfig(model, config) : config,
      });
    } catch (error) {
      lastError = error;
      temporarilyUnavailableGeminiModels.set(model, Date.now() + GEMINI_MODEL_RETRY_DELAY_MS);
      console.error(`[DEBUG] Gemini generateContent failed para el modelo ${model}`, {
        retryAfterMs: GEMINI_MODEL_RETRY_DELAY_MS,
        ...summarizeGeminiError(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('GEMINI_GENERATE_CONTENT_FAILED');
}

const INTEGRATION_ENVIRONMENT_GROUPS = [
  {
    id: 'int_supabase_database',
    name: 'Supabase Database, Auth y Storage',
    category: 'Base de datos',
    requiredEnvVars: [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_JWT_SECRET',
      'SUPABASE_STORAGE_BUCKET',
    ],
  },
  {
    id: 'int_render_deployment',
    name: 'Render Deploy, Environment y Webhooks',
    category: 'Hosting',
    requiredEnvVars: ['APP_URL', 'RENDER_SERVICE_ID', 'RENDER_API_KEY', 'TRUST_PROXY'],
  },
  {
    id: 'int_gemini_ai',
    name: 'Gemini AI y modelos de respaldo',
    category: 'IA',
    requiredEnvVars: ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODELS'],
  },
  {
    id: 'int_whatsapp_cloud',
    name: 'WhatsApp Cloud API',
    category: 'Mensajería',
    requiredEnvVars: [
      'META_WEBHOOK_VERIFY_TOKEN',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_BUSINESS_ACCOUNT_ID',
    ],
    webhookPath: '/api/webhooks/meta/whatsapp',
  },
  {
    id: 'int_meta_social',
    name: 'Facebook, Instagram, Messenger y Meta Lead Ads',
    category: 'Social Ads',
    requiredEnvVars: [
      'META_APP_ID',
      'DS_META_APP_SECRET',
      'META_PAGE_ACCESS_TOKEN',
      'META_PAGE_ID',
      'META_ADS_ACCESS_TOKEN',
      'META_AD_ACCOUNT_ID',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    ],
    webhookPath: '/api/webhooks/meta/leadgen',
  },
  {
    id: 'int_google_ads',
    name: 'Google Ads Search, Display y Performance Max',
    category: 'Buscadores',
    requiredEnvVars: [
      'GOOGLE_ADS_CLIENT_ID',
      'GOOGLE_ADS_CLIENT_SECRET',
      'GOOGLE_ADS_REFRESH_TOKEN',
      'GOOGLE_ADS_CUSTOMER_ID',
    ],
    webhookPath: '/api/webhooks/google-ads/leads',
  },
  {
    id: 'int_ad_payment_wallet',
    name: 'Tarjeta empresarial para pauta inteligente',
    category: 'Pauta',
    requiredEnvVars: [
      'AD_PAYMENT_PROVIDER',
      'AD_PAYMENT_PUBLIC_KEY',
      'AD_PAYMENT_SECRET_KEY',
      'AD_PAYMENT_WEBHOOK_SECRET',
      'META_ADS_BILLING_ACCOUNT_ID',
      'GOOGLE_ADS_BILLING_SETUP_ID',
    ],
  },
  {
    id: 'int_youtube',
    name: 'YouTube Ads y YouTube Shorts',
    category: 'Video',
    requiredEnvVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN', 'YOUTUBE_CHANNEL_ID'],
    webhookPath: '/api/webhooks/youtube/events',
  },
  {
    id: 'int_voice_sales',
    name: 'Telefonía de ventas · Twilio ConversationRelay',
    category: 'Telefonía',
    requiredEnvVars: ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN'],
    webhookPath: '/api/voice/provider',
  },
  {
    id: 'int_creative_ai',
    name: 'Generación de imágenes y videos con IA',
    category: 'Creativos',
    requiredEnvVars: [
      'IMAGE_GENERATION_PROVIDER',
      'IMAGE_GENERATION_API_KEY',
      'VIDEO_GENERATION_PROVIDER',
      'VIDEO_GENERATION_API_KEY',
    ],
  },
  {
    id: 'int_payments',
    name: 'Pasarelas de pago y comprobantes',
    category: 'Pagos',
    requiredEnvVars: [
      'PAYMENT_PROVIDER',
      'PAYMENT_PUBLIC_KEY',
      'PAYMENT_SECRET_KEY',
      'PAYMENT_WEBHOOK_SECRET',
    ],
    webhookPath: '/api/webhooks/payments',
  },
  {
    id: 'int_inteca_campus',
    name: 'Campus Virtual INTECA',
    category: 'Campus',
    requiredEnvVars: [
      'INTECA_CAMPUS_BASE_URL',
      'INTECA_FIREBASE_SERVICE_ACCOUNT_JSON',
    ],
  },
  {
    id: 'int_dgii_ecf',
    name: 'Facturación electrónica DGII e-CF',
    category: 'Facturación',
    requiredEnvVars: [
      'DGII_ECF_ENVIRONMENT',
      'DGII_ECF_CERTIFICATE_PATH',
      'DGII_ECF_CERTIFICATE_PASSWORD',
      'DGII_ECF_ISSUER_RNC',
      'DGII_ECF_PROVIDER_API_KEY',
    ],
    webhookPath: '/api/webhooks/dgii/ecf-status',
  },
  {
    id: 'int_owner_notifications',
    name: 'Notificaciones al dueño',
    category: 'Notificaciones',
    requiredEnvVars: ['OWNER_NOTIFICATION_WHATSAPP', 'OWNER_NOTIFICATION_EMAIL'],
  },
  {
    id: 'int_web_forms',
    name: 'Landing pages y formularios web',
    category: 'Web',
    requiredEnvVars: ['APP_URL'],
    webhookPath: '/api/webhooks/web/forms',
  },
];

const AGENT_RUNTIME_REGISTRY = [
  {
    id: 'agent_whatsapp',
    name: 'Mateo Rivera',
    function: 'Atención, respuesta, seguimiento y transferencia humana por WhatsApp.',
    requiredIntegrationIds: ['int_whatsapp_cloud', 'int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_owner_notifications', 'int_payments'],
    executableTools: ['whatsapp.receive_message', 'whatsapp.send_text', 'crm.create_lead', 'audit.record'],
    humanIntervention:
      'Pago, reclamo sensible, promesa no autorizada, error de envío o conversación fuera de la ventana permitida.',
  },
  {
    id: 'agent_omnichannel',
    name: 'Nora Campos',
    function: 'Captura, normaliza y enruta leads desde web, redes, Meta, Google y WhatsApp.',
    requiredIntegrationIds: ['int_web_forms', 'int_supabase_database'],
    optionalIntegrationIds: ['int_meta_social', 'int_google_ads', 'int_whatsapp_cloud'],
    executableTools: ['webforms.receive', 'meta.lead_event', 'googleads.lead_event', 'crm.route_lead'],
    humanIntervention: 'Lead duplicado incierto, fuente sin consentimiento o credencial revocada.',
  },
  {
    id: 'agent_conversion',
    name: 'Catalina Méndez',
    function:
      'Registra leads, califica intención, mueve el embudo, valida inscripción, activa estudiante y prepara bienvenida/campus.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: [
      'int_whatsapp_cloud',
      'int_web_forms',
      'int_payments',
      'int_inteca_campus',
      'int_owner_notifications',
    ],
    executableTools: [
      'crm.create_lead',
      'crm.update_stage',
      'payments.verify_enrollment',
      'campus.create_student',
      'campus.send_credentials',
      'audit.record',
    ],
    humanIntervention:
      'Pago dudoso, credenciales no sincronizadas, campus sin API, datos incompletos o reclamo sensible.',
  },
  {
    id: 'agent_closer',
    name: 'Valeria Parkert',
    function: 'Ventas y cierre por WhatsApp, conversación de voz y llamadas autorizadas, objeciones, historial, seguimiento y pago validado.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_whatsapp_cloud', 'int_payments', 'int_owner_notifications', 'int_voice_sales'],
    executableTools: ['crm.update_opportunity', 'crm.schedule_followup', 'payments.create_request', 'voice.verify_number', 'voice.schedule_authorized', 'voice.stop', 'voice.transcript', 'crm.payment_interest'],
    humanIntervention: 'Aprobar descuentos y costos telefónicos, activar proveedor y número, validar pagos, atender transferencias y conciliar resultados inciertos.',
  },
  {
    id: 'agent_copywriter',
    name: 'Camila Torres',
    function: 'Crea campañas, copys, embudos y propuestas de valor para adquisición y conversión.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_meta_social', 'int_google_ads', 'int_youtube', 'int_creative_ai'],
    executableTools: ['marketing.generate_copy', 'campaign.prepare', 'audit.record'],
    humanIntervention: 'Testimonios, noticias institucionales, promesas sensibles o gasto publicitario.',
  },
  {
    id: 'agent_media_buyer',
    name: 'Marco Salazar',
    function: 'Prepara, valida y optimiza campañas pagadas con límites y aprobación del dueño.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_meta_social', 'int_google_ads', 'int_ad_payment_wallet'],
    executableTools: ['ads.prepare_campaign', 'ads.read_metrics', 'budget.validate_limits'],
    humanIntervention: 'Activación de gasto, cambio de presupuesto, campaña pública o cuenta sin permisos.',
  },
  {
    id: 'agent_creative',
    name: 'Isabella Morel',
    function: 'Genera briefs, flyers, carruseles, prompts, piezas visuales y evidencias de revisión.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_creative_ai', 'int_meta_social', 'int_whatsapp_cloud'],
    executableTools: ['creative.prepare_brief', 'creative.generate_asset', 'asset.store'],
    humanIntervention: 'Uso de marca sin activo aprobado, proveedor sin credencial o pieza sensible.',
  },
  {
    id: 'agent_video',
    name: 'Dante Vega',
    function: 'Prepara guiones, videos cortos, metadatos, miniaturas y publicación autorizada.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_creative_ai', 'int_youtube'],
    executableTools: ['video.prepare_script', 'video.generate_asset', 'youtube.prepare_upload'],
    humanIntervention: 'Publicación real, reclamo de derechos, canal sin autorización o cuota agotada.',
  },
  {
    id: 'agent_billing',
    name: 'Sofía Navarro',
    function: 'Prepara documentos comerciales por empresa con cálculos deterministas y control previo a emisión fiscal.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_payments', 'int_dgii_ecf', 'int_owner_notifications'],
    executableTools: ['fiscal.calculate', 'fiscal.prepare_commercial_draft', 'fiscal.review_draft', 'fiscal.read_readiness', 'audit.record'],
    humanIntervention: 'Emisión fiscal, certificado faltante, secuencia no autorizada o rechazo DGII.',
  },
  {
    id: 'agent_accounting',
    name: 'Bruno Ferrer',
    function: 'Prepara reportes contables, conciliaciones, inventario, recibos y estados financieros.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_payments', 'int_dgii_ecf'],
    executableTools: ['accounting.read_ledger', 'accounting.review_period', 'accounting.export_journal', 'accounting.prepare_tax_workpaper', 'accounting.prepare_dgii_606_607_608_609_IT1_IR2_ACT_drafts', 'bank.compare_book_balance'],
    humanIntervention: 'Confirmar RNC y obligaciones oficiales, completar NCF/retenciones/anexos, validar períodos en cero, conciliación, firma y presentación DGII. El agente solo guarda borradores internos.',
  },
  {
    id: 'agent_procurement_national',
    name: 'Nadia Paredes',
    function: 'Gestiona requisiciones, cotizaciones locales, comparativos, órdenes e inventario.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_owner_notifications'],
    executableTools: ['procurement.create_request', 'procurement.evaluate_quotes', 'inventory.update'],
    humanIntervention: 'Aprobación de compra, contrato, pago o proveedor con riesgo.',
  },
  {
    id: 'agent_owner_ops',
    name: 'Bruno Montes',
    function: 'Filtra avances y notifica solo pagos, llamadas, bloqueos, campañas listas y decisiones.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_owner_notifications', 'int_whatsapp_cloud'],
    executableTools: ['owner.notify', 'audit.summarize', 'crm.escalate'],
    humanIntervention: 'Decisión estratégica, bloqueo crítico o acción que comprometa gasto externo.',
  },
];

const CONFIGURATION_EXTRA_ENV_VARS = [
  'GOOGLE_ADS_DEVELOPER_TOKEN', // Legacy compatibility only; no longer required or sent.
  'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
  'GOOGLE_ADS_API_VERSION',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_NAME',
  'ADMIN_ORGANIZATION',
  'AGENT_KNOWLEDGE_MAX_CHARS',
  'APP_URL',
  'CRM_ADMIN_EMAIL',
  'CRM_ADMIN_PASSWORD',
  'DEPLOYMENT_MODE',
  'GEMINI_MODEL_RETRY_DELAY_MS',
  'NODE_ENV',
  'VITE_DEPLOYMENT_MODE',
  'VITE_INTECA_CAMPUS_URL',
  'INTECA_FIREBASE_SERVICE_ACCOUNT_JSON', 'INTECA_FIREBASE_PROJECT_ID', 'INTECA_FIRESTORE_DATABASE_ID',
  'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM', 'ENROLLMENT_AUTO_ENABLED',
  'WHATSAPP_ENROLLMENT_TEMPLATE_NAME', 'WHATSAPP_ENROLLMENT_TEMPLATE_LANGUAGE',
];

const CONFIGURABLE_ENV_VARS = new Set([
  ...CONFIGURATION_EXTRA_ENV_VARS,
  ...INTEGRATION_ENVIRONMENT_GROUPS.flatMap((group) => group.requiredEnvVars),
]);

function normalizeConfigurableEnvVars(variables: Record<string, string>) {
  const accepted: Record<string, string> = {};
  const invalidKeys: string[] = [];

  for (const [rawKey, rawValue] of Object.entries(variables)) {
    const key = rawKey.trim().toUpperCase();
    const value = rawValue.trim();

    if (!key || !value) {
      continue;
    }

    if (!CONFIGURABLE_ENV_VARS.has(key)) {
      invalidKeys.push(key);
      continue;
    }

    accepted[key] = value;
  }

  return { accepted, invalidKeys };
}

function applyRuntimeEnvVars(variables: Record<string, string>) {
  for (const [key, value] of Object.entries(variables)) {
    process.env[key] = value;
  }

  DEPLOYMENT_MODE =
    process.env.DEPLOYMENT_MODE || process.env.VITE_DEPLOYMENT_MODE || 'production';

  if (
    variables.GEMINI_API_KEY ||
    variables.GEMINI_MODEL ||
    variables.GEMINI_FALLBACK_MODELS ||
    variables.GEMINI_MODEL_RETRY_DELAY_MS
  ) {
    aiClient = null;
    temporarilyUnavailableGeminiModels.clear();
  }
}

async function updateRenderEnvVar(
  serviceId: string,
  apiKey: string,
  key: string,
  value: string,
) {
  await renderRequest(serviceId, apiKey, key, value);
  return { saved: true };
}

async function triggerRenderDeploy(serviceId: string, apiKey: string) {
  const response = await fetch(
    `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clearCache: 'do_not_clear' }),
    },
  );

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message?: unknown }).message)
        : `Render deploy HTTP ${response.status}`;

    throw new Error(message);
  }

  return body;
}

function buildIntegrationEnvironmentStatus(){
  return INTEGRATION_ENVIRONMENT_GROUPS.map(group=>{
    // Advertising cards are linked with Meta/Google directly. These legacy
    // synthetic wallet credentials are NOT required for payment in either
    // platform. The creative suite has dedicated HeyGen/Runway/local adapters.
    const special=group.id==='int_ad_payment_wallet'||group.id==='int_creative_ai';
    const configuredEnvVars=special?[]:group.requiredEnvVars.filter(k=>Boolean(process.env[k]));
    const missingEnvVars=special?[]:group.requiredEnvVars.filter(k=>!process.env[k]);
    return {
      ...group,
      configured:special?false:missingEnvVars.length===0,
      configuredEnvVars,missingEnvVars,
      verificationMode:group.id==='int_ad_payment_wallet'?'provider_managed_billing':
        group.id==='int_creative_ai'?'specialized_creative_engines':'environment',
      setupRequired:special,
    };
  });
}

function buildAgentRuntimeManifest() {
  const integrations = buildIntegrationEnvironmentStatus();
  const integrationById = new Map(integrations.map((integration) => [integration.id, integration]));

  return AGENT_RUNTIME_REGISTRY.map((agent) => {
    const requiredIntegrations = agent.requiredIntegrationIds.map((id) => integrationById.get(id));
    const optionalIntegrations = agent.optionalIntegrationIds.map((id) => integrationById.get(id));
    const missingRequired = requiredIntegrations.flatMap((integration) =>
      integration ? (integration.setupRequired ? [integration.name+':comprobar conexión externa'] :
        integration.missingEnvVars.map(envVar => `${integration.name}:${envVar}`)) : [],
    );
    const missingOptional = optionalIntegrations.flatMap((integration) =>
      integration ? (integration.setupRequired ? [integration.name+':comprobar conexión externa'] :
        integration.missingEnvVars.map(envVar => `${integration.name}:${envVar}`)) : [],
    );
    const status =
      missingRequired.length === 0
        ? missingOptional.length === 0
          ? 'configurado_sin_prueba_operativa'
          : 'degradado'
        : 'bloqueado_por_credenciales';

    return {
      ...agent,
      status,
      sharedPlatformConnections: agentConnections.snapshot(),
      requiredIntegrations: requiredIntegrations.filter(Boolean),
      optionalIntegrations: optionalIntegrations.filter(Boolean),
      missingRequired,
      missingOptional,
      evidence:
        missingRequired.length === 0
          ? 'Variables requeridas presentes; requiere prueba real del proveedor antes de ejecutar acciones externas.'
          : 'No se declara operativo porque faltan variables requeridas.',
    };
  });
}

// Advertising approval is exclusively authenticated server-side; prompts cannot approve anything.
app.use('/api/advertising', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.method === 'GET' && /^\/oauth\/(meta|google_ads|youtube)\/callback$/.test(req.path)) return next();
  const admin = getConfiguredAdminCredentials();
  if (!verifySalesSession(req.headers.cookie || '', admin.password || '', admin.email || '')) return res.status(401).json({ error: AD_ERRORS.AD_AUTH });
  if (req.method !== 'GET' && req.get('X-CRM-Action') !== 'advertising') return res.status(403).json({ error: 'Solicitud no autorizada.' });
  next();
});
const adFail = (res: express.Response, error: unknown) => { const code = adError(error); const help = googleAdsAccessHelp(error); return res.status(code === 'AD_STORAGE' ? 503 : 409).json({ error: help || AD_ERRORS[code], code, ...(error instanceof ProviderAccessError ? { providerReason: error.providerReason, httpStatus: error.httpStatus } : {}), ...(help ? { cloudConsoleUrl: GOOGLE_ADS_CLOUD_CONSOLE } : {}) }); };
app.use('/api/advertising/oauth', createIntegrationOAuth({
  checkPersistence: () => renderRequest(process.env.RENDER_SERVICE_ID || '', process.env.RENDER_API_KEY || ''),
  persist: async variables => {
    if (!process.env.RENDER_API_KEY || !process.env.RENDER_SERVICE_ID) throw Error('OAUTH_SAVE');
    for (const [key, value] of Object.entries(variables)) await updateRenderEnvVar(process.env.RENDER_SERVICE_ID, process.env.RENDER_API_KEY, key, value);
  },
  verified: () => agentConnections.refresh(),
}));
app.use('/api/voice/provider',voiceProviderRouter(voiceSalesAgent));
app.use('/api/advertising/voice',voiceAdminRouter(voiceSalesAgent));

// CRM admin endpoints inherit the /api/advertising session and CSRF-action protection.
app.use('/api/advertising/community/video/local',localVideoAdminRouter(localVideoEngine));
// GPU worker uses a separate constant-time checked bearer token (never a CRM user cookie).
app.use('/api/local-video/worker',localVideoWorkerRouter(localVideoEngine));
app.get('/api/advertising/community/video-provider', async (_req,res)=>{
  try {
    const runway=await intequitoVideoProvider.status();
    const heygen=heygenVideoProvider.status();
    res.json({
      providers:{heygen,runway},
      renderReady:heygen.ready||runway.renderReady,
      automaticSpending:false,
      note:'HeyGen genera un avatar hablante completo; Runway genera un plano animado de 5 segundos. Las combinaciones necesitan edición y control de calidad.'
    });
  } catch {res.status(503).json({error:'No se pudo verificar los proveedores audiovisuales.'});}
});
const videoGenerationSchema=z.object({
  communityJobId:z.string().uuid(),
  provider:z.enum(['heygen','runway']),
  requestId:z.string().uuid(),
  confirmSpend:z.literal(true),
  maxRunwayCredits:z.number().int().min(60).max(240).optional(),
}).strict();
// Approval is a per-request human action in an authenticated admin session.
// Each (community job, provider) has at most one start request: unknown outcomes are never automatically repeated.
app.post('/api/advertising/community/video/generate',async(req,res)=>{
  const parsed=videoGenerationSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Confirma el gasto y selecciona un video válido y un proveedor.'});
  const {communityJobId,provider,requestId,maxRunwayCredits}=parsed.data;
  let registeredId:string|null=null;
  try{
    const jobs=await salesStore.request(`crm_community_jobs?id=eq.${communityJobId}&limit=1`);
    const source=jobs?.[0];
    if(!source||source.state!=='brief'||!source.payload?.script||source.payload.script.actor!=='INTEQUITO'||contentHash(source.payload)!==source.content_hash){
      return res.status(409).json({error:'El guion no está aprobado o ha cambiado. Revisa el calendario.'});
    }
    const catalog=await whatsAppCatalog.get();
    if(!catalog||catalog.hash!==source.payload.catalogHash||!catalog.courses.some(course=>course.title===source.payload.courseTitle)){
      return res.status(409).json({error:'El catálogo cambió; revisa el guion y la información comercial antes de producir.'});
    }
    const runnable=provider==='heygen'?heygenVideoProvider.status().ready:(await intequitoVideoProvider.status()).renderReady;
    if(!runnable) return res.status(409).json({error:'Falta configurar las claves o la identidad oficial de INTEQUITO para ese proveedor.'});
    if(provider==='runway' && (maxRunwayCredits??0)<60) return res.status(400).json({error:'Un plano de 5 segundos en Runway necesita al menos 60 créditos autorizados.'});
    const reservation=await salesStore.request('crm_community_video_generations','POST',{
      job_id:communityJobId,provider,request_id:requestId,state:'starting',
      approved_runway_credits:provider==='runway'?maxRunwayCredits:null,
      result:{acknowledged:true,output:'pending',character:'INTEQUITO'},
    });
    registeredId=String(reservation?.[0]?.id||'');
    if(!z.string().uuid().safeParse(registeredId).success)throw Error('VIDEO_RESERVATION_FAILED');
    let submitted;
    if(provider==='heygen') {
      submitted=await heygenVideoProvider.createVideo(source.payload.script,{confirmed:true,requestId});
    }else {
      submitted=await intequitoVideoProvider.createScene(source.payload.script.scenes[0],{
        confirmed:true,maxCreditsApproved:maxRunwayCredits!,
      });
    }
    await salesStore.request(`crm_community_video_generations?id=eq.${registeredId}&state=eq.starting`,'PATCH',{
      state:'submitted',provider_job_id:submitted.id,result:{...submitted,output:'awaiting_provider',origin:'inteca_admin_manual'},
      updated_at:new Date().toISOString(),
    });
    return res.json({id:registeredId,provider,providerJobId:submitted.id,state:'submitted',
      note:provider==='runway'?'Plano inicial de 5 segundos; aún no es el anuncio final.':'Video solicitado a HeyGen; requiere revisión antes de publicar.'});
  }catch(e){
    // Unknown provider outcomes remain manual-review only, preventing duplicate charges.
    if(registeredId)await salesStore.request(`crm_community_video_generations?id=eq.${registeredId}&state=eq.starting`,'PATCH',{
      state:'review_required',result:{reason:'VIDEO_PROVIDER_OUTCOME_UNKNOWN',output:'manual_reconciliation_required'},
      updated_at:new Date().toISOString(),
    }).catch(()=>{});
    return res.status(409).json({error:registeredId?'Resultado desconocido: revisa el proveedor antes de repetir. No se cobrará automáticamente otra generación.':'No se pudo registrar la autorización en Supabase. No se inició ninguna generación.'});
  }
});
app.get('/api/advertising/community/video/generations',async(_req,res)=>{
  try{
    const jobs=await salesStore.request('crm_community_video_generations?order=updated_at.desc&limit=100');
    res.json(jobs);
  }catch{res.status(503).json({error:'No se pudieron leer las generaciones audiovisuales.'});}
});
app.get('/api/advertising/community/video/generations/:id/status',async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({error:'Identificador inválido.'});
  try{
    const rows=await salesStore.request(`crm_community_video_generations?id=eq.${req.params.id}&limit=1`);
    const generation=rows?.[0];
    if(!generation)return res.status(404).json({error:'Generación no encontrada.'});
    if(generation.state!=='submitted'||!generation.provider_job_id)
      return res.json({id:generation.id,provider:generation.provider,state:generation.state,result:generation.result});
    const providerResult=generation.provider==='heygen'
      ?await heygenVideoProvider.getVideo(generation.provider_job_id)
      :await intequitoVideoProvider.sceneStatus(generation.provider_job_id);
    const complete=generation.provider==='heygen'
      ?providerResult.status==='completed'
      :providerResult.status==='SUCCEEDED';
    const failed=generation.provider==='heygen'
      ?providerResult.status==='failed'
      :providerResult.status==='FAILED';
    const state=complete?'review_required':failed?'failed':'submitted';
    const updated=await salesStore.request(`crm_community_video_generations?id=eq.${generation.id}&state=eq.submitted`,'PATCH',{
      state,result:providerResult,updated_at:new Date().toISOString(),
    });
    return res.json({id:generation.id,provider:generation.provider,state,result:providerResult,needsHumanApproval:complete,
      note:complete?'Revisa la identidad visual y duración; publicar requiere aprobación separada.':'No se publica automáticamente.'});
  }catch{return res.status(503).json({error:'No se pudo consultar el proveedor audiovisual. Conservamos el estado anterior; no se repetirán cargos.'});}
});

app.get('/api/advertising/community/diagnostics', async (_req,res)=>{
  try{res.json(await communityDiagnostics.config());}
  catch{res.status(503).json({error:'No se pudieron verificar los archivos y el almacenamiento.'});}
});
app.post('/api/advertising/community/diagnostics/test', async (_req,res)=>{
  try{
    const [media,channels]=await Promise.all([
      communityDiagnostics.testRenderAndStorage(),
      communityDiagnostics.verifyChannels(),
    ]);
    return res.json({media,channels});
  }catch(e){
    const raw=e instanceof Error?e.message:'';
    const code=/^CM_[A-Z_0-9]+$/.test(raw)?raw:'CM_DIAGNOSTIC_FAILED';
    console.warn('community_diagnostics_failed',code);
    return res.status(409).json({error:code,note:'No se ha publicado ninguna pieza en redes. Revisa los archivos y la configuración de Supabase.'});
  }
});
app.get('/api/advertising/community', async (_req,res)=>{try{res.json(await communityManager.snapshot());}catch{res.status(503).json({error:'No se pudo leer la memoria de Lisa en Supabase.'});}});
app.post('/api/advertising/community/settings',async(req,res)=>{const b=z.object({enabled:z.boolean()}).strict().safeParse(req.body);if(!b.success)return res.status(400).json({error:'Revisa la configuración.'});try{await communityManager.setEnabled(b.data.enabled);res.json({success:true});}catch{res.status(503).json({error:'No se pudo guardar la configuración.'});}});
app.post('/api/advertising/community/run',async(_req,res)=>{void communityManager.tick();res.json({accepted:true,message:'Procesamiento solicitado. Consulta el estado real en el calendario.'});});
app.post('/api/advertising/community/jobs/:id/retry',async(req,res)=>{if(!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({error:'Identificador no válido.'});try{await communityManager.retry(String(req.params.id));res.json({success:true});}catch{res.status(409).json({error:'Solo se pueden reintentar piezas bloqueadas, con Lisa habilitada. Los resultados inciertos necesitan conciliación humana.'});}});
app.get('/api/advertising/google-ads/accounts', async (_req, res) => { try { res.json(await advertisingAgent.accessibleGoogleAdsAccounts()); } catch (error) { adFail(res, error); } });
app.get('/api/advertising', async (_req, res) => { try { res.json(await advertisingAgent.snapshot()); } catch (error) { adFail(res, error); } });
app.post('/api/advertising/plans', async (req, res) => {
  const parsed = adPlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'El presupuesto total mínimo es RD$1,000. Revisa curso, canales, días y límites.' });
  try { return res.json(await advertisingAgent.plans.create(parsed.data)); } catch (error) { return adFail(res, error); }
});
app.post('/api/advertising/plans/:id/approve', async (req, res) => {
  const parsed = z.object({ contentHash: z.string().regex(/^[a-f0-9]{64}$/), reviewed: z.literal(true) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: AD_ERRORS.AD_APPROVAL });
  try { return res.json(await advertisingAgent.plans.approve(String(req.params.id), parsed.data.contentHash, getConfiguredAdminCredentials().email || '')); } catch (error) { return adFail(res, error); }
});
app.post('/api/advertising/plans/:id/evaluate', async (req, res) => {
  try { return res.json(await advertisingAgent.evaluatePlan(String(req.params.id))); } catch (error) { return adFail(res, error); }
});
app.post('/api/advertising/plans/:id/cancel', async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: AD_ERRORS.AD_INPUT });
  try {
    const rows = await salesStore.request(`crm_ad_plans?id=eq.${req.params.id}&state=in.(draft,approved)`, 'PATCH', { state: 'cancelled' });
    if (!rows.length) throw Error('AD_STATE');
    return res.json({ success: true, externalCampaignsChanged: false });
  } catch (error) { return adFail(res, error); }
});
app.post('/api/advertising/verify', async (req, res) => {
  const parsed = z.enum(CHANNELS).safeParse(req.body?.channel);
  if (!parsed.success) return res.status(400).json({ error: AD_ERRORS.AD_INPUT });
  try { return res.json(await advertisingAgent.verify(parsed.data)); } catch (error) { return adFail(res, error); }
});

// All agent workspaces use the same server-side adapters and sanitized evidence.
// This check only reads provider identities; it cannot publish, charge or grant scopes.
// Read-only owner diagnostics. No charging, provider mutations, secret disclosure,
// invented card vault or publication. Authenticated by /api/advertising middleware.
app.get('/api/advertising/operational-readiness',async(_req,res)=>{
  try{
    const [accounts,runway,local]=await Promise.all([
      agentConnections.ensureFresh(),
      intequitoVideoProvider.status(),
      localVideoEngine.status(),
    ]);
    return res.json(integratedReadiness(accounts,{
      heygen:heygenVideoProvider.status(),runway,local,
    }));
  }catch{
    return res.status(503).json({error:'No fue posible comprobar las integraciones. Inténtalo de nuevo sin modificar credenciales.'});
  }
});
// Read-only evidence audit for ALL five modules on the Operations screen.
// Requires the existing CRM administrator cookie (advertising router middleware).
// Never returns payment credentials, tax ID, Firebase user data or raw secrets.
app.get('/api/advertising/activation-audit',async(_req,res)=>{
  res.set('Cache-Control','private, no-store');
  try {
    const timeout=<T>(promise:Promise<T>,ms:number):Promise<T>=>
      Promise.race([promise,new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('CHECK_TIMEOUT')),ms))]);
    const [gateway,campus,local,runway,creative,mappings,enrollments,profiles]=await Promise.allSettled([
      gatewayPrecontract.status(),
      timeout(enrollmentAgent.campusReadiness(),10_000),
      localVideoEngine.status(),
      intequitoVideoProvider.status(),
      communityDiagnostics.config(),
      salesStore.request('crm_campus_course_mapping?select=course_title&limit=1000'),
      salesStore.request('crm_student_enrollments?select=id&limit=1000'),
      salesStore.request('crm_fiscal_companies?select=organization_id&limit=1000'),
    ]);
    const val=<T>(r:PromiseSettledResult<T>,fallback:T):T=>r.status==='fulfilled'?r.value:fallback;
    const g=val(gateway,{
      preferredProvider:'unselected',merchantStatus:'contract_pending',
      productionCertified:false,sandboxCertified:false,
      linkInfrastructureReady:false,checkoutAvailable:false,
    });
    const ca=val(campus,{
      verified:false,authReady:false,databaseReady:false,courseCount:0,
      readyForEnrollment:false,campusSyncEnabled:false,errorCode:'CAMPUS_CHECK_UNAVAILABLE',
    });
    const lo=val(local,{
      readyForProduction:false,workerConnected:false,referencePresent:false,
      storageReady:false,autoEnabled:false,
    });
    const ru=val(runway,{renderReady:false});
    const im=val(creative,{storageStatus:'unreachable',assets:{logo:false}});
    const profileRows=val(profiles,[] as any[]);
    const result=activationAudit({
      flyers:{
        configured:Boolean(im.assets?.logo&&im.storageStatus==='available'),
        renderTestVerified:false,
      },
      videos:{
        heygen:{ready:heygenVideoProvider.status().ready},
        runway:{renderReady:ru.renderReady},
        local:{
          readyForProduction:lo.readyForProduction,workerConnected:lo.workerConnected,
          referencePresent:lo.referencePresent,storageReady:lo.storageReady,
          autoEnabled:lo.autoEnabled,
        },
      },
      payments:{
        preferredProvider:g.preferredProvider,merchantStatus:g.merchantStatus,
        sandboxCertified:g.sandboxCertified,productionCertified:g.productionCertified,
        linkInfrastructureReady:g.linkInfrastructureReady,checkoutAvailable:g.checkoutAvailable,
      },
      campus:{
        verified:ca.verified,authReady:ca.authReady,databaseReady:ca.databaseReady,
        courseCount:ca.courseCount,readyForEnrollment:ca.readyForEnrollment,
        campusSyncEnabled:ca.campusSyncEnabled,errorCode:ca.errorCode,
      },
      counts:{
        courseMappings:val(mappings,[] as any[]).length,
        enrollments:val(enrollments,[] as any[]).length,
        fiscalProfiles:profileRows.length,
      },
      fiscal:{
        companyProfilePresent:profileRows.length>0,
        // No certified e-CF adapter or official authorization verification is
        // implemented. These remain false even when a JSON environment key exists.
        companyAuthorizationVerified:false,
        emissionAdapterCertified:false,
      },
    });
    return res.json(result);
  }catch {
    return res.status(503).json({error:'AUDIT_UNAVAILABLE',allOperational:false});
  }
});

app.get('/api/advertising/shared-connections', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ scope: 'platform_owner', connections: await agentConnections.ensureFresh(), billingVerified: false, conversionsVerified: false });
});
app.post('/api/advertising/shared-connections/verify', async (_req, res) => {
  res.json({ scope: 'platform_owner', connections: await agentConnections.refresh(), billingVerified: false, conversionsVerified: false });
});
app.post('/api/advertising/campaigns', async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: AD_ERRORS.AD_INPUT });
  try { return res.json(await advertisingAgent.create(parsed.data)); } catch (error) { return adFail(res, error); }
});
app.post('/api/advertising/campaigns/:id/approve', async (req, res) => {
  const parsed = z.object({ contentHash: z.string().regex(/^[a-f0-9]{64}$/), reviewed: z.literal(true), approveDiscount: z.boolean(), destination: z.string().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: AD_ERRORS.AD_APPROVAL });
  try { return res.json(await advertisingAgent.approve(String(req.params.id), parsed.data.contentHash, parsed.data.approveDiscount, getConfiguredAdminCredentials().email || '', parsed.data.destination)); } catch (error) { return adFail(res, error); }
});
app.post('/api/advertising/metrics', async (req, res) => {
  const parsed = z.enum(['meta_ads', 'google_ads']).safeParse(req.body?.channel);
  if (!parsed.success) return res.status(400).json({ error: AD_ERRORS.AD_INPUT });
  try { return res.json(await advertisingAgent.metrics(parsed.data)); } catch (error) { return adFail(res, error); }
});
app.post('/api/advertising/campaigns/:id/execute', async (req, res) => {
  try { return res.json(await advertisingAgent.execute(String(req.params.id))); } catch (error) { return adFail(res, error); }
});
app.post('/api/advertising/campaigns/:id/reject', async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: AD_ERRORS.AD_INPUT });
  try {
    const result = await salesStore.request(`crm_ad_campaigns?id=eq.${req.params.id}&state=in.(draft,approved)`, 'PATCH', { state: 'rejected' });
    if (!result.length) throw new Error('AD_STATE');
    return res.json({ success: true });
  } catch (error) { return adFail(res, error); }
});

// Fiscal data is accessible only through the real platform administrator session.
app.use('/api/fiscal', (req,res,next) => {
  res.set('Cache-Control','no-store');
  const admin=getConfiguredAdminCredentials();
  if(!verifySalesSession(req.headers.cookie || '',admin.password || '',admin.email || '')) return res.status(401).json({error:'Inicia sesión con el administrador para gestionar la facturación.'});
  if(req.method!=='GET' && req.get('X-CRM-Action')!=='fiscal') return res.status(403).json({error:'Acción fiscal no autorizada.'});
  next();
}, createFiscalRouter(salesStore,()=>getConfiguredAdminCredentials().email || ''));

app.use('/api/accounting', (req,res,next) => {
  res.set('Cache-Control','no-store');
  const admin=getConfiguredAdminCredentials();
  if(!verifySalesSession(req.headers.cookie || '',admin.password || '',admin.email || '')) return res.status(401).json({error:'Inicia sesión como administrador para consultar contabilidad.'});
  if(req.method!=='GET' && req.get('X-CRM-Action')!=='accounting') return res.status(403).json({error:'Acción contable no autorizada.'});
  next();
}, createAccountingRouter(salesStore,()=>getConfiguredAdminCredentials().email || ''));

const teamStudio=createTeamStudio(salesStore,req=>{const c=getConfiguredAdminCredentials();return verifySalesSession(req.headers.cookie||'',c.password||'',c.email||'');},()=>getConfiguredAdminCredentials().email||'',async prompt=>{const r=await generateGeminiContentWithFallback(prompt,{temperature:0.4});return r.text||'';},async()=>buildAgentKnowledgePrompt('catálogo y planificación interna'),async()=>{const d=await communityManager.snapshot();return JSON.stringify({guiaOperativa:readAgentKnowledgeFile('docs/community-manager-source.md'),enabled:d.settings?.enabled,crecimientoObservado:d.growth,capacidades:d.capabilities,jobs:d.jobs.filter((j:any)=>['published','blocked','review_required'].includes(j.state)).slice(-20).map((j:any)=>({id:j.id,state:j.state,channel:j.channel,title:j.payload?.title,result:j.result,last_error:j.last_error}))});});
app.use('/api/team',teamStudio.router);

// Sales APIs require the real administrator's signed, HttpOnly session.
// Public student checkout-status routes expose no personal customer data, card fields or charge operations.
app.use('/api/payments/checkout',gatewayPublicRouter(gatewayPrecontract));
app.use('/api/sales', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const credentials = getConfiguredAdminCredentials();
  if (!verifySalesSession(req.headers.cookie || '', credentials.password || '', credentials.email || '')) return res.status(401).json({ error: 'Inicia sesión nuevamente para abrir Ventas y Cierre.' });
  if (req.method !== 'GET' && req.get('X-CRM-Action') !== 'sales') return res.status(403).json({ error: 'Solicitud no autorizada.' });
  next();
});
const salesActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('verify_payment'), data: z.object({ bank: z.enum(['Banreservas', 'Qik', 'Banco Popular']), reference: z.string().trim().min(3).max(100), amount: z.number().positive().max(1000000), confirmed: z.literal(true), receiptId: z.string().uuid(), receiptReviewed: z.literal(true) }) }),
  z.object({ action: z.literal('quote'), data: z.object({ amount: z.number().positive().max(1000000) }) }),
  z.object({ action: z.literal('follow_up'), data: z.object({ note: z.string().trim().min(3).max(1000), at: z.string().datetime() }) }),
  z.object({ action: z.enum(['pause', 'resume', 'complete_task']), data: z.object({}).default({}) }),
]);
function salesError(res: express.Response, error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    ...ENROLLMENT_ERRORS,
    ALREADY_PAID: 'Este pago ya fue validado.', INVALID_PAYMENT: 'Verifica nombre, curso, importe exacto de inscripción y referencia bancaria.',
    QUOTE_REQUIRED: 'Define primero el importe de inscripción confirmado por INTECA.', UNKNOWN_CONTACT: 'Oportunidad no encontrada.',
    INVALID_ACTION: 'No puedes reactivar un contacto que pidió no recibir mensajes.', DUPLICATE_REFERENCE: 'Esa referencia bancaria ya está registrada.',
  };
  return res.status(messages[code] ? 409 : 503).json({ error: messages[code] || 'No se pudo guardar o consultar Supabase. Vuelve a intentarlo; el CRM no confirmó esta operación.' });
}
// Payment-gateway administration inherits the existing signed CRM owner session.
app.use('/api/sales/gateway',gatewayAdminRouter(gatewayPrecontract));
app.get('/api/sales/enrollments', async (_req, res) => {
  try {
    const [enrollments, mappings, paid] = await Promise.all([
      salesStore.request('crm_student_enrollments?select=*&order=created_at.desc&limit=200'),
      salesStore.request('crm_campus_course_mapping?select=*&order=course_title'),
      salesStore.request('crm_sales_opportunities?stage=eq.won&select=contact_key,profile&limit=200'),
    ]);
    return res.json({ enrollments, mappings, paid, configuration: enrollmentAgent.status(), errors: ENROLLMENT_ERRORS });
  } catch (error) { return salesError(res, error); }
});
app.get('/api/sales/catalog', async (_req, res) => {
  const catalog = await whatsAppCatalog.get();
  if (!catalog) return res.status(503).json({ error: 'No se pudo consultar el catálogo de Supabase.' });
  return res.json({ courses: catalog.courses, generalSchedule: catalog.generalSchedule });
});
app.get('/api/sales/interested-document', async (_req, res) => {
  try {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await salesStore.request(`crm_sales_opportunities?select=contact_key,profile,stage,control,objection,next_action,follow_up_at,updated_at&order=contact_key&limit=500&offset=${offset}`);
      rows.push(...page); if (page.length < 500) break;
    }
    return res.json({ generatedAt: new Date().toISOString(), rows });
  } catch (error) { return salesError(res, error); }
});
app.post('/api/sales/integration-value', rateLimit({ windowMs: 60000, limit: 10 }), (req, res) => {
  const parsed = z.object({ key: z.string(), adminPassword: z.string().min(1).max(200) }).strict().safeParse(req.body);
  const admin = getConfiguredAdminCredentials();
  if (!parsed.success || !validateAdminCredentials(admin.email || '', parsed.data.adminPassword)) return res.status(403).json({ error: 'Confirma tu contraseña de administrador para consultar una clave guardada.' });
  if (!CONFIGURABLE_ENV_VARS.has(parsed.data.key)) return res.status(400).json({ error: 'Variable no permitida.' });
  recordServerAudit({ actorType: 'Usuario', actorName: admin.email || '', module: 'Integraciones', action: 'Consultó', entityType: 'ProductionConfig', summary: 'Administrador consultó una variable guardada.', details: parsed.data.key, sourceChannel: 'Web', severity: 'Info', status: 'Registrado' });
  return res.json({ value: process.env[parsed.data.key] || '' });
});
// Read-only Firebase Auth/Firestore health: never returns account keys or student PII.
app.get('/api/sales/campus-health', rateLimit({windowMs:60_000,limit:10}), async (_req,res)=>{
  try{return res.json(await enrollmentAgent.campusReadiness());}
  catch{return res.status(503).json({error:'No se pudo comprobar la conexión del campus.'});}
});
app.get('/api/sales/campus-courses', async (_req, res) => {
  try { return res.json(await enrollmentAgent.courses()); } catch (error) { return salesError(res, new Error(enrollmentError(error))); }
});
app.post('/api/sales/course-mapping', async (req, res) => {
  const parsed = z.object({ courseTitle: z.string().trim().min(3).max(250), campusCourseId: z.string().min(1).max(150) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Selecciona los dos cursos.' });
  try {
    const course = (await enrollmentAgent.courses()).find((c: any) => c.id === parsed.data.campusCourseId);
    if (!course) return res.status(400).json({ error: 'El curso no existe en el campus.' });
    const body = { course_title: parsed.data.courseTitle, campus_course_id: course.id, campus_course_title: course.title, verified_by: getConfiguredAdminCredentials().email, updated_at: new Date().toISOString() };
    const existing = await salesStore.request(`crm_campus_course_mapping?course_title=eq.${encodeURIComponent(parsed.data.courseTitle)}&select=course_title`);
    if (existing.length) await salesStore.request(`crm_campus_course_mapping?course_title=eq.${encodeURIComponent(parsed.data.courseTitle)}`, 'PATCH', body);
    else await salesStore.request('crm_campus_course_mapping', 'POST', body);
    return res.json({ success: true });
  } catch (error) { return salesError(res, new Error(enrollmentError(error))); }
});
app.post('/api/sales/enrollments/:id/retry', async (req, res) => {
  const parsed = z.object({ confirmedNotSent: z.boolean().default(false) }).safeParse(req.body);
  if (!parsed.success || !z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: 'Solicitud inválida.' });
  try {
    const row = (await salesStore.request(`crm_student_enrollments?id=eq.${req.params.id}&select=*`))[0];
    if (!row) return res.status(404).json({ error: 'Matrícula no encontrada.' });
    if (row.lease_until && new Date(row.lease_until).getTime() > Date.now()) return res.status(409).json({ error: 'El agente está procesando esta matrícula.' });
    if (['sending', 'review'].includes(row.email_status) || ['sending', 'review'].includes(row.whatsapp_status)) {
      if (!parsed.data.confirmedNotSent) return res.status(409).json({ error: 'Comprueba en los proveedores que los mensajes pendientes NO se enviaron antes de reintentar.' });
    }
    const patch = { email_status: row.email_status === 'accepted' ? 'accepted' : 'pending', whatsapp_status: row.whatsapp_status === 'accepted' ? 'accepted' : 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: '' };
    const changed = await salesStore.request(`crm_student_enrollments?id=eq.${row.id}&or=(lease_until.is.null,lease_until.lt.${encodeURIComponent(new Date().toISOString())})`, 'PATCH', patch);
    if (!changed?.length) return res.status(409).json({ error: 'La matrícula se está procesando. Actualiza el panel.' });
    await salesStore.request('crm_sales_events', 'POST', { contact_key: row.contact_key, kind: 'enrollment_retry', actor: getConfiguredAdminCredentials().email, details: parsed.data });
    void enrollmentAgent.tick(); return res.json({ success: true });
  } catch (error) { return salesError(res, error); }
});
app.get('/api/sales/:key/receipts', async (req, res) => {
  try { return res.json(await salesStore.request(`crm_payment_receipts?contact_key=eq.${encodeURIComponent(req.params.key)}&select=id,mime_type,created_at&order=created_at.desc`)); }
  catch (error) { return salesError(res, error); }
});
app.post('/api/sales/:key/receipts', async (req, res) => {
  const parsed = z.union([z.object({ eventId: z.string().uuid() }), z.object({ base64: z.string().min(8).max(7000000) })]).safeParse(req.body);
  if (!parsed.success || !/^[a-f0-9]{64}$/.test(req.params.key)) return res.status(400).json({ error: 'Adjunta un recibo válido.' });
  try {
    const actor = getConfiguredAdminCredentials().email!;
    const receipt = 'eventId' in parsed.data ? await enrollmentAgent.importWhatsAppReceipt(req.params.key, parsed.data.eventId, actor) : await enrollmentAgent.uploadReceipt(req.params.key, Buffer.from(parsed.data.base64, 'base64'), actor);
    return res.json({ id: receipt.id, mime_type: receipt.mime_type, created_at: receipt.created_at });
  } catch (error) { return salesError(res, new Error(enrollmentError(error))); }
});
app.get('/api/sales/receipts/:id/content', async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.sendStatus(404);
  try { const receipt = await enrollmentAgent.receipt(req.params.id); res.set({ 'Content-Type': receipt.mime, 'Content-Disposition': 'attachment; filename="comprobante"', 'X-Content-Type-Options': 'nosniff' }); return res.send(receipt.bytes); }
  catch (error) { return salesError(res, new Error(enrollmentError(error))); }
});

app.get('/api/sales', async (req, res) => {
  try {
    const offset = Math.max(0, Math.min(Number(req.query.offset) || 0, 1000000));
    const [settings, opportunities] = await Promise.all([
      salesStore.settings(), salesStore.request(`crm_sales_opportunities?select=*&order=updated_at.desc&limit=100&offset=${offset}`),
    ]);
    return res.json({ settings, opportunities, hasMore: opportunities.length === 100, status: salesStore.status() });
  } catch (error) { return salesError(res, error); }
});
app.get('/api/sales/:key/events', async (req, res) => {
  try { return res.json(await salesStore.request(`crm_sales_events?contact_key=eq.${encodeURIComponent(req.params.key)}&select=*&order=created_at.desc&limit=60`)); }
  catch (error) { return salesError(res, error); }
});
app.post('/api/sales/settings', async (req, res) => {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Estado inválido.' });
  try { await salesStore.request('crm_sales_settings?id=eq.org_inteca_main', 'PATCH', { ...parsed.data, updated_at: new Date().toISOString() }); return res.json({ success: true }); }
  catch (error) { return salesError(res, error); }
});
app.post('/api/sales/:key/action', async (req, res) => {
  const parsed = salesActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Completa los datos requeridos y confirma la verificación bancaria.' });
  try {
    const opportunity = await salesStore.request('rpc/crm_sales_admin_action', 'POST', {
      p_key: req.params.key, p_action: parsed.data.action, p_data: parsed.data.data, p_actor: getConfiguredAdminCredentials().email,
    });
    if (parsed.data.action === 'verify_payment') void enrollmentAgent.tick();
    return res.json({ success: true, opportunity });
  } catch (error) { return salesError(res, error); }
});

// Health Check API
app.get('/api/health', (req, res) => {
  const integrationStatus = buildIntegrationEnvironmentStatus();
  const isIntegrationConfigured = (id: string) =>
    Boolean(integrationStatus.find((integration) => integration.id === id)?.configured);

  res.json({
    status: 'ok',
    app: 'Sales AI CRM',
    deploymentMode: DEPLOYMENT_MODE,
    timestamp: new Date().toISOString(),
    whatsAppMemory: whatsAppConversations.status(),
    whatsAppCatalog: { ...whatsAppCatalog.status(), paymentInstructionsConfigured: Boolean(process.env.WHATSAPP_PAYMENT_INSTRUCTIONS?.trim()) },
    salesAgent: salesStore.status(),
    enrollmentAgent: enrollmentAgent.status(),
    fiscalWorkspace: { jurisdiction: 'DO', multiCompany: true, calculationMode: 'deterministic_decimal_strings', preparationEnabled: true, officialEmissionEnabled: false, xmlValidationEnabled: false, rulesVersion: FISCAL_RULE_VERSION },
    advertisingAgent: { minimumPlanBudgetDop: 1000, budgetControl: 'crm_allocation_only', automaticSpendingEnabled: false, policy: 'owner_approval_per_campaign', autonomousDiscountPercent: 0, connections: advertisingAgent.configuration().map(({ channel, configured }) => ({ channel, configured })) },
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    geminiModels: {
      configured: getGeminiModelCandidates(),
      currentlyAvailable: getAvailableGeminiModelCandidates(),
      retryDelayMs: GEMINI_MODEL_RETRY_DELAY_MS,
    },
    authConfigured: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
    agentKnowledgeConfigured: getIntecaKnowledgeSourcesStatus().some((source) => source.loaded),
    integrations: {
      supabaseConfigured: isIntegrationConfigured('int_supabase_database'),
      renderConfigured: Boolean(process.env.APP_URL && (process.env.RENDER || process.env.RENDER_SERVICE_ID)),
      geminiConfigured: isIntegrationConfigured('int_gemini_ai'),
      whatsappConfigured: Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
      ),
      metaConfigured: Boolean(process.env.META_APP_ID && process.env.DS_META_APP_SECRET),
      googleAdsConfigured: Boolean(
        isIntegrationConfigured('int_google_ads'),
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
      campusConfigured: isIntegrationConfigured('int_inteca_campus'),
      creativeAiConfigured: isIntegrationConfigured('int_creative_ai'),
      youtubeConfigured: isIntegrationConfigured('int_youtube'),
    },
    conversionAgent: {
      registeredLeadsInMemory: serverConversionLeads.length,
      studentEnrollmentsInMemory: serverStudentEnrollments.length,
      processLeadPath: '/api/agents/conversion/process-lead',
    },
  });
});

app.get('/api/integrations/status', (_req, res) => {
  res.json({
    success: true,
    appUrl: process.env.APP_URL || `http://localhost:${PORT}`,
    deploymentMode: DEPLOYMENT_MODE,
    renderPersistenceReady: Boolean(process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID),
    checkedAt: new Date().toISOString(),
    groups: buildIntegrationEnvironmentStatus(),
  });
});

app.get('/api/agents/runtime/manifest', (_req, res) => {
  res.json({
    success: true,
    checkedAt: new Date().toISOString(),
    deploymentMode: DEPLOYMENT_MODE,
    configurationPrecedence: [
      '1. Credenciales por empresa guardadas en backend seguro o Supabase con cifrado.',
      '2. Variables de entorno del servidor en Render para integraciones globales.',
      '3. Valores de ejemplo solo para UI; nunca se usan como acceso real.',
    ],
    persistence: process.env.SUPABASE_URL ? 'supabase-ready' : 'memory-runtime',
    queue: process.env.SUPABASE_URL
      ? 'cola persistente preparada por esquema SQL incluido'
      : 'cola persistente pendiente de Supabase',
    agents: buildAgentRuntimeManifest(),
  });
});

app.post('/api/integrations/configure', async (req, res) => {
  const parsed = integrationConfigureRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INTEGRATION_CONFIG_REQUEST',
      details: parsed.error.flatten(),
    });
  }

  const { adminEmail, adminPassword, forceProduction, redeploy } = parsed.data;
  if (!validateAdminCredentials(adminEmail, adminPassword)) {
    recordServerAudit({
      actorType: 'Usuario',
      actorName: adminEmail,
      module: 'Integraciones',
      action: 'Falló',
      entityType: 'ProductionConfig',
      summary: 'Intento rechazado de modificar credenciales de producción.',
      details: `Correo: ${adminEmail}. No se revelaron ni guardaron secretos.`,
      sourceChannel: 'Web',
      severity: 'Crítico',
      status: 'Pendiente revisión',
    });

    return res.status(401).json({
      success: false,
      error: 'INVALID_ADMIN_CONFIRMATION',
      message: 'Confirma el correo y la contraseña del administrador para guardar credenciales.',
    });
  }

  const { accepted, invalidKeys } = normalizeConfigurableEnvVars(parsed.data.variables);
  const productionDefaults: Record<string, string> = forceProduction
    ? {
        DEPLOYMENT_MODE: 'production',
        VITE_DEPLOYMENT_MODE: 'production',
        TRUST_PROXY: 'true',
        WHATSAPP_AUTO_REPLY_ENABLED: accepted.WHATSAPP_AUTO_REPLY_ENABLED || 'true',
        META_GRAPH_API_VERSION: accepted.META_GRAPH_API_VERSION || 'v22.0',
      }
    : {};
  const variablesToApply: Record<string, string> = {
    ...productionDefaults,
    ...accepted,
  };

  if (Object.keys(variablesToApply).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'NO_CONFIG_VALUES',
      message: 'No se recibieron credenciales o variables validas para guardar.',
      invalidKeys,
    });
  }

  applyRuntimeEnvVars(variablesToApply);

  const renderApiKey = variablesToApply.RENDER_API_KEY || process.env.RENDER_API_KEY;
  const renderServiceId = variablesToApply.RENDER_SERVICE_ID || process.env.RENDER_SERVICE_ID;
  const renderPersistence = {
    attempted: Boolean(renderApiKey && renderServiceId),
    persistedVariables: [] as string[],
    failedVariables: [] as Array<{ key: string; error: string }>,
    skippedReason: '',
  };
  let deploy:
    | { requested: boolean; success: boolean; id?: string; status?: string; error?: string }
    | undefined;

  if (renderApiKey && renderServiceId) {
    for (const [key, value] of Object.entries(variablesToApply)) {
      try {
        await updateRenderEnvVar(renderServiceId, renderApiKey, key, value);
        renderPersistence.persistedVariables.push(key);
      } catch (error) {
        renderPersistence.failedVariables.push({
          key,
          error: error instanceof Error ? error.message : 'Render API error',
        });
      }
    }

    if (redeploy && renderPersistence.failedVariables.length === 0) {
      try {
        const deployResponse = await triggerRenderDeploy(renderServiceId, renderApiKey);
        const deployLike = deployResponse as { id?: unknown; status?: unknown };
        deploy = {
          requested: true,
          success: true,
          id: typeof deployLike.id === 'string' ? deployLike.id : undefined,
          status: typeof deployLike.status === 'string' ? deployLike.status : 'queued',
        };
      } catch (error) {
        deploy = {
          requested: true,
          success: false,
          error: error instanceof Error ? error.message : 'No se pudo iniciar el deploy.',
        };
      }
    } else {
      deploy = {
        requested: Boolean(redeploy),
        success: false,
        error: redeploy
          ? 'No se inicio deploy porque algunas variables no se guardaron en Render.'
          : 'Deploy no solicitado.',
      };
    }
  } else {
    renderPersistence.skippedReason =
      'Falta RENDER_API_KEY o RENDER_SERVICE_ID. Los cambios se aplicaron solo al proceso actual.';
  }

  recordServerAudit({
    actorType: 'Usuario',
    actorName: adminEmail,
    module: 'Integraciones',
    action: 'Configuró',
    entityType: 'ProductionConfig',
    summary: 'Credenciales y modo de producción actualizados desde el CRM.',
    details: `Variables recibidas: ${Object.keys(variablesToApply).join(', ')}. Variables rechazadas: ${
      invalidKeys.join(', ') || 'ninguna'
    }. Persistidas en Render: ${renderPersistence.persistedVariables.join(', ') || 'ninguna'}.`,
    sourceChannel: 'Web',
    severity: renderPersistence.failedVariables.length > 0 ? 'Advertencia' : 'Éxito',
    status: renderPersistence.failedVariables.length > 0 ? 'Pendiente revisión' : 'Registrado',
  });

  return res.json({
    success: renderPersistence.failedVariables.length === 0,
    message:
      renderPersistence.failedVariables.length === 0
        ? 'Configuracion aplicada. Los secretos no se devuelven por seguridad.'
        : 'Configuracion aplicada parcialmente. Revisa las variables que Render no pudo guardar.',
    deploymentMode: DEPLOYMENT_MODE,
    savedVariables: Object.keys(variablesToApply),
    invalidKeys,
    renderPersistence,
    deploy,
    groups: buildIntegrationEnvironmentStatus(),
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
    agentKnowledgeStatusPath: '/api/knowledge/inteca/status',
    agentRuntimeManifestPath: '/api/agents/runtime/manifest',
    conversionAgentPath: '/api/agents/conversion/process-lead',
    conversionAgentLeadsPath: '/api/agents/conversion/leads',
    campusBaseUrl: process.env.INTECA_CAMPUS_BASE_URL || 'https://campus.inteca.com.do',
  });
});

app.get('/api/knowledge/inteca/status', async (_req, res) => {
  await whatsAppCatalog.get();
  const knowledge = getIntecaAgentKnowledgeBase();
  res.json({
    success: true,
    sources: getIntecaKnowledgeSourcesStatus(),
    whatsAppCatalog: { ...whatsAppCatalog.status(), paymentInstructionsConfigured: Boolean(process.env.WHATSAPP_PAYMENT_INSTRUCTIONS?.trim()) },
    loadedCharacters: knowledge.length,
    maxCharacters: getAgentKnowledgeMaxChars(),
    canParaphrase: true,
    rule: 'Los agentes pueden parafrasear con fluidez, pero no pueden inventar ni alterar datos institucionales confirmados.',
  });
});

// Restore identity from the signed owner cookie or a server-validated, active staff session.
// This does not renew the cookie or extend its lifetime.
app.get('/api/auth/session', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const credentials = getConfiguredAdminCredentials();
  if (!credentials.email || !credentials.password || !verifySalesSession(req.headers.cookie || '', credentials.password, credentials.email)) {
    try { const i=await teamStudio.identity(req);if(i&&!i.owner)return res.json({success:true,session:{mode:'real',userName:i.name,email:i.email,role:i.area,organizationId:i.org,organizationName:(await salesStore.request(`crm_team_members?id=eq.${i.id}&select=organization_name`))[0].organization_name,token:'',loginAt:new Date().toISOString()}}); } catch {}
    return res.status(401).json({ success: false, error: 'SESSION_REQUIRED' });
  }
  return res.json({ success: true, session: {
    mode: 'real', userName: process.env.ADMIN_NAME || 'Luis Ramirez', email: credentials.email,
    role: 'Super Admin CRM', organizationName: process.env.ADMIN_ORGANIZATION || 'INTECA SRL',
    token: '', loginAt: new Date().toISOString(),
  } });
});

app.post('/api/auth/login', rateLimit({windowMs:15*60000,limit:20}), async (req, res) => {
  const parsed = authLoginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, error: 'INVALID_LOGIN_REQUEST', details: parsed.error.flatten() });
  }

  const configuredCredentials = getConfiguredAdminCredentials();
  const configuredEmail = configuredCredentials.email;
  const configuredPassword = configuredCredentials.password;
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

  if (!validateAdminCredentials(parsed.data.email, parsed.data.password)) {
    try { if(await teamStudio.login(parsed.data.email,parsed.data.password,res))return; } catch {}
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
    email: configuredEmail || 'admin@inteca.com.do',
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

  res.clearCookie('crm_team_session',{path:'/api'});
  if (configuredPassword && configuredEmail) res.cookie('crm_sales_session', issueSalesSession(configuredPassword, configuredEmail), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/api',
  });
  return res.json({ success: true, session });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('crm_sales_session', { path: '/api' });
  res.clearCookie('crm_team_session', {path:'/api'});
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

    const messages = extractWhatsAppMessages(event, process.env.WHATSAPP_PHONE_NUMBER_ID);

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

    if (messages.length > 0) {
      void processWhatsAppInboundMessages(messages, event).catch((error) => {
        console.error('Error sending WhatsApp auto reply:', error);
        recordServerAudit({
          actorType: 'Agente IA',
          actorName: 'Agente WhatsApp INTECA',
          module: 'WhatsApp',
          action: 'Falló',
          entityType: 'WhatsAppAutoReply',
          summary: 'No se pudo enviar la respuesta automatizada por WhatsApp.',
          details:
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : 'Error desconocido al responder por WhatsApp.',
          sourceChannel: 'WhatsApp',
          severity: 'Crítico',
          status: 'Pendiente revisión',
        });
      });
    }

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

app.get('/api/agents/conversion/leads', (_req, res) => {
  res.json({
    success: true,
    agentName: 'Agente IA Conversión y Matrícula',
    persistence: process.env.SUPABASE_URL ? 'supabase-ready' : 'memory-runtime',
    leads: serverConversionLeads,
    enrollments: serverStudentEnrollments,
    campus: {
      baseUrl: process.env.INTECA_CAMPUS_BASE_URL || 'https://campus.inteca.com.do',
      configured: Boolean(process.env.INTECA_CAMPUS_BASE_URL && process.env.INTECA_CAMPUS_API_KEY),
    },
  });
});

app.post('/api/agents/conversion/process-lead', (req, res) => {
  if (req.body?.paymentConfirmed) return res.status(403).json({ success: false, error: 'MANUAL_BANK_VALIDATION_REQUIRED' });
  const parsed = conversionLeadRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_CONVERSION_LEAD_REQUEST',
      details: parsed.error.flatten(),
    });
  }

  const result = processConversionLead(parsed.data, parsed.data.source || 'API');
  return res.status(result.enrollment ? 201 : 202).json({
    success: true,
    agentName: 'Agente IA Conversión y Matrícula',
    action: result.enrollment ? 'student_enrolled' : 'lead_registered',
    lead: result.lead,
    enrollment: result.enrollment,
    nextActions: result.nextActions,
    requiresHumanReview: Boolean(
      result.lead.missingFields.length,
    ),
    persistence: process.env.SUPABASE_URL ? 'supabase-ready' : 'memory-runtime',
  });
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
  const parsedLead = conversionLeadRequestSchema.safeParse({
    ...req.body,
    source: req.body?.source || 'Meta Ads',
    campaign: req.body?.campaign || req.body?.campaign_name || req.body?.ad_name,
    message: req.body?.message || req.body?.leadgen_id || JSON.stringify(req.body || {}),
  });
  const conversionResult = parsedLead.success
    ? processConversionLead(parsedLead.data, 'Meta Ads')
    : null;

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
  return res.status(200).json({
    success: true,
    receivedEntries: entries,
    conversionLead: conversionResult?.lead,
    nextActions: conversionResult?.nextActions,
  });
});

app.post('/api/webhooks/google-ads/leads', (req, res) => {
  const parsedLead = conversionLeadRequestSchema.safeParse({
    ...req.body,
    source: req.body?.source || 'Google Ads',
    campaign: req.body?.campaign || req.body?.campaign_name || req.body?.keyword,
    message: req.body?.message || JSON.stringify(req.body || {}),
  });
  const conversionResult = parsedLead.success
    ? processConversionLead(parsedLead.data, 'Google Ads')
    : null;

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
  return res.status(200).json({
    success: true,
    payloadAccepted: Boolean(req.body),
    conversionLead: conversionResult?.lead,
    nextActions: conversionResult?.nextActions,
  });
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
  const parsedLead = conversionLeadRequestSchema.safeParse({
    ...req.body,
    source: req.body?.source || 'Web Form',
  });
  const conversionResult = parsedLead.success
    ? processConversionLead(parsedLead.data, 'Web Form')
    : null;

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
  if (!parsedLead.success) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_WEB_FORM_LEAD',
      details: parsedLead.error.flatten(),
    });
  }

  return res.status(200).json({
    success: true,
    payloadAccepted: Boolean(req.body),
    conversionLead: conversionResult?.lead,
    nextActions: conversionResult?.nextActions,
  });
});

// No trusted payment-provider verifier is configured. Unauthenticated payloads cannot close a sale.
app.post('/api/webhooks/payments', (_req, res) => {
  return res.status(503).json({ success: false, paymentConfirmed: false, error: 'PAYMENT_PROVIDER_VERIFICATION_NOT_CONFIGURED', message: 'Valida las transferencias desde el panel autenticado de Ventas y Cierre.' });
});

app.post('/api/webhooks/dgii/ecf-status', (_req,res) => res.status(503).json({success:false,payloadAccepted:false,error:'FISCAL_PROVIDER_SIGNATURE_VERIFICATION_NOT_CONFIGURED'}));

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

${buildAgentKnowledgePrompt('ventas, seguimiento, soporte comercial, objeciones y conversacion con leads')}

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
2. Utiliza la base de conocimiento, el contexto y el historial. Puedes parafrasear, pero no alterar datos confirmados.
3. No prometas descuentos, disponibilidad, pagos o condiciones que no estén expresamente autorizados.
4. Mantén una llamada a la acción clara, sin afirmar que ejecutaste acciones externas.
5. Si falta información, indícalo y solicita intervención humana.
6. Detecta la necesidad principal del cliente y adapta la oferta a esa necesidad.
7. Explica el beneficio práctico: qué aprenderá/recibirá, cómo mejora su vida, empleo, ventas u operación.
8. Crea urgencia ética mostrando el costo de no actuar y el siguiente paso concreto.
9. Si el cliente está listo para pagar, orienta hacia pago validado; no marques cliente/matriculado sin confirmación real.
10. Sugiere próxima acción de seguimiento si no compra ahora.
`;

    const response = await generateGeminiContentWithFallback(promptInstruction, {
      temperature: 0.7,
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
    const prompt = `
Analiza la siguiente información comercial y realiza una calificación orientativa. No uses características sensibles y no inventes datos ausentes:

${buildAgentKnowledgePrompt('calificacion de leads, deteccion de necesidades, recomendacion de cursos y proximos pasos comerciales')}

DATOS DEL LEAD:
${JSON.stringify(leadData, null, 2)}

Infiere y genera en formato JSON estricto los siguientes campos:
1. aiScore (número de 0 a 100)
2. buyProbability (número de 0 a 100)
3. recommendedCourseId (ID del curso más afín)
4. currentEmotion ("Muy Entusiasta", "Interesado", "Neutral", "Indeciso", "Escéptico", "Urgente", "Molesto")
5. discType ("Dominante", "Influyente", "Estable", "Concienzudo")
6. decisionSpeed ("Rápida", "Analítica", "Basada en Precio", "Lenta")
7. dominantPainPoint (resumen corto de su dolor o necesidad principal)
8. buyingMotivation (motivación de compra principal)
9. recommendedNextAction (siguiente paso sugerido para el vendedor o agente IA)
`;

    const response = await generateGeminiContentWithFallback(prompt, {
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
app.use(['/api/ai/generate-marketing', '/api/ai/generate-growth-system', '/api/ai/generate-creative-brief'], (req, res, next) => {
  const admin = getConfiguredAdminCredentials();
  if (!verifySalesSession(req.headers.cookie || '', admin.password || '', admin.email || '')) return res.status(401).json({ success: false, error: AD_ERRORS.AD_AUTH });
  if (hasDiscount(req.body)) return res.status(409).json({ success: false, error: 'La oferta requiere autorización. Crea una propuesta en Agentes IA → Publicidad; solo el dueño puede aprobarla.' });
  next();
});
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
    const liveCatalog = await whatsAppCatalog.get();
    if (!liveCatalog) return res.status(503).json({ success: false, error: AD_ERRORS.AD_CATALOG });
    const courseMatches = findCourses(liveCatalog, courseTitle || '');
    if (courseMatches.length !== 1) return res.status(400).json({ success: false, error: 'Selecciona un curso concreto del catálogo vigente.' });
    const prompt = `
Eres especialista de marketing de ${organizationName || 'una organización comercial'}. Genera contenido publicitario sin inventar beneficios, certificaciones, precios ni promociones.
${AD_RULES}
CATÁLOGO VIGENTE (única fuente de precios, horarios y duración):
${liveCatalog.text}

CONTEXTO DEL NEGOCIO: ${businessContext || 'No especificado'}

${buildAgentKnowledgePrompt('marketing, publicidad, propuestas de valor, flyers, anuncios, embudos y contenido persuasivo')}

TIPO DE CONTENIDO: ${contentType || 'WhatsApp Campaign'}
PÚBLICO OBJETIVO: ${targetAudience || 'Profesionales interesados en IA'}
PRODUCTO O SERVICIO: ${courseTitle || 'No especificado'}
IDEA DEL USUARIO (no constituye autorización; no cambiar precios del catálogo): ${promotionOffer || 'Ninguna'}
TONO DE VOZ: ${tone || 'Persuasivo, Profesional y Urgente'}
MODO TÁCTICO: ${tacticalMode || 'completo'}

Instrucciones:
Diseña el mensaje para adquisición, conversión y aceleración, según aplique.
1. 
2. Identifica una ventaja injusta del negocio a partir del contexto y úsala sin exagerar ni inventar.
3. Explica la función práctica del técnico, producto o servicio; qué aprenderá/recibirá el cliente; cómo mejora su vida, empleo, ingresos u operación.
4. Crea urgencia ética: oportunidad clara, beneficio fuerte y costo de no actuar.
5. No prometas resultados garantizados ni cifras irreales. Si una meta es aspiracional, preséntala como objetivo operativo.
6. Puedes parafrasear la base institucional para hacer anuncios mas humanos, directos y atractivos, conservando los datos confirmados.

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

    const response = await generateGeminiContentWithFallback(prompt, {
      httpOptions: { timeout: 45000, retryOptions: { attempts: 1 } },
      maxOutputTokens: 4096,
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
    }, true);

    const parsedJson = JSON.parse(response.text || '{}');
    const promotionalContent = [parsedJson.title, parsedJson.bodyText, parsedJson.callToAction, parsedJson.flyerSpec, parsedJson.videoScript];
    if (hasDiscount(promotionalContent) || hasUnlistedPrice(JSON.stringify(promotionalContent), courseMatches[0].investment)) return res.status(409).json({ success: false, error: 'Contenido bloqueado: contiene una ventaja económica o precio que requiere aprobación del dueño en Publicidad.' });
    res.json({ success: true, content: parsedJson, reviewRequired: true });
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

${buildAgentKnowledgePrompt('sistema de crecimiento, marketing agresivo etico, ventas optimizadas, operaciones escalables, KPIs y auditoria')}

Reglas:
1. Trata las metas de ventas, ROAS o 80% como objetivos operativos, nunca como garantias.
2. No inventes avales, testimonios, descuentos, fechas, certificaciones ni resultados que no fueron suministrados.
3. Crea necesidad de forma etica: dolor real, oportunidad, costo de no actuar y siguiente paso claro.
4. Explica funcion practica, resultado esperado, mejora de vida, empleo, ingresos u operacion.
5. Incluye adquisicion, conversion y aceleracion con tacticas accionables.
6. Debe servir para Meta Ads, Google Ads, YouTube, WhatsApp, landing, email y retargeting.
7. Indica que debe aprobar el dueno y que puede ejecutar cada agente de IA.
8. Incluye plan para romper el cuello de botella y escalar sin depender de trabajo manual del dueno.
9. Puedes parafrasear la base de conocimiento para crear mensajes mas potentes, pero sin cambiar hechos confirmados.

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

    const response = await generateGeminiContentWithFallback(prompt, {
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
    });

    const parsedJson = JSON.parse(response.text || '{}');
    recordServerAudit({
      actorType: 'Agente IA',
      actorName: 'Máximo Sterling',
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

    const prompt = `
Eres un director creativo de performance marketing para ${organizationName || 'INTECA'}.
Debes crear un brief listo para una herramienta de generación de imágenes o video. Toda pieza de INTECA lleva el logo institucional real sin alterarlo, jerarquía tipográfica clara, beneficios verificables del curso y un llamado a solicitar información. El video explica un beneficio por escena con subtítulos. Apela a aspiraciones reales de aprendizaje sin crear miedo, escasez falsa o promesas de empleo.

PIEZA: ${creativeType}
CURSO / PRODUCTO: ${courseTitle}
PÚBLICO: ${targetAudience}
OFERTA AUTORIZADA: ${promotionOffer || 'No especificada'}
LANZAMIENTO: ${launchDate || 'No especificado'}
RELANZAMIENTO: ${relaunchDate || 'No especificado'}
MARCA: ${brandInstructions || 'Usar logo INTECA, tono profesional, claro, educativo y orientado a resultados.'}

${buildAgentKnowledgePrompt('briefs creativos, flyers, videos de 30 a 60 segundos, carruseles, reels, shorts y anuncios visuales')}

Reglas:
1. No inventes avales, precios, fechas ni garantías no indicadas.
2. La pieza debe crear deseo y necesidad de forma ética, con beneficio práctico y CTA fuerte.
3. Si es flyer, incluye escena visual, texto principal, CTA, elementos obligatorios y prompt de imagen en inglés.
4. Si es video, incluye guion por segundos, texto en pantalla, voz en off, scenes, portada y CTA.
5. Debe ser útil para Meta Ads, WhatsApp, YouTube Shorts/Reels y landing.
6. Puedes parafrasear con estilo publicitario, pero manteniendo exactamente precios, duraciones, advertencias y condiciones confirmadas.

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

    const response = await generateGeminiContentWithFallback(prompt, {
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
    });

    const parsedJson = JSON.parse(response.text || '{}');
    recordServerAudit({
      actorType: 'Agente IA',
      actorName: creativeType.includes('Video') ? 'Dante Vega' : 'Isabella Morel',
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

// Retired generative fiscal endpoint; use the deterministic company workspace.
app.post('/api/ai/generate-ecf-invoice', (req,res) => {
  const admin=getConfiguredAdminCredentials();
  if(!verifySalesSession(req.headers.cookie || '',admin.password || '',admin.email || '')) return res.status(401).json({error:'Inicia sesión para gestionar facturación.'});
  return res.status(410).json({success:false,error:'La facturación usa ahora el motor determinista por empresa. Abre Pasarelas y Facturación.',replacement:'/api/fiscal',fiscalIssued:false});
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
    const prompt = `
Eres Bruno Ferrer, agente contable autónomo para ${organizationName || 'la empresa'}.
Debes preparar un documento contable estructurado, auditable y listo para revisión.

TIPO DE REPORTE/DOCUMENTO: ${reportType}
PERIODO: ${period}
NOTAS: ${notes || 'Sin notas'}

DATOS FUENTE:
${JSON.stringify(sourceData, null, 2)}

${buildAgentKnowledgePrompt('contabilidad, reportes administrativos, ordenes de compra, recibos, conciliacion, inventario, KPIs y auditoria')}

Reglas:
1. Para Estado de resultados, resume ingresos, costos, gastos y utilidad.
2. Para Balance general, presenta activos, pasivos y patrimonio. Usa el marco contable confirmado de la empresa; no asumas normas de otra jurisdicción.
3. Para Flujo de efectivo, separa entradas, salidas y flujo neto.
4. Para órdenes de compra, recibos, conciliaciones e inventarios, genera campos completos y estado.
5. No apliques normas extranjeras ni tratamientos fiscales sin confirmar el marco y la actividad de la empresa. Los reportes 606/607/608/609 no sustituyen declaraciones tributarias; e-CF, firma y transmisión requieren autorización y evidencias reales.
6. No marques documento como aprobado sin revisión humana autorizada.
7. Devuelve JSON estricto con resumen, tablas, alertas y próximos pasos.
8. Puedes explicar y resumir con lenguaje profesional, pero no inventar soportes, pagos, saldos, aprobaciones ni conciliaciones.
`;

    const response = await generateGeminiContentWithFallback(prompt, {
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
    });

    const parsedJson = JSON.parse(response.text || '{}');
    recordServerAudit({
      actorType: 'Agente IA',
      actorName: 'Bruno Ferrer',
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

  const httpServer=createServer(app);
  attachVoiceRelay(httpServer,voiceSalesAgent);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sales AI CRM listening on http://0.0.0.0:${PORT}`);
    if (process.env.CRM_RENDER_PERSISTENCE_DIAGNOSTIC === 'true') {
      void probeRenderPersistence(process.env.RENDER_SERVICE_ID || '', process.env.RENDER_API_KEY || '')
        .then(result => console.log('OAUTH_RENDER_WRITE_CHECK', JSON.stringify(result)))
        .catch(error => console.warn('OAUTH_RENDER_WRITE_CHECK', JSON.stringify({ writeVerified: false, code: error instanceof RenderPersistenceError ? error.code : 'NETWORK', httpStatus: error instanceof RenderPersistenceError ? error.httpStatus : undefined })));
    }
    if (process.env.CRM_META_OAUTH_DIAGNOSTIC === 'true') void probeMetaClient(process.env).then(result => console.log('OAUTH_META_CLIENT_CHECK', JSON.stringify(result)));
    void renderRequest(process.env.RENDER_SERVICE_ID || '', process.env.RENDER_API_KEY || '')
      .then(() => console.log('OAUTH_RENDER_CHECK', JSON.stringify({ readVerified: true })))
      .catch(error => console.warn('OAUTH_RENDER_CHECK', JSON.stringify({ readVerified: false, code: error instanceof RenderPersistenceError ? error.code : 'OAUTH_RENDER_UNAVAILABLE', httpStatus: error instanceof RenderPersistenceError ? error.httpStatus : undefined })));
    void agentConnections.refresh().then(connections => console.log('AGENT_CONNECTION_CHECK', JSON.stringify(connections.map(({channel,state,checkedAt,failureReason,httpStatus,providerCode,providerReason}) => ({channel,state,checkedAt,failureReason,httpStatus,providerCode,providerReason})))))
      .catch(() => console.warn('AGENT_CONNECTION_CHECK unavailable'));
  });
}

startServer();
