import React, { useEffect, useState } from 'react';
import { PlatformFrame } from './components/PlatformFrame';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { AuthGate } from './components/AuthGate';

// View Modules
import { DashboardOverview } from './components/DashboardOverview';
import { LeadsCRM } from './components/LeadsCRM';
import { AIChatStudio } from './components/AIChatStudio';
import { AIAgentsCommand } from './components/AIAgentsCommand';
import { CoursesManager } from './components/CoursesManager';
import { SalesFunnelsEditor } from './components/SalesFunnelsEditor';
import { MarketingAutomation } from './components/MarketingAutomation';
import { GrowthRevenueCommandCenter } from './components/GrowthRevenueCommandCenter';
import { AutonomousGrowthOps } from './components/AutonomousGrowthOps';
import { PaymentsInvoicing } from './components/PaymentsInvoicing';
import { AccountingAutopilot } from './components/AccountingAutopilot';
import { DocumentVault } from './components/DocumentVault';
import { PredictiveAnalytics } from './components/PredictiveAnalytics';
import { AuditTrailCenter } from './components/AuditTrailCenter';
import { MultiTenantSettings } from './components/MultiTenantSettings';
import { ManualsDocumentationModal } from './components/ManualsDocumentationModal';
import { OwnerControlCenter } from './components/OwnerControlCenter';
import { AdsWalletCommandCenter } from './components/AdsWalletCommandCenter';
import { ProcurementCommandCenter } from './components/ProcurementCommandCenter';
import { CompanyKpisCenter } from './components/CompanyKpisCenter';

// Mock Initial Datasets
import {
  INITIAL_USERS,
  MULTI_AGENTS_SPEC,
  FUNNEL_STAGES,
  CONFIRMED_INTECA_COURSES,
  INITIAL_LICENSE_PLANS,
  INITIAL_TENANT_LICENSES,
  EXTERNAL_INTEGRATIONS_READINESS,
  PLATFORM_OWNER_CONTROL,
} from './data/initialData';

import {
  Lead,
  AIAgentSpec,
  Course,
  FunnelStageConfig,
  MarketingCampaign,
  PaymentTransaction,
  OrganizationTenant,
  UserProfile,
  PlatformMode,
  SalesOpportunity,
  CommercialQuote,
  ElectronicInvoice,
  LicensePlan,
  TenantLicense,
  AuditLogEntry,
  AccountingReport,
  PurchaseRequest,
  CashReceipt,
  BankReconciliation,
  DailyInventoryReport,
  CRMAuthSession,
  AdPaymentProfile,
  AdSpendDecision,
  CompanyAdminProfile,
  CompanyStaffUser,
  SupplierQuoteEvaluation,
  ProcurementAgentTask,
  CompanyKpiMetric,
  UserRole,
  AdPlatform,
  StudentEnrollment,
} from './types';

const AUTH_SESSION_STORAGE_KEY = 'sales-ai-crm-auth-session-real-only-v128';
const THEME_STORAGE_KEY = 'sales-ai-crm-theme';
const REAL_ORGANIZATIONS_STORAGE_KEY = 'sales-ai-crm-real-organizations-v123';
const REAL_AUDIT_STORAGE_KEY = 'sales-ai-crm-real-audit-log-v123';
const REAL_COMPANY_ADMINS_STORAGE_KEY = 'sales-ai-crm-real-company-admins-v126';
const REAL_COMPANY_STAFF_STORAGE_KEY = 'sales-ai-crm-real-company-staff-v126';
const REAL_AD_PAYMENT_PROFILES_STORAGE_KEY = 'sales-ai-crm-real-ad-payment-profiles-v126';
type ThemeMode = 'dark' | 'light';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

const buildOrganizationFromSession = (session: CRMAuthSession | null): OrganizationTenant => {
  const organizationName = session?.organizationName?.trim() || 'Mi empresa';
  const slug = slugify(organizationName) || 'empresa_principal';
  const isInteca = organizationName.toLowerCase().includes('inteca');

  return {
    id: isInteca ? 'org_inteca_main' : `org_${slug}`,
    name: organizationName,
    slug: isInteca ? 'inteca-main' : slug,
    logo: isInteca ? '🎓' : '🏢',
    plan: isInteca ? 'Enterprise Autonomous AI' : 'Business',
    activeUsers: isInteca ? 8 : 1,
    activeLeadsCount: 0,
    whatsappStatus: 'Procesando',
  };
};

