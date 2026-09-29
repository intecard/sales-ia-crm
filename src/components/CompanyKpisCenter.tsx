import React from 'react';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Target, TrendingUp } from 'lucide-react';
import { CompanyKpiMetric, OrganizationTenant } from '../types';

interface CompanyKpisCenterProps {
  currentOrg: OrganizationTenant;
  kpis: CompanyKpiMetric[];
}

const statusClass: Record<CompanyKpiMetric['status'], string> = {
  'En meta': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Atención: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Crítico: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'Sin datos': 'bg-slate-800 text-slate-300 border-slate-700',
};

const formatValue = (metric: CompanyKpiMetric, value: number) => {
  if (metric.unit === 'DOP') return `RD$${value.toLocaleString()}`;
  if (metric.unit === '%') return `${value}%`;
  return `${value.toLocaleString()} ${metric.unit.toLowerCase()}`;
};

export const CompanyKpisCenter: React.FC<CompanyKpisCenterProps> = ({ currentOrg, kpis }) => {
  const orgKpis = kpis.filter((kpi) => kpi.organizationId === currentOrg.id);
  const inTarget = orgKpis.filter((kpi) => kpi.status === 'En meta').length;
  const critical = orgKpis.filter((kpi) => kpi.status === 'Crítico').length;
  const attention = orgKpis.filter((kpi) => kpi.status === 'Atención').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>KPIs de empresa, alertas y recomendaciones de agentes</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">KPIs Empresa</h1>
          <p className="text-xs text-slate-400 mt-1">
            Ventas, marketing, finanzas, operaciones, compras, atención e inventario con metas,
            estado y siguiente acción recomendada.
          </p>
        </div>
        <span className="bg-slate-950 border border-slate-800 rounded-full px-3 py-1 text-xs font-black text-slate-300">
          {currentOrg.name}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'KPIs activos', value: orgKpis.length, icon: Activity, color: 'text-cyan-300' },
          { label: 'En meta', value: inTarget, icon: CheckCircle2, color: 'text-emerald-300' },
          { label: 'Atención', value: attention, icon: AlertTriangle, color: 'text-amber-300' },
          { label: 'Críticos', value: critical, icon: Target, color: 'text-rose-300' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <Icon className={`w-5 h-5 ${item.color} mb-3`} />
              <span className="text-[10px] uppercase font-black text-slate-500">{item.label}</span>
              <p className="text-3xl font-black text-white mt-1">{item.value}</p>
            </div>
          );
        })}
      </div>

      {orgKpis.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-black text-white">Sin KPIs reales todavía</h2>
          <p className="text-sm text-slate-400 mt-2">
            Cuando conectemos ventas, pagos, campañas, compras e inventario, el CRM calculará los
            indicadores de esta empresa sin datos inventados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orgKpis.map((metric) => {
            const progress =
              metric.targetValue > 0
                ? Math.min(100, Math.round((metric.currentValue / metric.targetValue) * 100))
                : 0;
            return (
              <div key={metric.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-black text-cyan-300">
                      {metric.area}
                    </span>
                    <h3 className="text-white font-black mt-1">{metric.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Responsable: {metric.ownerAgentId}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-full border ${statusClass[metric.status]}`}
                  >
                    {metric.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <span className="text-slate-500 uppercase font-bold text-[10px]">Actual</span>
                    <p className="text-white font-black mt-1">
                      {formatValue(metric, metric.currentValue)}
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <span className="text-slate-500 uppercase font-bold text-[10px]">Meta</span>
                    <p className="text-emerald-300 font-black mt-1">
                      {formatValue(metric, metric.targetValue)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] uppercase font-black text-slate-500 mb-1">
                    <span>Progreso</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full ${
                        metric.status === 'En meta'
                          ? 'bg-emerald-500'
                          : metric.status === 'Crítico'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-3 flex gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-300 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-300 leading-relaxed">{metric.recommendation}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
