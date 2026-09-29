import React from 'react';
import {
  ClipboardList,
  FileText,
  Globe2,
  PackageCheck,
  ShoppingCart,
  TrendingDown,
} from 'lucide-react';
import {
  DailyInventoryReport,
  OrganizationTenant,
  ProcurementAgentTask,
  PurchaseRequest,
  SupplierQuoteEvaluation,
} from '../types';

interface ProcurementCommandCenterProps {
  currentOrg: OrganizationTenant;
  purchaseRequests: PurchaseRequest[];
  inventoryReports: DailyInventoryReport[];
  quoteEvaluations: SupplierQuoteEvaluation[];
  procurementTasks: ProcurementAgentTask[];
}

export const ProcurementCommandCenter: React.FC<ProcurementCommandCenterProps> = ({
  currentOrg,
  purchaseRequests,
  inventoryReports,
  quoteEvaluations,
  procurementTasks,
}) => {
  const orgPurchaseRequests = purchaseRequests.filter(
    (request) => request.organizationId === currentOrg.id,
  );
  const orgInventory = inventoryReports.filter((report) => report.organizationId === currentOrg.id);
  const orgQuotes = quoteEvaluations.filter((quote) => quote.organizationId === currentOrg.id);
  const orgTasks = procurementTasks.filter((task) => task.organizationId === currentOrg.id);
  const avgSavings =
    orgTasks.length > 0
      ? Math.round(
          orgTasks.reduce((total, task) => total + task.expectedSavingPercent, 0) / orgTasks.length,
        )
      : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Departamento autónomo de compras nacionales e internacionales</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Compras IA</h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestiona requisiciones, cotizaciones, negociación, órdenes de compra, inventario y
            trazabilidad completa por empresa.
          </p>
        </div>
        <span className="bg-slate-950 border border-slate-800 rounded-full px-3 py-1 text-xs font-black text-slate-300">
          Empresa: {currentOrg.name}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Requisiciones', value: orgPurchaseRequests.length, icon: ClipboardList },
          { label: 'Cotizaciones evaluadas', value: orgQuotes.length, icon: FileText },
          { label: 'Tareas de agentes', value: orgTasks.length, icon: Globe2 },
          { label: 'Ahorro esperado', value: `${avgSavings}%`, icon: TrendingDown },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <Icon className="w-5 h-5 text-cyan-300 mb-3" />
              <span className="text-[10px] uppercase font-black text-slate-500">{item.label}</span>
              <p className="text-3xl font-black text-white mt-1">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Globe2 className="w-4 h-4 text-emerald-300" />
            Agentes de compras
          </h2>
          {orgTasks.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300">
              No hay tareas de compras reales todavía. Crea una requisición o carga una cotización
              para que los agentes evalúen precio, calidad, garantía, entrega y riesgo.
            </div>
          ) : (
            <div className="space-y-3">
              {orgTasks.map((task) => (
                <div key={task.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{task.agentName}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {task.scope} · {task.taskType} · {task.supplierOrItem}
                      </p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 rounded-full border bg-blue-500/20 text-blue-300 border-blue-500/30">
                      {task.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">
                        Ahorro esperado
                      </span>
                      <p className="text-emerald-300 font-black">{task.expectedSavingPercent}%</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">
                        Próxima acción
                      </span>
                      <p className="text-slate-200 font-bold">{task.nextAction}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-amber-300" />
            Evaluación de cotizaciones
          </h2>
          {orgQuotes.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300">
              Sin cotizaciones evaluadas. El agente puede comparar proveedores locales o
              internacionales cuando cargues solicitud, monto y condiciones.
            </div>
          ) : (
            <div className="space-y-3">
              {orgQuotes.map((quote) => {
                const score = Math.round(
                  (quote.warrantyScore +
                    quote.qualityScore +
                    quote.priceScore +
                    quote.complianceScore) /
                    4,
                );
                return (
                  <div
                    key={quote.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-white">{quote.supplierName}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {quote.country} · {quote.quoteNumber} · {quote.requestedItem}
                        </p>
                      </div>
                      <span className="text-[10px] font-black px-2 py-1 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                        Score {score}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <span className="text-slate-500 uppercase font-bold text-[10px]">
                          Precio
                        </span>
                        <p className="font-black text-white">{quote.priceScore}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <span className="text-slate-500 uppercase font-bold text-[10px]">
                          Calidad
                        </span>
                        <p className="font-black text-white">{quote.qualityScore}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <span className="text-slate-500 uppercase font-bold text-[10px]">
                          Garantía
                        </span>
                        <p className="font-black text-white">{quote.warrantyScore}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <span className="text-slate-500 uppercase font-bold text-[10px]">
                          Entrega
                        </span>
                        <p className="font-black text-white">{quote.deliveryDays} días</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                      {quote.recommendation}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-cyan-300" />
            Requisiciones y órdenes de compra
          </h2>
          <div className="space-y-3">
            {orgPurchaseRequests.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300">
                No hay requisiciones reales registradas para esta empresa.
              </div>
            ) : (
              orgPurchaseRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{request.requestNumber}</h3>
                      <p className="text-xs text-slate-400 mt-1">{request.description}</p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/30">
                      {request.status}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-300 font-black mt-3">
                    {request.currency} {request.amount.toLocaleString()} · {request.supplierName}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <PackageCheck className="w-4 h-4 text-emerald-300" />
            Inventario conectado
          </h2>
          <div className="space-y-3">
            {orgInventory.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300">
                No hay inventario real cargado. Al recibir una compra, el agente actualiza entradas,
                salidas y alertas.
              </div>
            ) : (
              orgInventory.map((report) => (
                <div
                  key={report.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{report.itemName}</h3>
                      <p className="text-xs text-slate-400 mt-1">Fecha: {report.reportDate}</p>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-1 rounded-full border ${
                        report.alertLevel === 'Normal'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {report.alertLevel}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-2">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">
                        Inicial
                      </span>
                      <p className="text-white font-black">{report.openingStock}</p>
                    </div>
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-2">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">
                        Entradas
                      </span>
                      <p className="text-emerald-300 font-black">{report.entries}</p>
                    </div>
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-2">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">
                        Salidas
                      </span>
                      <p className="text-rose-300 font-black">{report.exits}</p>
                    </div>
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-2">
                      <span className="text-slate-500 uppercase font-bold text-[10px]">Cierre</span>
                      <p className="text-cyan-300 font-black">{report.closingStock}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
