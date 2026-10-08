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

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
let DEPLOYMENT_MODE =
  process.env.DEPLOYMENT_MODE || process.env.VITE_DEPLOYMENT_MODE || 'production';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const DEFAULT_GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];
const GEMINI_MODEL_RETRY_DELAY_MS = Number(process.env.GEMINI_MODEL_RETRY_DELAY_MS || 120_000);

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1' || process.env.RENDER) {
  app.set('trust proxy', 1);
}
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

const conversionLeadRequestSchema = z.object({
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  fullName: z.string().max(240).optional(),
  name: z.string().max(240).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(60).optional(),
  whatsapp: z.string().max(60).optional(),
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

function getConfiguredAdminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL || process.env.CRM_ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD || process.env.CRM_ADMIN_PASSWORD,
  };
}

function validateAdminCredentials(email: string, password: string) {
  const configuredCredentials = getConfiguredAdminCredentials();
  const expectedEmail = configuredCredentials.email || 'admin@inteca.com.do';
  const expectedPassword = configuredCredentials.password || 'Inteca2026!';

  return (
    email.trim().toLowerCase() === expectedEmail.trim().toLowerCase() &&
    password === expectedPassword
  );
}

const INTECA_AGENT_KNOWLEDGE_BASE = `
INTECA SRL, tambien conocida como Instituto Tecnico del Caribe e Instituto Nacional de Tecnologia y Capacitacion Aplicada, es una institucion de formacion tecnica en Republica Dominicana enfocada en cursos del sector salud, autorizaciones medicas, atencion al usuario, facturacion medica, Ley 87-01, farmacologia aplicada, enfermeria y capacitacion profesional.

Canales oficiales:
- Sitio web: https://www.inteca.com.do
- Instagram: @formacion.inteca
- WhatsApp principal: 809-643-5502
- Correo institucional actual: intecaedu@gmail.com

Curso principal confirmado:
- Nombre: Tecnico u Oficial de Autorizaciones Medicas.
- Modalidad: virtual.
- Duracion: 5 meses.
- Precio confirmado: inscripcion RD$2,500 y mensualidad RD$2,000.
- Contenido: PBS, flujo de autorizaciones, validacion de coberturas, precertificaciones, atencion al afiliado, procesos ARS, SISALRIL, CNSS, SDSS, Ley 87-01, reclamos y casos practicos.
- Beneficio: prepara al participante para comprender y ejecutar procesos reales de autorizaciones medicas en ARS, clinicas, hospitales, farmacias y centros de salud.

Otros programas confirmados o previstos:
- Precertificaciones medicas.
- Atencion al usuario en salud.
- Farmacologia aplicada.
- Ley 87-01.
- Facturacion medica.
- Enfermeria, con duracion confirmada de 1 ano.
- Cursos del sector salud.
- Precios base usados por INTECA cuando no exista otra tarifa aprobada: inscripcion RD$2,500 y mensualidad RD$2,000.

Horarios confirmados para ofertas virtuales cuando esten disponibles:
- Lunes a viernes: 3:00 p. m. a 5:00 p. m. y 7:00 p. m. a 9:00 p. m.
- Sabados: 10:00 a. m. a 12:00 m. y 2:00 p. m. a 4:00 p. m.
- Domingos: 9:00 a. m. a 11:00 a. m.

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
    return `FUENTE: ${relativePath}\n${content}`;
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
  return `
BASE DE CONOCIMIENTO INSTITUCIONAL PARA TODOS LOS AGENTES DE INTECA
Alcance de uso: ${scope}.

${getIntecaAgentKnowledgeBase()}