const loadRealOrganizations = (session: CRMAuthSession | null): OrganizationTenant[] => {
  try {
    const stored = localStorage.getItem(REAL_ORGANIZATIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as OrganizationTenant[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (error) {
    console.warn('No se pudieron cargar empresas reales:', error);
  }

  return [buildOrganizationFromSession(session)];
};

const getOrganizationsForSession = (session: CRMAuthSession | null): OrganizationTenant[] => {
  return loadRealOrganizations(session);
};

const REAL_AGENT_IDENTITIES: Record<string, { name: string; roleTitle: string; initials: string }> =
  {
    agent_director: {
      name: 'Agente IA Estratega Comercial',
      roleTitle: 'Dirección comercial autónoma',
      initials: 'EC',
    },
    agent_closer: {
      name: 'Agente IA de Ventas y Cierre',
      roleTitle: 'Ventas 24/7, objeciones, seguimiento y pagos',
      initials: 'VC',
    },
    agent_conversion: {
      name: 'Agente IA Conversión y Matrícula',
      roleTitle: 'Registro autónomo de leads, inscripción, campus y bienvenida',
      initials: 'CM',
    },
    agent_whatsapp: {
      name: 'Agente IA WhatsApp',
      roleTitle: 'Atención, respuesta y seguimiento por WhatsApp',
      initials: 'WA',
    },
    agent_copywriter: {
      name: 'Agente IA Copywriting',
      roleTitle: 'Mensajes, anuncios y propuestas de valor',
      initials: 'CW',
    },
    agent_growth_master: {
      name: 'Agente IA Growth',
      roleTitle: 'Adquisición, conversión y aceleración',
      initials: 'GR',
    },
    agent_media_buyer: {
      name: 'Agente IA Publicidad',
      roleTitle: 'Meta Ads, Google Ads y optimización de pauta',
      initials: 'AD',
    },
    agent_funnel_architect: {
      name: 'Agente IA de Embudos',
      roleTitle: 'Arquitectura comercial desde lead hasta pago',
      initials: 'EM',
    },
    agent_sdr: {
      name: 'Agente IA Prospección',
      roleTitle: 'Calificación, diagnóstico y agenda comercial',
      initials: 'SD',
    },
    agent_sales_elite: {
      name: 'Agente IA Cierre Avanzado',
      roleTitle: 'Negociación y cierre con políticas autorizadas',
      initials: 'CA',
    },
    agent_cro_analytics: {
      name: 'Agente IA Analítica CRO',
      roleTitle: 'Conversión, datos y optimización de rendimiento',
      initials: 'AN',
    },
    agent_recovery: {
      name: 'Agente IA Recuperación',
      roleTitle: 'Reactivación de leads fríos y pagos pendientes',
      initials: 'RC',
    },
    agent_omnichannel: {
      name: 'Agente IA Omnicanal',
      roleTitle: 'Coordinación entre web, redes, WhatsApp y anuncios',
      initials: 'OM',
    },
    agent_creative: {
      name: 'Agente IA Creativos',
      roleTitle: 'Flyers, piezas visuales y conceptos publicitarios',
      initials: 'CR',
    },
    agent_video: {
      name: 'Agente IA Video Ads',
      roleTitle: 'Guiones y estructura de videos promocionales',
      initials: 'VD',
    },
    agent_billing: {
      name: 'Agente IA Facturación e-CF',
      roleTitle: 'XML, PDF, impuestos, firma, QR y control DGII',
      initials: 'FC',
    },
    agent_accounting: {
      name: 'Agente IA Contable',
      roleTitle: 'Estados financieros, recibos, compras e inventario',
      initials: 'CO',
    },
    agent_launch: {
      name: 'Agente IA Lanzamientos',
      roleTitle: 'Fechas de inicio, relanzamientos y calendario comercial',
      initials: 'LZ',
    },
    agent_owner_ops: {
      name: 'Agente IA Operaciones del Dueño',
      roleTitle: 'Alertas, llamadas prioritarias, pagos y bloqueos',
      initials: 'OP',
    },
    agent_procurement_national: {
      name: 'Agente IA Compras Nacionales',
      roleTitle: 'Requisiciones, proveedores locales, negociación e inventario',
      initials: 'CN',
    },
    agent_procurement_international: {
      name: 'Agente IA Compras Internacionales',
      roleTitle: 'Cotizaciones globales, riesgo, logística y negociación',
      initials: 'CI',
    },
  };

const buildAgentAvatar = (initials: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#1e293b"/><circle cx="48" cy="48" r="34" fill="#2563eb"/><text x="48" y="55" font-family="Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="#ffffff">${initials}</text></svg>`,
  )}`;

const resetAgentStats = (agents: AIAgentSpec[]) =>
  agents.map((agent) => ({
    ...agent,
    ...(REAL_AGENT_IDENTITIES[agent.id] || {
      name: `Agente IA ${agent.specialty}`,
      roleTitle: agent.roleTitle,
      initials: 'IA',
    }),
    avatar: buildAgentAvatar((REAL_AGENT_IDENTITIES[agent.id]?.initials || 'IA').slice(0, 2)),
    stats: {
      conversationsHandled: 0,
      dealsClosed: 0,
      avgSatisfaction: 0,
      conversionRatePercent: 0,
    },
  }));

const getAgentsForSession = () => {
  return resetAgentStats(MULTI_AGENTS_SPEC);
};

const getCoursesForSession = () => {
  return CONFIRMED_INTECA_COURSES;
};

const getIntecaCampusUrl = () => {
  const viteCampusUrl = import.meta.env.VITE_INTECA_CAMPUS_URL;
  if (typeof viteCampusUrl === 'string' && viteCampusUrl.trim()) {
    return viteCampusUrl.trim();
  }

  return 'https://campus.inteca.com.do';
};

const normalizeCredentialToken = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);

const getCourseShortCode = (course: Course) =>
  course.code?.trim() || normalizeCredentialToken(course.title).slice(0, 10).toUpperCase();

const buildStudentEnrollment = (
  lead: Lead,
  course: Course,
  paymentTransactionId: string,
  paidAt: string,
): StudentEnrollment => {
  const cleanName = normalizeCredentialToken(`${lead.firstName}.${lead.lastName || 'estudiante'}`);
  const phoneToken = normalizeCredentialToken(lead.whatsapp || lead.phone || lead.id).slice(-4);
  const courseCode = getCourseShortCode(course);
  const studentCode = `INTECA-${new Date(paidAt).getFullYear()}-${lead.id.slice(-5).toUpperCase()}`;
  const campusUrl = getIntecaCampusUrl();
  const campusEmail =
    lead.email && lead.email.includes('@')
      ? lead.email.trim().toLowerCase()
      : `${cleanName || 'estudiante'}${phoneToken}@alumnos.inteca.com.do`;
  const campusTemporaryPassword = `Inteca-${courseCode.slice(0, 4)}-${phoneToken || '2026'}!`;
  const courseAccessCode = `${courseCode}-${studentCode.slice(-5)}`;
  const nextAcademicFollowUpAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
  const welcomeMessage = `Hola ${lead.firstName}, bienvenido/a oficialmente a INTECA. Tu inscripción al programa ${course.title} fue validada correctamente. Acceso al campus: ${campusUrl}. Usuario: ${campusEmail}. Contraseña temporal: ${campusTemporaryPassword}. Código de acceso del curso: ${courseAccessCode}. En las próximas 24 horas el equipo académico confirmará tu grupo, horario y próximos pasos.`;

  return {
    status: 'Bienvenida enviada',
    studentCode,
    enrollmentPaymentTransactionId: paymentTransactionId,
    enrollmentPaidAt: paidAt,
    campusUrl,
    campusEmail,
    campusTemporaryPassword,
    courseAccessCode,
    welcomeMessage,
    credentialsSentAt: paidAt,
    nextAcademicFollowUpAt,
  };
};

const getTenantLicensesForSession = (
  session: CRMAuthSession | null,
  organizations: OrganizationTenant[],
): TenantLicense[] => {
  return organizations.map((organization) => {
    if (
      organization.id === 'org_inteca_main' ||
      organization.name.toLowerCase().includes('inteca')
    ) {
      return {
        ...INITIAL_TENANT_LICENSES[0],
        organizationId: organization.id,
        invoiceEmail: session?.email || INITIAL_TENANT_LICENSES[0].invoiceEmail,
      };
    }

    const planId =
      organization.plan === 'Pro'
        ? 'plan_starter'
        : organization.plan === 'Business'
          ? 'plan_business'
          : 'plan_enterprise';
    const seatsLimit = organization.plan === 'Pro' ? 3 : organization.plan === 'Business' ? 10 : 25;

    return {
      id: `lic_${organization.id}`,
      organizationId: organization.id,
      planId,
      billingCycle: 'Mensual',
      monthlyAmount: 0,
      status: 'Prueba',
      renewalDate: 'Pendiente configurar',
      seatsUsed: 1,
      seatsLimit,
      invoiceEmail: session?.email || '',
      paymentMethod: 'Pendiente',
    };
  });
};

const getAuditLogsForSession = (): AuditLogEntry[] => {
  try {
    const stored = localStorage.getItem(REAL_AUDIT_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as AuditLogEntry[];
  } catch (error) {
    console.warn('No se pudo cargar auditoría real:', error);
  }

  return [];
};

const loadRealCollection = <T,>(key: string): T[] => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as T[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn(`No se pudo cargar colección real ${key}:`, error);
  }

  return [];
};

const createUserForSession = (
  session: CRMAuthSession | null,
  organizationId: string,
): UserProfile => {
  return {
    ...INITIAL_USERS[0],
    id: 'usr_real_admin',
    name: session?.userName || 'Administrador',
    email: session?.email || '',
    role: session?.role || 'Admin',
    organizationId,
  };
};

export function App() {
  const deploymentMode = 'production' as const;

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (error) {
      console.warn('No se pudo cargar el tema local:', error);
    }
    return 'dark';
  });

  const [authSession, setAuthSession] = useState<CRMAuthSession | null>(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CRMAuthSession;
        if (parsed.mode === 'real') return parsed;
      }
    } catch (error) {
      console.warn('No se pudo cargar la sesión local:', error);
    }
    return null;
  });

  const effectiveDeploymentMode = deploymentMode;
  const isTrialMode = false;

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Multi-platform simulator state
  const [simulatedOS, setSimulatedOS] = useState<PlatformMode>('web');

  // Multi-tenant organization & user state
  const [organizations, setOrganizations] = useState<OrganizationTenant[]>(() =>
    getOrganizationsForSession(authSession),
  );
  const [currentOrg, setCurrentOrg] = useState<OrganizationTenant>(() => {
    const initialOrganizations = getOrganizationsForSession(authSession);
    return initialOrganizations[0] || buildOrganizationFromSession(authSession);
  });
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const initialOrganizations = getOrganizationsForSession(authSession);
    const firstOrg = initialOrganizations[0] || buildOrganizationFromSession(authSession);
    return createUserForSession(authSession, firstOrg.id);
  });

  const handleAuthenticated = (session: CRMAuthSession) => {
    setAuthSession(session);
    setCurrentUser((prev) => ({
      ...prev,
      name: session.userName,
      email: session.email,
      role: session.role,
    }));
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch((error) =>
      console.warn('No se pudo notificar cierre de sesión al servidor:', error),
    );
    setAuthSession(null);
    setActiveTab('dashboard');
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Master Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<AIAgentSpec[]>(() => getAgentsForSession());
  const [courses, setCourses] = useState<Course[]>(() => getCoursesForSession());
  const [funnelStages, setFunnelStages] = useState<FunnelStageConfig[]>(FUNNEL_STAGES);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [quotes, setQuotes] = useState<CommercialQuote[]>([]);
  const [electronicInvoices, setElectronicInvoices] = useState<ElectronicInvoice[]>([]);
  const [licensePlans] = useState<LicensePlan[]>(INITIAL_LICENSE_PLANS);
  const [tenantLicenses, setTenantLicenses] = useState<TenantLicense[]>(() =>
    getTenantLicensesForSession(authSession, getOrganizationsForSession(authSession)),
  );
  const [accountingReports, setAccountingReports] = useState<AccountingReport[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [cashReceipts, setCashReceipts] = useState<CashReceipt[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<BankReconciliation[]>([]);
  const [dailyInventoryReports, setDailyInventoryReports] = useState<DailyInventoryReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => getAuditLogsForSession());
  const [creativeAssets, setCreativeAssets] = useState(() => []);
  const [launchPlans, setLaunchPlans] = useState(() => []);
  const [ownerActions, setOwnerActions] = useState(() => []);
  const [adPaymentProfiles, setAdPaymentProfiles] = useState<AdPaymentProfile[]>(() =>
    loadRealCollection<AdPaymentProfile>(REAL_AD_PAYMENT_PROFILES_STORAGE_KEY),
  );
  const [adSpendDecisions, setAdSpendDecisions] = useState<AdSpendDecision[]>([]);
  const [companyAdmins, setCompanyAdmins] = useState<CompanyAdminProfile[]>(() =>
    loadRealCollection<CompanyAdminProfile>(REAL_COMPANY_ADMINS_STORAGE_KEY),
  );
  const [companyStaffUsers, setCompanyStaffUsers] = useState<CompanyStaffUser[]>(() =>
    loadRealCollection<CompanyStaffUser>(REAL_COMPANY_STAFF_STORAGE_KEY),
  );
  const [supplierQuoteEvaluations, setSupplierQuoteEvaluations] = useState<
    SupplierQuoteEvaluation[]
  >([]);
  const [procurementAgentTasks, setProcurementAgentTasks] = useState<ProcurementAgentTask[]>([]);
  const [companyKpis, setCompanyKpis] = useState<CompanyKpiMetric[]>([]);

  // Active Lead for Chat Studio
  const [selectedLeadForChat, setSelectedLeadForChat] = useState<Lead | null>(null);

  // Modal Documentation State
  const [isDocumentationModalOpen, setIsDocumentationModalOpen] = useState(false);

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('No se pudo guardar el tema local:', error);
    }
  }, [theme]);

  useEffect(() => {
    try {
      if (authSession) {
        sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(authSession));
      } else {
        sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('No se pudo guardar la sesión local:', error);
    }
  }, [authSession]);

  useEffect(() => {
    try {
      sessionStorage.removeItem('sales-ai-crm-auth-session-v123');
      localStorage.removeItem('sales-ai-crm-demo-audit-log-v123');
    } catch (error) {
      console.warn('No se pudieron limpiar llaves demo anteriores:', error);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const sessionOrganizations = getOrganizationsForSession(authSession);
    const firstOrg = sessionOrganizations[0] || buildOrganizationFromSession(authSession);

    setOrganizations(sessionOrganizations);
    setCurrentOrg(firstOrg);
    setCurrentUser(createUserForSession(authSession, firstOrg.id));
    setLeads([]);
    setAgents(getAgentsForSession());
    setCourses(getCoursesForSession());
    setCampaigns([]);
    setTransactions([]);
    setOpportunities([]);
    setQuotes([]);
    setElectronicInvoices([]);
    setTenantLicenses(getTenantLicensesForSession(authSession, sessionOrganizations));
    setAccountingReports([]);
    setPurchaseRequests([]);
    setCashReceipts([]);
    setBankReconciliations([]);
    setDailyInventoryReports([]);
    setAuditLogs(getAuditLogsForSession());
    setCreativeAssets([]);
    setLaunchPlans([]);
    setOwnerActions([]);
    setAdPaymentProfiles(
      loadRealCollection<AdPaymentProfile>(REAL_AD_PAYMENT_PROFILES_STORAGE_KEY),
    );
    setAdSpendDecisions([]);
    setCompanyAdmins(loadRealCollection<CompanyAdminProfile>(REAL_COMPANY_ADMINS_STORAGE_KEY));
    setCompanyStaffUsers(loadRealCollection<CompanyStaffUser>(REAL_COMPANY_STAFF_STORAGE_KEY));
    setSupplierQuoteEvaluations([]);
    setProcurementAgentTasks([]);
    setCompanyKpis([]);
    setSelectedLeadForChat(null);
  }, [authSession]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (authSession?.mode !== 'real') return;
    try {
      localStorage.setItem(REAL_ORGANIZATIONS_STORAGE_KEY, JSON.stringify(organizations));
    } catch (error) {
      console.warn('No se pudieron guardar empresas reales:', error);
    }
  }, [authSession?.mode, organizations]);

  useEffect(() => {
    try {
      localStorage.setItem(REAL_AUDIT_STORAGE_KEY, JSON.stringify(auditLogs.slice(0, 1000)));
    } catch (error) {
      console.warn('No se pudo guardar auditoría local:', error);
    }
  }, [auditLogs]);

  useEffect(() => {
    if (authSession?.mode !== 'real') return;
    try {
      localStorage.setItem(REAL_COMPANY_ADMINS_STORAGE_KEY, JSON.stringify(companyAdmins));
    } catch (error) {
      console.warn('No se pudieron guardar admins reales:', error);
    }
  }, [authSession?.mode, companyAdmins]);

  useEffect(() => {
    if (authSession?.mode !== 'real') return;
    try {
      localStorage.setItem(REAL_COMPANY_STAFF_STORAGE_KEY, JSON.stringify(companyStaffUsers));
    } catch (error) {
      console.warn('No se pudieron guardar usuarios reales:', error);
    }
  }, [authSession?.mode, companyStaffUsers]);

  useEffect(() => {
    if (authSession?.mode !== 'real') return;
    try {
      localStorage.setItem(REAL_AD_PAYMENT_PROFILES_STORAGE_KEY, JSON.stringify(adPaymentProfiles));
    } catch (error) {
      console.warn('No se pudieron guardar perfiles de pauta reales:', error);
    }
  }, [adPaymentProfiles, authSession?.mode]);

  if (!authSession) {
    return (
      <AuthGate
        deploymentMode={deploymentMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const recordAudit = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);

    const newEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${randomPart}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    setAuditLogs((prev) => [newEntry, ...prev].slice(0, 1000));
  };

  const handleAddOrganization = (
    organizationName: string,
    plan: OrganizationTenant['plan'] = 'Business',
  ) => {
    const cleanName = organizationName.trim();
    if (!cleanName) return;

    const slug = slugify(cleanName) || `empresa_${Date.now()}`;
    const newOrganization: OrganizationTenant = {
      id: `org_${slug}_${Date.now()}`,
      name: cleanName,
      slug,
      logo: '🏢',
      plan,
      activeUsers: 1,
      activeLeadsCount: 0,
      whatsappStatus: 'Desconectado',
    };

    setOrganizations((prev) => [newOrganization, ...prev]);
    setCurrentOrg(newOrganization);
    setCurrentUser((prev) => ({ ...prev, organizationId: newOrganization.id }));
    setTenantLicenses((prev) => [
      {
        id: `lic_${newOrganization.id}`,
        organizationId: newOrganization.id,
        planId:
          plan === 'Pro'
            ? 'plan_starter'
            : plan === 'Business'
              ? 'plan_business'
              : 'plan_enterprise',
        billingCycle: plan === 'Enterprise Autonomous AI' ? 'Anual' : 'Mensual',
        monthlyAmount: 0,
        status: 'Prueba',
        renewalDate: 'Pendiente configurar',
        seatsUsed: 1,
        seatsLimit: plan === 'Pro' ? 3 : plan === 'Business' ? 10 : 25,
        invoiceEmail: '',
        paymentMethod: 'Pendiente',
      },
      ...prev,
    ]);
    recordAudit({
      actorType: 'Usuario',
      actorName: currentUser.name,
      module: 'Seguridad',
      action: 'Creó',
      entityType: 'OrganizationTenant',
      entityId: newOrganization.id,
      summary: `Empresa registrada: ${newOrganization.name}`,
      details: `Plan base seleccionado: ${newOrganization.plan}. Datos iniciales reales en cero, sin datos de muestra.`,
      sourceChannel: 'Sistema',
      severity: 'Éxito',
      status: 'Registrado',
    });
  };

  const handleCreateCompanyAdmin = (organizationId: string, name: string, email: string) => {
    const license = tenantLicenses.find((item) => item.organizationId === organizationId);
    if (license?.isOpenLicense || license?.licenseManagementLocked) {
      recordAudit({
        actorType: 'Sistema',
        actorName: 'Sales AI CRM',
        module: 'Licencias',
        action: 'Validó',
        entityType: 'TenantLicense',
        entityId: license.id,
        summary: 'INTECA mantiene licencia abierta indefinida fuera de administración comercial.',
        details:
          'No se creó Admin Empresa porque INTECA no se administra como cliente vendible ni requiere control de licencia.',
        sourceChannel: 'Sistema',
        severity: 'Info',
        status: 'Registrado',
      });
      return;
    }

    const newAdmin: CompanyAdminProfile = {
      id: `company_admin_${organizationId}_${Date.now()}`,
      organizationId,
      name,
      email,
      role: 'Admin Empresa',
      canGrantLicenses: false,
      canManageUsers: true,
      canManageIntegrations: true,
      seatsLimit: license?.seatsLimit || 1,
      usersLoaded: companyStaffUsers.filter((user) => user.organizationId === organizationId)
        .length,
      status: 'Activo',
    };

    setCompanyAdmins((prev) => [
      newAdmin,
      ...prev.filter((admin) => admin.organizationId !== organizationId),
    ]);
    recordAudit({
      actorType: 'Usuario',
      actorName: currentUser.name,
      module: 'Usuarios',
      action: 'Creó',
      entityType: 'CompanyAdminProfile',
      entityId: newAdmin.id,
      summary: `Admin Empresa creado: ${newAdmin.name}`,
      details:
        'Rol limitado a gestionar usuarios e integraciones de su empresa. No puede otorgar licencias del CRM.',
      sourceChannel: 'Sistema',
      severity: 'Éxito',
      status: 'Registrado',
    });
  };

  const handleInviteStaffUser = (
    organizationId: string,
    adminId: string,
    name: string,
    email: string,
    role: UserRole,
    department: string,
  ) => {
    const license = tenantLicenses.find((item) => item.organizationId === organizationId);
    if (license?.isOpenLicense || license?.licenseManagementLocked) return;

    const newStaffUser: CompanyStaffUser = {
      id: `staff_${organizationId}_${Date.now()}`,
      organizationId,
      name,
      email,
      role,
      department,
      status: 'Invitado',
      createdByAdminId: adminId,
    };

    setCompanyStaffUsers((prev) => [newStaffUser, ...prev]);
    setCompanyAdmins((prev) =>
      prev.map((admin) =>
        admin.id === adminId ? { ...admin, usersLoaded: admin.usersLoaded + 1 } : admin,
      ),
    );
    setOrganizations((prev) =>
      prev.map((organization) =>
        organization.id === organizationId
          ? { ...organization, activeUsers: organization.activeUsers + 1 }
          : organization,
      ),
    );
    setTenantLicenses((prev) =>
      prev.map((license) =>
        license.organizationId === organizationId
          ? { ...license, seatsUsed: Math.min(license.seatsLimit, license.seatsUsed + 1) }
          : license,
      ),
    );
    recordAudit({
      actorType: 'Usuario',
      actorName: currentUser.name,
      module: 'Usuarios',
      action: 'Creó',
      entityType: 'CompanyStaffUser',
      entityId: newStaffUser.id,
      summary: `Usuario invitado: ${newStaffUser.name}`,
      details: `Rol: ${newStaffUser.role}. Departamento: ${newStaffUser.department}. Creado por admin ${adminId}.`,
      sourceChannel: 'Sistema',
      severity: 'Info',
      status: 'Registrado',
    });
  };

  const handleRegisterAdPaymentProfile = (
    provider: AdPlatform,
    cardLast4: string,
    dailyLimit: number,
  ) => {
    const profile: AdPaymentProfile = {
      id: `adpay_${currentOrg.id}_${provider.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      organizationId: currentOrg.id,
      provider,
      cardBrand: 'Otra',
      cardLast4,
      cardholderName: currentOrg.name,
      billingEmail: currentUser.email,
      spendingLimitDaily: Math.max(0, dailyLimit),
      spendingLimitMonthly: Math.max(0, dailyLimit * 30),
      status: 'Requiere verificación',
      approvalMode: 'Requiere aprobación del dueño',
    };

    setAdPaymentProfiles((prev) => [
      profile,
      ...prev.filter(
        (item) => !(item.organizationId === currentOrg.id && item.provider === provider),
      ),
    ]);
    recordAudit({
      actorType: 'Usuario',
      actorName: currentUser.name,
      module: 'Pauta',
      action: 'Creó',
      entityType: 'AdPaymentProfile',
      entityId: profile.id,
      summary: `Perfil de pago registrado para ${provider}`,
      details:
        'Se guardó tarjeta enmascarada con límites. El número completo debe tokenizarse con el proveedor de pago o la plataforma publicitaria.',
      sourceChannel: provider,
      severity: 'Éxito',
      status: 'Pendiente revisión',
    });
  };

  // Handlers
  const handleAddLead = (newLead: Lead) => {
    const leadForCurrentOrg = {
      ...newLead,
      organizationId: currentOrg.id,
    };

    setLeads((prev) => [leadForCurrentOrg, ...prev]);
    recordAudit({
      actorType: 'Usuario',
      actorName: currentUser.name,
      module: 'Leads',
      action: 'Creó',
      entityType: 'Lead',
      entityId: leadForCurrentOrg.id,
      summary: `Lead creado: ${leadForCurrentOrg.firstName} ${leadForCurrentOrg.lastName}`,
      details: `Fuente: ${leadForCurrentOrg.source}. Curso de interés: ${leadForCurrentOrg.courseOfInterestId}. Asignado a ${leadForCurrentOrg.assignedAgentId}.`,
      sourceChannel: leadForCurrentOrg.source,
      severity: 'Info',
      status: 'Registrado',
    });
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    if (selectedLeadForChat?.id === updatedLead.id) {
      setSelectedLeadForChat(updatedLead);
    }
    recordAudit({
      actorType: 'Sistema',
      actorName: 'Sales AI CRM',
      module: 'Leads',
      action: 'Actualizó',
      entityType: 'Lead',
      entityId: updatedLead.id,
      summary: `Lead actualizado: ${updatedLead.firstName} ${updatedLead.lastName}`,
      details: `Etapa: ${updatedLead.stageId}. Estado: ${updatedLead.status}. Probabilidad: ${updatedLead.buyProbability}%.`,
      sourceChannel: updatedLead.source,
      severity: 'Info',
      status: 'Registrado',
    });
  };

  const buildEnrolledStudentLead = (lead: Lead, transaction: PaymentTransaction): Lead => {
    const courseObj =
      courses.find((course) => course.title === transaction.courseTitle) ||
      courses.find((course) => course.id === lead.courseOfInterestId) ||
      courses[0];
    const paidAt = transaction.createdAt || new Date().toISOString();
    const enrollment = buildStudentEnrollment(lead, courseObj, transaction.id, paidAt);
    const existingMessageIds = new Set(lead.conversationHistory.map((message) => message.id));
    const welcomeMessage = {
      id: `msg_welcome_${transaction.id}`,
      sender: 'ai_agent' as const,
      agentName: 'Agente IA Conversión y Matrícula',
      channel: 'WhatsApp' as const,
      messageType: 'text' as const,
      content: enrollment.welcomeMessage,
      timestamp: paidAt,
    };

    return {
      ...lead,
      stageId: 'cliente',
      status: 'Ganado',
      buyProbability: 100,
      scoreAI: Math.max(lead.scoreAI, 96),
      assignedAgentId: 'agent_conversion',
      studentEnrollment: enrollment,
      nextFollowUp: enrollment.nextAcademicFollowUpAt,
      tags: Array.from(
        new Set([
          ...lead.tags,
          'Inscripción Pagada',
          'Estudiante Activo',
          'Campus Virtual',
          'Bienvenida Enviada',
        ]),
      ),
      conversationHistory: existingMessageIds.has(welcomeMessage.id)
        ? lead.conversationHistory
        : [...lead.conversationHistory, welcomeMessage],
      updatedAt: paidAt,
    };
  };

  const activateEnrollmentForTransaction = (transaction: PaymentTransaction) => {
    let enrolledLead: Lead | null = null;

    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== transaction.leadId) return lead;
        enrolledLead = buildEnrolledStudentLead(lead, transaction);
        return enrolledLead;
      }),
    );

    setSelectedLeadForChat((prev) =>
      prev?.id === transaction.leadId ? buildEnrolledStudentLead(prev, transaction) : prev,
    );

    const targetLead = leads.find((lead) => lead.id === transaction.leadId);
    const auditLead = enrolledLead || targetLead;
    if (auditLead) {
      recordAudit({
        actorType: 'Agente IA',
        actorName: 'Agente IA Conversión y Matrícula',
        module: 'Leads',
        action: 'Actualizó',
        entityType: 'StudentEnrollment',
        entityId: transaction.leadId,
        summary: `Lead convertido en estudiante: ${auditLead.firstName} ${auditLead.lastName}`,
        details: `Pago de inscripción validado. Se generaron credenciales de campus, mensaje de bienvenida y seguimiento académico. Transacción: ${transaction.transactionRef}.`,
        sourceChannel: 'Sistema',
        severity: 'Éxito',
        status: 'Registrado',
      });
    }
  };

  const handleOpenChatWithLead = (lead: Lead) => {
    setSelectedLeadForChat(lead);
    setActiveTab('chat');
  };

  const handleUpdateAgent = (updatedAgent: AIAgentSpec) => {
    setAgents((prev) => prev.map((a) => (a.id === updatedAgent.id ? updatedAgent : a)));
    recordAudit({
      actorType: 'Usuario',
      actorName: currentUser.name,
      module: 'Agentes',
      action: 'Actualizó',
      entityType: 'AIAgentSpec',
      entityId: updatedAgent.id,
      summary: `Agente actualizado: ${updatedAgent.name}`,
      details: `Especialidad: ${updatedAgent.specialty}. Estado: ${updatedAgent.status}. Nivel de autonomía: ${updatedAgent.autonomyLevel || 'Supervisado'}.`,
      sourceChannel: 'Sistema',
      severity: 'Info',
      status: 'Registrado',
    });
  };

  const handleAddCourse = (newCourse: Course) => {
    setCourses((prev) => [...prev, newCourse]);
    recordAudit({
      actorType: 'Usuario',
      actorName: currentUser.name,
      module: 'Lanzamientos',
      action: 'Creó',
      entityType: 'Course',
      entityId: newCourse.id,
      summary: `Producto/curso creado: ${newCourse.title}`,
      details: `Categoría: ${newCourse.category}. Precio: ${newCourse.price}. Estado: ${newCourse.status}.`,
      sourceChannel: 'Sistema',
      severity: 'Info',
      status: 'Registrado',
    });
  };

  const handleUpdateCourse = (updatedCourse: Course) => {
    setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
    recordAudit({
      actorType: 'Usuario',
      actorName: currentUser.name,
      module: 'Lanzamientos',
      action: 'Actualizó',
      entityType: 'Course',
      entityId: updatedCourse.id,
      summary: `Producto/curso actualizado: ${updatedCourse.title}`,
      details: `Estado: ${updatedCourse.status}. Horario: ${updatedCourse.schedule}. Promociones: ${(updatedCourse.activePromotions || []).join(', ') || 'ninguna'}.`,
      sourceChannel: 'Sistema',
      severity: 'Info',
      status: 'Registrado',
    });
  };

  const handleAddCampaign = (newCampaign: MarketingCampaign) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
    const adChannel =
      newCampaign.channel === 'Facebook/Instagram'
        ? 'Meta Ads'
        : newCampaign.channel === 'Google Ads'
          ? 'Google Ads'
          : newCampaign.channel === 'YouTube'
            ? 'YouTube Ads'
            : null;

    if (adChannel) {
      const spendDecision: AdSpendDecision = {
        id: `ad_decision_${Date.now()}`,
        organizationId: currentOrg.id,
        campaignTitle: newCampaign.title,
        channel: adChannel,
        objective: `Lanzar ${newCampaign.channel} hacia conversaciones calificadas, pagos y seguimiento medible.`,
        recommendedBudgetDop: newCampaign.recommendedBudgetDop || 1000,
        maxBudgetDop: Math.max(1000, (newCampaign.recommendedBudgetDop || 1000) * 3),
        expectedLeads: 45,
        expectedSales: 5,
        targetRoas: 3.5,
        riskLevel: 'Medio',
        status: 'Recomendado',
        reasoning:
          'El agente recomienda iniciar con prueba controlada, medir conversaciones útiles y escalar solo si hay intención alta o pagos validados.',
        guardrails: [
          'No pagar pauta sin método de pago conectado y límite de gasto activo.',
          'Pausar si el costo por lead sube sin oportunidades ni pagos.',
          'No escalar presupuesto si no hay trazabilidad de fuente, UTM y pago.',
        ],
        createdByAgentId: 'agent_media_buyer',
        createdAt: new Date().toISOString(),
      };
      setAdSpendDecisions((prev) => [spendDecision, ...prev]);
      recordAudit({
        actorType: 'Agente IA',
        actorName: 'Agente IA Publicidad',
        module: 'Pauta',
        action: 'Evaluó',
        entityType: 'AdSpendDecision',
        entityId: spendDecision.id,
        summary: `Decisión de pauta preparada: ${spendDecision.campaignTitle}`,
        details: `Canal: ${spendDecision.channel}. Presupuesto recomendado: RD$${spendDecision.recommendedBudgetDop}. Requiere tarjeta/límite antes de pago real.`,
        sourceChannel: spendDecision.channel,
        severity: 'Info',
        status: 'Registrado',
      });
    }
    recordAudit({
      actorType: 'Agente IA',
      actorName: 'Agente IA Copywriting',
      module: 'Marketing',
      action: 'Generó',
      entityType: 'MarketingCampaign',
      entityId: newCampaign.id,
      summary: `Campaña generada: ${newCampaign.title}`,
      details: `Canal: ${newCampaign.channel}. Segmento: ${newCampaign.targetSegment}. Estado: ${newCampaign.status}.`,
      sourceChannel: newCampaign.channel === 'Google Ads' ? 'Google Ads' : 'Meta Ads',
      severity: 'Éxito',
      status: 'Registrado',
    });
  };

  const handleAddTransaction = (newTx: PaymentTransaction) => {
    setTransactions((prev) => [newTx, ...prev]);
    recordAudit({
      actorType: 'Agente IA',
      actorName: 'Sofía e-CF',
      module: 'Pagos',
      action: newTx.status === 'Completado' ? 'Validó' : 'Creó',
      entityType: 'PaymentTransaction',
      entityId: newTx.id,
      summary: `Pago ${newTx.status.toLowerCase()}: ${newTx.leadName}`,
      details: `Curso/servicio: ${newTx.courseTitle}. Monto: ${newTx.currency} ${newTx.amount}. Gateway: ${newTx.gateway}. Referencia: ${newTx.transactionRef}.`,
      sourceChannel: 'Sistema',
      severity: newTx.status === 'Completado' ? 'Éxito' : 'Advertencia',
      status: newTx.status === 'Pendiente' ? 'Pendiente revisión' : 'Registrado',
    });

    if (newTx.status === 'Completado') {
      activateEnrollmentForTransaction(newTx);
    }
  };

  // Real-time Chat AI Messaging Handler via Express Backend
  const handleSendMessageToLead = async (
    leadId: string,
    messageContent: string,
    isHumanOverride: boolean,
  ) => {
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead) return;

    // 1. Append user/lead message
    const userMsg = {
      id: `msg_u_${Date.now()}`,
      sender: 'lead' as const,
      channel: 'WhatsApp' as const,
      messageType: 'text' as const,
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    const updatedWithUser = {
      ...targetLead,
      conversationHistory: [...targetLead.conversationHistory, userMsg],
      updatedAt: new Date().toISOString(),
    };

    handleUpdateLead(updatedWithUser);
    recordAudit({
      actorType: isHumanOverride ? 'Usuario' : 'Webhook',
      actorName: isHumanOverride ? currentUser.name : 'Entrada omnicanal',
      module: 'Chat',
      action: 'Recibió',
      entityType: 'ConversationMessage',
      entityId: userMsg.id,
      summary: `Mensaje recibido de ${targetLead.firstName} ${targetLead.lastName}`,
      details: messageContent,
      sourceChannel: 'WhatsApp',
      severity: 'Info',
      status: 'Registrado',
    });

    // 2. Call backend server-side Gemini AI agent
    try {
      const assignedAgent = agents.find((a) => a.id === targetLead.assignedAgentId) || agents[0];
      const courseObj = courses.find((c) => c.id === targetLead.courseOfInterestId) || courses[0];

      const response = await fetch('/api/ai/chat-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentRole: assignedAgent.roleTitle,
          leadName: `${targetLead.firstName} ${targetLead.lastName}`,
          courseTitle: courseObj.title,
          agentName: assignedAgent.name,
          leadEmail: targetLead.email,
          leadPhone: targetLead.whatsapp || targetLead.phone,
          conversationHistory: updatedWithUser.conversationHistory,
          currentEmotion: targetLead.currentEmotion,
          buyProbability: targetLead.buyProbability,
          userMessage: messageContent,
          systemPrompt: assignedAgent.systemPrompt,
          isHumanOverride,
        }),
      });

      const data = await response.json();

      let replyText = data.reply;
      if (!replyText) {
        replyText = `¡Excelente pregunta, ${targetLead.firstName}! Para orientarte bien, te explico el valor práctico de ${courseObj.title}, cómo responde a tu necesidad y cuál sería el siguiente paso para reservar o cotizar sin perder seguimiento. ¿Quieres que te envíe los pasos de pago o prefieres que validemos primero tus dudas principales?`;
      }

      const aiMsg = {
        id: `msg_ai_${Date.now()}`,
        sender: 'ai_agent' as const,
        agentName: assignedAgent.name,
        channel: 'WhatsApp' as const,
        messageType: 'text' as const,
        content: replyText,
        timestamp: new Date().toISOString(),
      };

      const updatedWithAI = {
        ...updatedWithUser,
        conversationHistory: [...updatedWithUser.conversationHistory, aiMsg],
        updatedAt: new Date().toISOString(),
      };

      handleUpdateLead(updatedWithAI);
      recordAudit({
        actorType: 'Agente IA',
        actorName: assignedAgent.name,
        module: 'Chat',
        action: 'Respondió',
        entityType: 'ConversationMessage',
        entityId: aiMsg.id,
        summary: `Respuesta generada para ${targetLead.firstName} ${targetLead.lastName}`,
        details: replyText,
        sourceChannel: 'WhatsApp',
        severity: 'Éxito',
        status: 'Registrado',
      });
    } catch (err) {
      console.error('Error getting AI reply:', err);
      recordAudit({
        actorType: 'Sistema',
        actorName: 'Sales AI CRM',
        module: 'Chat',
        action: 'Falló',
        entityType: 'AIReply',
        entityId: leadId,
        summary: `Fallo generando respuesta para ${targetLead.firstName} ${targetLead.lastName}`,
        details: err instanceof Error ? err.message : 'Error desconocido al generar respuesta IA.',
        sourceChannel: 'WhatsApp',
        severity: 'Crítico',
        status: 'Pendiente revisión',
      });
    }
  };

  // Payment Link Generator from Chat
  const handleGeneratePaymentLink = (lead: Lead, courseId: string, discountPercent: number) => {
    const courseObj = courses.find((c) => c.id === courseId) || courses[0];
    const baseAmount = courseObj.discountPrice ?? courseObj.price;
    const safeDiscount = Math.min(100, Math.max(0, discountPercent));
    const finalAmount = Number((baseAmount * (1 - safeDiscount / 100)).toFixed(2));

    const newTx: PaymentTransaction = {
      id: `tx_${Date.now()}`,
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      courseTitle: courseObj.title,
      organizationId: lead.organizationId,
      amount: finalAmount,
      currency: 'DOP',
      status: 'Pendiente',
      gateway: 'Transferencia',
      transactionRef: `pending_${crypto.randomUUID()}`,
      invoiceNumber: '',
      invoiceUrl: '',
      createdAt: new Date().toISOString(),
      courseActivationCode: '',
    };

    handleAddTransaction(newTx);

    // Notify in chat
    const paymentMsg = {
      id: `msg_pay_${Date.now()}`,
      sender: 'ai_agent' as const,
      agentName: 'Agente IA de Ventas y Cierre',
      channel: 'WhatsApp' as const,
      messageType: 'payment_link' as const,
      content: isTrialMode
        ? `Se creó una solicitud de pago de prueba por RD$${finalAmount.toLocaleString()}. El pago permanece pendiente hasta validar comprobante o conectar una pasarela con webhook real.`
        : `Se creó una solicitud de pago por RD$${finalAmount.toLocaleString()}. El pago permanece pendiente hasta validar comprobante o recibir confirmación de una pasarela con webhook real.`,
      timestamp: new Date().toISOString(),
    };

    const updatedLead: Lead = {
      ...lead,
      stageId: 'pago_pendiente',
      status: 'Activo',
      conversationHistory: [...lead.conversationHistory, paymentMsg],
      updatedAt: new Date().toISOString(),
    };

    handleUpdateLead(updatedLead);
    setActiveTab('chat');
  };

  const handleConfirmEnrollmentPayment = (lead: Lead, courseId: string) => {
    const courseObj = courses.find((c) => c.id === courseId) || courses[0];
    const enrollmentAmount = courseObj.discountPrice || Math.min(courseObj.price || 2500, 2500);
    const completedAt = new Date().toISOString();
    const paymentRef = `enrollment_${crypto.randomUUID()}`;

    const completedTransaction: PaymentTransaction = {
      id: `tx_paid_${Date.now()}`,
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      courseTitle: courseObj.title,
      organizationId: lead.organizationId,
      amount: enrollmentAmount,
      currency: 'DOP',
      status: 'Completado',
      gateway: 'Transferencia',
      transactionRef: paymentRef,
      invoiceNumber: `REC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      invoiceUrl: '',
      courseActivationCode: `${getCourseShortCode(courseObj)}-${lead.id.slice(-5).toUpperCase()}`,
      createdAt: completedAt,
    };

    handleAddTransaction(completedTransaction);
    setActiveTab('chat');
  };

  return (
    <PlatformFrame platform={simulatedOS}>
      <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
        {/* Left Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          leadsCount={leads.length}
          activeAgentsCount={agents.filter((a) => a.status === 'Activo').length}
          pendingPaymentsCount={transactions.filter((t) => t.status === 'Pendiente').length}
          deploymentMode={effectiveDeploymentMode}
        />

        {/* Right Main Content Panel */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top Header Controls */}
          <Header
            currentOS={simulatedOS}
            onOSChange={setSimulatedOS}
            organizations={organizations}
            currentOrg={currentOrg}
            onOrgChange={setCurrentOrg}
            currentUser={currentUser}
            onRoleChange={(newRole) => setCurrentUser((prev) => ({ ...prev, role: newRole }))}
            isDarkMode={theme === 'dark'}
            onToggleTheme={handleToggleTheme}
            onOpenDocumentation={() => setIsDocumentationModalOpen(true)}
            deploymentMode={effectiveDeploymentMode}
            authSession={authSession}
            onLogout={handleLogout}
          />

          {/* Dynamic View Container */}
          <main className="flex-1 overflow-y-auto bg-slate-950/90">
            {activeTab === 'dashboard' && (
              <DashboardOverview
                leads={leads}
                transactions={transactions}
                agents={agents}
                courses={courses}
                opportunities={opportunities}
                quotes={quotes}
                electronicInvoices={electronicInvoices}
                tenantLicenses={tenantLicenses}
                onNavigateToLeads={() => setActiveTab('leads')}
                onNavigateToAgents={() => setActiveTab('agents')}
                onNavigateToChat={() => setActiveTab('chat')}
                onNavigateToMarketing={() => setActiveTab('marketing')}
                deploymentMode={effectiveDeploymentMode}
              />
            )}

            {activeTab === 'leads' && (
              <LeadsCRM
                leads={leads}
                funnelStages={funnelStages}
                courses={courses}
                onAddLead={handleAddLead}
                onUpdateLead={handleUpdateLead}
                onOpenChatWithLead={handleOpenChatWithLead}
              />
            )}

            {activeTab === 'chat' &&
              (selectedLeadForChat || leads[0] ? (
                <AIChatStudio
                  leads={leads}
                  agents={agents}
                  courses={courses}
                  selectedLead={selectedLeadForChat || leads[0]}
                  onSelectLead={setSelectedLeadForChat}
                  onSendMessageToLead={handleSendMessageToLead}
                  onGeneratePaymentLink={handleGeneratePaymentLink}
                  onConfirmEnrollmentPayment={handleConfirmEnrollmentPayment}
                />
              ) : (
                <div className="p-6 max-w-3xl mx-auto">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-xl font-black text-white">Chat sin leads reales</h2>
                    <p className="text-sm text-slate-400 mt-2">
                      Esta es la versión real. Primero registra leads reales desde el módulo Leads
                      CRM 360° o conecta WhatsApp, formularios, Meta Ads o Google Ads.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('leads')}
                      className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl px-4 py-2"
                    >
                      Registrar primer lead real
                    </button>
                  </div>
                </div>
              ))}

            {activeTab === 'agents' && (
              <AIAgentsCommand
                agents={agents}
                integrations={EXTERNAL_INTEGRATIONS_READINESS}
                onUpdateAgent={handleUpdateAgent}
                onNavigateToChat={() => setActiveTab('chat')}
              />
            )}

            {activeTab === 'courses' && (
              <CoursesManager
                courses={courses}
                onAddCourse={handleAddCourse}
                onUpdateCourse={handleUpdateCourse}
              />
            )}

            {activeTab === 'funnels' && (
              <SalesFunnelsEditor stages={funnelStages} onUpdateStages={setFunnelStages} />
            )}

            {activeTab === 'marketing' && (
              <MarketingAutomation
                campaigns={campaigns}
                courses={courses}
                onAddCampaign={handleAddCampaign}
              />
            )}

            {activeTab === 'growth' && (
              <GrowthRevenueCommandCenter agents={agents} courses={courses} />
            )}

            {activeTab === 'operations' && (
              <AutonomousGrowthOps
                integrations={EXTERNAL_INTEGRATIONS_READINESS}
                creativeAssets={creativeAssets}
                launchPlans={launchPlans}
                ownerActions={ownerActions}
                agents={agents}
                courses={courses}
              />
            )}

            {activeTab === 'owner' && (
              <OwnerControlCenter
                ownerControl={PLATFORM_OWNER_CONTROL}
                organizations={organizations}
                tenantLicenses={tenantLicenses}
                licensePlans={licensePlans}
                companyAdmins={companyAdmins}
                staffUsers={companyStaffUsers}
                onCreateCompanyAdmin={handleCreateCompanyAdmin}
                onInviteStaffUser={handleInviteStaffUser}
              />
            )}

            {activeTab === 'adsWallet' && (
              <AdsWalletCommandCenter
                currentOrg={currentOrg}
                paymentProfiles={adPaymentProfiles}
                spendDecisions={adSpendDecisions}
                campaigns={campaigns}
                deploymentMode={effectiveDeploymentMode}
                onRegisterPaymentProfile={handleRegisterAdPaymentProfile}
              />
            )}

            {activeTab === 'procurement' && (
              <ProcurementCommandCenter
                currentOrg={currentOrg}
                purchaseRequests={purchaseRequests}
                inventoryReports={dailyInventoryReports}
                quoteEvaluations={supplierQuoteEvaluations}
                procurementTasks={procurementAgentTasks}
              />
            )}

            {activeTab === 'kpis' && (
              <CompanyKpisCenter currentOrg={currentOrg} kpis={companyKpis} />
            )}

            {activeTab === 'payments' && (
              <PaymentsInvoicing
                transactions={transactions}
                leads={leads}
                courses={courses}
                opportunities={opportunities}
                quotes={quotes}
                electronicInvoices={electronicInvoices}
                onAddTransaction={handleAddTransaction}
                deploymentMode={effectiveDeploymentMode}
              />
            )}

            {activeTab === 'accounting' && (
              <AccountingAutopilot
                reports={accountingReports}
                purchaseRequests={purchaseRequests}
                cashReceipts={cashReceipts}
                bankReconciliations={bankReconciliations}
                inventoryReports={dailyInventoryReports}
              />
            )}

            {activeTab === 'documents' && <DocumentVault leads={leads} />}

            {activeTab === 'analytics' && <PredictiveAnalytics leads={leads} courses={courses} />}

            {activeTab === 'audit' && <AuditTrailCenter auditLogs={auditLogs} />}

            {activeTab === 'settings' && (
              <MultiTenantSettings
                organizations={organizations}
                currentOrg={currentOrg}
                currentUser={currentUser}
                licensePlans={licensePlans}
                tenantLicenses={tenantLicenses}
                onOrgChange={setCurrentOrg}
                onAddOrganization={handleAddOrganization}
              />
            )}
          </main>
        </div>
      </div>

      {/* Manuals & Technical Documentation Modal */}
      <ManualsDocumentationModal
        isOpen={isDocumentationModalOpen}
        onClose={() => setIsDocumentationModalOpen(false)}
      />
    </PlatformFrame>
  );
}

export default App;
