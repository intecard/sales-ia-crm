import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  Zap,
  Sliders,
  ShieldAlert,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  Award,
  DollarSign,
  Edit3,
  Save,
  Brain,
} from 'lucide-react';
import { AIAgentSpec } from '../types';

interface AIAgentsCommandProps {
  agents: AIAgentSpec[];
  onUpdateAgent: (agent: AIAgentSpec) => void;
  onNavigateToChat: () => void;
}

export const AIAgentsCommand: React.FC<AIAgentsCommandProps> = ({
  agents,
  onUpdateAgent,
  onNavigateToChat,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<AIAgentSpec>(agents[0]);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(agents[0]?.systemPrompt || '');
  const [maxDiscountPercent, setMaxDiscountPercent] = useState<number>(40);

  const handleSelectAgent = (ag: AIAgentSpec) => {
    setSelectedAgent(ag);
    setEditedPrompt(ag.systemPrompt);
    setIsEditingPrompt(false);
  };

  const handleSavePrompt = () => {
    const updated = {
      ...selectedAgent,
      systemPrompt: editedPrompt,
    };
    onUpdateAgent(updated);
    setSelectedAgent(updated);
    setIsEditingPrompt(false);
  };

  const handleToggleStatus = () => {
    const newStatus = selectedAgent.status === 'Activo' ? 'En Pausa' : 'Activo';
    const updated = { ...selectedAgent, status: newStatus as any };
    onUpdateAgent(updated);
    setSelectedAgent(updated);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Bot className="w-3.5 h-3.5 text-cyan-300" />
            <span>Centro de Comando Multi-Agente Vendedor Autónomo</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Agentes de Inteligencia Artificial Especializados
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Los agentes colaboran entre sí de forma autónoma. Puedes supervisar, ajustar sus límites
            de negociación y tomar el control humano en cualquier momento.
          </p>
        </div>

        <button
          onClick={onNavigateToChat}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Ver Diálogos de Agentes en Vivo</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Agent Selector List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Lista de Agentes Autónomos ({agents.length})
          </h2>

          {agents.map((ag) => {
            const isSelected = ag.id === selectedAgent.id;

            return (
              <div
                key={ag.id}
                onClick={() => handleSelectAgent(ag)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                    : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={ag.avatar}
                    alt={ag.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/40"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-white">{ag.name}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          ag.status === 'Activo'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {ag.status}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-300 font-medium">{ag.roleTitle}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Cierres:{' '}
                        <strong className="text-emerald-400">{ag.stats.dealsClosed}</strong>
                      </span>
                      <span>
                        Conversión:{' '}
                        <strong className="text-cyan-300">{ag.stats.conversionRatePercent}%</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 2 Columns: Detailed Inspector & Prompt Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Agent Profile Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedAgent.avatar}
                  alt={selectedAgent.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
                    <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      {selectedAgent.specialty}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{selectedAgent.roleTitle}</p>
                  <p className="text-xs text-slate-400 mt-1">{selectedAgent.description}</p>
                </div>
              </div>

              {/* Status Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleStatus}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedAgent.status === 'Activo'
                      ? 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {selectedAgent.status === 'Activo' ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {selectedAgent.status === 'Activo' ? 'Pausar Agente' : 'Activar Agente'}
                  </span>
                </button>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">
                  Conversaciones
                </span>
                <p className="text-base font-extrabold text-white mt-0.5">
                  {selectedAgent.stats.conversationsHandled.toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">
                  Ventas Cerradas
                </span>
                <p className="text-base font-extrabold text-emerald-400 mt-0.5">
                  {selectedAgent.stats.dealsClosed}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Satisfacción</span>
                <p className="text-base font-extrabold text-amber-400 mt-0.5">
                  ★ {selectedAgent.stats.avgSatisfaction}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">
                  Ratio Conversión
                </span>
                <p className="text-base font-extrabold text-cyan-300 mt-0.5">
                  {selectedAgent.stats.conversionRatePercent}%
                </p>
              </div>
            </div>

            {/* Negotiation Parameters Limits */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Parámetros de Autonomía & Descuentos
                  </h3>
                </div>
                <span className="text-xs text-emerald-400 font-bold">
                  Límite Máximo: {maxDiscountPercent}% OFF
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>
                    Descuento máximo autorizado que el agente puede ofrecer autónomamente:
                  </span>
                  <span className="font-bold text-white">{maxDiscountPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={maxDiscountPercent}
                  onChange={(e) => setMaxDiscountPercent(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* Strategic Growth Mandate */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Mandato de Crecimiento 24/7
                  </h3>
                </div>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
                  {selectedAgent.autonomyLevel || 'Supervisado'}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedAgent.operatingMandate ||
                  'Este agente opera bajo supervisión humana y ejecuta tareas asignadas dentro del flujo comercial.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Meta ventas/día
                  </span>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">
                    {selectedAgent.kpiTargets?.dailySalesTarget || 0}
                  </p>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    SLA respuesta
                  </span>
                  <p className="text-lg font-black text-cyan-300 mt-0.5">
                    {selectedAgent.kpiTargets?.responseSlaMinutes || 10} min
                  </p>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Éxito objetivo
                  </span>
                  <p className="text-lg font-black text-purple-300 mt-0.5">
                    {selectedAgent.kpiTargets?.targetRoiPercent || 0}%
                  </p>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Leads calif./día
                  </span>
                  <p className="text-lg font-black text-amber-300 mt-0.5">
                    {selectedAgent.kpiTargets?.minimumQualifiedLeadsDaily || 0}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Arsenal táctico
                  </h4>
                  <div className="space-y-2">
                    {(
                      selectedAgent.tacticalArsenal || [
                        'Responder conversaciones',
                        'Actualizar CRM',
                      ]
                    ).map((item) => (
                      <div key={item} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Reglas de aprobación
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Campañas comerciales</span>
                      <strong className="text-emerald-400">
                        {selectedAgent.approvalPolicy?.canLaunchCommercialCampaigns
                          ? 'Puede lanzar y notificar'
                          : 'Requiere aprobación'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Testimonios/noticias</span>
                      <strong className="text-amber-300">
                        {selectedAgent.approvalPolicy?.requiresApprovalForTestimonials ||
                        selectedAgent.approvalPolicy?.requiresApprovalForInstitutionalNews
                          ? 'Aprobación previa'
                          : 'Automático'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Descuento máximo</span>
                      <strong className="text-cyan-300">
                        {selectedAgent.approvalPolicy?.maxDiscountPercent ?? maxDiscountPercent}%
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Prompt Customizer */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Prompt del Sistema (Personalidad & Instrucciones)
                  </h3>
                </div>

                {!isEditingPrompt ? (
                  <button
                    onClick={() => setIsEditingPrompt(true)}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Prompt</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSavePrompt}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1 rounded-lg"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </button>
                )}
              </div>

              {isEditingPrompt ? (
                <textarea
                  rows={6}
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                ></textarea>
              ) : (
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                  {selectedAgent.systemPrompt}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