REGLAS DE CONVERSACION, PARAFRASEO Y SEGURIDAD:
- Puedes conversar de forma fluida, profesional, empatica y natural, usando espanol dominicano neutro.
- Puedes parafrasear para adaptar el mensaje al canal, al nivel del cliente y a su necesidad.
- No cambies datos sensibles: precios, duraciones, fechas, horarios, condiciones, avales, advertencias, requisitos, limitaciones, pagos ni certificaciones.
- No inventes beneficios, cupos, empleos garantizados, pasantias, alianzas, descuentos, testimonios, resultados, pagos aprobados ni facturas emitidas.
- Si la informacion no esta confirmada en la base o en el contexto de la solicitud, dilo con claridad y escala a Luis o a un asesor autorizado.
- Cuando hables por INTECA, presenta los cursos como oportunidades de formacion practica y mejora profesional, sin prometer resultados garantizados.
- Si el contexto pertenece a otra empresa, usa estas reglas como guia de calidad, pero no presentes datos de INTECA como si fueran de esa empresa.
`;
}

function getIntecaKnowledgeSourcesStatus() {
  return INTECA_AGENT_KNOWLEDGE_FILES.map((relativePath) => ({
    path: relativePath,
    loaded: Boolean(readAgentKnowledgeFile(relativePath)),
  }));
}

function trimWhatsAppReply(text: string) {
  return text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1_500);
}

function buildFallbackWhatsAppReply(customerName: string | undefined, userMessage: string) {
  const greetingName = customerName ? ` ${customerName}` : '';
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('autoriz')) {
    return trimWhatsAppReply(`Hola${greetingName}, gracias por escribir a INTECA.

Si te interesa el curso de Tecnico u Oficial de Autorizaciones Medicas, te cuento lo esencial:

- Modalidad virtual.
- Duracion: 5 meses.
- Inscripcion: RD$2,500.
- Mensualidad: RD$2,000.
- Aprenderas procesos de autorizaciones, validacion de coberturas, PBS, precertificaciones, atencion al afiliado, Ley 87-01, SISALRIL, CNSS y casos practicos del sector salud.

Este curso te prepara para entender como trabajan las ARS, clinicas, hospitales y centros de salud en el area de autorizaciones medicas.

Para orientarte mejor, dime por favor:
1. Tu nombre completo.
2. Si tienes experiencia en salud o empiezas desde cero.
3. Que horario prefieres: tarde, noche, sabado o domingo.`);
  }

  return trimWhatsAppReply(`Hola${greetingName}, gracias por escribir a INTECA.

Somos una institucion de formacion tecnica enfocada en cursos del sector salud. Tenemos programas como Autorizaciones Medicas, Precertificaciones Medicas, Atencion al Usuario, Facturacion Medica, Ley 87-01, Farmacologia Aplicada y Enfermeria.

Para ayudarte bien, dime:
1. Que curso te interesa.
2. Si prefieres horario de tarde, noche o fin de semana.
3. Si deseas informacion para inscribirte.`);
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

  return `Mensaje recibido de tipo ${message?.type || 'desconocido'}.`;
}

function findWhatsAppContactName(event: any, waId: string) {
  const contacts =
    event.entry?.flatMap(
      (entry: any) => entry.changes?.flatMap((change: any) => change.value?.contacts || []) || [],
    ) || [];
  const contact = contacts.find((item: any) => item?.wa_id === waId);
  return contact?.profile?.name;
}

async function generateWhatsAppAutoReply(userMessage: string, customerName?: string) {
  const fallback = buildFallbackWhatsAppReply(customerName, userMessage);

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  try {
    const prompt = `
Eres el agente comercial de WhatsApp de INTECA. Responde al prospecto usando un estilo humano, profesional, claro y orientado a conversion.

BASE DE CONOCIMIENTO AUTORIZADA:
${buildAgentKnowledgePrompt('WhatsApp, ventas consultivas, captacion de leads y seguimiento comercial')}

NOMBRE DEL PROSPECTO: ${customerName || 'No especificado'}
MENSAJE DEL PROSPECTO:
"${userMessage}"

