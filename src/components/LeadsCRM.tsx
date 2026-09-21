import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Kanban,
  Table as TableIcon,
  Phone,
  Mail,
  MessageCircle,
  Sparkles,
  MapPin,
  Calendar,
  Globe,
  DollarSign,
  TrendingUp,
  BrainCircuit,
  FileText,
  Clock,
  Smartphone,
  ChevronRight,
  CheckCircle2,
  X,
  AlertCircle,
  Tag,
  ShieldCheck,
  Send
} from 'lucide-react';
import { Lead, FunnelStageConfig, Course, LeadSource, EmotionState } from '../types';

interface LeadsCRMProps {
  leads: Lead[];
  funnelStages: FunnelStageConfig[];
  courses: Course[];
  onAddLead: (newLead: Lead) => void;
  onUpdateLead: (updatedLead: Lead) => void;
  onOpenChatWithLead: (lead: Lead) => void;
}

export const LeadsCRM: React.FC<LeadsCRMProps> = ({
  leads,
  funnelStages,
  courses,
  onAddLead,
  onUpdateLead,
  onOpenChatWithLead
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedLeadModal, setSelectedLeadModal] = useState<Lead | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Lead Form State
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCountry, setNewCountry] = useState('México');
  const [newCity, setNewCity] = useState('CDMX');
  const [newCourseId, setNewCourseId] = useState(courses[0]?.id || 'crs_ai_biz');
  const [newSource, setNewSource] = useState<LeadSource>('WhatsApp');

  // Filtering
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      `${lead.firstName} ${lead.lastName} ${lead.email} ${lead.phone} ${lead.company || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesSource = selectedSource === 'all' || lead.source === selectedSource;
    return matchesSearch && matchesSource;
  });

  // Handle Drag / Stage change
  const handleStageChange = (leadId: string, newStageId: any) => {
    const targetLead = leads.find((l) => l.id === leadId);
    if (targetLead) {
      const updated: Lead = {
        ...targetLead,
        stageId: newStageId,
        updatedAt: new Date().toISOString()
      };
      onUpdateLead(updated);
      if (selectedLeadModal?.id === leadId) {
        setSelectedLeadModal(updated);
      }
    }
  };

  const handleCreateLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newEmail) return;

    const courseObj = courses.find((c) => c.id === newCourseId);

    const created: Lead = {
      id: `lead_${Date.now()}`,
      firstName: newFirstName,
      lastName: newLastName || 'INTECA Lead',
      country: newCountry,
      city: newCity,
      email: newEmail,
      phone: newPhone || '+52 55 0000 0000',
      whatsapp: newPhone || '+52 55 0000 0000',
      interests: [courseObj?.category || 'Inteligencia Artificial'],
      courseOfInterestId: newCourseId,
      funnelId: 'fn_default',
      stageId: 'nuevo',
      status: 'Activo',
      buyProbability: 80,
      estimatedValue: courseObj?.discountPrice || 299,
      source: newSource,
      scoreAI: 85,
      currentEmotion: 'Muy Entusiasta',
      lastInteraction: new Date().toISOString(),
      assignedAgentId: 'agent_closer',
      organizationId: 'org_inteca_main',
      tags: ['Manual / Form Ingestion', 'Capturado IA'],
      conversationHistory: [
        {
          id: `msg_init_${Date.now()}`,
          sender: 'ai_agent',
          agentName: 'Valeria Sotomayor (Closer IA)',
          channel: 'WhatsApp',
          messageType: 'text',
          content: `¡Hola ${newFirstName}! Bienvenido a INTECA. Recibimos tu registro para el ${courseObj?.title}. Te envío el brochure con el temario completo.`,
          timestamp: new Date().toISOString()
        }
      ],
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddLead(created);
    setIsAddModalOpen(false);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPhone('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1800px] mx-auto overflow-y-auto">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Captura & Gestión 360° de Leads</h1>
            <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-semibold">
              {filteredLeads.length} Leads
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Almacenamiento completo de atributos, profiling con IA, personalidad DISC y seguimiento omnicanal.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nombre, mail, tel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Source Filter */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todas las Fuentes</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Meta Ads">Meta Ads</option>
            <option value="Google Ads">Google Ads</option>
            <option value="TikTok">TikTok</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Web INTECA">Web INTECA</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Kanban de Embudo"
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Tabla de Datos 360°"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Ingest Lead Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ingestar Lead</span>
          </button>
        </div>
      </div>

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 min-h-[650px] scrollbar-thin">
          {funnelStages.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stageId === stage.id);

            return (
              <div
                key={stage.id}
                className="w-80 flex-shrink-0 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col max-h-[750px]"
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${stage.color}`}>
                      {stage.name}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">({stageLeads.length})</span>
                  </div>
                </div>

                {/* Column Leads Stack */}
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {stageLeads.map((lead) => {
                    const courseObj = courses.find((c) => c.id === lead.courseOfInterestId);

                    return (
                      <div
                        key={lead.id}
                        onClick={() => setSelectedLeadModal(lead)}
                        className="bg-slate-950 border border-slate-800 hover:border-blue-500/60 rounded-xl p-3.5 shadow-md cursor-pointer transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-xs text-white group-hover:text-blue-400 transition-colors">
                              {lead.firstName} {lead.lastName}
                            </h3>
                            <p className="text-[11px] text-slate-400">{lead.company || lead.country}</p>
                          </div>
                          <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                            Score IA: {lead.scoreAI}
                          </span>
                        </div>

                        {/* Course Badge */}
                        <div className="mt-2 text-[11px] text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-1 rounded line-clamp-1">
                          🎓 {courseObj?.title || 'Curso INTECA'}
                        </div>

                        {/* Lead Metadata */}
                        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-900">
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-500" />
                            {lead.country}
                          </span>
                          <span className="font-bold text-emerald-400">${lead.estimatedValue} USD</span>
                        </div>

                        {/* Action Bar */}
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-900/80">
                          <span className="text-[10px] text-amber-400 font-medium">
                            {lead.currentEmotion}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChatWithLead(lead);
                            }}
                            className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-medium px-2 py-1 rounded-lg transition-colors"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Chat IA</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {stageLeads.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-600 border border-dashed border-slate-800 rounded-xl">
                      Sin leads en esta etapa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Lead / Contacto</th>
                  <th className="p-3.5">País / Ciudad</th>
                  <th className="p-3.5">Curso de Interés</th>
                  <th className="p-3.5">Fuente</th>
                  <th className="p-3.5">Etapa Embudo</th>
                  <th className="p-3.5">Puntuación IA</th>
                  <th className="p-3.5">Valor Est.</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLeads.map((lead) => {
                  const courseObj = courses.find((c) => c.id === lead.courseOfInterestId);
                  const stageObj = funnelStages.find((s) => s.id === lead.stageId);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLeadModal(lead)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 font-bold text-white">
                        <div>{lead.firstName} {lead.lastName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{lead.email} • {lead.phone}</div>
                      </td>
                      <td className="p-3.5">{lead.country} ({lead.city || 'Principal'})</td>
                      <td className="p-3.5 text-cyan-300 font-medium">{courseObj?.title || 'Curso INTECA'}</td>
                      <td className="p-3.5">
                        <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px]">
                          {lead.source}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${stageObj?.color}`}>
                          {stageObj?.name}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-purple-400">{lead.scoreAI}/100</td>
                      <td className="p-3.5 font-bold text-emerald-400">${lead.estimatedValue} USD</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChatWithLead(lead);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1 rounded-lg text-xs"
                        >
                          Chat Sales
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 360° LEAD DETAILED MODAL / DRAWER */}
      {selectedLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedLeadModal(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header profile */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">
                    {selectedLeadModal.firstName} {selectedLeadModal.lastName}
                  </h2>
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    Score IA: {selectedLeadModal.scoreAI}/100
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedLeadModal.roleTitle || 'Interesado'} • {selectedLeadModal.company || 'Particular'} • {selectedLeadModal.country}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onOpenChatWithLead(selectedLeadModal);
                    setSelectedLeadModal(null);
                  }}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Abrir Chat Comercial IA</span>
                </button>
              </div>
            </div>

            {/* Lead 360 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Col 1: Contact & Tech attributes */}
              <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Atributos Personales & Contacto</h3>
                <div className="space-y-2 text-xs text-slate-300">
                  <div><strong className="text-slate-400">Correo:</strong> {selectedLeadModal.email}</div>
                  <div><strong className="text-slate-400">Teléfono / WA:</strong> {selectedLeadModal.whatsapp}</div>
                  <div><strong className="text-slate-400">Ubicación:</strong> {selectedLeadModal.city}, {selectedLeadModal.country}</div>
                  <div><strong className="text-slate-400">Edad / Sexo:</strong> {selectedLeadModal.age || 30} años • {selectedLeadModal.gender || 'Femenino'}</div>
                  <div><strong className="text-slate-400">Fuente Ingestión:</strong> {selectedLeadModal.source}</div>
                  <div><strong className="text-slate-400">Dispositivo:</strong> {selectedLeadModal.deviceUsed || 'iPhone / Mac'}</div>
                  <div><strong className="text-slate-400">Navegador:</strong> {selectedLeadModal.browserUsed || 'Chrome 134'}</div>
                </div>
              </div>

              {/* Col 2: AI Personality & Emotion Radar */}
              <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold text-xs text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                  Perfil & Psicología de Compra IA
                </h3>
                <div className="space-y-2 text-xs text-slate-300">
                  <div>
                    <strong className="text-slate-400">Tipo DISC:</strong>{' '}
                    <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                      {selectedLeadModal.personalityAnalysis?.discType || 'Dominante'}
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-400">Velocidad Decisión:</strong>{' '}
                    {selectedLeadModal.personalityAnalysis?.decisionSpeed || 'Rápida'}
                  </div>
                  <div>
                    <strong className="text-slate-400">Dolor Principal:</strong>{' '}
                    <p className="text-amber-300/90 text-[11px] mt-0.5">
                      "{selectedLeadModal.personalityAnalysis?.dominantPainPoint || 'Automatización urgente de procesos de venta.'}"
                    </p>
                  </div>
                  <div>
                    <strong className="text-slate-400">Emoción Actual:</strong>{' '}
                    <span className="text-emerald-400 font-bold">{selectedLeadModal.currentEmotion}</span>
                  </div>
                </div>
              </div>

              {/* Col 3: Funnel Stage Switcher & Next Actions */}
              <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold text-xs text-blue-300 uppercase tracking-wider">Estado Comercial & Etapa</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Cambiar Etapa de Embudo:</label>
                    <select
                      value={selectedLeadModal.stageId}
                      onChange={(e) => handleStageChange(selectedLeadModal.id, e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white mt-1"
                    >
                      {funnelStages.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 space-y-1">
                    <div><strong className="text-slate-400">Probabilidad de Pago:</strong> <span className="text-emerald-400 font-bold">{selectedLeadModal.buyProbability}%</span></div>
                    <div><strong className="text-slate-400">Valor Estimado:</strong> <span className="text-white font-bold">${selectedLeadModal.estimatedValue} USD</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW LEAD INGESTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Ingestar Nuevo Lead a INTECA</h2>
            </div>

            <form onSubmit={handleCreateLeadSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Ej. Juan"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Apellidos</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Ej. Pérez"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="juan@empresa.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium">WhatsApp / Teléfono</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+52 55 1234 5678"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Curso de Interés</label>
                  <select
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Fuente Ingestión</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as LeadSource)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Web INTECA">Web INTECA</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl"
                >
                  Guardar & Calificar con IA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
