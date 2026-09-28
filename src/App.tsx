import React, { useState } from 'react';
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

// Mock Initial Datasets
import {
  INITIAL_ORGANIZATIONS,
  INITIAL_USERS,
  MULTI_AGENTS_SPEC,
  FUNNEL_STAGES,
  INTECA_COURSES,
  INITIAL_LEADS,
  INITIAL_CAMPAIGNS,
  INITIAL_TRANSACTIONS,
  INITIAL_OPPORTUNITIES,
  INITIAL_QUOTES,
  INITIAL_ELECTRONIC_INVOICES,
  INITIAL_LICENSE_PLANS,
  INITIAL_TENANT_LICENSES,
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
} from './types';

export function App() {
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
  const [opportunities] = useState<SalesOpportunity[]>(INITIAL_OPPORTUNITIES);
  const [quotes] = useState<CommercialQuote[]>(INITIAL_QUOTES);
  const [electronicInvoices] = useState<ElectronicInvoice[]>(INITIAL_ELECTRONIC_INVOICES);
  const [licensePlans] = useState<LicensePlan[]>(INITIAL_LICENSE_PLANS);
  const [tenantLicenses] = useState<TenantLicense[]>(INITIAL_TENANT_LICENSES);

  // Active Lead for Chat Studio
  const [selectedLeadForChat, setSelectedLeadForChat] = useState<Lead>(INITIAL_LEADS[0]);

  // Modal Documentation State
  const [isDocumentationModalOpen, setIsDocumentationModalOpen] = useState(false);

  // Handlers
  const handleAddLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
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
      agentName: 'Valeria Sotomayor (Closer IA)',
      channel: 'WhatsApp' as const,
      messageType: 'payment_link' as const,
      content: `Se creó una solicitud de pago en modo demostración por RD$${finalAmount.toLocaleString()}. El pago permanece pendiente hasta validar comprobante o conectar una pasarela con webhook real.`,
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
                opportunities={opportunities}
                quotes={quotes}
                electronicInvoices={electronicInvoices}
                tenantLicenses={tenantLicenses}
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
              <SalesFunnelsEditor stages={funnelStages} onUpdateStages={setFunnelStages} />
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
                opportunities={opportunities}
                quotes={quotes}
                electronicInvoices={electronicInvoices}
                onAddTransaction={handleAddTransaction}
              />
            )}

            {activeTab === 'documents' && <DocumentVault leads={leads} />}

            {activeTab === 'analytics' && <PredictiveAnalytics leads={leads} courses={courses} />}

            {activeTab === 'settings' && (
              <MultiTenantSettings
                organizations={INITIAL_ORGANIZATIONS}
                currentOrg={currentOrg}
                currentUser={INITIAL_USERS[0]}
                licensePlans={licensePlans}
                tenantLicenses={tenantLicenses}
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