INSTRUCCIONES:
1. Responde en espanol dominicano profesional.
2. Puedes parafrasear con naturalidad, pero no inventes datos, fechas, descuentos, certificaciones ni garantias.
3. Si pregunta por autorizaciones medicas, incluye duracion 5 meses, modalidad virtual, inscripcion RD$2,500 y mensualidad RD$2,000.
4. Explica beneficio laboral y practico en pocas lineas.
5. Cierra con una pregunta que capture datos o acerque al pago.
6. Mantente por debajo de 1,200 caracteres para WhatsApp.
`;

    const response = await generateGeminiContentWithFallback(prompt, {
      temperature: 0.55,
    });

    return trimWhatsAppReply(response.text || fallback) || fallback;
  } catch (error) {
    console.error('Error generating WhatsApp auto reply:', error);
    return fallback;
  }
}

async function sendWhatsAppTextMessage(to: string, body: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphApiVersion = process.env.META_GRAPH_API_VERSION || 'v22.0';

  if (!accessToken || !phoneNumberId) {
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
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body,
        },
      }),
    },
  );

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('WhatsApp Cloud API send failed', {
      status: response.status,
      responseBody,
    });
    throw new Error('WHATSAPP_SEND_FAILED');
  }

  return responseBody;
}

async function processWhatsAppInboundMessages(messages: any[], event: any) {
  if (process.env.WHATSAPP_AUTO_REPLY_ENABLED === 'false') {
    return;
  }

  for (const message of messages) {
    const messageId = message?.id;
    const from = message?.from;
    if (!from || !messageId || processedWhatsAppMessageIds.has(messageId)) {
      continue;
    }

    processedWhatsAppMessageIds.add(messageId);
    if (processedWhatsAppMessageIds.size > 1_000) {
      const firstMessageId = processedWhatsAppMessageIds.values().next().value;
      if (typeof firstMessageId === 'string') {
        processedWhatsAppMessageIds.delete(firstMessageId);
      }
    }

    const userMessage = getWhatsAppMessageText(message);
    const customerName = findWhatsAppContactName(event, from);
    const conversionResult = processConversionLead(
      {
        fullName: customerName,
        whatsapp: from,
        phone: from,
        source: 'WhatsApp',
        message: userMessage,
        courseTitle: inferCourseTitle({ message: userMessage }),
        organizationId: 'org_inteca_main',
      },
      'WhatsApp',
    );
    const reply = await generateWhatsAppAutoReply(userMessage, customerName);

    await sendWhatsAppTextMessage(from, reply);

    recordServerAudit({
      actorType: 'Agente IA',
      actorName: 'Agente WhatsApp INTECA',
      module: 'WhatsApp',
      action: 'Respondió',
      entityType: 'WhatsAppMessage',
      entityId: messageId,
      summary: 'Respuesta automatizada enviada por WhatsApp Cloud API.',
      details: `Prospecto: ${customerName || from}. Mensaje recibido: ${userMessage}. Respuesta: ${reply}`,
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
    const leadWhatsapp = (lead.whatsapp || lead.phone).replace(/\D/g, '');
    return Boolean(
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

function buildCampusCredentialPackage(
  lead: ServerConversionLead,
  payload: ConversionLeadInput,
): ServerStudentEnrollment {
  const paidAt = new Date().toISOString();
  const campusUrl = process.env.INTECA_CAMPUS_BASE_URL || 'https://campus.inteca.com.do';
  const campusConnected = Boolean(process.env.INTECA_CAMPUS_BASE_URL && process.env.INTECA_CAMPUS_API_KEY);
  const nameToken = normalizeConversionToken(`${lead.firstName}.${lead.lastName}`);
  const contactToken = normalizeConversionToken(lead.whatsapp || lead.phone || lead.id).slice(-4);
  const courseToken = normalizeConversionToken(lead.courseTitle).slice(0, 8).toUpperCase() || 'CURSO';
  const studentCode = `INTECA-${new Date(paidAt).getFullYear()}-${lead.id.slice(-6).toUpperCase()}`;
  const campusEmail =
    lead.email && lead.email.includes('@')
      ? lead.email.toLowerCase()
      : `${nameToken || 'estudiante'}${contactToken}@alumnos.inteca.com.do`;
  const campusTemporaryPassword = `Inteca-${courseToken.slice(0, 4)}-${contactToken || '2026'}!`;
  const courseAccessCode = `${courseToken}-${studentCode.slice(-6)}`;
  const nextAcademicFollowUpAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
  const welcomeMessage = `Hola ${lead.firstName}, bienvenido/a oficialmente a INTECA. Tu inscripción al programa ${lead.courseTitle} fue validada correctamente. Acceso al campus: ${campusUrl}. Usuario: ${campusEmail}. Contraseña temporal: ${campusTemporaryPassword}. Código del curso: ${courseAccessCode}. En las próximas 24 horas confirmaremos tu grupo, horario y próximos pasos académicos.`;

  return {
    id: `enr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    leadId: lead.id,
    studentCode,
    courseId: lead.courseId,
    courseTitle: lead.courseTitle,
    paymentTransactionId:
      normalizeContactValue(payload.paymentTransactionId) ||
      `payment_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    paymentAmount: payload.paymentAmount,
    paidAt,
    status: campusConnected ? 'Activo en campus' : 'Bienvenida enviada',
    campusUrl,
    campusEmail,
    campusTemporaryPassword,
    courseAccessCode,
    welcomeMessage,
    credentialsSentAt: paidAt,
    nextAcademicFollowUpAt,
    campusSyncStatus: campusConnected ? 'synced_or_ready' : 'pending_external_campus_api',
  };
}

function registerStudentEnrollment(enrollment: ServerStudentEnrollment) {
  const existingIndex = serverStudentEnrollments.findIndex(
    (item) => item.leadId === enrollment.leadId && item.paymentTransactionId === enrollment.paymentTransactionId,
  );
  if (existingIndex >= 0) {
    serverStudentEnrollments[existingIndex] = enrollment;
  } else {
    serverStudentEnrollments.unshift(enrollment);
  }

  serverStudentEnrollments.splice(300);
  return enrollment;
}

function processConversionLead(payload: ConversionLeadInput, sourceChannel = 'API') {
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

  const enrollment = payload.paymentConfirmed
    ? registerStudentEnrollment(buildCampusCredentialPackage(lead, payload))
    : null;

  if (enrollment) {
    recordServerAudit({
      actorType: 'Agente IA',
      actorName: 'Agente IA Conversión y Matrícula',
      module: 'Campus',
      action: 'Activó',
      entityType: 'StudentEnrollment',
      entityId: enrollment.id,
      summary: `Estudiante activado y bienvenida preparada: ${lead.fullName}`,
      details: `Pago: ${enrollment.paymentTransactionId}. Usuario campus: ${enrollment.campusEmail}. Estado campus: ${enrollment.campusSyncStatus}.`,
      sourceChannel,
      severity: enrollment.campusSyncStatus === 'synced_or_ready' ? 'Éxito' : 'Advertencia',
      status:
        enrollment.campusSyncStatus === 'synced_or_ready' ? 'Registrado' : 'Pendiente revisión',
    });
  }

  return {
    lead,
    enrollment,
    nextActions: enrollment
      ? [
          'Enviar mensaje de bienvenida al estudiante por WhatsApp/email.',
          'Confirmar grupo, horario de inicio y acceso al campus.',
          'Programar seguimiento académico en 24 horas.',
        ]
      : [
          'Completar datos faltantes si existen.',
          'Explicar valor del curso y confirmar horario preferido.',
          'Solicitar pago de inscripción y mantener seguimiento hasta validarlo.',
        ],
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

async function generateGeminiContentWithFallback(contents: string, config?: Record<string, unknown>) {
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
        config,
      });
    } catch (error) {
      lastError = error;
      temporarilyUnavailableGeminiModels.set(model, Date.now() + GEMINI_MODEL_RETRY_DELAY_MS);
      console.error('Gemini generateContent failed', {
        model,
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
      'META_APP_SECRET',
      'META_PAGE_ACCESS_TOKEN',
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
      'GOOGLE_ADS_DEVELOPER_TOKEN',
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
    requiredEnvVars: ['YOUTUBE_API_KEY', 'YOUTUBE_CHANNEL_ID'],
    webhookPath: '/api/webhooks/youtube/events',
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
      'INTECA_CAMPUS_API_KEY',
      'INTECA_CAMPUS_DEFAULT_ROLE',
      'INTECA_CAMPUS_WELCOME_TEMPLATE_ID',
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
    name: 'Agente IA WhatsApp',
    function: 'Atención, respuesta, seguimiento y transferencia humana por WhatsApp.',
    requiredIntegrationIds: ['int_whatsapp_cloud', 'int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_owner_notifications', 'int_payments'],
    executableTools: ['whatsapp.receive_message', 'whatsapp.send_text', 'crm.create_lead', 'audit.record'],
    humanIntervention:
      'Pago, reclamo sensible, promesa no autorizada, error de envío o conversación fuera de la ventana permitida.',
  },
  {
    id: 'agent_omnichannel',
    name: 'Agente IA Omnicanal',
    function: 'Captura, normaliza y enruta leads desde web, redes, Meta, Google y WhatsApp.',
    requiredIntegrationIds: ['int_web_forms', 'int_supabase_database'],
    optionalIntegrationIds: ['int_meta_social', 'int_google_ads', 'int_whatsapp_cloud'],
    executableTools: ['webforms.receive', 'meta.lead_event', 'googleads.lead_event', 'crm.route_lead'],
    humanIntervention: 'Lead duplicado incierto, fuente sin consentimiento o credencial revocada.',
  },
  {
    id: 'agent_conversion',
    name: 'Agente IA Conversión y Matrícula',
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
    name: 'Agente IA Ventas',
    function: 'Seguimiento comercial, cierre, actualización de oportunidad y solicitud de pago.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_whatsapp_cloud', 'int_payments', 'int_owner_notifications'],
    executableTools: ['crm.update_opportunity', 'crm.schedule_followup', 'payments.create_request'],
    humanIntervention: 'Descuento fuera de política, promesa sensible, pago dudoso o llamada necesaria.',
  },
  {
    id: 'agent_copywriter',
    name: 'Agente IA Marketing',
    function: 'Crea campañas, copys, embudos y propuestas de valor para adquisición y conversión.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_meta_social', 'int_google_ads', 'int_youtube', 'int_creative_ai'],
    executableTools: ['marketing.generate_copy', 'campaign.prepare', 'audit.record'],
    humanIntervention: 'Testimonios, noticias institucionales, promesas sensibles o gasto publicitario.',
  },
  {
    id: 'agent_media_buyer',
    name: 'Agente IA Publicidad',
    function: 'Prepara, valida y optimiza campañas pagadas con límites y aprobación del dueño.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_meta_social', 'int_google_ads', 'int_ad_payment_wallet'],
    executableTools: ['ads.prepare_campaign', 'ads.read_metrics', 'budget.validate_limits'],
    humanIntervention: 'Activación de gasto, cambio de presupuesto, campaña pública o cuenta sin permisos.',
  },
  {
    id: 'agent_creative',
    name: 'Agente IA Creativo',
    function: 'Genera briefs, flyers, carruseles, prompts, piezas visuales y evidencias de revisión.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_creative_ai', 'int_meta_social', 'int_whatsapp_cloud'],
    executableTools: ['creative.prepare_brief', 'creative.generate_asset', 'asset.store'],
    humanIntervention: 'Uso de marca sin activo aprobado, proveedor sin credencial o pieza sensible.',
  },
  {
    id: 'agent_video',
    name: 'Agente IA Video',
    function: 'Prepara guiones, videos cortos, metadatos, miniaturas y publicación autorizada.',
    requiredIntegrationIds: ['int_gemini_ai', 'int_supabase_database'],
    optionalIntegrationIds: ['int_creative_ai', 'int_youtube'],
    executableTools: ['video.prepare_script', 'video.generate_asset', 'youtube.prepare_upload'],
    humanIntervention: 'Publicación real, reclamo de derechos, canal sin autorización o cuota agotada.',
  },
  {
    id: 'agent_billing',
    name: 'Agente IA Facturación e-CF',
    function: 'Prepara pagos, comprobantes, borradores e-CF, XML/PDF y cola fiscal auditada.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_payments', 'int_dgii_ecf', 'int_owner_notifications'],
    executableTools: ['payments.verify', 'ecf.prepare_xml', 'ecf.validate_required_fields', 'audit.record'],
    humanIntervention: 'Emisión fiscal, certificado faltante, secuencia no autorizada o rechazo DGII.',
  },
  {
    id: 'agent_accounting',
    name: 'Agente IA Contable',
    function: 'Prepara reportes contables, conciliaciones, inventario, recibos y estados financieros.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_payments', 'int_dgii_ecf'],
    executableTools: ['accounting.prepare_report', 'bank.reconcile', 'inventory.prepare_daily_report'],
    humanIntervention: 'Reporte definitivo, conciliación con diferencia, criterio fiscal o cierre contable.',
  },
  {
    id: 'agent_procurement_national',
    name: 'Agente IA Compras Nacionales',
    function: 'Gestiona requisiciones, cotizaciones locales, comparativos, órdenes e inventario.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_owner_notifications'],
    executableTools: ['procurement.create_request', 'procurement.evaluate_quotes', 'inventory.update'],
    humanIntervention: 'Aprobación de compra, contrato, pago o proveedor con riesgo.',
  },
  {
    id: 'agent_owner_ops',
    name: 'Agente IA Dueño',
    function: 'Filtra avances y notifica solo pagos, llamadas, bloqueos, campañas listas y decisiones.',
    requiredIntegrationIds: ['int_supabase_database'],
    optionalIntegrationIds: ['int_owner_notifications', 'int_whatsapp_cloud'],
    executableTools: ['owner.notify', 'audit.summarize', 'crm.escalate'],
    humanIntervention: 'Decisión estratégica, bloqueo crítico o acción que comprometa gasto externo.',
  },
];

const CONFIGURATION_EXTRA_ENV_VARS = [
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
  const response = await fetch(
    `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/env-vars/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    },
  );

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message?: unknown }).message)
        : `Render API HTTP ${response.status}`;

    throw new Error(message);
  }

  return body;
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

