export type PlatformMode = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';

export type UserRole = 
  | 'Admin'
  | 'Supervisor'
  | 'Ventas'
  | 'Marketing'
  | 'Call Center'
  | 'Docentes'
  | 'Caja'
  | 'Contabilidad'
  | 'Soporte';

export type LeadSource =
  | 'Facebook'
  | 'Instagram'
  | 'WhatsApp'
  | 'TikTok'
  | 'Messenger'
  | 'Telegram'
  | 'Landing Page'
  | 'Web INTECA'
  | 'Google Ads'
  | 'Meta Ads'
  | 'LinkedIn'
  | 'YouTube'
  | 'Email'
  | 'Formulario'
  | 'Código QR'
  | 'Eventos'
  | 'Webinars'
  | 'Referidos'
  | 'API'
  | 'Importación CSV';

export type FunnelStageId = 
  | 'nuevo'
  | 'interesado'
  | 'contactado'
  | 'calificado'
  | 'presentacion'
  | 'negociacion'
  | 'oferta'
  | 'pago_pendiente'
  | 'venta_realizada'
  | 'cliente'
  | 'recompra'
  | 'referido';

export type EmotionState = 'Muy Entusiasta' | 'Interesado' | 'Neutral' | 'Indeciso' | 'Escéptico' | 'Urgente' | 'Molesto';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  age?: number;
  gender?: 'Masculino' | 'Femenino' | 'Otro';
  country: string;
  province?: string;
  city?: string;
  address?: string;
  email: string;
  phone: string;
  whatsapp: string;
  telegram?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  company?: string;
  roleTitle?: string;
  interests: string[];
  courseOfInterestId: string;
  
  // Status & Funnel
  funnelId: string;
  stageId: FunnelStageId;
  status: 'Activo' | 'Ganado' | 'Perdido' | 'En Pausa' | 'Recuperación';
  buyProbability: number; // 0 - 100%
  estimatedValue: number;
  source: LeadSource;
  scoreAI: number; // 0 - 100
  
  // AI Profiling
  personalityAnalysis?: {
    discType: 'Dominante' | 'Influyente' | 'Estable' | 'Concienzudo';
    decisionSpeed: 'Rápida' | 'Analítica' | 'Basada en Precio' | 'Lenta';
    dominantPainPoint: string;
    buyingMotivation: string;
    objectionsHistory: string[];
  };
  currentEmotion: EmotionState;
  
  // Tracking & Tech
  lastInteraction: string;
  nextFollowUp?: string;
  responseTimeMinutes?: number;
  deviceUsed?: string;
  browserUsed?: string;
  ipLocation?: string;
  assignedAgentId: string;
  organizationId: string;
  tags: string[];
  
  // Conversation & Docs
  conversationHistory: ConversationMessage[];
  documents: LeadDocument[];
  
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  sender: 'lead' | 'ai_agent' | 'human_user';
  agentName?: string;
  channel: 'WhatsApp' | 'WebChat' | 'Email' | 'Instagram' | 'Messenger' | 'Telegram' | 'SMS' | 'CallNote';
  messageType: 'text' | 'audio' | 'image' | 'pdf' | 'payment_link' | 'video';
  content: string;
  mediaUrl?: string;
  timestamp: string;
  sentiment?: 'Positivo' | 'Neutral' | 'Negativo';
  aiIntent?: string;
}

export interface LeadDocument {
  id: string;
  title: string;
  type: 'Contrato' | 'Comprobante' | 'PDF Cursos' | 'Grabación' | 'Audio' | 'Certificado' | 'Identificación';
  url: string;
  fileSize: string;
  uploadedAt: string;
}

export interface Course {
  id: string;
  title: string;
  code: string;
  category: 'Inteligencia Artificial' | 'Marketing & Ventas' | 'Programación' | 'Gestión Empresarial' | 'Diseño & UX';
  price: number;
  discountPrice?: number;
  description: string;
  durationHours: number;
  schedule: string;
  instructors: string[];
  modulesCount: number;
  modulesList: { title: string; topics: string[] }[];
  materialsIncluded: string[];
  bonusesIncluded: string[];
  certificationType: 'Certificación Oficial INTECA' | 'Diplomado Internacional' | 'Máster Executive';
  videoPreviewUrl?: string;
  brochurePdfUrl?: string;
  activePromotions?: string[];
  enrolledStudents: number;
  status: 'Disponible' | 'Cupos Limitados' | 'Próximo Inicio' | 'Cerrado';
}

export interface AIAgentSpec {
  id: string;
  name: string;
  roleTitle: string;
  specialty: 'Estrategia' | 'Cierre' | 'Marketing' | 'WhatsApp' | 'Copywriting' | 'Recuperación' | 'Soporte';
  avatar: string;
  description: string;
  systemPrompt: string;
  status: 'Activo' | 'En Pausa' | 'Saturado';
  stats: {
    conversationsHandled: number;
    dealsClosed: number;
    avgSatisfaction: number; // 0 - 5.0
    conversionRatePercent: number;
  };
}

export interface MarketingCampaign {
  id: string;
  title: string;
  channel: 'WhatsApp' | 'Email' | 'SMS' | 'Facebook/Instagram' | 'TikTok';
  status: 'Borrador' | 'Programada' | 'En Ejecución' | 'Completada';
  targetSegment: string;
  sentCount: number;
  openRatePercent: number;
  clickRatePercent: number;
  conversionsCount: number;
  revenueGenerated: number;
  generatedByAI: boolean;
  contentSnippet: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  leadId: string;
  leadName: string;
  courseTitle: string;
  amount: number;
  currency: string;
  gateway: 'Stripe' | 'PayPal' | 'Square' | 'Google Pay' | 'Apple Pay' | 'Transferencia' | 'Tarjeta Local';
  status: 'Completado' | 'Pendiente' | 'Fallido' | 'Reembolsado';
  transactionRef: string;
  invoiceNumber: string;
  invoiceUrl: string;
  courseActivationCode: string;
  createdAt: string;
}

export interface OrganizationTenant {
  id: string;
  name: string;
  slug: string;
  logo: string;
  plan: 'Enterprise Autonomous AI' | 'Pro' | 'Business';
  activeUsers: number;
  activeLeadsCount: number;
  whatsappStatus: 'Conectado QR' | 'Desconectado' | 'Procesando';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  avatarUrl: string;
}

export interface FunnelStageConfig {
  id: FunnelStageId;
  name: string;
  color: string;
  order: number;
  autoActionPrompt?: string;
}
