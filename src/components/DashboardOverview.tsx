import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Bot,
  Zap,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Award,
  MessageCircle,
  BrainCircuit,
  ShieldCheck,
  Target,
} from 'lucide-react';
import {
  Lead,
  AIAgentSpec,
  PaymentTransaction,
  Course,
  SalesOpportunity,
  CommercialQuote,
  ElectronicInvoice,
  TenantLicense,
} from '../types';

interface DashboardOverviewProps {
  leads: Lead[];
  agents: AIAgentSpec[];
  transactions: PaymentTransaction[];
  courses: Course[];
  opportunities: SalesOpportunity[];
  quotes: CommercialQuote[];
  electronicInvoices: ElectronicInvoice[];
  tenantLicenses: TenantLicense[];
  onNavigateToLeads: () => void;
  onNavigateToAgents: () => void;
  onNavigateToChat: () => void;
  onNavigateToMarketing: () => void;
  deploymentMode?: 'production' | 'trial';
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  leads,
  agents,
  transactions,
  courses,
  opportunities,
  quotes,
  electronicInvoices,
  tenantLicenses,
  onNavigateToLeads,
  onNavigateToAgents,
  onNavigateToChat,
  onNavigateToMarketing,
  deploymentMode = 'production',
}) => {
  const isTrialMode = deploymentMode === 'trial';
  const totalRevenue = transactions.reduce(
    (sum, t) => sum + (t.status === 'Completado' ? t.amount : 0),
    0,
  );
  const totalLeadsCount = leads.length;
  const openPipeline = opportunities
    .filter((opp) => !['Ganado', 'Perdido'].includes(opp.stage))
    .reduce((sum, opp) => sum + opp.quotedAmount, 0);
  const acceptedQuotes = quotes.filter((quote) => quote.status === 'Aceptada').length;
  const pendingFiscalInvoices = electronicInvoices.filter(
    (invoice) => invoice.dgiiStatus !== 'Aceptada',
  ).length;
  const paidLicensesMRR = tenantLicenses.reduce((sum, license) => sum + license.monthlyAmount, 0);
  const formatCoursePrice = (course: Course) => {
    if (course.price > 0 && course.discountPrice && course.discountPrice !== course.price) {
      return {
        regular: `RD$${course.price.toLocaleString()}`,
        primary: `RD$${course.discountPrice.toLocaleString()}`,
      };
    }

    if (course.price > 0) {
      return {
        regular: '',
        primary: `RD$${course.price.toLocaleString()}`,
      };
    }

    return {
      regular: '',
      primary: course.activePromotions?.join(' · ') || 'Precio pendiente de confirmar',
    };
  };
  const hasOperationalActivity =
    leads.length > 0 ||
    transactions.length > 0 ||
    opportunities.length > 0 ||
    quotes.length > 0 ||
    electronicInvoices.length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 overflow-y-auto max-w-7xl mx-auto">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <Sparkles
                className="w-3.5 h-3.5 text-cyan-300 animate-spin"
                style={{ animationDuration: '5s' }}
              />
              <span>
                CRM comercial multiempresa · {isTrialMode ? 'Modo prueba' : 'Versión original'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Panel Ejecutivo de Inteligencia Comercial
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Plataforma configurable para administrar prospectos, productos, servicios y ventas.
              {isTrialMode
                ? ' Estás viendo un entorno de prueba seguro para ensayar campañas, agentes y cobros.'
                : ' Entorno principal listo para operar y conectar integraciones externas reales.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onNavigateToChat}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Ver Chat en Vivo</span>
            </button>
            <button
              onClick={onNavigateToMarketing}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Lanzar Campaña IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-blue-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isTrialMode ? 'Cobros de Prueba' : 'Cobros Confirmados'}
            </span>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">
              RD${totalRevenue.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                {isTrialMode
                  ? 'Pagos simulados sin pasarela real conectada'
                  : 'Pagos registrados y listos para conciliación'}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Leads Capturados
            </span>
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">
              {totalLeadsCount.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Omnicanal: Meta, Google, WhatsApp, TikTok</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Pipeline Comercial Abierto
            </span>
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">
              RD${openPipeline.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-purple-300 font-medium mt-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {opportunities.length} oportunidades · {acceptedQuotes} cotización aceptada
              </span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Licencias SaaS Mensuales
            </span>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">
              RD${paidLicensesMRR.toLocaleString()}
            </span>
            <div className="text-xs text-slate-400 font-medium mt-2">
              {tenantLicenses.length} tenants · INTECA marcado gratis permanente
            </div>
          </div>
        </div>
      </div>

      {/* Commercial Product Flow */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Flujo comercial completo del CRM
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              El CRM separa embudo, cotización, factura electrónica, cobro, seguimiento y licencias
              por empresa.
            </p>
          </div>
          <button
            onClick={onNavigateToLeads}
            className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold px-4 py-2 rounded-xl"
          >
            Ver prospectos y oportunidades
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
          {[
            { title: '1. Lead', value: `${totalLeadsCount} capturados`, tone: 'text-blue-300' },
            {
              title: '2. Oportunidad',
              value: `RD$${openPipeline.toLocaleString()}`,
              tone: 'text-purple-300',
            },
            { title: '3. Cotización', value: `${quotes.length} emitidas`, tone: 'text-amber-300' },
            {
              title: '4. Factura e-CF',
              value: `${electronicInvoices.length} e-CF`,
              tone: 'text-cyan-300',
            },
            {
              title: '5. Cobro',
              value: `RD$${totalRevenue.toLocaleString()}`,
              tone: 'text-emerald-300',
            },
            {
              title: '6. Reporte',
              value: `${pendingFiscalInvoices} pendientes DGII`,
              tone: 'text-rose-300',
            },
          ].map((step) => (
            <div key={step.title} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">{step.title}</span>
              <p className={`font-black mt-1 ${step.tone}`}>{step.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Middle Grid: Active Agents & Live Autonomous Log Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Multi-Agents Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-bold text-white">Equipo de Agentes IA Comerciales</h2>
              </div>
              <button
                onClick={onNavigateToAgents}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                Ver Todos →
              </button>
            </div>

            <div className="space-y-3">
              {agents.map((ag) => (
                <div
                  key={ag.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={ag.avatar}
                      alt={ag.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/40"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">{ag.name}</span>
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                          {ag.specialty}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{ag.roleTitle}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-400">
                      {ag.stats.dealsClosed} cierres
                    </span>
                    <p className="text-[10px] text-slate-500">
                      {ag.stats.conversionRatePercent}% conv.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Disponibilidad: <strong className="text-emerald-400">24/7 configurable</strong>
            </span>
            <span className="text-cyan-400 font-semibold">{agents.length} especialistas</span>
          </div>
        </div>

        {/* Live Autonomous Feed / Activity */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
              <h2 className="text-base font-bold text-white">Feed de Operaciones Comerciales</h2>
            </div>
            <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
              {isTrialMode ? 'Datos de prueba' : 'Datos operativos'} · WebSockets pendiente
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {!isTrialMode && !hasOperationalActivity ? (
              <>
                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-300">
                        INTECA SRL lista para operación real
                      </span>
                      <span className="text-[10px] text-slate-500">Producción</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Empresa principal, catálogo de cursos, agentes IA, embudos, facturación,
                      contabilidad y auditoría están preparados. Aún no hay leads, cobros ni ventas
                      reales registrados.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-blue-500/30 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg mt-0.5">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-300">
                        Canales listos para conectar datos reales
                      </span>
                      <span className="text-[10px] text-slate-500">Integraciones</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      WhatsApp Cloud API, Meta Lead Ads, Google Ads, formularios, YouTube y
                      pasarelas quedan preparados para alimentar el CRM cuando sus credenciales y
                      webhooks estén activos.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg mt-0.5">
                    <BrainCircuit className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-purple-300">
                        Agentes IA activos con operación real
                      </span>
                      <span className="text-[10px] text-slate-500">24/7</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Los agentes están listos para responder, vender, crear campañas, generar
                      flyers, preparar videos, gestionar lanzamientos, facturación e informes. Las
                      métricas empiezan en cero hasta recibir operación real.
                    </p>
                  </div>
                </div>
              </>
            ) : isTrialMode ? (
              <>
                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-300">
                        Venta Cerrada & Factura e-CF Emitida
                      </span>
                      <span className="text-[10px] text-slate-500">Hace 2 minutos</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Agente <strong className="text-white">Valeria Sotomayor</strong> llevó a{' '}
                      <strong className="text-cyan-300">Alejandro Gómez</strong> hasta pago recibido
                      por <span className="text-amber-300">Técnico en Autorizaciones Médicas</span>.
                      El sistema exige validación antes de matricular.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Recibo: REC-INTECA-2026-0001
                      </span>
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-amber-400">
                        Validación pendiente
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-blue-500/30 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg mt-0.5">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-300">
                        Respuesta por WhatsApp + Audio IA Enviado
                      </span>
                      <span className="text-[10px] text-slate-500">Hace 8 minutos</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Agente <strong className="text-white">Mateo WhatsApp Pro</strong> respondió
                      consulta por WhatsApp con audio, pensum, beneficios laborales y próximo paso
                      de inscripción.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg mt-0.5">
                    <BrainCircuit className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-purple-300">
                        Calificación Predictiva de Lead (Score 96/100)
                      </span>
                      <span className="text-[10px] text-slate-500">Hace 14 minutos</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      El motor predictivo clasificó un prospecto con perfil{' '}
                      <strong className="text-purple-300">analítico</strong> y sugirió enviar
                      funciones del técnico, campo laboral y prueba social autorizada.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {transactions.slice(0, 1).map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-300">
                          Cobro registrado en producción
                        </span>
                        <span className="text-[10px] text-slate-500">{tx.status}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {tx.leadName} · {tx.courseTitle} · RD${tx.amount.toLocaleString()}.
                      </p>
                    </div>
                  </div>
                ))}

                {leads.slice(0, 1).map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-slate-950/80 border border-blue-500/30 rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg mt-0.5">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-blue-300">Lead real capturado</span>
                        <span className="text-[10px] text-slate-500">{lead.source}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {lead.firstName} {lead.lastName} · {lead.phone || lead.email} · etapa{' '}
                        {lead.stageId}.
                      </p>
                    </div>
                  </div>
                ))}

                {electronicInvoices.slice(0, 1).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg mt-0.5">
                      <BrainCircuit className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-purple-300">
                          e-CF registrado para revisión
                        </span>
                        <span className="text-[10px] text-slate-500">{invoice.dgiiStatus}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {invoice.customerName} · {invoice.eNcf} · RD$
                        {invoice.total.toLocaleString()}.
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Courses Summary Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Catálogo de Productos, Servicios y Programas
            </h2>
          </div>
          <span className="text-xs text-slate-400">Catálogo configurable por empresa</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {courses.map((crs) => {
            const price = formatCoursePrice(crs);

            return (
              <div
                key={crs.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/40 transition-all"
              >
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    {crs.category}
                  </span>
                  <h3 className="font-bold text-xs sm:text-sm text-white mt-2 line-clamp-2">
                    {crs.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{crs.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    {price.regular && (
                      <span className="text-xs text-slate-500 line-through mr-1.5">
                        {price.regular}
                      </span>
                    )}
                    <span className="text-sm font-black text-emerald-400">{price.primary}</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                    {crs.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