function buildIntegrationEnvironmentStatus() {
  return INTEGRATION_ENVIRONMENT_GROUPS.map((group) => {
    const configuredEnvVars = group.requiredEnvVars.filter((envVar) =>
      Boolean(process.env[envVar]),
    );
    const missingEnvVars = group.requiredEnvVars.filter((envVar) => !process.env[envVar]);

    return {
      ...group,
      configured: missingEnvVars.length === 0,
      configuredEnvVars,
      missingEnvVars,
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
      integration ? integration.missingEnvVars.map((envVar) => `${integration.name}:${envVar}`) : [],
    );
    const missingOptional = optionalIntegrations.flatMap((integration) =>
      integration ? integration.missingEnvVars.map((envVar) => `${integration.name}:${envVar}`) : [],
    );
    const status =
      missingRequired.length === 0
        ? missingOptional.length === 0
          ? 'operativo'
          : 'degradado'
        : 'bloqueado_por_credenciales';

    return {
      ...agent,
      status,
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

app.get('/api/knowledge/inteca/status', (_req, res) => {
  const knowledge = getIntecaAgentKnowledgeBase();
  res.json({
    success: true,
    sources: getIntecaKnowledgeSourcesStatus(),
    loadedCharacters: knowledge.length,
    maxCharacters: getAgentKnowledgeMaxChars(),
    canParaphrase: true,
    rule: 'Los agentes pueden parafrasear con fluidez, pero no pueden inventar ni alterar datos institucionales confirmados.',
  });
});

app.post('/api/auth/login', (req, res) => {
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
      result.lead.missingFields.length ||
        result.enrollment?.campusSyncStatus === 'pending_external_campus_api',
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

app.post('/api/webhooks/payments', (req, res) => {
  const rawStatus = String(
    req.body?.status ||
      req.body?.payment_status ||
      req.body?.event ||
      req.body?.type ||
      req.body?.data?.status ||
      '',
  ).toLowerCase();
  const paymentConfirmed =
    req.body?.paymentConfirmed === true ||
    ['completed', 'completado', 'paid', 'pagado', 'succeeded', 'approved', 'aprobado'].some(
      (status) => rawStatus.includes(status),
    );
  const rawAmount = req.body?.paymentAmount || req.body?.amount || req.body?.data?.amount;
  const paymentAmount = Number(rawAmount);
  const parsedLead = conversionLeadRequestSchema.safeParse({
    fullName:
      req.body?.leadName || req.body?.customerName || req.body?.customer?.name || req.body?.name,
    email: req.body?.email || req.body?.customer?.email,
    phone: req.body?.phone || req.body?.customer?.phone,
    whatsapp: req.body?.whatsapp || req.body?.customer?.whatsapp || req.body?.customer?.phone,
    courseId: req.body?.courseId || req.body?.metadata?.courseId,
    courseTitle: req.body?.courseTitle || req.body?.metadata?.courseTitle,
    source: req.body?.source || 'Payment Provider',
    campaign: req.body?.campaign || req.body?.metadata?.campaign,
    organizationId: req.body?.organizationId || req.body?.metadata?.organizationId,
    paymentConfirmed,
    paymentAmount: Number.isFinite(paymentAmount) ? paymentAmount : undefined,
    paymentTransactionId:
      req.body?.paymentTransactionId ||
      req.body?.transactionId ||
      req.body?.id ||
      req.body?.data?.id,
    message: JSON.stringify(req.body || {}),
  });
  const conversionResult = parsedLead.success
    ? processConversionLead(parsedLead.data, 'Payment Provider')
    : null;

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
  return res.status(200).json({
    success: true,
    payloadAccepted: Boolean(req.body),
    paymentConfirmed,
    conversionLead: conversionResult?.lead,
    enrollment: conversionResult?.enrollment,
    nextActions: conversionResult?.nextActions,
  });
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
4. currentEmotion ("Muy Entusiasta", "Interesado", "Neutral", "Indeciso", "Escéptico", "Urgente", "Molesto")
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
    const prompt = `
Eres especialista de marketing de ${organizationName || 'una organización comercial'}. Genera contenido publicitario sin inventar beneficios, certificaciones, precios ni promociones.

CONTEXTO DEL NEGOCIO: ${businessContext || 'No especificado'}

${buildAgentKnowledgePrompt('marketing, publicidad, propuestas de valor, flyers, anuncios, embudos y contenido persuasivo')}

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

${buildAgentKnowledgePrompt('briefs creativos, flyers, videos de 30 a 60 segundos, carruseles, reels, shorts y anuncios visuales')}

Reglas:
1. No inventes avales, precios, fechas ni garantías no indicadas.
2. La pieza debe crear deseo y necesidad de forma ética, con beneficio práctico y CTA fuerte.
3. Si es flyer, incluye escena visual, texto principal, CTA, elementos obligatorios y prompt de imagen en inglés.
4. Si es video, incluye guion por segundos, texto en pantalla, voz en off, escenas, portada y CTA.
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

${buildAgentKnowledgePrompt('facturacion electronica dominicana e-CF, datos institucionales, auditoria fiscal y documentos pendientes de revision')}

Reglas:
1. Incluye encabezado fiscal con emisor, receptor, RNC, dirección fiscal y fecha.
2. Incluye número e-CF pendiente de secuencia real si no fue suministrado.
3. Incluye detalle comercial: cantidad, descripción, precio unitario, descuentos y total.
4. Desglosa impuestos: gravado, exento, ITBIS, ISC, otros cargos y total.
5. Incluye campos de firma digital y QR como pendientes si no hay certificado conectado.
6. No afirmes envío a DGII sin credenciales reales.
7. Devuelve JSON estricto y auditable.
8. Puedes parafrasear notas y explicaciones para el cliente, pero no alterar montos, RNC, comprobantes, impuestos ni estados fiscales.
`;

    const response = await generateGeminiContentWithFallback(prompt, {
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
    const prompt = `
Eres Bruno Contable IA, agente contable autónomo para ${organizationName || 'la empresa'}.
Debes preparar un documento contable estructurado, auditable y listo para revisión.

TIPO DE REPORTE/DOCUMENTO: ${reportType}
PERIODO: ${period}
NOTAS: ${notes || 'Sin notas'}

DATOS FUENTE:
${JSON.stringify(sourceData, null, 2)}

${buildAgentKnowledgePrompt('contabilidad, reportes administrativos, ordenes de compra, recibos, conciliacion, inventario, KPIs y auditoria')}

Reglas:
1. Para Estado de resultados, resume ingresos, costos, gastos y utilidad.
2. Para Balance general, presenta activos, pasivos y patrimonio. Usa estructura compatible con NIF B-6.
3. Para Flujo de efectivo, separa entradas, salidas y flujo neto.
4. Para órdenes de compra, recibos, conciliaciones e inventarios, genera campos completos y estado.
5. Si aplica adquisición de negocios, menciona NIF B-7 y los puntos de valuación.
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
