import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Settings,
  Building2,
  PlusCircle,
  Users,
  Lock,
  QrCode,
  CheckCircle2,
  Key,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Database,
  FileCheck,
  Cloud,
  ExternalLink,
  EyeOff,
  Rocket,
  Save,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { LicensePlan, OrganizationTenant, TenantLicense, UserProfile, UserRole } from '../types';

interface MultiTenantSettingsProps {
  organizations: OrganizationTenant[];
  currentOrg: OrganizationTenant;
  currentUser: UserProfile;
  licensePlans: LicensePlan[];
  tenantLicenses: TenantLicense[];
  onOrgChange: (org: OrganizationTenant) => void;
  onAddOrganization?: (organizationName: string, plan: OrganizationTenant['plan']) => void;
}

interface RuntimeIntegrationGroup {
  id: string;
  name: string;
  category: string;
  requiredEnvVars: string[];
  configuredEnvVars: string[];
  missingEnvVars: string[];
  configured: boolean;
  webhookPath?: string;
}

interface RuntimeIntegrationStatus {
  success: boolean;
  appUrl: string;
  deploymentMode: string;
  renderPersistenceReady: boolean;
  checkedAt: string;
  groups: RuntimeIntegrationGroup[];
}

interface IntegrationConfigureResponse {
  success: boolean;
  message?: string;
  error?: string;
  deploymentMode?: string;
  savedVariables?: string[];
  invalidKeys?: string[];
  renderPersistence?: {
    attempted: boolean;
    persistedVariables: string[];
    failedVariables: Array<{ key: string; error: string }>;
    skippedReason?: string;
  };
  deploy?: {
    requested: boolean;
    success: boolean;
    id?: string;
    status?: string;
    error?: string;
  };
  groups?: RuntimeIntegrationGroup[];
}

interface ProductionConfigField {
  key: string;
  label: string;
  placeholder?: string;
  sensitive?: boolean;
  helper?: string;
}

interface ProductionConfigSection {
  id: string;
  title: string;
  description: string;
  fields: ProductionConfigField[];
}

const GEMINI_FALLBACK_MODELS =
  'gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite,gemini-1.5-flash,gemini-1.5-flash-8b';

const DEFAULT_PRODUCTION_CONFIG_VALUES: Record<string, string> = {
  APP_URL: 'https://sales.ia.crm.inteca.com.do',
  DEPLOYMENT_MODE: 'production',
  VITE_DEPLOYMENT_MODE: 'production',
  TRUST_PROXY: 'true',
  WHATSAPP_AUTO_REPLY_ENABLED: 'true',
  META_GRAPH_API_VERSION: 'v22.0',
  GEMINI_MODEL: 'gemini-3.5-flash',
  GEMINI_FALLBACK_MODELS,
  SUPABASE_STORAGE_BUCKET: 'sales-ai-crm',
};

