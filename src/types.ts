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

export type EmotionState =
  'Muy Entusiasta' | 'Interesado' | 'Neutral' | 'Indeciso' | 'Escéptico' | 'Urgente' | 'Molesto';

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
  channel:
    'WhatsApp' | 'WebChat' | 'Email' | 'Instagram' | 'Messenger' | 'Telegram' | 'SMS' | 'CallNote';
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
  type:
    | 'Contrato'
    | 'Comprobante'
    | 'PDF Cursos'
    | 'Grabación'
    | 'Audio'
    | 'Certificado'
    | 'Identificación';
  url: string;
  fileSize: string;
  uploadedAt: string;
}

export interface Course {
  id: string;
  title: string;
  code: string;
  category:
    | 'Salud'
    | 'Inteligencia Artificial'
    | 'Marketing & Ventas'
    | 'Programación'
    | 'Gestión Empresarial'
    | 'Diseño & UX';
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
  certificationType:
    'Certificación Oficial INTECA' | 'Diplomado Internacional' | 'Máster Executive';
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
  specialty:
    'Estrategia' | 'Cierre' | 'Marketing' | 'WhatsApp' | 'Copywriting' | 'Recuperación' | 'Soporte';
  avatar: string;
  description: string;
  systemPrompt: string;
  autonomyLevel?: 'Supervisado' | 'Semiautónomo' | '24/7 Autónomo';
  operatingMandate?: string;
  tacticalArsenal?: string[];
  kpiTargets?: {
    dailySalesTarget?: number;
    responseSlaMinutes?: number;
    targetRoiPercent?: number;
    minimumQualifiedLeadsDaily?: number;
  };
  approvalPolicy?: {
    canLaunchCommercialCampaigns: boolean;
    requiresApprovalForTestimonials: boolean;
    requiresApprovalForInstitutionalNews: boolean;
    maxDiscountPercent: number;
  };
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
  organizationId?: string;
  opportunityId?: string;
  quoteId?: string;
  amount: number;
  currency: string;
  gateway:
    'Stripe' | 'PayPal' | 'Square' | 'Google Pay' | 'Apple Pay' | 'Transferencia' | 'Tarjeta Local';
  status: 'Completado' | 'Pendiente' | 'Fallido' | 'Reembolsado';
  transactionRef: string;
  invoiceNumber: string;
  invoiceUrl: string;
  courseActivationCode: string;
  createdAt: string;
}

export type OpportunityStage =
  'Prospecto' | 'Calificado' | 'Cotización' | 'Negociación' | 'Cierre' | 'Ganado' | 'Perdido';

export type QuoteStatus = 'Borrador' | 'Enviada' | 'Aceptada' | 'Vencida' | 'Convertida a factura';

export type InvoiceFiscalType =
  | 'Factura de crédito fiscal'
  | 'Factura de consumo'
  | 'Nota de crédito'
  | 'Factura gubernamental'
  | 'Factura especial';

export type DgiiStatus =
  | 'No configurada'
  | 'Lista para enviar'
  | 'Enviada a DGII'
  | 'Aceptada'
  | 'Rechazada'
  | 'Modo demo';

export interface ProductService {
  id: string;
  organizationId: string;
  name: string;
  sku: string;
  category: 'Educación' | 'Salud' | 'Servicios' | 'Retail' | 'Automotriz' | 'Tecnología' | 'Otro';
  description: string;
  unitPrice: number;
  currency: string;
  billingCycle: 'Único' | 'Mensual' | 'Trimestral' | 'Anual';
  taxable: boolean;
  status: 'Activo' | 'Pausado';
}

export interface SalesOpportunity {
  id: string;
  organizationId: string;
  leadId: string;
  title: string;
  companyName: string;
  stage: OpportunityStage;
  productServiceId: string;
  quotedAmount: number;
  currency: string;
  probability: number;
  expectedCloseDate: string;
  ownerName: string;
  nextStep: string;
  riskLevel: 'Bajo' | 'Medio' | 'Alto';
}

export interface QuoteLineItem {
  id: string;
  productServiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

export interface CommercialQuote {
  id: string;
  organizationId: string;
  opportunityId: string;
  quoteNumber: string;
  customerName: string;
  customerTaxId: string;
  issueDate: string;
  validUntil: string;
  status: QuoteStatus;
  currency: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: QuoteLineItem[];
}

export interface ElectronicInvoice {
  id: string;
  organizationId: string;
  transactionId?: string;
  quoteId?: string;
  customerName: string;
  customerTaxId: string;
  fiscalType: InvoiceFiscalType;
  ncf: string;
  eNcf: string;
  dgiiStatus: DgiiStatus;
  integrationMode: 'Demo' | 'Producción pendiente' | 'Producción';
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  issuedAt: string;
  dueDate: string;
  paymentStatus: 'Pendiente' | 'Pagada' | 'Parcial' | 'Anulada';
  auditTrail: string[];
}

export interface LicensePlan {
  id: string;
  name: string;
  targetSegment: string;
  monthlyPrice: number;
  setupFee: number;
  includedUsers: number;
  leadLimit: number;
  features: string[];
  status: 'Vendible' | 'Interno' | 'Pausado';
}

export interface TenantLicense {
  id: string;
  organizationId: string;
  planId: string;
  billingCycle: 'Mensual' | 'Anual' | 'Gratis permanente';
  monthlyAmount: number;
  status: 'Activa' | 'Prueba' | 'Vencida' | 'Suspendida';
  renewalDate: string;
  seatsUsed: number;
  seatsLimit: number;
  invoiceEmail: string;
  paymentMethod: 'Tarjeta' | 'Transferencia' | 'Gratis INTECA' | 'Pendiente';
  isFreeForever?: boolean;
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
