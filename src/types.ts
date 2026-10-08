export type PlatformMode = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';

export type UserRole =
  | 'Super Admin CRM'
  | 'Admin Empresa'
  | 'Admin'
  | 'Supervisor'
  | 'Ventas'
  | 'Marketing'
  | 'Call Center'
  | 'Docentes'
  | 'Caja'
  | 'Contabilidad'
  | 'Compras'
  | 'Inventario'
  | 'KPIs'
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
  studentEnrollment?: StudentEnrollment;

  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  sender: 'lead' | 'ai_agent' | 'human_user';
  agentName?: string;
  channel:
    | 'WhatsApp'
    | 'WebChat'
    | 'Email'
    | 'Instagram'
    | 'Messenger'
    | 'Telegram'
    | 'SMS'
    | 'CallNote'
    | 'Facebook Lead Ads'
    | 'Meta Ads'
    | 'Google Ads'
    | 'YouTube'
    | 'Web Form';
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

export interface StudentEnrollment {
  status:
    | 'Lead registrado'
    | 'Pago pendiente'
    | 'Inscripción pagada'
    | 'Credenciales generadas'
    | 'Bienvenida enviada'
    | 'Activo en campus';
  studentCode: string;
  enrollmentPaymentTransactionId?: string;
  enrollmentPaidAt?: string;
  campusUrl: string;
  campusEmail: string;
  campusTemporaryPassword: string;
  courseAccessCode: string;
  welcomeMessage: string;
  credentialsSentAt?: string;
  nextAcademicFollowUpAt?: string;
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
    | 'Estrategia'
    | 'Cierre'
    | 'Marketing'
    | 'Conversión'
    | 'Publicidad'
    | 'Embudos'
    | 'Prospección'
    | 'Ventas'
    | 'CRO'
    | 'WhatsApp'
    | 'Copywriting'
    | 'Recuperación'
    | 'Soporte'
    | 'Omnicanal'
    | 'Creativos'
    | 'Video'
    | 'Facturación'
    | 'Contabilidad'
    | 'Compras'
    | 'Inventario'
    | 'KPIs'
    | 'Lanzamientos'
    | 'Operaciones';
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
  channel:
    | 'WhatsApp'
    | 'Email'
    | 'SMS'
    | 'Facebook/Instagram'
    | 'TikTok'
    | 'Google Ads'
    | 'YouTube'
    | 'Omnicanal';
  status: 'Borrador' | 'Programada' | 'En Ejecución' | 'Completada';
  targetSegment: string;
  sentCount: number;
  openRatePercent: number;
  clickRatePercent: number;
  conversionsCount: number;
  revenueGenerated: number;
  generatedByAI: boolean;
  contentSnippet: string;
  recommendedBudgetDop?: number;
  paidByAgent?: boolean;
  adPaymentProfileId?: string;
  paymentAuthorizationStatus?: 'Sin tarjeta' | 'Pendiente aprobación' | 'Autorizada' | 'Pagada';
  createdAt: string;
}

export type AdPlatform = 'Meta Ads' | 'Google Ads' | 'YouTube Ads' | 'TikTok Ads';

export interface AdPaymentProfile {
  id: string;
  organizationId: string;
  provider: AdPlatform;
  cardBrand: 'Visa' | 'Mastercard' | 'Amex' | 'Otra';
  cardLast4: string;
  cardholderName: string;
  billingEmail: string;
  spendingLimitDaily: number;
  spendingLimitMonthly: number;
  status: 'No configurada' | 'Activa' | 'Requiere verificación' | 'Suspendida';
  approvalMode: 'Autónomo dentro de límite' | 'Requiere aprobación del dueño' | 'Solo manual';
  connectedAccountId?: string;
}

