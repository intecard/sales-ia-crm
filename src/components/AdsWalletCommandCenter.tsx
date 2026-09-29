import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  AdPaymentProfile,
  AdPlatform,
  AdSpendDecision,
  MarketingCampaign,
  OrganizationTenant,
} from '../types';

interface AdsWalletCommandCenterProps {
  currentOrg: OrganizationTenant;
  paymentProfiles: AdPaymentProfile[];
  spendDecisions: AdSpendDecision[];
  campaigns: MarketingCampaign[];
  deploymentMode: 'production' | 'trial';
  onRegisterPaymentProfile: (provider: AdPlatform, cardLast4: string, dailyLimit: number) => void;
}

export const AdsWalletCommandCenter: React.FC<AdsWalletCommandCenterProps> = ({
  currentOrg,
  paymentProfiles,
  spendDecisions,
  campaigns,
  deploymentMode,
  onRegisterPaymentProfile,
}) => {
  const [draftProvider, setDraftProvider] = useState<AdPlatform>('Meta Ads');
  const [draftLast4, setDraftLast4] = useState('');
  const [draftDailyLimit, setDraftDailyLimit] = useState(1000);
  const [previewReady, setPreviewReady] = useState(false);

  const orgProfiles = paymentProfiles.filter((profile) => profile.organizationId === currentOrg.id);
  const orgDecisions = spendDecisions.filter(
    (decision) => decision.organizationId === currentOrg.id,
  );
  const paidCampaigns = campaigns.filter((campaign) => campaign.paidByAgent);

  const monthlyLimit = useMemo(
    () => orgProfiles.reduce((total, profile) => total + profile.spendingLimitMonthly, 0),
    [orgProfiles],
  );

  const handlePrepareCard = (event: React.FormEvent) => {
    event.preventDefault();
    if (draftLast4.length !== 4) return;
    onRegisterPaymentProfile(draftProvider, draftLast4, draftDailyLimit);
    setPreviewReady(true);
    setDraftLast4('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <WalletCards className="w-3.5 h-3.5" />
            <span>Tarjeta empresarial, pauta inteligente y control de gasto</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Tarjeta & Pauta IA</h1>
          <p className="text-xs text-slate-400 mt-1">
            La empresa registra su método de pago, define límites y los agentes invierten solo en
            campañas con reglas de rentabilidad, trazabilidad y autorización.
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-black border ${
            deploymentMode === 'trial'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
          }`}
        >
          {deploymentMode === 'trial' ? 'Modo prueba' : 'Versión real'}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <form
          onSubmit={handlePrepareCard}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 xl:col-span-1"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Registrar tarjeta
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            En producción se conecta con Meta/Google/Stripe o procesador autorizado. El CRM solo
            debe guardar token seguro, marca y últimos 4 dígitos, nunca el número completo.
          </p>

          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="text-slate-300 font-bold">Plataforma de pauta</span>
              <select
                value={draftProvider}
                onChange={(event) => setDraftProvider(event.target.value as AdPlatform)}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                {['Meta Ads', 'Google Ads', 'YouTube Ads', 'TikTok Ads'].map((provider) => (
                  <option key={provider} value={provider} className="bg-slate-900">
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-300 font-bold">Últimos 4 dígitos visibles</span>
              <input
                value={draftLast4}
                onChange={(event) =>
                  setDraftLast4(event.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="1234"
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-slate-300 font-bold">Límite diario autorizado</span>
              <input
                type="number"
                min={0}
                value={draftDailyLimit}
                onChange={(event) => setDraftDailyLimit(Number(event.target.value))}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl px-4 py-2 text-sm"
          >
            Preparar conexión segura
          </button>

          {previewReady && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 rounded-xl p-3 text-xs">
              Perfil registrado de forma segura con tarjeta enmascarada. La conexión real de cobro
              queda pendiente de tokenizar la tarjeta con el proveedor autorizado.
            </div>
          )}
        </form>

        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-slate-500">
              Perfiles activos
            </span>
            <p className="text-3xl font-black text-white mt-2">{orgProfiles.length}</p>
            <p className="text-xs text-slate-400 mt-1">
              Tarjetas o cuentas publicitarias vinculadas.
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-slate-500">Límite mensual</span>
            <p className="text-3xl font-black text-emerald-400 mt-2">
              RD${monthlyLimit.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">Gasto máximo permitido por reglas.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-slate-500">
              Campañas pagadas
            </span>
            <p className="text-3xl font-black text-cyan-300 mt-2">{paidCampaigns.length}</p>
            <p className="text-xs text-slate-400 mt-1">Solo cuando hay tarjeta y autorización.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-cyan-300" />
            Métodos de pago y límites
          </h2>
          {orgProfiles.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300">
              No hay tarjeta real registrada para {currentOrg.name}. Los agentes pueden preparar
              campañas, pero no pagar pauta hasta conectar Meta Ads, Google Ads o un procesador.
            </div>
          ) : (
            <div className="space-y-3">
              {orgProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{profile.provider}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {profile.cardBrand} terminada en {profile.cardLast4} ·{' '}
                        {profile.billingEmail}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-1 rounded-full border ${
                        profile.status === 'Activa'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {profile.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                      <span className="text-slate-500 font-bold uppercase text-[10px]">Diario</span>
                      <p className="text-white font-black">RD${profile.spendingLimitDaily}</p>
                    </div>
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                      <span className="text-slate-500 font-bold uppercase text-[10px]">
                        Mensual
                      </span>
                      <p className="text-white font-black">
                        RD${profile.spendingLimitMonthly.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                      <span className="text-slate-500 font-bold uppercase text-[10px]">Modo</span>
                      <p className="text-cyan-300 font-black">{profile.approvalMode}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-300" />
            Decisiones estratégicas de pauta
          </h2>
          {orgDecisions.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300">
              Todavía no hay decisiones de inversión. El agente de publicidad generará una cuando
              exista campaña, objetivo, presupuesto y canal conectado.
            </div>
          ) : (
            <div className="space-y-3">
              {orgDecisions.map((decision) => (
                <div
                  key={decision.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-white font-black">{decision.campaignTitle}</h3>
                      <p className="text-xs text-slate-400 mt-1">{decision.objective}</p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 rounded-full border bg-blue-500/20 text-blue-300 border-blue-500/30">
                      {decision.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">Canal</span>
                      <p className="text-white font-black">{decision.channel}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">
                        Presupuesto
                      </span>
                      <p className="text-emerald-300 font-black">
                        RD${decision.recommendedBudgetDop.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">Ventas</span>
                      <p className="text-cyan-300 font-black">{decision.expectedSales}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">Riesgo</span>
                      <p className="text-amber-300 font-black">{decision.riskLevel}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                    {decision.reasoning}
                  </p>
                  <div className="mt-3 space-y-1">
                    {decision.guardrails.map((guardrail) => (
                      <div
                        key={guardrail}
                        className="flex items-start gap-2 text-xs text-slate-300"
                      >
                        <Lock className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{guardrail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-300" />
          Reglas para que los agentes paguen campañas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {[
            {
              icon: CheckCircle2,
              title: 'Solo dentro de límites',
              text: 'El gasto nunca supera el límite diario/mensual definido por la empresa.',
            },
            {
              icon: TrendingUp,
              title: 'Escala por pagos',
              text: 'El presupuesto sube únicamente cuando hay leads útiles, pagos o ROAS medible.',
            },
            {
              icon: AlertTriangle,
              title: 'Pausa automática',
              text: 'Si CPL, CAC o frecuencia se salen de rango, el agente pausa y deja auditoría.',
            },
            {
              icon: ShieldCheck,
              title: 'Aprobación sensible',
              text: 'Campañas institucionales, testimonios y alto presupuesto requieren aprobación.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <Icon className="w-5 h-5 text-cyan-300 mb-3" />
                <h3 className="font-black text-white">{item.title}</h3>
                <p className="text-slate-400 mt-1 leading-relaxed">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
