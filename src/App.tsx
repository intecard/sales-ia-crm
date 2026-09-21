import React, { useEffect, useState } from 'react';
import { PlatformFrame } from './components/PlatformFrame';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';

// View Modules
import { DashboardOverview } from './components/DashboardOverview';
import { LeadsCRM } from './components/LeadsCRM';
import { AIChatStudio } from './components/AIChatStudio';
import { AIAgentsCommand } from './components/AIAgentsCommand';
import { CoursesManager } from './components/CoursesManager';
import { SalesFunnelsEditor } from './components/SalesFunnelsEditor';
import { MarketingAutomation } from './components/MarketingAutomation';
import { PaymentsInvoicing } from './components/PaymentsInvoicing';
import { DocumentVault } from './components/DocumentVault';
import { PredictiveAnalytics } from './components/PredictiveAnalytics';
import { MultiTenantSettings } from './components/MultiTenantSettings';
import { ManualsDocumentationModal } from './components/ManualsDocumentationModal';
import { apiRequest } from './services/api';

// Mock Initial Datasets
import {
  INITIAL_ORGANIZATIONS,
  INITIAL_USERS,
  MULTI_AGENTS_SPEC,
  FUNNEL_STAGES,
  INTECA_COURSES,
  INITIAL_LEADS,
  INITIAL_CAMPAIGNS,
  INITIAL_TRANSACTIONS
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
  PlatformMode
} from './types';

type AppProps = { organizationId?: string; connectedMode?: boolean };

