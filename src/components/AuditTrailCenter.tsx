import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  History,
  Search,
  ShieldCheck,
  User,
  Webhook,
} from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditTrailCenterProps {
  auditLogs: AuditLogEntry[];
}

const severityTone = (severity: AuditLogEntry['severity']) => {
  if (severity === 'Éxito') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (severity === 'Advertencia') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (severity === 'Crítico') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
};

const actorIcon = (actorType: AuditLogEntry['actorType']) => {
  if (actorType === 'Agente IA') return Bot;
  if (actorType === 'Usuario') return User;
  if (actorType === 'Webhook') return Webhook;
  return ShieldCheck;
};

export const AuditTrailCenter: React.FC<AuditTrailCenterProps> = ({ auditLogs }) => {
  const [moduleFilter, setModuleFilter] = useState<'Todos' | AuditLogEntry['module']>('Todos');
  const [severityFilter, setSeverityFilter] = useState<'Todas' | AuditLogEntry['severity']>(
    'Todas',
  );
  const [searchTerm, setSearchTerm] = useState('');

  const modules = useMemo(
    () => Array.from(new Set(auditLogs.map((log) => log.module))).sort(),
    [auditLogs],
  );

  const filteredLogs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesModule = moduleFilter === 'Todos' || log.module === moduleFilter;
      const matchesSeverity = severityFilter === 'Todas' || log.severity === severityFilter;
      const matchesSearch =
        !search ||
        [log.actorName, log.summary, log.details, log.entityType, log.entityId || '']
          .join(' ')
          .toLowerCase()
          .includes(search);

      return matchesModule && matchesSeverity && matchesSearch;
    });
  }, [auditLogs, moduleFilter, searchTerm, severityFilter]);

  const criticalOrReview = auditLogs.filter(
    (log) => log.severity === 'Crítico' || log.status === 'Pendiente revisión',
  ).length;

  const handleExport = () => {
    const payload = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sales-ai-crm-auditoria-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-slate-700/40 text-slate-200 border border-slate-600 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <History className="w-3.5 h-3.5 text-cyan-300" />
            <span>Auditoría completa del CRM</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Historial de acciones, agentes, campañas, pagos y webhooks
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Cada acción importante queda registrada con hora, responsable, módulo, canal, entidad y
            detalle. En producción este historial debe persistirse en base de datos para auditoría
            fiscal, comercial y operativa.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-xs px-4 py-2.5 rounded-xl"
        >
          <Download className="w-4 h-4" />
          Exportar JSON
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Eventos registrados',
            value: auditLogs.length.toString(),
            icon: History,
            tone: 'text-cyan-300',
          },
          {
            label: 'Pendientes de revisión',
            value: criticalOrReview.toString(),
            icon: AlertTriangle,
            tone: 'text-amber-300',
          },
          {
            label: 'Agentes auditados',
            value: new Set(auditLogs.map((log) => log.actorName)).size.toString(),
            icon: Bot,
            tone: 'text-purple-300',
          },
          {
            label: 'Módulos cubiertos',
            value: modules.length.toString(),
            icon: ShieldCheck,
            tone: 'text-emerald-400',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-500 font-black tracking-wider">
                  {card.label}
                </span>
                <Icon className={`w-5 h-5 ${card.tone}`} />
              </div>
              <p className={`text-2xl font-black mt-3 ${card.tone}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por agente, lead, campaña, pago, webhook o detalle..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <select
              value={moduleFilter}
              onChange={(event) =>
                setModuleFilter(event.target.value as 'Todos' | AuditLogEntry['module'])
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white"
            >
              <option value="Todos">Todos los módulos</option>
              {modules.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleName}
                </option>
              ))}
            </select>
          </div>

          <select
            value={severityFilter}
            onChange={(event) =>
              setSeverityFilter(event.target.value as 'Todas' | AuditLogEntry['severity'])
            }
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-white"
          >
            <option value="Todas">Todas las severidades</option>
            <option value="Info">Info</option>
            <option value="Éxito">Éxito</option>
            <option value="Advertencia">Advertencia</option>
            <option value="Crítico">Crítico</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Línea de tiempo auditada
          </h2>
          <span className="text-xs text-slate-400">{filteredLogs.length} eventos visibles</span>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredLogs.map((log) => {
            const Icon = actorIcon(log.actorType);
            return (
              <div key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-cyan-300" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{log.summary}</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityTone(
                            log.severity,
                          )}`}
                        >
                          {log.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{log.details}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{log.actorType}: {log.actorName}</span>
                        <span>·</span>
                        <span>{log.module}</span>
                        <span>·</span>
                        <span>{log.action} {log.entityType}</span>
                        {log.entityId && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-cyan-300">{log.entityId}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs lg:text-right text-slate-400 min-w-44">
                    <div className="flex lg:justify-end items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 flex lg:justify-end gap-2">
                      {log.sourceChannel && (
                        <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                          {log.sourceChannel}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          log.status === 'Resuelto'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : log.status === 'Pendiente revisión'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            No hay eventos con esos filtros.
          </div>
        )}
      </div>
    </div>
  );
};
