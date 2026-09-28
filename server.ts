import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import cookieParser from 'cookie-parser';
import { authRouter } from './server/routes/auth';
import { crmRouter } from './server/routes/crm';
import { platformRouter } from './server/routes/platform';
import { authenticate, requirePermission } from './server/security';
import { operationsRouter } from './server/routes/operations';
import { prisma } from './server/db';
import { Prisma } from '@prisma/client';
import { config } from './server/config';

dotenv.config();

import { workspaceRouter } from './server/routes/workspace';
import { websiteRouter } from './server/routes/website';
import { paymentPortalRouter } from './server/routes/payment-portal';
import { channelsRouter } from './server/routes/channels';
import { startSocialWorker } from './server/social';
import { licenseGuard } from './server/licence';
const app = express();
const PORT = config.PORT;

app.disable('x-powered-by');
if (config.TRUST_PROXY) app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  express.json({
    limit: '8mb',
    verify(req, _res, buf) {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(cookieParser());
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 600,
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

const marketingRequestSchema = z.object({
  organizationName: z.string().max(150).optional(),
  businessContext: z.string().max(2_000).optional(),
  contentType: z.string().max(100).optional(),
  targetAudience: z.string().max(1_000).optional(),
  courseTitle: z.string().max(250).optional(),
  promotionOffer: z.string().max(500).optional(),
  tone: z.string().max(200).optional(),
});

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
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(config.GEMINI_API_KEY),
    databaseConfigured: Boolean(config.DATABASE_URL),
    mode: config.NODE_ENV,
    deploymentMode: config.DEPLOYMENT_MODE,
    publicUrl: config.APP_URL,
  });
});

app.get('/api/runtime', (_req, res) => {
  res.json({
    app: 'Sales AI CRM',
    version: '0.8.0-inteca',
    deploymentMode: config.DEPLOYMENT_MODE,
    publicUrl: config.APP_URL,
    secure: new URL(config.APP_URL).protocol === 'https:',
  });
});

app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ready = Boolean(await prisma.plan.findUnique({ where: { code: 'STARTER' } }));
    res.status(ready ? 200 : 503).json({ ready });
  } catch {
    res.status(503).json({ ready: false });
  }
});
app.use('/api/channels', channelsRouter);
app.use('/api/website', websiteRouter);
app.use('/api/pay', paymentPortalRouter);
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    origin &&
    origin !== new URL(config.APP_URL).origin
  ) {
    return res.status(403).json({ error: 'INVALID_ORIGIN' });
  }
  next();
});
app.use(
  '/api/auth',
  rateLimit({ windowMs: 900000, limit: 50, skip: (req) => req.method === 'GET' }),
);
app.use('/api/auth', authRouter);
app.use('/api/crm', crmRouter);
app.use('/api/operations', operationsRouter);
app.use('/api/platform', platformRouter);
app.use('/api/workspace', workspaceRouter);

// 1. AI Multi-Agent Sales & Negotiation Endpoint
app.post(
  '/api/ai/chat-agent',
  authenticate,
  licenseGuard,
  requirePermission('ai.use'),
  async (req, res) => {
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

ORGANIZACIÓN: ${organizationName || 'Organización de demostración'}
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
`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
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
  },
);

// 2. AI Predictive Lead Scoring & Profiling Endpoint
app.post(
  '/api/ai/qualify-lead',
  authenticate,
  licenseGuard,
  requirePermission('ai.use'),
  async (req, res) => {
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
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
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
  },
);

// 3. AI Marketing Generator (Emails, WhatsApp Blasts, Ad Copies, Landing Pages)
app.post(
  '/api/ai/generate-marketing',
  authenticate,
  licenseGuard,
  requirePermission('ai.use'),
  async (req, res) => {
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
      } = parsed.data;
      const ai = getGeminiClient();

      const prompt = `
Eres especialista de marketing de ${organizationName || 'una organización en modo demostración'}. Genera contenido publicitario sin inventar beneficios, certificaciones, precios ni promociones.

CONTEXTO DEL NEGOCIO: ${businessContext || 'No especificado'}

TIPO DE CONTENIDO: ${contentType || 'WhatsApp Campaign'}
PÚBLICO OBJETIVO: ${targetAudience || 'Profesionales interesados en IA'}
PRODUCTO O SERVICIO: ${courseTitle || 'No especificado'}
PROMOCIÓN / OFERTA AUTORIZADA: ${promotionOffer || 'Ninguna'}
TONO DE VOZ: ${tone || 'Persuasivo, Profesional y Urgente'}

Instrucciones:
Proporciona el resultado estructurado en JSON con los campos:
- title: Título o asunto de la campaña
- bodyText: Texto principal persuasivo con emojis adecuados, ganchos AIDA/PAS y llamada a la acción
- callToAction: Texto de botón o respuesta rápida
- suggestedImagePrompt: Un prompt descriptivo en inglés para generar una imagen/banner publicitario impactante.
`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
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
  },
);

app.get('/api/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.1.0',
    info: { title: 'Sales AI CRM API', version: '0.8.0' },
    servers: [{ url: '/api' }],
    paths: {
      '/health': { get: { summary: 'Estado del servicio' } },
      '/auth/register': { post: { summary: 'Crear organización y propietario' } },
      '/auth/login': { post: { summary: 'Iniciar sesión' } },
      '/crm/contacts': {
        get: { summary: 'Listar contactos' },
        post: { summary: 'Crear contacto' },
      },
      '/crm/products': {
        get: { summary: 'Listar productos y servicios' },
        post: { summary: 'Crear producto o servicio' },
      },
      '/crm/deals': {
        get: { summary: 'Listar oportunidades' },
        post: { summary: 'Crear oportunidad' },
      },
      '/platform/integrations': { get: { summary: 'Estado de integraciones' } },
      '/platform/payments/sandbox': {
        post: { summary: 'Crear solicitud de pago sin procesar dinero' },
      },
      '/platform/campaigns': {
        get: { summary: 'Listar campañas' },
        post: { summary: 'Crear campaña en borrador' },
      },
      '/platform/documents/upload-request': {
        post: { summary: 'Solicitar carga segura; requiere almacenamiento configurado' },
      },
    },
  });
});

app.use('/api', (_req, res) =>
  res.status(404).json({ success: false, error: 'API_ROUTE_NOT_FOUND' }),
);

app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({ error: 'INVALID_REQUEST', details: error.flatten() });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'DUPLICATE_RECORD' });
      if (error.code === 'P2025') return res.status(404).json({ error: 'RECORD_NOT_FOUND' });
    }
    console.error(
      'Unhandled server error',
      error instanceof Error
        ? config.NODE_ENV === 'test'
          ? error.message
          : error.name
        : 'Unknown',
    );
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  },
);

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
    app.get('/sales-widget.html', (req, res) => {
      const origins = (process.env.WIDGET_ALLOWED_ORIGINS || '')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => /^https:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?$/.test(v));
      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self' " + origins.join(' '));
      res.sendFile(path.join(distPath, 'sales-widget.html'));
    });
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  startSocialWorker();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sales AI CRM listening on http://0.0.0.0:${PORT}`);
  });
}

if (config.NODE_ENV !== 'test') {
  startServer();
}

export { app };