export interface AdSpendDecision {
  id: string;
  organizationId: string;
  campaignTitle: string;
  channel: AdPlatform;
  objective: string;
  recommendedBudgetDop: number;
  maxBudgetDop: number;
  expectedLeads: number;
  expectedSales: number;
  targetRoas: number;
  riskLevel: 'Bajo' | 'Medio' | 'Alto';
  status: 'Recomendado' | 'Programado' | 'Aprobado' | 'Pausado' | 'Rechazado';
  reasoning: string;
  guardrails: string[];
  createdByAgentId: string;
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

export interface FiscalParty {
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  commercialName?: string;
  email?: string;
  phone?: string;
}

export interface EcfLineItem {
  id: string;
  quantity: number;
  description: string;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  exemptAmount: number;
  itbisAmount: number;
  iscAmount?: number;
  otherTaxAmount?: number;
  total: number;
}

export interface EcfTaxBreakdown {
  taxableAmount: number;
  exemptAmount: number;
  itbisRate: number;
  itbisAmount: number;
  iscAmount: number;
  otherChargesAmount: number;
  grandTotal: number;
}

export interface ElectronicInvoice {
  id: string;
  organizationId: string;
  transactionId?: string;
  quoteId?: string;
  issuer: FiscalParty;
  receiver: FiscalParty;
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
  lineItems: EcfLineItem[];
  taxBreakdown: EcfTaxBreakdown;
  xmlStatus:
    'Pendiente generar' | 'XML generado' | 'Firmado' | 'Enviado' | 'Aceptado' | 'Rechazado';
  pdfStatus: 'Pendiente generar' | 'Representación PDF generada' | 'Enviada al cliente';
  digitalSignatureHash: string;
  qrVerificationUrl: string;
  qrPayload: string;
  auditTrail: string[];
}

export type AccountingReportType =
  'Estado de resultados' | 'Balance general' | 'Estado de flujo de efectivo';

export interface AccountingReport {
  id: string;
  organizationId: string;
  type: AccountingReportType;
  period: string;
  status: 'Generado' | 'En revisión' | 'Pendiente datos' | 'Aprobado';
  generatedByAgentId: string;
  highlights: string[];
  totals: {
    ingresos?: number;
    costos?: number;
    gastos?: number;
    utilidadNeta?: number;
    activos?: number;
    pasivos?: number;
    patrimonio?: number;
    entradasEfectivo?: number;
    salidasEfectivo?: number;
    flujoNeto?: number;
  };
  nifReference?: string;
  nextAction: string;
}

export interface PurchaseRequest {
  id: string;
  organizationId: string;
  requestNumber: string;
  supplierName: string;
  requesterName: string;
  description: string;
  amount: number;
  currency: string;
  status: 'Borrador' | 'Solicitada' | 'En revisión' | 'Aprobada' | 'Recibida' | 'Rechazada';
  requiredBy: string;
}

export interface CashReceipt {
  id: string;
  organizationId: string;
  receiptNumber: string;
  payerName: string;
  concept: string;
  amount: number;
  currency: string;
  paymentMethod: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque';
  receivedAt: string;
  linkedTransactionId?: string;
}

export interface BankReconciliation {
  id: string;
  organizationId: string;
  bankName: string;
  accountMask: string;
  period: string;
  internalBalance: number;
  bankStatementBalance: number;
  difference: number;
  status: 'Cuadrada' | 'Diferencia pendiente' | 'En revisión';
  pendingItems: string[];
}

export interface DailyInventoryReport {
  id: string;
  organizationId: string;
  reportDate: string;
  itemName: string;
  openingStock: number;
  entries: number;
  exits: number;
  closingStock: number;
  alertLevel: 'Normal' | 'Bajo' | 'Crítico';
}

export interface SupplierQuoteEvaluation {
  id: string;
  organizationId: string;
  supplierName: string;
  country: string;
  quoteNumber: string;
  category: string;
  requestedItem: string;
  amount: number;
  currency: string;
  deliveryDays: number;
  warrantyScore: number;
  qualityScore: number;
  priceScore: number;
  complianceScore: number;
  negotiationStatus: 'Pendiente' | 'Negociando' | 'Mejor oferta' | 'Rechazada' | 'Aprobada';
  recommendation: string;
  agentNotes: string;
}

export interface ProcurementAgentTask {
  id: string;
  organizationId: string;
  scope: 'Nacional' | 'Internacional';
  agentName: string;
  taskType: 'Requisición' | 'Cotización' | 'Negociación' | 'Orden de compra' | 'Inventario';
  supplierOrItem: string;
  status: 'Pendiente' | 'En proceso' | 'Aprobado' | 'Cerrado';
  expectedSavingPercent: number;
  nextAction: string;
}

export interface CompanyKpiMetric {
  id: string;
  organizationId: string;
  area: 'Ventas' | 'Marketing' | 'Finanzas' | 'Operaciones' | 'Compras' | 'Atención' | 'Inventario';
  name: string;
  currentValue: number;
  targetValue: number;
  unit: '%' | 'DOP' | 'Cantidad' | 'Días' | 'Horas';
  status: 'En meta' | 'Atención' | 'Crítico' | 'Sin datos';
  trend: 'Sube' | 'Baja' | 'Estable' | 'Sin datos';
  ownerAgentId: string;
  recommendation: string;
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
  billingCycle: 'Mensual' | 'Anual' | 'Gratis permanente' | 'Abierta indefinida';
  monthlyAmount: number;
  status: 'Activa' | 'Prueba' | 'Vencida' | 'Suspendida';
  renewalDate: string;
  seatsUsed: number;
  seatsLimit: number;
  invoiceEmail: string;
  paymentMethod: 'Tarjeta' | 'Transferencia' | 'Gratis INTECA' | 'Pendiente';
  isFreeForever?: boolean;
  isOpenLicense?: boolean;
  licenseManagementLocked?: boolean;
}

export interface PlatformOwnerControl {
  ownerName: string;
  ownerEmail: string;
  ownerRole: 'Super Admin CRM';
  canGrantLicenses: true;
  canCreateTenants: true;
  canManageBilling: true;
  licensePolicy: string[];
}

export interface CompanyAdminProfile {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: 'Admin Empresa';
  canGrantLicenses: false;
  canManageUsers: true;
  canManageIntegrations: true;
  seatsLimit: number;
  usersLoaded: number;
  status: 'Activo' | 'Pendiente' | 'Suspendido';
}

export interface CompanyStaffUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  status: 'Activo' | 'Invitado' | 'Suspendido';
  createdByAdminId: string;
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

export interface CRMAuthSession {
  mode: 'real';
  userName: string;
  email: string;
  role: UserRole;
  organizationName: string;
  token: string;
  loginAt: string;
}

export interface FunnelStageConfig {
  id: FunnelStageId;
  name: string;
  color: string;
  order: number;
  autoActionPrompt?: string;
}

export type IntegrationStatus =
  | 'Listo para conectar'
  | 'Requiere credenciales'
  | 'Webhook preparado'
  | 'Conectado'
  | 'Producción pendiente'
  | 'Modo demo';

export type IntegrationCategory =
  | 'Base de datos'
  | 'Hosting'
  | 'IA'
  | 'Mensajería'
  | 'Social Ads'
  | 'Buscadores'
  | 'Video'
  | 'Pauta'
  | 'Pagos'
  | 'Facturación'
  | 'Creativos'
  | 'Notificaciones'
  | 'Web'
  | 'Campus';

export interface ExternalIntegration {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  inboundWebhookPath?: string;
  outboundCapability: string;
  requiredEnvVars: string[];
  ownerAgentId: string;
  setupNotes: string[];
}

export type CreativeAssetType = 'Flyer' | 'Video 30s' | 'Video 60s' | 'Carrusel' | 'Landing Hero';

export interface CreativeAsset {
  id: string;
  title: string;
  type: CreativeAssetType;
  courseId: string;
  campaignObjective: string;
  targetAudience: string;
  status: 'Brief listo' | 'Pendiente generar' | 'En revisión' | 'Aprobado para pauta';
  imagePrompt?: string;
  videoScript?: string[];
  copyBlocks: string[];
  assignedAgentId: string;
}

export interface LaunchCampaignPlan {
  id: string;
  courseId: string;
  launchName: string;
  launchDate: string;
  relaunchDate?: string;
  budgetDop: number;
  dailySalesGoal: number;
  status: 'Planificado' | 'Preparando audiencia' | 'En promoción' | 'Relanzamiento' | 'Cerrado';
  channels: MarketingCampaign['channel'][];
  automationCadence: string[];
  ownerCheckpoints: string[];
}

export interface OwnerActionNotification {
  id: string;
  priority: 'Alta' | 'Media' | 'Baja';
  type:
    | 'Llamada requerida'
    | 'Pago recibido'
    | 'Bloqueo operativo'
    | 'Factura pendiente'
    | 'Campaña lista';
  title: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  recommendedAction: string;
  dueAt: string;
  assignedAgentId: string;
  status: 'Pendiente' | 'Notificado' | 'Resuelto';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorType: 'Sistema' | 'Agente IA' | 'Usuario' | 'Webhook' | 'Integración';
  actorName: string;
  module:
    | 'Leads'
    | 'Chat'
    | 'Agentes'
    | 'Marketing'
    | 'Creativos'
    | 'Lanzamientos'
    | 'Pagos'
    | 'Facturación'
    | 'Contabilidad'
    | 'Integraciones'
    | 'Auditoría'
    | 'Licencias'
    | 'Usuarios'
    | 'Compras'
    | 'KPIs'
    | 'Pauta'
    | 'Seguridad';
  action:
    | 'Creó'
    | 'Actualizó'
    | 'Respondió'
    | 'Calificó'
    | 'Programó'
    | 'Generó'
    | 'Recibió'
    | 'Validó'
    | 'Otorgó'
    | 'Aprobó'
    | 'Evaluó'
    | 'Escaló'
    | 'Notificó'
    | 'Falló';
  entityType: string;
  entityId?: string;
  summary: string;
  details: string;
  sourceChannel?: ConversationMessage['channel'] | LeadSource | AdPlatform | 'Sistema' | 'API';
  severity: 'Info' | 'Éxito' | 'Advertencia' | 'Crítico';
  status: 'Registrado' | 'Pendiente revisión' | 'Resuelto';
}
