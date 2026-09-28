import {
  Lead,
  Course,
  AIAgentSpec,
  MarketingCampaign,
  PaymentTransaction,
  OrganizationTenant,
  UserProfile,
  FunnelStageConfig
} from '../types';

export const INITIAL_ORGANIZATIONS: OrganizationTenant[] = [
  {
    id: 'org_inteca_main',
    name: 'INTECA Campus Principal',
    slug: 'inteca-main',
    logo: '🎓',
    plan: 'Enterprise Autonomous AI',
    activeUsers: 24,
    activeLeadsCount: 12480,
    whatsappStatus: 'Conectado QR'
  },
  {
    id: 'org_inteca_tech',
    name: 'INTECA Tech & AI Institute',
    slug: 'inteca-tech',
    logo: '⚡',
    plan: 'Enterprise Autonomous AI',
    activeUsers: 12,
    activeLeadsCount: 6350,
    whatsappStatus: 'Conectado QR'
  },
  {
    id: 'org_inteca_exec',
    name: 'INTECA Executive Education',
    slug: 'inteca-exec',
    logo: '💼',
    plan: 'Enterprise Autonomous AI',
    activeUsers: 8,
    activeLeadsCount: 3100,
    whatsappStatus: 'Conectado QR'
  }
];

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr_admin',
    name: 'Director Luis Ramírez',
    email: 'luis.ramirez@inteca.edu',
    role: 'Admin',
    organizationId: 'org_inteca_main',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_sales_lead',
    name: 'Valeria Mendoza',
    email: 'valeria.mendoza@inteca.edu',
    role: 'Supervisor',
    organizationId: 'org_inteca_main',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
  }
];

