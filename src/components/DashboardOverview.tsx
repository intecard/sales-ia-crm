import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Bot,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
  Award,
  BarChart2,
  PieChart,
  MessageCircle,
  BrainCircuit,
  ShieldCheck,
  Target
} from 'lucide-react';
import { Lead, AIAgentSpec, PaymentTransaction, Course } from '../types';

interface DashboardOverviewProps {
  leads: Lead[];
  agents: AIAgentSpec[];
  transactions: PaymentTransaction[];
  courses: Course[];
  onNavigateToLeads: () => void;
  onNavigateToAgents: () => void;
  onNavigateToChat: () => void;
  onNavigateToMarketing: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  leads,
  agents,
  transactions,
  courses,
  onNavigateToLeads,
  onNavigateToAgents,
  onNavigateToChat,
  onNavigateToMarketing
}) => {
  const totalRevenue = transactions.reduce((sum, t) => sum + (t.status === 'Completado' ? t.amount : 0), 0);
  const totalLeadsCount = leads.length;
  const wonLeadsCount = leads.filter((l) => l.status === 'Ganado').length;
  const conversionRate = totalLeadsCount > 0 ? ((wonLeadsCount / totalLeadsCount) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-4 sm:p-6 space-y-6 overflow-y-auto max-w-7xl mx-auto">
      {/* Top Welcome Banner */}
      <div className="demo-hero bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '5s' }} />
              <span>CRM comercial multiempresa · Datos de demostración</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Panel Ejecutivo de Inteligencia Comercial
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Plataforma configurable para administrar prospectos, productos, servicios y ventas. Las integraciones externas permanecen en modo demostración hasta ser configuradas.
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
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ingresos Totales Cerrados</span>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">${totalRevenue.toLocaleString()} USD</span>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+34.8% vs mes anterior (Ventas IA)</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Leads Capturados</span>
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalLeadsCount.toLocaleString()}</span>
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Omnicanal: Meta, Google, WhatsApp, TikTok</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tasa de Conversión IA</span>
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{conversionRate}%</span>
            <div className="flex items-center gap-1.5 text-xs text-purple-300 font-medium mt-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Superior a la media del mercado (8.2%)</span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CAC & LTV Estimado</span>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-slate-200">CAC: <span className="text-amber-400">$24.50</span></span>
              <span className="text-xl font-bold text-slate-200">LTV: <span className="text-emerald-400">$820</span></span>
            </div>
            <div className="text-xs text-slate-400 font-medium mt-2">
              Retorno ROI Publicitario: <span className="text-emerald-400 font-bold">12.4x</span>
            </div>
          </div>
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
                <h2 className="text-base font-bold text-white">Equipo de Agentes IA de INTECA</h2>
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
                      onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/logo-icon.png';}}
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
                    <span className="text-xs font-bold text-emerald-400">{ag.stats.dealsClosed} cierres</span>
                    <p className="text-[10px] text-slate-500">{ag.stats.conversionRatePercent}% conv.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Disponibilidad: <strong className="text-emerald-400">24/7 sin descanso</strong></span>
            <span className="text-cyan-400 font-semibold">5 Especialistas</span>
          </div>
        </div>

        {/* Live Autonomous Feed / Activity */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
              <h2 className="text-base font-bold text-white">Feed de Operaciones Autónomas en Tiempo Real</h2>
            </div>
            <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
              Sincronizado vía WebSockets
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 flex items-start gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-300">Venta Cerrada & Factura Emitida Automaticamente</span>
                  <span className="text-[10px] text-slate-500">Hace 2 minutos</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Agente <strong className="text-white">Valeria Sotomayor</strong> cerró la matriculación de <strong className="text-cyan-300">Alejandro Gómez (México)</strong> en el <span className="text-amber-300">Diplomado en IA Aplicada a Negocios</span> por <strong>$299 USD</strong> vía Stripe.
                </p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">Recibo: INV-2026-0892</span>
                  <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-emerald-400">Acceso Campus Enviado</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-blue-500/30 rounded-xl p-3.5 flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg mt-0.5">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-300">Respuesta por WhatsApp + Audio IA Enviado</span>
                  <span className="text-[10px] text-slate-500">Hace 8 minutos</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Agente <strong className="text-white">Mateo WhatsApp Pro</strong> respondió consulta de <strong className="text-cyan-300">María Fernanda Ríos (Colombia)</strong> enviando audio con explicaciones del Máster Executive.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-3.5 flex items-start gap-3">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg mt-0.5">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-purple-300">Calificación Predictiva de Lead (Score 96/100)</span>
                  <span className="text-[10px] text-slate-500">Hace 14 minutos</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  El motor predictivo clasificó a <strong className="text-cyan-300">Carlos Vargas (Chile)</strong> con perfil <strong className="text-purple-300">DISC Concienzudo</strong> y sugirió enviar temario avanzado B2B.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Summary Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Programas Académicos Destacados de INTECA</h2>
          </div>
          <span className="text-xs text-slate-400">Total Estudiantes Matriculados: <strong>5,360</strong></span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {courses.map((crs) => (
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
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {crs.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 line-through mr-1.5">${crs.price} USD</span>
                  <span className="text-sm font-black text-emerald-400">${crs.discountPrice} USD</span>
                </div>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                  {crs.enrolledStudents} alumnos
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
