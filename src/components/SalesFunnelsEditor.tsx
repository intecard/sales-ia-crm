import React, { useState } from 'react';
import {
  GitMerge,
  Plus,
  Sliders,
  Zap,
  Bot,
  MessageCircle,
  Mail,
  Send,
  Sparkles,
  Edit3,
  CheckCircle2,
  Settings
} from 'lucide-react';
import { FunnelStageConfig } from '../types';

interface SalesFunnelsEditorProps {
  stages: FunnelStageConfig[];
  onUpdateStages: (stages: FunnelStageConfig[]) => void;
}

export const SalesFunnelsEditor: React.FC<SalesFunnelsEditorProps> = ({
  stages,
  onUpdateStages
}) => {
  const [selectedStage, setSelectedStage] = useState<FunnelStageConfig>(stages[0]);
  const [actionPrompt, setActionPrompt] = useState(stages[0]?.autoActionPrompt || '');

  const handleSelectStage = (st: FunnelStageConfig) => {
    setSelectedStage(st);
    setActionPrompt(st.autoActionPrompt || '');
  };

  const handleSaveTrigger = () => {
    const updatedStages = stages.map((s) => {
      if (s.id === selectedStage.id) {
        return { ...s, autoActionPrompt: actionPrompt };
      }
      return s;
    });
    onUpdateStages(updatedStages);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <GitMerge className="w-3.5 h-3.5 text-cyan-300" />
            <span>Motor de Embudos & Disparadores de Automatización</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Configuración del Pipeline de Ventas INTECA</h1>
          <p className="text-xs text-slate-400 mt-1">
            Define los pasos del embudo y configura acciones automáticas por etapa (envío de WhatsApp, SMS, asignación de agentes IA y seguimiento).
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stages List Column */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Etapas del Embudo ({stages.length})
          </h2>

          <div className="space-y-2">
            {stages.map((st, idx) => {
              const isSelected = st.id === selectedStage.id;

              return (
                <div
                  key={st.id}
                  onClick={() => handleSelectStage(st)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-blue-500/80 shadow-md ring-1 ring-blue-500/40'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${st.color}`}>
                      {st.name}
                    </span>
                  </div>

                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage Trigger Inspector */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded border ${selectedStage.color}`}>
                Etapa: {selectedStage.name}
              </span>
              <p className="text-xs text-slate-400 mt-2">
                Acción automática ejecutada por la IA cuando un lead ingresa a esta etapa.
              </p>
            </div>
            <button
              onClick={handleSaveTrigger}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Guardar Disparador</span>
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-white uppercase tracking-wider block">
              Instrucción del Disparador Automático
            </label>
            <textarea
              rows={5}
              value={actionPrompt}
              onChange={(e) => setActionPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              placeholder="Escribe la regla de automatización..."
            ></textarea>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Canales de Automatización Habilitados
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1">
              <div className="bg-slate-900 p-2 rounded border border-slate-800 text-center">📱 WhatsApp API</div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800 text-center">✉️ Email Sequence</div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800 text-center">💬 SMS Reminder</div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800 text-center">🤖 Agente IA Closer</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