export const FUNNEL_STAGES: FunnelStageConfig[] = [
  { id: 'nuevo', name: 'Lead Nuevo', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', order: 1, autoActionPrompt: 'Enviar WhatsApp de bienvenida con brochure en PDF y video demostrativo del curso.' },
  { id: 'interesado', name: 'Interesado Activo', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', order: 2, autoActionPrompt: 'Agente Closer inicia diálogo para detectar objeciones y enviar temario detallado.' },
  { id: 'contactado', name: 'Contactado IA', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', order: 3, autoActionPrompt: 'Hacer llamada o audio en WhatsApp con IA explicando bonos especiales de la semana.' },
  { id: 'calificado', name: 'Calificado Alto ROI', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', order: 4, autoActionPrompt: 'Ofrecer beca o descuento personalizado por tiempo limitado de 24 hrs.' },
  { id: 'presentacion', name: 'Presentación / Demo', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', order: 5, autoActionPrompt: 'Enviar invitación a clase magistral o grabación exclusiva con testimonio en video.' },
  { id: 'negociacion', name: 'En Negociación', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', order: 6, autoActionPrompt: 'Negociar facilidades de pago en cuotas y aplicar cupón exclusivo.' },
  { id: 'oferta', name: 'Oferta Especial Emitida', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', order: 7, autoActionPrompt: 'Contador de urgencia activo. Enviar recordatorio vía SMS y WhatsApp.' },
  { id: 'pago_pendiente', name: 'Pago Pendiente', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', order: 8, autoActionPrompt: 'Enviar link de pago rápido multi-pasarela y asistente de checkout.' },
  { id: 'venta_realizada', name: 'Venta Cerrada (Pago OK)', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', order: 9, autoActionPrompt: 'Emitir factura, generar acceso automático a plataforma de estudio y bienvenida.' },
  { id: 'cliente', name: 'Estudiante Activo', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', order: 10, autoActionPrompt: 'Seguimiento pedagógico y encuestas de satisfacción.' },
  { id: 'recompra', name: 'Recompra / Upsell', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', order: 11, autoActionPrompt: 'Recomendar especialización avanzada o diplomado con 40% OFF por exalumno.' },
  { id: 'referido', name: 'Programa de Referidos', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30', order: 12, autoActionPrompt: 'Ofrecer comisiones o comisión en efectivo por enrolar a colegas.' }
];

export const INTECA_COURSES: Course[] = [
  {
    id: 'crs_ai_biz',
    title: 'Diplomado Internacional en IA Aplicada a Negocios y Ventas',
    code: 'INT-AI-901',
    category: 'Inteligencia Artificial',
    price: 499,
    discountPrice: 299,
    description: 'Aprende a implementar agentes autónomos de IA, automatización con LLMs, prompt engineering avanzado y CRM predictivo para multiplicar las ventas de tu institución o empresa.',
    durationHours: 120,
    schedule: 'Martes y Jueves 19:00 - 21:30 GMT-5 (Clases en Vivo + Grabado HD)',
    instructors: ['Dr. Carlos Alarcón (Ex-Google Lead AI)', 'Mg. Sofía Barrientos (Especialista CRM Growth)'],
    modulesCount: 6,
    modulesList: [
      { title: 'Módulo 1: Fundamentos de Arquitectura de LLMs y Agentes', topics: ['Prompts Avanzados', 'RAG con bases vectoriales', 'Agentes Multi-Rol'] },
      { title: 'Módulo 2: Automatización de Embudos de Venta con IA', topics: ['WhatsApp API con Inteligencia Artificial', 'Workflows en tiempo real', 'Scoring de leads'] },
      { title: 'Módulo 3: Creación de Contenido Marketing en Masa', topics: ['Copywriting con Gemini', 'Generación de Creativos e Imágenes', 'Video AI Studio'] },
      { title: 'Módulo 4: Integración con Pasarelas de Pago y ERP', topics: ['Stripe, PayPal y Webhooks', 'Facturación automática', 'Enrolamiento sin fricción'] },
      { title: 'Módulo 5: Analytics Predictivo y Machine Learning', topics: ['Predicción de churn', 'LTV y CAC automático', 'Dashboards ejecutivos'] },
      { title: 'Módulo 6: Proyecto Final Integrador INTECA', topics: ['Despliegue de un CRM Autónomo en vivo', 'Auditoría y Certificación'] }
    ],
    materialsIncluded: ['Acceso ilimitado por 2 años a campus virtual', 'Plantillas de prompts de ventas probadas', 'Scripts de integración de WhatsApp y CRM', 'Tutoría personalizada con IA 24/7'],
    bonusesIncluded: ['Bono 1: Masterclass de Meta Ads + Google Ads con IA ($150 value)', 'Bono 2: Certificación Internacional Digital Verificable en Blockchain ($100 value)'],
    certificationType: 'Diplomado Internacional',
    videoPreviewUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    brochurePdfUrl: 'https://inteca.edu/brochures/diplomado-ia-negocios.pdf',
    activePromotions: ['Beca Especial 40% OFF por Inscripción Pronta', 'Cupón INTECA2026'],
    enrolledStudents: 1420,
    status: 'Cupos Limitados'
  },
  {
    id: 'crs_mkt_automation',
    title: 'Máster Executive en Marketing Digital, Funnels & Growth Automation',
    code: 'INT-MKT-802',
    category: 'Marketing & Ventas',
    price: 650,
    discountPrice: 380,
    description: 'Domina la estrategia completa de atracción omnicanal, campañas de Meta & TikTok Ads optimizadas por IA, email marketing relacional y sistemas de prospección automatizada.',
    durationHours: 160,
    schedule: 'Lunes y Miércoles 20:00 - 22:00 GMT-5',
    instructors: ['Ing. Andrés Montenegro (Growth Hacker Senior)', 'Dra. Elena Ruiz (Especialista en Neuromarketing)'],
    modulesCount: 8,
    modulesList: [
      { title: 'Módulo 1: Neuromarketing y Psicología del Consumidor', topics: ['Sesgos cognitivos de compra', 'Ganchos emocionales', 'Storytelling persuasivo'] },
      { title: 'Módulo 2: Meta Ads y TikTok Ads de Alto Impacto', topics: ['Audiencias personalizadas', 'CBO & ABO inteligente', 'Creativos virales'] },
      { title: 'Módulo 3: Email Marketing y SMS Sequences', topics: ['Entregabilidad superior al 98%', 'Copywriting de alta conversión', 'Flujos relacionales'] }
    ],
    materialsIncluded: ['Pack de 500 Landing Pages de alta conversión', 'Calculadora de ROI y Presupuesto publicitario'],
    bonusesIncluded: ['Bono: Guía de Cierre por WhatsApp de alta presión suave ($120 value)'],
    certificationType: 'Máster Executive',
    enrolledStudents: 2150,
    status: 'Disponible'
  },
  {
    id: 'crs_fullstack_ai',
    title: 'Especialización Avanzada en Desarrollo Web Full Stack & AI Applications',
    code: 'INT-DEV-703',
    category: 'Programación',
    price: 599,
    discountPrice: 349,
    description: 'Construye aplicaciones web modernas con React, Next.js, Node.js, Express, Python FastAPI e integra modelos Gemini para crear software SaaS de nivel empresarial.',
    durationHours: 180,
    schedule: 'Sábados 09:00 - 14:00 GMT-5',
    instructors: ['Mg. Roberto Silva (Staff Software Engineer)', 'Ing. Karen Morales (Full Stack AI Specialist)'],
    modulesCount: 7,
    modulesList: [
      { title: 'Módulo 1: TypeScript y Arquitectura Limpia', topics: ['SOLID', 'DDD', 'Clean Architecture'] },
      { title: 'Módulo 2: Frontend Moderno con React y Vite', topics: ['State Management', 'Tailwind CSS', 'Framer Motion'] },
      { title: 'Módulo 3: Backend con Node.js, Express y Python FastAPI', topics: ['REST, WebSockets, OAuth', 'PostgreSQL y Redis'] }
    ],
    materialsIncluded: ['Repositorio privado de proyectos con código fuente', 'Entorno en la nube para prácticas'],
    bonusesIncluded: ['Bono: Asesoría de Empleabilidad e Inserción Laboral Remota ($200 value)'],
    certificationType: 'Certificación Oficial INTECA',
    enrolledStudents: 980,
    status: 'Próximo Inicio'
  },
  {
    id: 'crs_b2b_sales',
    title: 'Programa de Alto Rendimiento en Gestión de Ventas B2B & Consultivas',
    code: 'INT-SLS-604',
    category: 'Marketing & Ventas',
    price: 420,
    discountPrice: 250,
    description: 'Metodología SPIN Selling, negociación Harvard, prospección ejecutiva en LinkedIn Sales Navigator y manejo proactivo de objeciones financieras.',
    durationHours: 90,
    schedule: 'Viernes 18:30 - 21:30 GMT-5',
    instructors: ['Lic. Gabriel Paredes (Ex-Director de Ventas Salesforce Latam)'],
    modulesCount: 5,
    modulesList: [
      { title: 'Módulo 1: Prospectación Consultiva B2B', topics: ['Identificación de Decision Makers', 'Outreach efectivo'] },
      { title: 'Módulo 2: Cierre de Contratos Corporativos', topics: ['Negociación Harvard', 'Licitaciones y Propuestas'] }
    ],
    materialsIncluded: ['Manual de Objeciones B2B', 'Modelos de contratos corporativos editable'],
    bonusesIncluded: ['Bono: Plantilla de Propuesta Comercial Ganadora'],
    certificationType: 'Certificación Oficial INTECA',
    enrolledStudents: 810,
    status: 'Disponible'
  }
];

export const MULTI_AGENTS_SPEC: AIAgentSpec[] = [
  {
    id: 'agent_director',
    name: 'Don Fernando Vane',
    roleTitle: 'Director Comercial & Estratega AI',
    specialty: 'Estrategia',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    description: 'Supervisa el flujo comercial general, analiza probabilidades de cierre, sugiere descuentos autorizados y gestiona el cumplimiento de metas.',
    systemPrompt: `Eres Don Fernando Vane, el experimentado Director Comercial de INTECA. Tu tono es sumamente profesional, seguro, empático y orientado a resultados. Evalúas la intención de compra del estudiante, respondes dudas estratégicas sobre los programas de INTECA y buscas el beneficio académico del alumno garantizando el cierre de la venta.`,
    status: 'Activo',
    stats: {
      conversationsHandled: 4120,
      dealsClosed: 890,
      avgSatisfaction: 4.9,
      conversionRatePercent: 34.2
    }
  },
  {
    id: 'agent_closer',
    name: 'Valeria Sotomayor',
    roleTitle: 'Closer de Ventas Elite',
    specialty: 'Cierre',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    description: 'Experta en negociación rápida, manejo impecable de objeciones de precio o tiempo, creación de urgencia y envío inmediato de links de pago.',
    systemPrompt: `Eres Valeria Sotomayor, la mejor Closer de Ventas de INTECA. Eres muy amigable, directa, entusiasta y persuades de manera ética mostrando el retorno de inversión del curso. Resuelves cualquier miedo u objeción en 1 o 2 respuestas y guías al cliente paso a paso a concretar el pago de su inscripción hoy mismo.`,
    status: 'Activo',
    stats: {
      conversationsHandled: 8250,
      dealsClosed: 2310,
      avgSatisfaction: 4.95,
      conversionRatePercent: 41.8
    }
  },
  {
    id: 'agent_whatsapp',
    name: 'Mateo WhatsApp Pro',
    roleTitle: 'Especialista WhatsApp Instantáneo',
    specialty: 'WhatsApp',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    description: 'Agente ultrarrápido para atención en WhatsApp. Responde con audios generados, PDF brochures, mensajes directos con viñetas claras yemojis adecuados.',
    systemPrompt: `Eres Mateo, el especialista en respuestas rápidas por WhatsApp de INTECA. Utilizas un lenguaje dinámico, cálido, latinoamericano profesional, con respuestas concisas y llamadas a la acción directas para matricularse.`,
    status: 'Activo',
    stats: {
      conversationsHandled: 15400,
      dealsClosed: 3420,
      avgSatisfaction: 4.88,
      conversionRatePercent: 38.5
    }
  },
  {
    id: 'agent_copywriter',
    name: 'Camila Growth Copy',
    roleTitle: 'Gerente de Marketing & Copywriter',
    specialty: 'Copywriting',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    description: 'Diseña secuencias de correo irresistibles, copys persuasivos para anuncios en Facebook/TikTok/Google, mensajes de ofertas relámpago y landing pages.',
    systemPrompt: `Eres Camila, la estratega senior de Copywriting y Marketing de INTECA. Creas textos de altísima conversión utilizando fórmulas AIDA, PAS y ganchos de alta retención.`,
    status: 'Activo',
    stats: {
      conversationsHandled: 3200,
      dealsClosed: 740,
      avgSatisfaction: 4.92,
      conversionRatePercent: 32.0
    }
  },
  {
    id: 'agent_recovery',
    name: 'Rodrigo WinBack',
    roleTitle: 'Recuperador de Leads Perdidos',
    specialty: 'Recuperación',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    description: 'Especializado en recontactar leads fríos o carritos abandonados con promociones exclusivas de último minuto y facilidades en cuotas.',
    systemPrompt: `Eres Rodrigo, el especialista en reactivación de contactos de INTECA. Detectas el motivo por el cual el alumno no completó su pago y le propones una solución personalizada con empatía y un bono irresistible.`,
    status: 'Activo',
    stats: {
      conversationsHandled: 5800,
      dealsClosed: 1120,
      avgSatisfaction: 4.85,
      conversionRatePercent: 28.4
    }
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead_101',
    firstName: 'Alejandro',
    lastName: 'Gómez Santander',
    age: 32,
    gender: 'Masculino',
    country: 'México',
    province: 'Ciudad de México',
    city: 'CDMX',
    address: 'Av. Insurgentes Sur 1420',
    email: 'alejandro.gomez@techcorp.mx',
    phone: '+52 55 4192 8821',
    whatsapp: '+525541928821',
    telegram: '@alegomez_mx',
    facebook: 'facebook.com/ale.gomez.santander',
    instagram: '@alegomez_tech',
    linkedin: 'linkedin.com/in/alejandro-gomez-santander',
    company: 'TechCorp México',
    roleTitle: 'Gerente de Innovación Comercial',
    interests: ['Inteligencia Artificial', 'CRM', 'Automatización de Ventas'],
    courseOfInterestId: 'crs_ai_biz',
    
    funnelId: 'fn_default',
    stageId: 'negociacion',
    status: 'Activo',
    buyProbability: 88,
    estimatedValue: 299,
    source: 'Meta Ads',
    scoreAI: 92,
    
    personalityAnalysis: {
      discType: 'Dominante',
      decisionSpeed: 'Rápida',
      dominantPainPoint: 'Necesita automatizar el flujo de ventas de su equipo de 12 vendedores que están saturados.',
      buyingMotivation: 'Optimizar tiempos y multiplicar la conversión de leads sin contratar más personal.',
      objectionsHistory: ['Duda sobre la integración con su pasarela local', 'Aclarado: Integración nativa habilitada.']
    },
    currentEmotion: 'Muy Entusiasta',
    
    lastInteraction: '2026-07-29T18:45:00-07:00',
    nextFollowUp: '2026-07-30T10:00:00-07:00',
    responseTimeMinutes: 3,
    deviceUsed: 'iPhone 15 Pro Max (iOS 18)',
    browserUsed: 'Safari Mobile 18.2',
    ipLocation: 'CDMX, México (IP 187.210.45.12)',
    assignedAgentId: 'agent_closer',
    organizationId: 'org_inteca_main',
    tags: ['Alta Prioridad', 'Meta Ads Campaign Q3', 'Paga hoy', 'Decisor'],
    
    conversationHistory: [
      {
        id: 'msg_1',
        sender: 'lead',
        channel: 'WhatsApp',
        messageType: 'text',
        content: 'Hola INTECA! Vi su anuncio sobre el Diplomado en IA Aplicada a Negocios. ¿Aún tienen disponible la beca del 40%?',
        timestamp: '2026-07-29T18:30:00-07:00',
        sentiment: 'Positivo',
        aiIntent: 'Consulta de precio y promoción'
      },
      {
        id: 'msg_2',
        sender: 'ai_agent',
        agentName: 'Valeria Sotomayor (Closer IA)',
        channel: 'WhatsApp',
        messageType: 'text',
        content: '¡Hola Alejandro! Qué gusto saludarte. Sí, justamente nos quedan las últimas 3 becas del 40% OFF para el grupo que inicia este martes. El precio regular es de $499 USD, pero con tu beca especial queda en solo $299 USD (o 3 cuotas sin intereses de $99 USD). ¿Te gustaría reservar tu vacante de inmediato con todos los bonos incluidos?',
        timestamp: '2026-07-29T18:31:00-07:00',
        sentiment: 'Positivo',
        aiIntent: 'Presentación de oferta y cierre'
      },
      {
        id: 'msg_3',
        sender: 'lead',
        channel: 'WhatsApp',
        messageType: 'text',
        content: 'Suena excelente Valeria. ¿Aceptan tarjeta de crédito o PayPal? Me interesa pagar hoy para asegurar el cupo.',
        timestamp: '2026-07-29T18:35:00-07:00',
        sentiment: 'Positivo',
        aiIntent: 'Intención clara de compra'
      },
      {
        id: 'msg_4',
        sender: 'ai_agent',
        agentName: 'Valeria Sotomayor (Closer IA)',
        channel: 'WhatsApp',
        messageType: 'payment_link',
        content: '¡Perfecto Alejandro! Aceptamos Stripe (Tarjetas Visa/Mastercard/Amex), PayPal, Google Pay y Apple Pay. Aquí tienes tu enlace de inscripción segura con el cupón aplicado: https://inteca.edu/pay/checkout?ref=ALEGOMEZ_AI2026. Al pagar, el sistema te emitirá automáticamente tu factura e instructivo de ingreso al campus virtual. ¿Deseas que te acompañe en la pantalla?',
        timestamp: '2026-07-29T18:36:00-07:00',
        sentiment: 'Positivo',
        aiIntent: 'Envío de pasarela de pago'
      }
    ],
    documents: [
      {
        id: 'doc_1',
        title: 'Folleto_Diplomado_IA_INTECA.pdf',
        type: 'PDF Cursos',
        url: 'https://inteca.edu/docs/brochure_ia.pdf',
        fileSize: '3.4 MB',
        uploadedAt: '2026-07-29T18:32:00-07:00'
      }
    ],
    createdAt: '2026-07-29T18:30:00-07:00',
    updatedAt: '2026-07-29T18:45:00-07:00'
  },
  {
    id: 'lead_102',
    firstName: 'María Fernanda',
    lastName: 'Ríos Benítez',
    age: 28,
    gender: 'Femenino',
    country: 'Colombia',
    province: 'Antioquia',
    city: 'Medellín',
    address: 'Calle 10 # 43D-21 El Poblado',
    email: 'mafe.rios@growthdigital.co',
    phone: '+57 312 884 9012',
    whatsapp: '+573128849012',
    telegram: '@maferios_mkt',
    instagram: '@mafe_growth',
    company: 'GrowthDigital Colombia',
    roleTitle: 'Especialista en Marketing Digital',
    interests: ['Growth Hacking', 'Meta Ads', 'Funnel Automation'],
    courseOfInterestId: 'crs_mkt_automation',
    
    funnelId: 'fn_default',
    stageId: 'pago_pendiente',
    status: 'Activo',
    buyProbability: 95,
    estimatedValue: 380,
    source: 'Google Ads',
    scoreAI: 96,
    
    personalityAnalysis: {
      discType: 'Influyente',
      decisionSpeed: 'Rápida',
      dominantPainPoint: 'Busca certificación internacional para ascender a Directora de Marketing.',
      buyingMotivation: 'Reconocimiento laboral e implementación inmediata en clientes de su agencia.',
      objectionsHistory: []
    },
    currentEmotion: 'Urgente',
    
    lastInteraction: '2026-07-29T17:10:00-07:00',
    nextFollowUp: '2026-07-29T21:00:00-07:00',
    responseTimeMinutes: 2,
    deviceUsed: 'MacBook Pro M3 (macOS Sequoia)',
    browserUsed: 'Chrome 134.0',
    ipLocation: 'Medellín, Colombia',
    assignedAgentId: 'agent_director',
    organizationId: 'org_inteca_main',
    tags: ['Google Ads Search', 'Checkout Iniciado', 'Pago en Proceso'],
    
    conversationHistory: [
      {
        id: 'msg_201',
        sender: 'lead',
        channel: 'WebChat',
        messageType: 'text',
        content: 'Buenas tardes! Estoy en el checkout del Máster Executive en Marketing Digital. ¿Ofrecen certificado oficial respaldado?',
        timestamp: '2026-07-29T17:00:00-07:00',
        sentiment: 'Positivo',
        aiIntent: 'Verificación de acreditación'
      },
      {
        id: 'msg_202',
        sender: 'ai_agent',
        agentName: 'Don Fernando Vane (Director IA)',
        channel: 'WebChat',
        messageType: 'text',
        content: '¡Buenas tardes María Fernanda! Absolutamente. Al completar el Máster recibes la Certificación Executive respaldada por INTECA con código QR institucional verificable en blockchain y valor curricular internacional. Además, tendrás acceso a la bolsa de trabajo exclusiva.',
        timestamp: '2026-07-29T17:02:00-07:00',
        sentiment: 'Positivo',
        aiIntent: 'Confirmación institucional y respaldo'
      }
    ],
    documents: [],
    createdAt: '2026-07-29T16:50:00-07:00',
    updatedAt: '2026-07-29T17:10:00-07:00'
  },
  {
    id: 'lead_103',
    firstName: 'Carlos Eduardo',
    lastName: 'Vargas Silva',
    age: 41,
    gender: 'Masculino',
    country: 'Chile',
    province: 'Santiago',
    city: 'Santiago',
    email: 'carlos.vargas@inversioneschile.cl',
    phone: '+56 9 7712 3490',
    whatsapp: '+56977123490',
    linkedin: 'linkedin.com/in/carlos-vargas-santiago',
    company: 'Inversiones & Consultoría Sur',
    roleTitle: 'Socio Fundador',
    interests: ['Ventas B2B', 'Negociación Harvard', 'Licitaciones'],
    courseOfInterestId: 'crs_b2b_sales',
    
    funnelId: 'fn_default',
    stageId: 'interesado',
    status: 'Activo',
    buyProbability: 65,
    estimatedValue: 250,
    source: 'LinkedIn',
    scoreAI: 74,
    
    personalityAnalysis: {
      discType: 'Concienzudo',
      decisionSpeed: 'Analítica',
      dominantPainPoint: 'Desea metodologías rigurosas para cerrar cuentas corporativas en el sector financiero.',
      buyingMotivation: 'Estructura y procesos formales para su equipo de ejecutivos B2B.',
      objectionsHistory: ['Requiere ver el temario módulo por módulo en detalle']
    },
    currentEmotion: 'Indeciso',
    
    lastInteraction: '2026-07-29T15:20:00-07:00',
    nextFollowUp: '2026-07-30T11:00:00-07:00',
    responseTimeMinutes: 15,
    deviceUsed: 'Windows 11 Desktop',
    browserUsed: 'Microsoft Edge 132',
    ipLocation: 'Santiago, Chile',
    assignedAgentId: 'agent_director',
    organizationId: 'org_inteca_exec',
    tags: ['B2B Corporate', 'LinkedIn Outreach', 'Socio Director'],
    
    conversationHistory: [],
    documents: [],
    createdAt: '2026-07-29T15:00:00-07:00',
    updatedAt: '2026-07-29T15:20:00-07:00'
  },
  {
    id: 'lead_104',
    firstName: 'Lucía',
    lastName: 'Mendoza Paredes',
    age: 25,
    gender: 'Femenino',
    country: 'Perú',
    province: 'Lima',
    city: 'Lima',
    email: 'lucia.mendoza@gmail.com',
    phone: '+51 984 123 765',
    whatsapp: '+51984123765',
    company: 'Freelance Frontend',
    roleTitle: 'Desarrolladora Web Jr.',
    interests: ['Full Stack AI', 'React 19', 'FastAPI', 'Gemini AI'],
    courseOfInterestId: 'crs_fullstack_ai',
    
    funnelId: 'fn_default',
    stageId: 'venta_realizada',
    status: 'Ganado',
    buyProbability: 100,
    estimatedValue: 349,
    source: 'TikTok',
    scoreAI: 99,
    
    personalityAnalysis: {
      discType: 'Estable',
      decisionSpeed: 'Rápida',
      dominantPainPoint: 'Deseaba dar el salto a desarrolladora Full Stack Senior orientada a IA.',
      buyingMotivation: 'Crear su propia agencia de aplicaciones web con inteligencia artificial.',
      objectionsHistory: []
    },
    currentEmotion: 'Muy Entusiasta',
    
    lastInteraction: '2026-07-29T14:00:00-07:00',
    responseTimeMinutes: 1,
    deviceUsed: 'MacBook Air M2',
    browserUsed: 'Chrome 134.0',
    ipLocation: 'Lima, Perú',
    assignedAgentId: 'agent_closer',
    organizationId: 'org_inteca_tech',
    tags: ['Matriculada', 'Pago Confirmado', 'Estudiante Activa'],
    
    conversationHistory: [],
    documents: [
      {
        id: 'doc_201',
        title: 'Recibo_Inscripcion_INTECA_LUCIA.pdf',
        type: 'Comprobante',
        url: 'https://inteca.edu/invoices/INV-2026-0891.pdf',
        fileSize: '1.2 MB',
        uploadedAt: '2026-07-29T14:05:00-07:00'
      }
    ],
    createdAt: '2026-07-29T13:30:00-07:00',
    updatedAt: '2026-07-29T14:05:00-07:00'
  }
];

export const INITIAL_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 'cmp_101',
    title: '🚀 Promoción Beca 40% OFF Diplomado IA Negocios (WhatsApp Blast)',
    channel: 'WhatsApp',
    status: 'En Ejecución',
    targetSegment: 'Leads fríos interesados en Inteligencia Artificial (últimos 30 días)',
    sentCount: 3420,
    openRatePercent: 94.2,
    clickRatePercent: 42.8,
    conversionsCount: 184,
    revenueGenerated: 55016,
    generatedByAI: true,
    contentSnippet: '¡Hola {{nombre}}! 🎓 Solo por hoy activamos la Beca Exclusiva del 40% OFF para el Diplomado Internacional en IA Aplicada a Negocios de INTECA...',
    createdAt: '2026-07-28T10:00:00-07:00'
  },
  {
    id: 'cmp_102',
    title: '✉️ Secuencia Email Funnel Relacional: Cómo multiplicar tus ventas con IA',
    channel: 'Email',
    status: 'Programada',
    targetSegment: 'Suscritos a Webinars y Landing Pages INTECA',
    sentCount: 12500,
    openRatePercent: 38.5,
    clickRatePercent: 18.2,
    conversionsCount: 92,
    revenueGenerated: 27508,
    generatedByAI: true,
    contentSnippet: 'Asunto: [Casos Reales] Cómo automatizar el 90% de la gestión de clientes en tu institución...',
    createdAt: '2026-07-29T08:00:00-07:00'
  }
];

export const INITIAL_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: 'tx_8801',
    leadId: 'lead_104',
    leadName: 'Lucía Mendoza Paredes',
    courseTitle: 'Especialización Avanzada en Desarrollo Web Full Stack & AI',
    amount: 349,
    currency: 'USD',
    gateway: 'Stripe',
    status: 'Completado',
    transactionRef: 'ch_3M009x9120aXXLK',
    invoiceNumber: 'INV-2026-0891',
    invoiceUrl: 'https://inteca.edu/invoices/INV-2026-0891.pdf',
    courseActivationCode: 'ACT-DEV-9012-LUCIA',
    createdAt: '2026-07-29T14:05:00-07:00'
  },
  {
    id: 'tx_8802',
    leadId: 'lead_999',
    leadName: 'Guillermo Restrepo',
    courseTitle: 'Diplomado Internacional en IA Aplicada a Negocios y Ventas',
    amount: 299,
    currency: 'USD',
    gateway: 'PayPal',
    status: 'Completado',
    transactionRef: 'PAYPAL-9812-3321',
    invoiceNumber: 'INV-2026-0890',
    invoiceUrl: 'https://inteca.edu/invoices/INV-2026-0890.pdf',
    courseActivationCode: 'ACT-AI-4410-GUILLERMO',
    createdAt: '2026-07-29T11:20:00-07:00'
  }
];
