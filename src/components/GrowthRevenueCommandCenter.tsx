import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  DollarSign,
  Flame,
  Megaphone,
  MessageSquareText,
  Rocket,
  Sparkles,
  Target,
  Workflow,
  Zap,
} from 'lucide-react';
import { AIAgentSpec, Course } from '../types';

interface GrowthRevenueCommandCenterProps {
  agents: AIAgentSpec[];
  courses: Course[];
}

const formatMoney = (amount: number, currency = 'DOP') =>
  `${currency === 'DOP' ? 'RD$' : '$'}${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const expertAgentIds = [
  'agent_growth_master',
  'agent_media_buyer',
  'agent_funnel_architect',
  'agent_copywriter',
  'agent_sdr',
  'agent_sales_elite',
  'agent_cro_analytics',
  'agent_closer',
  'agent_omnichannel',
];

export const GrowthRevenueCommandCenter: React.FC<GrowthRevenueCommandCenterProps> = ({
  agents,
  courses,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [targetMarket, setTargetMarket] = useState(
    'Personas que quieren mejorar sus ingresos, empleabilidad o resultados comerciales con una solución práctica',
  );
  const [offerPromise, setOfferPromise] = useState(
    'Transformar una necesidad urgente en una decisión de compra clara, confiable y fácil de pagar',
  );
  const [adBudget, setAdBudget] = useState(1000);
  const [dailySalesGoal, setDailySalesGoal] = useState(5);
  const [closeRatePercent, setCloseRatePercent] = useState(12);
  const [bottleneck, setBottleneck] = useState(
    'El prospecto pregunta, muestra interés y luego se enfría porque no recibe seguimiento, prueba de valor y cierre a tiempo',
  );
  const [preparedSystem, setPreparedSystem] = useState<string[] | null>(null);
  const [aiSystem, setAiSystem] = useState<Record<string, unknown> | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState('');

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || courses[0];
  const basePrice = selectedCourse?.discountPrice || selectedCourse?.price || 0;
  const requiredQualifiedLeads = Math.ceil(dailySalesGoal / Math.max(closeRatePercent / 100, 0.01));
  const dailyRevenueGoal = dailySalesGoal * basePrice;
  const targetRoas = adBudget > 0 ? dailyRevenueGoal / adBudget : 0;

  const expertAgents = useMemo(
    () => expertAgentIds.map((id) => agents.find((agent) => agent.id === id)).filter(Boolean),
    [agents],
  ) as AIAgentSpec[];

  const prepareMasterSystem = () => {
    const productName = selectedCourse?.title || 'producto o servicio seleccionado';
    setPreparedSystem([
      `Oferta central: ${productName}. Promesa permitida: ${offerPromise}.`,
      `Nicho objetivo: ${targetMarket}. Mensaje: dolor urgente + beneficio concreto + siguiente paso simple.`,
      `Embudo: anuncio/short/flyer -> WhatsApp/landing -> diagnóstico -> prueba de valor -> oferta -> pago -> onboarding -> referidos.`,
      `Meta: ${dailySalesGoal} ventas diarias. Leads calificados requeridos: ${requiredQualifiedLeads}/día con tasa de cierre ${closeRatePercent}%.`,
      `Pauta inicial: ${formatMoney(adBudget)}. Ingreso objetivo diario: ${formatMoney(dailyRevenueGoal)}. ROAS objetivo aproximado: ${targetRoas.toFixed(1)}x.`,
      `Cuello de botella a romper: ${bottleneck}. Acción: seguimiento inmediato, secuencia 24/72h y cierre por valor.`,
      'Dueño recibe solo: pagos, llamadas de alta probabilidad, bloqueos operativos y campañas listas para aprobar.',
    ]);
  };

  const generateAiGrowthSystem = async () => {
    setIsGeneratingAi(true);
    setAiError('');
    setAiSystem(null);
    prepareMasterSystem();

    try {
      const response = await fetch('/api/ai/generate-growth-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'INTECA',
          productName: selectedCourse?.title || 'producto o servicio seleccionado',
          targetMarket,
          offerPromise,
          adBudget,
          dailySalesGoal,
          closeRatePercent,
          bottleneck,
          channels: ['Meta Ads', 'Google Ads', 'YouTube', 'WhatsApp', 'Email', 'Landing Page'],
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo generar el sistema de crecimiento.');
      }

      setAiSystem(data.growthSystem || data);
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : 'No se pudo generar el sistema IA. Revisa la configuración de Gemini.',
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const funnelStages = [
    {
      title: 'Atracción',
      detail: 'Hooks, anuncios, shorts, flyers y contenidos que detienen el scroll.',
      owner: 'Marco Media Buyer',
    },
    {
      title: 'Captura',
      detail: 'WhatsApp, formularios, landing y QR con UTM y consentimiento.',
      owner: 'Nora Omnicanal',
    },
    {
      title: 'Calificación',
      detail: 'Necesidad, urgencia, presupuesto, autoridad, objeciones y score.',
      owner: 'Selena SDR Pro',
    },
    {
      title: 'Conversión',
      detail: 'Prueba de valor, oferta, guion, objeciones, cierre y enlace de pago.',
      owner: 'Héctor Closer Elite',
    },
    {
      title: 'Aceleración',
      detail: 'Duplicar ganadores, retargeting, referidos, upsell y reactivación.',
      owner: 'Ana CRO Analytics',
    },
  ];

  const arsenal = [
    {
      title: 'Investigación de mercado',
      icon: BrainCircuit,
      tools: ['Avatar', 'dolor', 'deseo', 'competencia', 'objeciones', 'oportunidad'],
    },
    {
      title: 'Oferta irresistible',
      icon: Flame,
      tools: ['promesa permitida', 'bonos', 'urgencia', 'garantías éticas', 'precio'],
    },
    {
      title: 'Publicidad agresiva',
      icon: Megaphone,
      tools: ['Meta Ads', 'Google Ads', 'YouTube', 'TikTok', 'retargeting'],
    },
    {
      title: 'Embudo completo',
      icon: Workflow,
      tools: ['landing', 'WhatsApp', 'email', 'CRM', 'seguimiento', 'pagos'],
    },
    {
      title: 'Ventas optimizadas',
      icon: MessageSquareText,
      tools: ['scripts', 'objeciones', 'cierres', 'negociación', 'agenda'],
    },
    {
      title: 'Escala y analítica',
      icon: BarChart3,
      tools: ['CPL', 'CAC', 'ROAS', 'tasa cierre', 'A/B test', 'LTV'],
    },
  ];

  const objectionMap = [
    {
      objection: 'Está caro',
      response: 'Reencuadrar contra costo de no resolver el problema y dividir por beneficio/tiempo.',
    },
    {
      objection: 'Lo pensaré',
      response: 'Preguntar qué falta para decidir y llevar a microcompromiso: llamada, prueba o pago mínimo.',
    },
    {
      objection: 'No tengo tiempo',
      response: 'Mostrar modalidad, ahorro futuro y plan de inicio simple sin fricción.',
    },
    {
      objection: 'No confío todavía',
      response: 'Usar autoridad, proceso claro, evidencia autorizada, auditoría y siguiente paso reversible.',
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Rocket className="w-3.5 h-3.5" />
            <span>Marketing, Publicidad y Ventas Autónomas</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Cabina de Crecimiento para Vender Cualquier Producto o Servicio
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Diseña oferta, pauta, embudo, guiones, objeciones, seguimiento, cierre, cobro y
            escalamiento con agentes IA expertos trabajando 24/7.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={prepareMasterSystem}
            className="bg-slate-800 hover:bg-slate-700 text-white font-black text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 border border-slate-700"
          >
            <Sparkles className="w-4 h-4" />
            <span>Preparar Embudo Maestro</span>
          </button>
          <button
            onClick={generateAiGrowthSystem}
            disabled={isGeneratingAi}
            className="bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 disabled:opacity-60 disabled:cursor-wait text-white font-black text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>{isGeneratingAi ? 'Generando...' : 'Generar Sistema con IA'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Ventas meta diarias',
            value: dailySalesGoal.toString(),
            icon: Target,
            tone: 'text-rose-300',
          },
          {
            label: 'Leads calificados/día',
            value: requiredQualifiedLeads.toString(),
            icon: Bot,
            tone: 'text-cyan-300',
          },
          {
            label: 'Ingreso diario objetivo',
            value: formatMoney(dailyRevenueGoal),
            icon: DollarSign,
            tone: 'text-emerald-300',
          },
          {
            label: 'ROAS objetivo',
            value: `${targetRoas.toFixed(1)}x`,
            icon: Zap,
            tone: 'text-amber-300',
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-500 font-black tracking-wider">
                  {metric.label}
                </span>
                <Icon className={`w-5 h-5 ${metric.tone}`} />
              </div>
              <p className={`text-2xl font-black mt-3 ${metric.tone}`}>{metric.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Configuración del sistema comercial
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Producto / Servicio</label>
              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id} className="bg-slate-900">
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Nicho objetivo</label>
              <textarea
                rows={3}
                value={targetMarket}
                onChange={(event) => setTargetMarket(event.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Promesa / propuesta de valor</label>
              <textarea
                rows={3}
                value={offerPromise}
                onChange={(event) => setOfferPromise(event.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Cuello de botella</label>
              <textarea
                rows={3}
                value={bottleneck}
                onChange={(event) => setBottleneck(event.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-slate-400 font-bold">Pauta RD$</span>
                <input
                  type="number"
                  value={adBudget}
                  onChange={(event) => setAdBudget(Number(event.target.value) || 0)}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200"
                />
              </label>
              <label className="block">
                <span className="text-slate-400 font-bold">Ventas/día</span>
                <input
                  type="number"
                  value={dailySalesGoal}
                  onChange={(event) => setDailySalesGoal(Number(event.target.value) || 0)}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200"
                />
              </label>
              <label className="block">
                <span className="text-slate-400 font-bold">Cierre %</span>
                <input
                  type="number"
                  value={closeRatePercent}
                  onChange={(event) => setCloseRatePercent(Number(event.target.value) || 1)}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-200"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              Arsenal táctico completo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {arsenal.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-amber-300" />
                      <p className="font-black text-white text-sm">{item.title}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {item.tools.map((tool) => (
                        <span
                          key={tool}
                          className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 rounded-full"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              Embudo maestro de venta
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {funnelStages.map((stage, index) => (
                <div key={stage.title} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
                  <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center font-black">
                    {index + 1}
                  </span>
                  <p className="font-black text-white mt-3">{stage.title}</p>
                  <p className="text-slate-400 mt-1">{stage.detail}</p>
                  <p className="text-cyan-300 font-bold mt-3">{stage.owner}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {preparedSystem && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5">
          <h2 className="text-sm font-black text-emerald-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Sistema comercial preparado
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
            {preparedSystem.map((line) => (
              <div key={line} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {(aiSystem || aiError) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-rose-300" />
            Sistema IA de crecimiento generado
          </h2>
          {aiError ? (
            <p className="text-xs text-amber-300 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              {aiError}. Cuando conectes `GEMINI_API_KEY`, este botón generará el plan completo.
            </p>
          ) : (
            <pre className="text-xs text-slate-300 mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(aiSystem, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider mb-4">
            Equipo de agentes expertos en promoción y venta
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expertAgents.map((agent) => (
              <div key={agent.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex gap-3">
                <img
                  src={agent.avatar}
                  alt={agent.name}
                  className="w-12 h-12 rounded-full object-cover border border-indigo-500/40"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-white text-sm">{agent.name}</p>
                    <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">
                      {agent.specialty}
                    </span>
                  </div>
                  <p className="text-xs text-cyan-300 mt-1">{agent.roleTitle}</p>
                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">{agent.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider mb-4">
            Objeciones y cierres
          </h2>
          <div className="space-y-3">
            {objectionMap.map((item) => (
              <div key={item.objection} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
                <p className="font-black text-amber-300">{item.objection}</p>
                <p className="text-slate-300 mt-1">{item.response}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
