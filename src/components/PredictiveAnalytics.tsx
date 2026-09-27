import React from 'react';
import {
  BarChart3,
  TrendingUp,
  BrainCircuit,
  Clock,
  Sparkles,
  Target,
  AlertTriangle,
  Award,
  Zap,
  Globe,
} from 'lucide-react';
import { Lead, Course } from '../types';

interface PredictiveAnalyticsProps {
  leads: Lead[];
  courses: Course[];
}

export const PredictiveAnalytics: React.FC<PredictiveAnalyticsProps> = ({ leads, courses }) => {
  const highProbabilityLeads = leads.filter((l) => l.buyProbability >= 80);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <BrainCircuit className="w-3.5 h-3.5 text-cyan-300" />
            <span>Motor Predictivo de Ventas INTECA AI Engine</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Predicciones de Compra, Probabilidad & Horarios Óptimos
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Machine Learning enfocado en predecir quién comprará, qué programa educacional elegirá,
            riesgo de abandono y la hora exacta de mayor conversión.
          </p>
        </div>
      </div>

      {/* Grid: High Buy Probability Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Card 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">
                Leads con Alta Probabilidad de Pago en 24h
              </h2>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
              {highProbabilityLeads.length} Oportunidades
            </span>
          </div>

          <div className="space-y-3">
            {highProbabilityLeads.map((lead) => {
              const courseObj = courses.find((c) => c.id === lead.courseOfInterestId);

              return (
                <div
                  key={lead.id}
                  className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-xs text-white">
                      {lead.firstName} {lead.lastName}
                    </h3>
                    <p className="text-[11px] text-cyan-300">
                      {courseObj?.title || 'Curso INTECA'}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {lead.country} • {lead.source}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-emerald-400">
                      {lead.buyProbability}% Prob.
                    </span>
                    <p className="text-[10px] text-amber-300 font-medium">
                      Recomendación: Enviar cupon 40%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Radar Card 2: Matrix of Optimal Contact Times */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white">
                Matriz de Horarios Óptimos de Envío por País
              </h2>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-300">
            {[
              {
                country: 'México (CDMX / Monterrey)',
                bestTime: '18:30 - 21:00 GMT-6',
                channel: 'WhatsApp Audio',
              },
              {
                country: 'Colombia (Bogotá / Medellín)',
                bestTime: '19:00 - 21:30 GMT-5',
                channel: 'Email + WhatsApp',
              },
              {
                country: 'Chile (Santiago)',
                bestTime: '20:00 - 22:00 GMT-4',
                channel: 'WhatsApp Direct',
              },
              {
                country: 'Perú (Lima)',
                bestTime: '18:00 - 20:30 GMT-5',
                channel: 'WhatsApp Audio',
              },
            ].map((m) => (
              <div
                key={m.country}
                className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-white block">{m.country}</span>
                  <span className="text-[11px] text-cyan-300">Canal Recomendado: {m.channel}</span>
                </div>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                  {m.bestTime}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