const PRODUCTION_CONFIG_SECTIONS: ProductionConfigSection[] = [
  {
    id: 'core',
    title: 'Producción CRM',
    description: 'Dominio, modo producción y reglas base del servidor.',
    fields: [
      { key: 'APP_URL', label: 'URL pública del CRM', placeholder: 'https://sales.ia.crm.inteca.com.do' },
      { key: 'DEPLOYMENT_MODE', label: 'Modo backend', placeholder: 'production' },
      { key: 'VITE_DEPLOYMENT_MODE', label: 'Modo frontend', placeholder: 'production' },
      { key: 'TRUST_PROXY', label: 'Trust Proxy Render', placeholder: 'true' },
    ],
  },
  {
    id: 'render',
    title: 'Render',
    description: 'Permite guardar variables en Environment y lanzar redeploy desde el CRM.',
    fields: [
      { key: 'RENDER_SERVICE_ID', label: 'Render Service ID', placeholder: 'srv-...' },
      {
        key: 'RENDER_API_KEY',
        label: 'Render API Key',
        placeholder: 'rnd_...',
        sensitive: true,
        helper: 'Solo se usa servidor-servidor para guardar Environment.',
      },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Cloud API',
    description: 'Credenciales para responder mensajes reales por WhatsApp.',
    fields: [
      {
        key: 'WHATSAPP_ACCESS_TOKEN',
        label: 'Token permanente WhatsApp',
        placeholder: 'EAAG...',
        sensitive: true,
      },
      { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone Number ID', placeholder: '1241169399089233' },
      {
        key: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        label: 'Business Account ID',
        placeholder: '1344553444211156',
      },
      {
        key: 'META_WEBHOOK_VERIFY_TOKEN',
        label: 'Verify Token Webhook',
        placeholder: 'sales_ai_crm_whatsapp_verify_2026',
        sensitive: true,
      },
      { key: 'META_GRAPH_API_VERSION', label: 'Meta Graph Version', placeholder: 'v22.0' },
      { key: 'WHATSAPP_AUTO_REPLY_ENABLED', label: 'Auto-respuesta IA', placeholder: 'true' },
    ],
  },
  {
    id: 'ai',
    title: 'Gemini IA',
    description: 'Modelo principal y modelos de respaldo para los agentes.',
    fields: [
      { key: 'GEMINI_API_KEY', label: 'Gemini API Key', placeholder: 'AIza...', sensitive: true },
      { key: 'GEMINI_MODEL', label: 'Modelo principal', placeholder: 'gemini-3.5-flash' },
      {
        key: 'GEMINI_FALLBACK_MODELS',
        label: 'Modelos respaldo',
        placeholder: GEMINI_FALLBACK_MODELS,
      },
    ],
  },
  {
    id: 'supabase',
    title: 'Supabase',
    description: 'Base de datos, autenticación, storage y multiempresa.',
    fields: [
      { key: 'SUPABASE_URL', label: 'Supabase URL', placeholder: 'https://xxxxx.supabase.co' },
      { key: 'SUPABASE_ANON_KEY', label: 'Anon Key', placeholder: 'eyJ...', sensitive: true },
      {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        label: 'Service Role Key',
        placeholder: 'eyJ...',
        sensitive: true,
      },
      { key: 'SUPABASE_JWT_SECRET', label: 'JWT Secret', placeholder: 'secreto...', sensitive: true },
      { key: 'SUPABASE_STORAGE_BUCKET', label: 'Storage Bucket', placeholder: 'sales-ai-crm' },
    ],
  },
  {
    id: 'meta-google',
    title: 'Meta, Google y YouTube',
    description: 'Pauta, formularios, leads, video y audiencias.',
    fields: [
      { key: 'META_APP_ID', label: 'Meta App ID', placeholder: '1654488056297391' },
      { key: 'META_APP_SECRET', label: 'Meta App Secret', placeholder: 'app secret', sensitive: true },
      {
        key: 'META_PAGE_ACCESS_TOKEN',
        label: 'Page Access Token',
        placeholder: 'EAAG...',
        sensitive: true,
      },
      { key: 'META_AD_ACCOUNT_ID', label: 'Meta Ad Account ID', placeholder: 'act_...' },
      { key: 'INSTAGRAM_BUSINESS_ACCOUNT_ID', label: 'Instagram Business ID', placeholder: '1784...' },
      {
        key: 'GOOGLE_ADS_DEVELOPER_TOKEN',
        label: 'Google Ads Developer Token',
        placeholder: 'developer token',
        sensitive: true,
      },
      { key: 'GOOGLE_ADS_CLIENT_ID', label: 'Google Client ID', placeholder: 'client id' },
      {
        key: 'GOOGLE_ADS_CLIENT_SECRET',
        label: 'Google Client Secret',
        placeholder: 'client secret',
        sensitive: true,
      },
      {
        key: 'GOOGLE_ADS_REFRESH_TOKEN',
        label: 'Google Refresh Token',
        placeholder: 'refresh token',
        sensitive: true,
      },
      { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Google Ads Customer ID', placeholder: '0000000000' },
      { key: 'YOUTUBE_API_KEY', label: 'YouTube API Key', placeholder: 'AIza...', sensitive: true },
      { key: 'YOUTUBE_CHANNEL_ID', label: 'YouTube Channel ID', placeholder: 'UC...' },
    ],
  },
  {
    id: 'payments-fiscal',
    title: 'Pagos, pauta y DGII',
    description: 'Tarjeta de campañas, pasarelas, e-CF y notificaciones al dueño.',
    fields: [
      { key: 'AD_PAYMENT_PROVIDER', label: 'Proveedor tarjeta pauta', placeholder: 'stripe/azul/cardnet' },
      { key: 'AD_PAYMENT_PUBLIC_KEY', label: 'Pauta Public Key', placeholder: 'pk_...' },
      { key: 'AD_PAYMENT_SECRET_KEY', label: 'Pauta Secret Key', placeholder: 'sk_...', sensitive: true },
      {
        key: 'AD_PAYMENT_WEBHOOK_SECRET',
        label: 'Pauta Webhook Secret',
        placeholder: 'whsec_...',
        sensitive: true,
      },
      { key: 'META_ADS_BILLING_ACCOUNT_ID', label: 'Meta Billing Account', placeholder: 'billing id' },
      { key: 'GOOGLE_ADS_BILLING_SETUP_ID', label: 'Google Billing Setup', placeholder: 'billing setup id' },
      { key: 'PAYMENT_PROVIDER', label: 'Proveedor pagos', placeholder: 'stripe/azul/cardnet' },
      { key: 'PAYMENT_PUBLIC_KEY', label: 'Pagos Public Key', placeholder: 'pk_...' },
      { key: 'PAYMENT_SECRET_KEY', label: 'Pagos Secret Key', placeholder: 'sk_...', sensitive: true },
      {
        key: 'PAYMENT_WEBHOOK_SECRET',
        label: 'Pagos Webhook Secret',
        placeholder: 'whsec_...',
        sensitive: true,
      },
      { key: 'DGII_ECF_ENVIRONMENT', label: 'DGII ambiente e-CF', placeholder: 'production/certification' },
      { key: 'DGII_ECF_CERTIFICATE_PATH', label: 'Ruta certificado DGII', placeholder: '/etc/secrets/cert.p12' },
      {
        key: 'DGII_ECF_CERTIFICATE_PASSWORD',
        label: 'Clave certificado DGII',
        placeholder: 'password certificado',
        sensitive: true,
      },
      { key: 'DGII_ECF_ISSUER_RNC', label: 'RNC emisor', placeholder: '000000000' },
      { key: 'DGII_ECF_PROVIDER_API_KEY', label: 'API Key proveedor e-CF', placeholder: 'api key', sensitive: true },
      { key: 'OWNER_NOTIFICATION_WHATSAPP', label: 'WhatsApp dueño', placeholder: '1809...' },
      { key: 'OWNER_NOTIFICATION_EMAIL', label: 'Email dueño', placeholder: 'correo@dominio.com' },
    ],
  },
  {
    id: 'creative',
    title: 'Creativos IA',
    description: 'Proveedores para imágenes, flyers, videos y piezas publicitarias.',
    fields: [
      { key: 'IMAGE_GENERATION_PROVIDER', label: 'Proveedor imágenes', placeholder: 'openai/replicate/etc' },
      {
        key: 'IMAGE_GENERATION_API_KEY',
        label: 'API Key imágenes',
        placeholder: 'key',
        sensitive: true,
      },
      { key: 'VIDEO_GENERATION_PROVIDER', label: 'Proveedor video', placeholder: 'runway/veo/etc' },
      { key: 'VIDEO_GENERATION_API_KEY', label: 'API Key video', placeholder: 'key', sensitive: true },
    ],
  },
];

export const MultiTenantSettings: React.FC<MultiTenantSettingsProps> = ({
  organizations,
  currentOrg,
  currentUser,
  licensePlans,
  tenantLicenses,
  onOrgChange,
  onAddOrganization,
}) => {
  const [qrConnected, setQrConnected] = useState(true);
  const [newOrganizationName, setNewOrganizationName] = useState('');
  const [newOrganizationPlan, setNewOrganizationPlan] =
    useState<OrganizationTenant['plan']>('Business');
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeIntegrationStatus | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>(
    DEFAULT_PRODUCTION_CONFIG_VALUES,
  );
  const [adminPassword, setAdminPassword] = useState('');
  const [forceProduction, setForceProduction] = useState(true);
  const [redeployAfterSave, setRedeployAfterSave] = useState(true);
  const [isCheckingIntegrations, setIsCheckingIntegrations] = useState(false);
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false);
  const [configurationMessage, setConfigurationMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const currentLicense = tenantLicenses.find((license) => license.organizationId === currentOrg.id);
  const currentPlan = licensePlans.find((plan) => plan.id === currentLicense?.planId);
  const configuredGroupsCount =
    runtimeStatus?.groups.filter((group) => group.configured).length ?? 0;
  const missingEnvVarsCount =
    runtimeStatus?.groups.reduce((total, group) => total + group.missingEnvVars.length, 0) ?? 0;
  const productionStatusLabel = runtimeStatus
    ? runtimeStatus.deploymentMode === 'production' && missingEnvVarsCount === 0
      ? 'Producción completa'
      : runtimeStatus.deploymentMode === 'production'
        ? 'Producción pendiente credenciales'
        : 'Modo sandbox/demo'
    : 'Consultando...';
  const productionStatusClass =
    runtimeStatus?.deploymentMode === 'production' && missingEnvVarsCount === 0
      ? 'text-emerald-400'
      : 'text-amber-300';
  const importantMissingVars = useMemo(() => {
    if (!runtimeStatus) return [];
    return runtimeStatus.groups.flatMap((group) =>
      group.missingEnvVars.slice(0, 4).map((envVar) => `${group.name}: ${envVar}`),
    );
  }, [runtimeStatus]);

  const fetchIntegrationStatus = useCallback(async () => {
    setIsCheckingIntegrations(true);
    try {
      const response = await fetch('/api/integrations/status');
      if (!response.ok) {
        throw new Error('No se pudo consultar el estado de integraciones.');
      }

      const data = (await response.json()) as RuntimeIntegrationStatus;
      setRuntimeStatus(data);
      setConfigurationMessage(null);
    } catch (error) {
      setConfigurationMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo consultar el estado de integraciones.',
      });
    } finally {
      setIsCheckingIntegrations(false);
    }
  }, []);

  useEffect(() => {
    const statusCheckTimer = window.setTimeout(() => {
      void fetchIntegrationStatus();
    }, 0);

    return () => window.clearTimeout(statusCheckTimer);
  }, [fetchIntegrationStatus]);

  const updateConfigValue = (key: string, value: string) => {
    setConfigValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const loadRecommendedProductionValues = () => {
    setConfigValues((previous) => ({
      ...DEFAULT_PRODUCTION_CONFIG_VALUES,
      ...previous,
      APP_URL: previous.APP_URL || DEFAULT_PRODUCTION_CONFIG_VALUES.APP_URL,
      DEPLOYMENT_MODE: 'production',
      VITE_DEPLOYMENT_MODE: 'production',
      TRUST_PROXY: 'true',
      WHATSAPP_AUTO_REPLY_ENABLED: 'true',
      META_GRAPH_API_VERSION: 'v22.0',
      GEMINI_MODEL: previous.GEMINI_MODEL || DEFAULT_PRODUCTION_CONFIG_VALUES.GEMINI_MODEL,
      GEMINI_FALLBACK_MODELS:
        previous.GEMINI_FALLBACK_MODELS || DEFAULT_PRODUCTION_CONFIG_VALUES.GEMINI_FALLBACK_MODELS,
    }));
    setForceProduction(true);
    setConfigurationMessage({
      type: 'success',
      text: 'Valores recomendados de producción cargados. Ahora pega las credenciales reales.',
    });
  };

  const handleSaveProductionConfiguration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminPassword.trim()) {
      setConfigurationMessage({
        type: 'warning',
        text: 'Escribe tu contraseña de administrador para autorizar el guardado.',
      });
      return;
    }

    const variables = Object.fromEntries(
      Object.entries(configValues).filter(([, value]) => value.trim().length > 0),
    );

    setIsSavingConfiguration(true);
    try {
      const response = await fetch('/api/integrations/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminPassword,
          forceProduction,
          redeploy: redeployAfterSave,
          variables,
        }),
      });
      const data = (await response.json()) as IntegrationConfigureResponse;

      if (!response.ok || !data.success) {
        const failedVariables = data.renderPersistence?.failedVariables
          ?.map((item) => `${item.key}: ${item.error}`)
          .join(' · ');
        throw new Error(failedVariables || data.message || data.error || 'No se pudo guardar.');
      }

      setRuntimeStatus((previous) =>
        previous && data.groups
          ? {
              ...previous,
              deploymentMode: data.deploymentMode || previous.deploymentMode,
              renderPersistenceReady:
                data.renderPersistence?.attempted ?? previous.renderPersistenceReady,
              checkedAt: new Date().toISOString(),
              groups: data.groups,
            }
          : previous,
      );
      setConfigurationMessage({
        type: 'success',
        text: data.deploy?.success
          ? 'Configuración guardada en Render y redeploy iniciado. Espera a que Render termine.'
          : data.message || 'Configuración guardada. Revisa el estado de integraciones.',
      });
      setAdminPassword('');
      setConfigValues(DEFAULT_PRODUCTION_CONFIG_VALUES);
      void fetchIntegrationStatus();
    } catch (error) {
      setConfigurationMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo guardar la configuración.',
      });
    } finally {
      setIsSavingConfiguration(false);
    }
  };

  const handleAddOrganization = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = newOrganizationName.trim();
    if (!cleanName || !onAddOrganization) return;

    onAddOrganization(cleanName, newOrganizationPlan);
    setNewOrganizationName('');
    setNewOrganizationPlan('Business');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Settings className="w-3.5 h-3.5 text-cyan-300" />
            <span>Multiempresa, Seguridad & Aislamiento de Datos</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Configuración Multiempresa, Licencias & Permisos
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Administra empresas aisladas, planes de licencia, usuarios, roles, seguridad y
            conexiones comerciales configurables.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            Licencia activa de la empresa seleccionada
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">Plan</span>
              <p className="font-black text-white mt-1">{currentPlan?.name || 'Sin plan'}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">Mensualidad</span>
              <p className="font-black text-emerald-400 mt-1">
                RD${(currentLicense?.monthlyAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">Usuarios</span>
              <p className="font-black text-cyan-300 mt-1">
                {currentLicense?.seatsUsed || 0}/{currentLicense?.seatsLimit || 0}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">Renovación</span>
              <p className="font-black text-amber-300 mt-1">
                {currentLicense?.renewalDate || 'Pendiente'}
              </p>
            </div>
          </div>
          {currentLicense?.isFreeForever && (
            <div className="mt-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200">
              INTECA SRL tiene licencia abierta indefinida y para siempre. No se renueva, no vence y
              no se administra como cliente vendible.
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-cyan-400" />
            Aislamiento de datos
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400">Organización activa</span>
              <strong className="text-white">{currentOrg.name}</strong>
            </div>
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400">Usuario actual</span>
              <strong className="text-indigo-300">{currentUser.role}</strong>
            </div>
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400">Modo producción</span>
              <strong className={productionStatusClass}>{productionStatusLabel}</strong>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSaveProductionConfiguration}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5"
      >
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold">
              <Server className="w-3.5 h-3.5" />
              Configuración real de producción
            </div>
            <h2 className="text-xl font-black text-white">
              Credenciales, plataformas y modo producción desde el CRM
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl">
              Pega aquí las claves reales de Render, Supabase, Meta, WhatsApp, Gemini, Google,
              pagos, DGII y creativos IA. El servidor guarda solo las variables enviadas, no muestra
              secretos de vuelta y permite activar producción sin volver al panel de cada módulo.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs min-w-full xl:min-w-[520px]">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-black text-[10px]">Integraciones</span>
              <p className="text-white font-black mt-1">
                {configuredGroupsCount}/{runtimeStatus?.groups.length || 0}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-black text-[10px]">Faltantes</span>
              <p className="text-amber-300 font-black mt-1">{missingEnvVarsCount}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-black text-[10px]">Render API</span>
              <p
                className={`font-black mt-1 ${
                  runtimeStatus?.renderPersistenceReady ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {runtimeStatus?.renderPersistenceReady ? 'Listo' : 'Pendiente'}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-black text-[10px]">Modo</span>
              <p className={`font-black mt-1 ${productionStatusClass}`}>
                {runtimeStatus?.deploymentMode || '...'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Autorización del dueño
              </h3>
              <div className="space-y-2 text-xs">
                <label className="block text-slate-400 font-bold">
                  Correo administrador
                  <input
                    value={currentUser.email}
                    readOnly
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </label>
                <label className="block text-slate-400 font-bold">
                  Contraseña administrador
                  <input
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Confirma para guardar"
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    checked={forceProduction}
                    onChange={(event) => setForceProduction(event.target.checked)}
                    type="checkbox"
                    className="accent-blue-500"
                  />
                  Forzar modo producción
                </label>
                <label className="flex items-center gap-2">
                  <input
                    checked={redeployAfterSave}
                    onChange={(event) => setRedeployAfterSave(event.target.checked)}
                    type="checkbox"
                    className="accent-blue-500"
                  />
                  Iniciar redeploy en Render al guardar
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={loadRecommendedProductionValues}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl px-3 py-2 flex items-center justify-center gap-2"
                >
                  <Sliders className="w-4 h-4 text-cyan-300" />
                  Cargar valores recomendados
                </button>
                <button
                  type="button"
                  onClick={() => void fetchIntegrationStatus()}
                  disabled={isCheckingIntegrations}
                  className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-black rounded-xl px-3 py-2 flex items-center justify-center gap-2"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-emerald-300 ${
                      isCheckingIntegrations ? 'animate-spin' : ''
                    }`}
                  />
                  Revisar estado
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfiguration}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl px-3 py-3 flex items-center justify-center gap-2"
                >
                  {isSavingConfiguration ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar y activar conexiones
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Cloud className="w-4 h-4 text-cyan-300" />
                Rutas útiles
              </h3>
              <a
                href="https://dashboard.render.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-xs text-slate-300 hover:text-white"
              >
                Render Dashboard <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://developers.facebook.com/apps/1654488056297391"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-xs text-slate-300 hover:text-white"
              >
                Meta Developers INTECA <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://supabase.com/dashboard/projects"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-xs text-slate-300 hover:text-white"
              >
                Supabase Projects <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://ads.google.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between text-xs text-slate-300 hover:text-white"
              >
                Google Ads <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {importantMissingVars.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-100 space-y-2">
                <h3 className="font-black flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Faltantes principales
                </h3>
                {importantMissingVars.slice(0, 8).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {configurationMessage && (
              <div
                className={`rounded-xl border p-3 text-xs font-semibold ${
                  configurationMessage.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                    : configurationMessage.type === 'warning'
                      ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                }`}
              >
                {configurationMessage.text}
              </div>
            )}

            {PRODUCTION_CONFIG_SECTIONS.map((section, index) => (
              <details
                key={section.id}
                open={index < 4}
                className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden"
              >
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-black text-white flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-300" />
                    {section.title}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    {section.fields.length} variables
                  </span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-[11px] text-slate-400">{section.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {section.fields.map((field) => {
                      const group = runtimeStatus?.groups.find((item) =>
                        item.requiredEnvVars.includes(field.key),
                      );
                      const isConfigured = group?.configuredEnvVars.includes(field.key);
                      const isMissing = group?.missingEnvVars.includes(field.key);

                      return (
                        <label key={field.key} className="block text-xs">
                          <span className="flex items-center justify-between gap-2 text-slate-400 font-bold">
                            <span>{field.label}</span>
                            <span
                              className={`text-[10px] ${
                                isConfigured
                                  ? 'text-emerald-400'
                                  : isMissing
                                    ? 'text-amber-300'
                                    : 'text-slate-600'
                              }`}
                            >
                              {isConfigured ? 'Configurada' : isMissing ? 'Falta' : 'Opcional'}
                            </span>
                          </span>
                          <div className="relative mt-1">
                            <input
                              value={configValues[field.key] || ''}
                              onChange={(event) => updateConfigValue(field.key, event.target.value)}
                              type={field.sensitive ? 'password' : 'text'}
                              placeholder={field.placeholder || field.key}
                              autoComplete="off"
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pr-9 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                            />
                            {field.sensitive && (
                              <EyeOff className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                            )}
                          </div>
                          {field.helper && (
                            <p className="text-[10px] text-slate-500 mt-1">{field.helper}</p>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] text-slate-400 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-2">
            <Rocket className="w-4 h-4 text-blue-300 mt-0.5" />
            <span>
              Flujo recomendado: pega credenciales, guarda, espera el redeploy, pulsa “Revisar
              estado” y prueba WhatsApp/Meta/Gemini con un lead real. Si falta Render API, el CRM
              aplica los cambios al proceso actual, pero no sobreviven a reinicios.
            </span>
          </div>
          <span className="text-slate-500 font-bold">
            Webhook WhatsApp: {runtimeStatus?.appUrl || DEFAULT_PRODUCTION_CONFIG_VALUES.APP_URL}
            /api/webhooks/meta/whatsapp
          </span>
        </div>
      </form>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-Tenant Institutions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              Empresas / Clientes Registrados
            </h2>
            <span className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1 font-bold">
              INTECA lista · clientes nuevos aquí
            </span>
          </div>

          {onAddOrganization && (
            <form
              onSubmit={handleAddOrganization}
              className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <PlusCircle className="w-4 h-4 text-cyan-300" />
                Registrar nueva empresa para licencia CRM
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_190px_auto] gap-3">
                <input
                  value={newOrganizationName}
                  onChange={(event) => setNewOrganizationName(event.target.value)}
                  placeholder="Nombre de la empresa o cliente"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
                <select
                  value={newOrganizationPlan}
                  onChange={(event) =>
                    setNewOrganizationPlan(event.target.value as OrganizationTenant['plan'])
                  }
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Business" className="bg-slate-900">
                    Business
                  </option>
                  <option value="Pro" className="bg-slate-900">
                    Pro
                  </option>
                  <option value="Enterprise Autonomous AI" className="bg-slate-900">
                    Enterprise IA
                  </option>
                </select>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl px-4 py-2"
                >
                  Crear empresa
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Esto crea un entorno aislado para vender o administrar el CRM a otra empresa. INTECA
                SRL permanece con licencia abierta indefinida fuera de la gestión comercial de
                licencias.
              </p>
            </form>
          )}

          <div className="space-y-3">
            {organizations.map((org) => {
              const isSelected = org.id === currentOrg.id;

              return (
                <div
                  key={org.id}
                  onClick={() => onOrgChange(org)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-950 border-blue-500 ring-1 ring-blue-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{org.logo}</span>
                    <div>
                      <h3 className="font-bold text-sm text-white">{org.name}</h3>
                      <span className="text-[10px] text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                        Plan base: {org.plan}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-400">
                    <div>
                      Leads:{' '}
                      <strong className="text-white">
                        {org.activeLeadsCount.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      Usuarios: <strong className="text-indigo-400">{org.activeUsers}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* WhatsApp QR Connection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-400" />
            Estado de Canales e Integraciones
          </h2>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-xs text-white">WhatsApp Business por empresa</span>
                <p className="text-[11px] text-slate-400">
                  QR/API configurable según credenciales reales del cliente
                </p>
              </div>
            </div>

            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
              ● {qrConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          {/* Security details */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>Encriptación en Reposo:</span>
              <strong className="text-emerald-400">AES-256 Habilitado</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Autenticación de Dos Factores (MFA):</span>
              <strong className="text-emerald-400">Requerido Obligatorio</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Integraciones externas:</span>
              <strong className={missingEnvVarsCount === 0 ? 'text-emerald-400' : 'text-amber-300'}>
                {missingEnvVarsCount === 0
                  ? 'Configuradas'
                  : `${missingEnvVarsCount} variables pendientes`}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Planes vendibles del CRM
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {licensePlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black text-white text-sm">{plan.name}</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                      plan.status === 'Vendible'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {plan.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{plan.targetSegment}</p>
              </div>
              <div>
                <span className="text-2xl font-black text-emerald-400">
                  RD${plan.monthlyPrice.toLocaleString()}
                </span>
                <span className="text-slate-500 text-xs"> / mes</span>
              </div>
              <div className="space-y-1">
                {plan.features.slice(0, 4).map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
