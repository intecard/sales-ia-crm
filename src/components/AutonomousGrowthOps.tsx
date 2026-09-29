import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Plug,
  ShieldCheck,
  Sparkles,
  Target,
  Video,
  Workflow,
  Zap,
} from 'lucide-react';
import {
  AIAgentSpec,
  Course,
  CreativeAsset,
  ExternalIntegration,
  LaunchCampaignPlan,
  OwnerActionNotification,
} from '../types';

interface AutonomousGrowthOpsProps {
  integrations: ExternalIntegration[];
  creativeAssets: CreativeAsset[];
  launchPlans: LaunchCampaignPlan[];
  ownerActions: OwnerActionNotification[];
  agents: AIAgentSpec[];
  courses: Course[];
}

const statusTone = (status: string) => {
  if (status === 'Conectado') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (status === 'Webhook preparado')
    return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  if (status === 'Modo demo') return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  if (status === 'Producción pendiente')
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (status === 'Listo para conectar')
    return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
};

const priorityTone = (priority: OwnerActionNotification['priority']) => {
  if (priority === 'Alta') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  if (priority === 'Media') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-slate-700/50 text-slate-300 border-slate-600';
};

export const AutonomousGrowthOps: React.FC<AutonomousGrowthOpsProps> = ({
  integrations,
  creativeAssets,
  launchPlans,
  ownerActions,
  agents,
  courses,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [launchDate, setLaunchDate] = useState('2026-10-15');
  const [relaunchDate, setRelaunchDate] = useState('2026-10-28');
  const [budgetDop, setBudgetDop] = useState(1000);
  const [dailyGoal, setDailyGoal] = useState(5);
  const [preparedPlan, setPreparedPlan] = useState<string[] | null>(null);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || courses[0];
  const agentById = useMemo(
    () => Object.fromEntries(agents.map((agent) => [agent.id, agent])),
    [agents],
  );
  const courseById = useMemo(
    () => Object.fromEntries(courses.map((course) => [course.id, course])),
    [courses],
  );

  const connectedLikeCount = integrations.filter((item) =>
    ['Conectado', 'Webhook preparado', 'Listo para conectar'].includes(item.status),
  ).length;
  const pendingCredentialCount = integrations.filter(
    (item) => item.status === 'Requiere credenciales',
  ).length;

  const prepareLaunchPlan = () => {
    const title = selectedCourse?.title || 'Curso seleccionado';
    setPreparedPlan([
      `Campaña de adquisición para ${title}: Meta Ads, Google Ads y video corto hacia WhatsApp.`,
      `Fecha de lanzamiento: ${launchDate}. Relanzamiento: ${relaunchDate || 'sin definir'}.`,
      `Presupuesto de prueba: RD$${budgetDop.toLocaleString()} con meta mínima de ${dailyGoal} ventas diarias.`,
      'Agentes asignados: Lanzamientos planifica, Publicidad pauta, Creativos diseña flyers, Video Ads prepara guiones y Ventas cierra.',
      'Avisos al dueño: pagos confirmados, llamadas de alta probabilidad, bloqueos fiscales y campañas listas.',
    ]);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Workflow className="w-3.5 h-3.5" />
            <span>Operación Autónoma Omnicanal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            CRM listo para redes, anuncios, creativos, cobros y lanzamientos
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Esta cabina deja preparados los conectores y agentes para que el sistema responda,
            promueva, venda, facture en modo controlado y te notifique solo pagos, llamadas o
            bloqueos importantes.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs w-full lg:w-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-500 uppercase font-black text-[10px]">Preparados</span>
            <p className="text-xl font-black text-emerald-400 mt-1">{connectedLikeCount}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-500 uppercase font-black text-[10px]">
              Por credenciales
            </span>
            <p className="text-xl font-black text-amber-300 mt-1">{pendingCredentialCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Canales sociales',
            value: 'Meta, WhatsApp, Google, YouTube',
            icon: MessageSquare,
            tone: 'text-cyan-300',
          },
          {
            label: 'Fábrica creativa',
            value: 'Flyers + videos 30-60s',
            icon: Sparkles,
            tone: 'text-purple-300',
          },
          {
            label: 'Cobros y e-CF',
            value: 'Pagos + facturación',
            icon: CreditCard,
            tone: 'text-emerald-400',
          },
          {
            label: 'Dueño informado',
            value: 'Pagos, llamadas y bloqueos',
            icon: PhoneCall,
            tone: 'text-amber-300',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-500 font-black tracking-wider">
                  {item.label}
                </span>
                <Icon className={`w-5 h-5 ${item.tone}`} />
              </div>
              <p className={`text-sm font-black mt-3 ${item.tone}`}>{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plug className="w-4 h-4 text-cyan-300" />
                Conectores externos preparados
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Cuando tengamos credenciales, estas rutas y variables son las que se conectan.
              </p>
            </div>
            <span className="text-xs text-slate-400">{integrations.length} integraciones</span>
          </div>

          <div className="divide-y divide-slate-800">
            {integrations.map((integration) => {
              const ownerAgent = agentById[integration.ownerAgentId];
              return (
                <div key={integration.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{integration.name}</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTone(
                            integration.status,
                          )}`}
                        >
                          {integration.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {integration.outboundCapability}
                      </p>
                      {integration.inboundWebhookPath && (
                        <p className="text-[11px] text-cyan-300 font-mono mt-2">
                          {integration.inboundWebhookPath}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 lg:text-right">
                      <span className="block text-slate-500 uppercase font-black text-[10px]">
                        Responsable
                      </span>
                      <strong className="text-indigo-300">{ownerAgent?.name || 'Agente IA'}</strong>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {integration.requiredEnvVars.map((envVar) => (
                      <span
                        key={envVar}
                        className="text-[10px] bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded font-mono"
                      >
                        {envVar}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-300" />
              Programar lanzamiento
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Define fechas y el CRM prepara cadencia, creativos, pauta, cierre y relanzamiento.
            </p>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Curso</label>
                <select
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Lanzamiento</label>
                  <input
                    type="date"
                    value={launchDate}
                    onChange={(event) => setLaunchDate(event.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Relanzamiento</label>
                  <input
                    type="date"
                    value={relaunchDate}
                    onChange={(event) => setRelaunchDate(event.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Pauta RD$</label>
                  <input
                    type="number"
                    value={budgetDop}
                    onChange={(event) => setBudgetDop(Number(event.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Ventas/día</label>
                  <input
                    type="number"
                    value={dailyGoal}
                    onChange={(event) => setDailyGoal(Number(event.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={prepareLaunchPlan}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                Preparar plan con agentes IA
              </button>
            </div>

            {preparedPlan && (
              <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                {preparedPlan.map((step) => (
                  <div key={step} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-300" />
              Reglas para no saturarte
            </h2>
            <div className="space-y-2 mt-3 text-xs">
              {[
                'Notificar pago confirmado con cliente, curso, monto y factura.',
                'Notificar llamada solo si el lead está caliente o bloqueado por confianza.',
                'Escalar descuentos fuera de política y facturas fiscales rechazadas.',
                'Ocultar ruido operativo: dudas simples, seguimientos y leads fríos los manejan agentes.',
              ].map((rule) => (
                <div key={rule} className="flex items-start gap-2 text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-300" />
              Flyers, imágenes y videos listos para generar
            </h2>
            <span className="text-xs text-slate-400">{creativeAssets.length} briefs</span>
          </div>

          <div className="space-y-4">
            {creativeAssets.map((asset) => {
              const course = courseById[asset.courseId];
              const ownerAgent = agentById[asset.assignedAgentId];
              return (
                <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {asset.type.includes('Video') ? (
                          <Video className="w-4 h-4 text-rose-300" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-purple-300" />
                        )}
                        <h3 className="text-sm font-bold text-white">{asset.title}</h3>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{course?.title}</p>
                    </div>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                      {asset.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-3">{asset.campaignObjective}</p>
                  <div className="mt-3 space-y-2">
                    {asset.copyBlocks.map((copy) => (
                      <div key={copy} className="flex items-start gap-2 text-xs text-slate-300">
                        <Megaphone className="w-3.5 h-3.5 text-amber-300 mt-0.5 flex-shrink-0" />
                        <span>{copy}</span>
                      </div>
                    ))}
                  </div>

                  {asset.imagePrompt && (
                    <div className="mt-3 bg-slate-900 border border-slate-800 rounded-lg p-3">
                      <span className="text-[10px] text-cyan-300 font-bold uppercase">
                        Prompt de imagen
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        {asset.imagePrompt}
                      </p>
                    </div>
                  )}

                  {asset.videoScript && (
                    <div className="mt-3 bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] text-rose-300 font-bold uppercase">
                        Guion de video
                      </span>
                      {asset.videoScript.map((line) => (
                        <p key={line} className="text-[11px] text-slate-300">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 mt-3">
                    Responsable: <strong className="text-indigo-300">{ownerAgent?.name}</strong>
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-emerald-400" />
              Planes de lanzamiento activos
            </h2>
            <div className="space-y-4">
              {launchPlans.map((plan) => {
                const course = courseById[plan.courseId];
                return (
                  <div key={plan.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">{plan.launchName}</h3>
                        <p className="text-[11px] text-slate-400 mt-1">{course?.title}</p>
                      </div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                        {plan.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                        <Clock className="w-3.5 h-3.5 text-amber-300 mb-1" />
                        <span className="text-slate-500 uppercase font-bold text-[10px]">
                          Lanzamiento
                        </span>
                        <p className="text-white font-black">{plan.launchDate}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                        <Zap className="w-3.5 h-3.5 text-cyan-300 mb-1" />
                        <span className="text-slate-500 uppercase font-bold text-[10px]">
                          Meta
                        </span>
                        <p className="text-white font-black">
                          {plan.dailySalesGoal}/día · RD${plan.budgetDop.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {plan.channels.map((channel) => (
                        <span
                          key={channel}
                          className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-1 rounded"
                        >
                          {channel}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 space-y-1">
                      {plan.automationCadence.map((step) => (
                        <p key={step} className="text-[11px] text-slate-400">
                          {step}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <PhoneCall className="w-4 h-4 text-amber-300" />
              Notificaciones para el dueño
            </h2>
            <div className="space-y-3">
              {ownerActions.map((action) => {
                const ownerAgent = agentById[action.assignedAgentId];
                return (
                  <div key={action.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityTone(
                              action.priority,
                            )}`}
                          >
                            {action.priority}
                          </span>
                          <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded">
                            {action.type}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white mt-2">{action.title}</h3>
                      </div>
                      {action.type === 'Pago recibido' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : action.type === 'Factura pendiente' ? (
                        <FileText className="w-5 h-5 text-cyan-300" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-300" />
                      )}
                    </div>

                    {(action.leadName || action.leadPhone || action.leadEmail) && (
                      <div className="mt-3 bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
                        <p className="text-white font-bold">{action.leadName || 'Cliente pendiente'}</p>
                        <p className="text-slate-400">{action.leadPhone || 'Sin teléfono'}</p>
                        <p className="text-slate-500">{action.leadEmail || 'Sin correo'}</p>
                      </div>
                    )}

                    <p className="text-xs text-slate-300 mt-3">{action.recommendedAction}</p>
                    <p className="text-[11px] text-slate-500 mt-2">
                      {action.dueAt} · Responsable:{' '}
                      <strong className="text-indigo-300">{ownerAgent?.name}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
