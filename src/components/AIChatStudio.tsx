import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Mic,
  Paperclip,
  CreditCard,
  FileText,
  Percent,
  Sparkles,
  Zap,
  Phone,
  Video,
  MoreVertical,
  CheckCheck,
  Brain,
  ShieldCheck,
  DollarSign,
  Play,
} from 'lucide-react';
import { Lead, AIAgentSpec, Course, ConversationMessage } from '../types';

interface AIChatStudioProps {
  leads: Lead[];
  agents: AIAgentSpec[];
  courses: Course[];
  selectedLead: Lead;
  onSelectLead: (lead: Lead) => void;
  onSendMessageToLead: (
    leadId: string,
    messageContent: string,
    isHumanOverride: boolean,
  ) => Promise<void>;
  onGeneratePaymentLink: (lead: Lead, courseId: string, discount: number) => void;
}

export const AIChatStudio: React.FC<AIChatStudioProps> = ({
  leads,
  agents,
  courses,
  selectedLead,
  onSelectLead,
  onSendMessageToLead,
  onGeneratePaymentLink,
}) => {
  const [inputText, setInputText] = useState('');
  const [isHumanOverride, setIsHumanOverride] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const selectedCourse =
    courses.find((c) => c.id === selectedLead.courseOfInterestId) || courses[0];
  const assignedAgent = agents.find((a) => a.id === selectedLead.assignedAgentId) || agents[0];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText;
    setInputText('');
    setIsSending(true);

    try {
      await onSendMessageToLead(selectedLead.id, textToSend, isHumanOverride);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickAction = (actionText: string) => {
    setInputText(actionText);
  };

  return (
    <div className="p-4 sm:p-6 h-[calc(100vh-80px)] flex flex-col max-w-[1800px] mx-auto">
      {/* Studio Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Centro de Diálogo Comercial Vendedor IA
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                ● Agente Autónomo Conectado
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Interacción por WhatsApp / WebChat con agente IA, seguimiento 24/7 y solicitudes de
              pago pendientes de validación.
            </p>
          </div>
        </div>

        {/* Human Override Switch */}
        <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-300 font-medium">Modo de Operación:</span>
          <button
            onClick={() => setIsHumanOverride(!isHumanOverride)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isHumanOverride
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-indigo-600 text-white shadow-md'
            }`}
          >
            {isHumanOverride ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            <span>{isHumanOverride ? 'Supervisión Humana Activa' : 'IA Autónoma 100%'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden">
        {/* Col 1: Lead Selector List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 font-bold text-xs text-slate-300 uppercase tracking-wider">
            Conversaciones Activas ({leads.length})
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
            {leads.map((lead) => {
              const isSelected = lead.id === selectedLead.id;
              const lastMsg = lead.conversationHistory[lead.conversationHistory.length - 1];

              return (
                <div
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800/80 border-l-4 border-blue-500'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">
                      {lead.firstName} {lead.lastName}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      RD${lead.estimatedValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-cyan-300 font-medium">{lead.source}</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                      Score: {lead.scoreAI}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {lastMsg?.content || 'Sin mensajes aún'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Col 2 & 3: Active Chat Window */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {/* Active Lead Chat Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                {selectedLead.firstName[0]}
              </div>
              <div>
                <h2 className="font-bold text-sm text-white">
                  {selectedLead.firstName} {selectedLead.lastName}
                </h2>
                <span className="text-[11px] text-slate-400">
                  {selectedLead.whatsapp} • {selectedLead.country} •{' '}
                  <strong className="text-amber-400">{selectedLead.currentEmotion}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg">
                Agente: <strong className="text-indigo-400">{assignedAgent.name}</strong>
              </span>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/50">
            {selectedLead.conversationHistory.map((msg) => {
              const isLead = msg.sender === 'lead';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isLead ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                      isLead
                        ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                    }`}
                  >
                    {!isLead && (
                      <div className="text-[10px] font-bold text-cyan-200 mb-1 flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        <span>{msg.agentName || assignedAgent.name}</span>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Media attachments */}
                    {msg.messageType === 'payment_link' && (
                      <div className="mt-2.5 p-2 bg-black/40 rounded-xl border border-emerald-400/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-emerald-400" />
                          <span className="font-bold text-emerald-300">
                            Pasarela de Pago Habilitada
                          </span>
                        </div>
                        <button
                          onClick={() => onGeneratePaymentLink(selectedLead, selectedCourse.id, 40)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] px-2.5 py-1 rounded-lg"
                        >
                          Solicitar pago
                        </button>
                      </div>
                    )}

                    <div
                      className={`text-[9px] mt-1.5 flex items-center justify-end gap-1 ${isLead ? 'text-slate-400' : 'text-indigo-200'}`}
                    >
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {!isLead && <CheckCheck className="w-3 h-3 text-cyan-300" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick AI Action Buttons */}
          <div className="p-2 bg-slate-950 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() =>
                handleQuickAction(
                  '¿Me podrías enviar el temario completo, qué funciones aprenderé y cómo me ayudaría laboralmente?',
                )
              }
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-lg flex-shrink-0"
            >
              📄 Pedir Temario
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickAction(
                  'Acepto la oferta. Envíame los pasos para pagar y validar mi inscripción hoy.',
                )
              }
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-lg flex-shrink-0"
            >
              💳 Pedir Enlace Pago
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickAction(
                  '¿Cuentan con facilidades de pago en cuotas o descuento adicional?',
                )
              }
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-lg flex-shrink-0"
            >
              🏷️ Preguntar Cuotas
            </button>
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isHumanOverride
                  ? 'Escribe un mensaje en modo Supervisión Humana...'
                  : 'Escribe para simular respuesta del cliente o instrucción a la IA...'
              }
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isSending}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Enviando...' : 'Enviar'}</span>
            </button>
          </form>
        </div>

        {/* Col 4: Lead Details & AI Offer Generator Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 flex flex-col justify-between overflow-y-auto">
          <div>
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-3">
              Ficha de Venta & Generador de Ofertas
            </h3>

            {/* Course card */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                {selectedCourse.category}
              </span>
              <h4 className="font-bold text-xs text-white">{selectedCourse.title}</h4>
              <div className="flex items-baseline gap-2">
                {selectedCourse.price > 0 && selectedCourse.discountPrice && (
                  <span className="text-xs text-slate-500 line-through">
                    RD${selectedCourse.price.toLocaleString()}
                  </span>
                )}
                <span className="text-base font-black text-emerald-400">
                  {selectedCourse.price > 0
                    ? `RD$${(selectedCourse.discountPrice || selectedCourse.price).toLocaleString()}`
                    : selectedCourse.activePromotions?.join(' · ') || 'Precio pendiente'}
                </span>
              </div>
            </div>

            {/* AI Profiling Radar */}
            <div className="mt-4 bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                <Brain className="w-4 h-4 text-purple-400" />
                <span>Análisis de Probabilidad IA</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Intención de Pago:</span>
                <span className="text-emerald-400 font-bold">{selectedLead.buyProbability}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full"
                  style={{ width: `${selectedLead.buyProbability}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Offer Trigger Button */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <button
              onClick={() => onGeneratePaymentLink(selectedLead, selectedCourse.id, 40)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Generar Link de Pago Instantáneo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