export function App({ organizationId, connectedMode = false }: AppProps) {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Multi-platform simulator state
  const [simulatedOS, setSimulatedOS] = useState<PlatformMode>('web');

  // Multi-tenant organization & user state
  const [currentOrg, setCurrentOrg] = useState<OrganizationTenant>(INITIAL_ORGANIZATIONS[0]);
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);

  // Master Data States
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [agents, setAgents] = useState<AIAgentSpec[]>(MULTI_AGENTS_SPEC);
  const [courses, setCourses] = useState<Course[]>(INTECA_COURSES);
  const [funnelStages, setFunnelStages] = useState<FunnelStageConfig[]>(FUNNEL_STAGES);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>(INITIAL_CAMPAIGNS);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(INITIAL_TRANSACTIONS);

  // Active Lead for Chat Studio
  const [selectedLeadForChat, setSelectedLeadForChat] = useState<Lead>(INITIAL_LEADS[0]);

  // Modal Documentation State
  const [isDocumentationModalOpen, setIsDocumentationModalOpen] = useState(false);

  useEffect(() => {
    if (!connectedMode || !organizationId) return;
    Promise.all([
      apiRequest<{ items: Array<{ id: string; firstName: string; lastName?: string; email?: string; phone?: string; source?: string; tags: string[]; createdAt: string; updatedAt: string }> }>('/api/crm/contacts?pageSize=100', {}, organizationId),
      apiRequest<{ items: Array<{ id: string; name: string; sku?: string; type: string; description?: string; price: string | number; currency: string; active: boolean; createdAt: string }> }>('/api/crm/products', {}, organizationId),
    ]).then(([contactResponse, productResponse]) => {
      setLeads(contactResponse.items.map((contact) => ({
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName || '',
        country: '',
        email: contact.email || '',
        phone: contact.phone || '',
        whatsapp: contact.phone || '',
        interests: [],
        courseOfInterestId: '',
        funnelId: 'default',
        stageId: 'nuevo',
        status: 'Activo',
        buyProbability: 0,
        estimatedValue: 0,
        source: 'API',
        scoreAI: 0,
        currentEmotion: 'Neutral',
        lastInteraction: contact.updatedAt,
        assignedAgentId: MULTI_AGENTS_SPEC[0]?.id || '',
        organizationId,
        tags: contact.tags,
        conversationHistory: [],
        documents: [],
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      })));
      setCourses(productResponse.items.map((product) => ({
        id: product.id,
        title: product.name,
        code: product.sku || product.id,
        category: 'Gestión Empresarial',
        price: Number(product.price),
        description: product.description || '',
        durationHours: 0,
        schedule: 'Configurable',
        instructors: [],
        modulesCount: 0,
        modulesList: [],
        materialsIncluded: [],
        bonusesIncluded: [],
        certificationType: 'Certificación Oficial INTECA',
        enrolledStudents: 0,
        status: product.active ? 'Disponible' : 'Cerrado',
      })));
    }).catch((error) => console.error('No fue posible sincronizar el CRM', error));
  }, [connectedMode, organizationId]);

  // Handlers
  const handleAddLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
    if (connectedMode && organizationId) {
      void apiRequest('/api/crm/contacts', {
        method: 'POST',
        body: JSON.stringify({ firstName: newLead.firstName, lastName: newLead.lastName, email: newLead.email, phone: newLead.phone, source: newLead.source, tags: newLead.tags }),
      }, organizationId).catch((error) => console.error('No fue posible guardar el contacto', error));
    }
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    if (connectedMode && organizationId) {
      void apiRequest(`/api/crm/contacts/${updatedLead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ firstName: updatedLead.firstName, lastName: updatedLead.lastName, email: updatedLead.email, phone: updatedLead.phone, source: updatedLead.source, tags: updatedLead.tags }),
      }, organizationId).catch((error) => console.error('No fue posible actualizar el contacto', error));
    }
    if (selectedLeadForChat.id === updatedLead.id) {
      setSelectedLeadForChat(updatedLead);
    }
  };

  const handleOpenChatWithLead = (lead: Lead) => {
    setSelectedLeadForChat(lead);
    setActiveTab('chat');
  };

  const handleUpdateAgent = (updatedAgent: AIAgentSpec) => {
    setAgents((prev) => prev.map((a) => (a.id === updatedAgent.id ? updatedAgent : a)));
  };

  const handleAddCourse = (newCourse: Course) => {
    setCourses((prev) => [...prev, newCourse]);
  };

  const handleUpdateCourse = (updatedCourse: Course) => {
    setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
  };

  const handleAddCampaign = (newCampaign: MarketingCampaign) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
  };

  const handleAddTransaction = (newTx: PaymentTransaction) => {
    setTransactions((prev) => [newTx, ...prev]);
  };

  // Real-time Chat AI Messaging Handler via Express Backend
  const handleSendMessageToLead = async (
    leadId: string,
    messageContent: string,
    isHumanOverride: boolean
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
      timestamp: new Date().toISOString()
    };

    const updatedWithUser = {
      ...targetLead,
      conversationHistory: [...targetLead.conversationHistory, userMsg],
      updatedAt: new Date().toISOString()
    };

    handleUpdateLead(updatedWithUser);

    // 2. Call backend server-side Gemini AI agent
    try {
      const assignedAgent = agents.find((a) => a.id === targetLead.assignedAgentId) || agents[0];
      const courseObj = courses.find((c) => c.id === targetLead.courseOfInterestId) || courses[0];

      const response = await fetch('/api/ai/chat-agent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(organizationId ? { 'X-Organization-Id': organizationId } : {}) },
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
          isHumanOverride
        })
      });

      const data = await response.json();

      let replyText = data.reply;
      if (!replyText) {
        replyText = `¡Excelente pregunta, ${targetLead.firstName}! En INTECA nos tomamos muy en serio tu formación. El ${courseObj.title} cuenta con acompañamiento directo y certificación internacional. ¿Te gustaría que reservemos tu vacante con la beca hoy mismo?`;
      }

      const aiMsg = {
        id: `msg_ai_${Date.now()}`,
        sender: 'ai_agent' as const,
        agentName: assignedAgent.name,
        channel: 'WhatsApp' as const,
        messageType: 'text' as const,
        content: replyText,
        timestamp: new Date().toISOString()
      };

      const updatedWithAI = {
        ...updatedWithUser,
        conversationHistory: [...updatedWithUser.conversationHistory, aiMsg],
        updatedAt: new Date().toISOString()
      };

      handleUpdateLead(updatedWithAI);
    } catch (err) {
      console.error('Error getting AI reply:', err);
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
      amount: finalAmount,
      currency: 'USD',
      status: 'Pendiente',
      gateway: 'Transferencia',
      transactionRef: `pending_${crypto.randomUUID()}`,
      invoiceNumber: '',
      invoiceUrl: '',
      createdAt: new Date().toISOString(),
      courseActivationCode: ''
    };

    handleAddTransaction(newTx);

    // Notify in chat
    const paymentMsg = {
      id: `msg_pay_${Date.now()}`,
      sender: 'ai_agent' as const,
      agentName: 'Valeria Sotomayor (Closer IA)',
      channel: 'WhatsApp' as const,
      messageType: 'payment_link' as const,
      content: `Se creó una solicitud de pago en modo demostración por ${finalAmount} USD. El pago permanece pendiente hasta conectar una pasarela y confirmar su webhook.`,
      timestamp: new Date().toISOString()
    };

    const updatedLead: Lead = {
      ...lead,
      stageId: 'pago_pendiente',
      status: 'Activo',
      conversationHistory: [...lead.conversationHistory, paymentMsg],
      updatedAt: new Date().toISOString()
    };

    handleUpdateLead(updatedLead);
    setActiveTab('chat');
  };

  return (
    <PlatformFrame platform={simulatedOS}>
      <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
        <div className={`fixed z-[100] bottom-3 right-3 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg ${connectedMode ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-950'}`}>
          {connectedMode ? 'MODO CONECTADO' : 'MODO DEMOSTRACIÓN'}
        </div>
        {/* Left Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          leadsCount={leads.length}
          activeAgentsCount={agents.filter((a) => a.status === 'Activo').length}
          pendingPaymentsCount={transactions.filter((t) => t.status === 'Pendiente').length}
        />

        {/* Right Main Content Panel */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top Header Controls */}
          <Header
            currentOS={simulatedOS}
            onOSChange={setSimulatedOS}
            organizations={INITIAL_ORGANIZATIONS}
            currentOrg={currentOrg}
            onOrgChange={setCurrentOrg}
            currentUser={currentUser}
            onRoleChange={(newRole) => setCurrentUser((prev) => ({ ...prev, role: newRole }))}
            onOpenDocumentation={() => setIsDocumentationModalOpen(true)}
          />

          {/* Dynamic View Container */}
          <main className="flex-1 overflow-y-auto bg-slate-950/90">
            {activeTab === 'dashboard' && (
              <DashboardOverview
                leads={leads}
                transactions={transactions}
                agents={agents}
                courses={courses}
                onNavigateToLeads={() => setActiveTab('leads')}
                onNavigateToAgents={() => setActiveTab('agents')}
                onNavigateToChat={() => setActiveTab('chat')}
                onNavigateToMarketing={() => setActiveTab('marketing')}
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

            {activeTab === 'chat' && (
              <AIChatStudio
                leads={leads}
                agents={agents}
                courses={courses}
                selectedLead={selectedLeadForChat}
                onSelectLead={setSelectedLeadForChat}
                onSendMessageToLead={handleSendMessageToLead}
                onGeneratePaymentLink={handleGeneratePaymentLink}
              />
            )}

            {activeTab === 'agents' && (
              <AIAgentsCommand
                agents={agents}
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
              <SalesFunnelsEditor
                stages={funnelStages}
                onUpdateStages={setFunnelStages}
              />
            )}

            {activeTab === 'marketing' && (
              <MarketingAutomation
                campaigns={campaigns}
                courses={courses}
                onAddCampaign={handleAddCampaign}
              />
            )}

            {activeTab === 'payments' && (
              <PaymentsInvoicing
                transactions={transactions}
                leads={leads}
                courses={courses}
                onAddTransaction={handleAddTransaction}
              />
            )}

            {activeTab === 'documents' && <DocumentVault leads={leads} />}

            {activeTab === 'analytics' && (
              <PredictiveAnalytics leads={leads} courses={courses} />
            )}

            {activeTab === 'settings' && (
              <MultiTenantSettings
                organizations={INITIAL_ORGANIZATIONS}
                currentOrg={currentOrg}
                currentUser={INITIAL_USERS[0]}
                onOrgChange={setCurrentOrg}
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
