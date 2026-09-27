import React from 'react';
import {
  Banknote,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  Landmark,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  AccountingReport,
  BankReconciliation,
  CashReceipt,
  DailyInventoryReport,
  PurchaseRequest,
} from '../types';

interface AccountingAutopilotProps {
  reports: AccountingReport[];
  purchaseRequests: PurchaseRequest[];
  cashReceipts: CashReceipt[];
  bankReconciliations: BankReconciliation[];
  inventoryReports: DailyInventoryReport[];
}

const formatMoney = (amount = 0, currency = 'DOP') =>
  `${currency === 'DOP' ? 'RD$' : '$'}${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const statusTone = (status: string) => {
  if (['Generado', 'Aprobado', 'Cuadrada', 'Normal'].includes(status)) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
  if (['En revisión', 'Diferencia pendiente', 'Bajo'].includes(status)) {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }
  if (['Pendiente datos', 'Crítico'].includes(status)) {
    return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  }
  return 'bg-slate-700/60 text-slate-200 border-slate-600';
};

export const AccountingAutopilot: React.FC<AccountingAutopilotProps> = ({
  reports,
  purchaseRequests,
  cashReceipts,
  bankReconciliations,
  inventoryReports,
}) => {
  const incomeReport = reports.find((report) => report.type === 'Estado de resultados');
  const balanceReport = reports.find((report) => report.type === 'Balance general');
  const cashFlowReport = reports.find((report) => report.type === 'Estado de flujo de efectivo');
  const totalReceipts = cashReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  const pendingPurchaseAmount = purchaseRequests
    .filter((request) => !['Aprobada', 'Recibida', 'Rechazada'].includes(request.status))
    .reduce((sum, request) => sum + request.amount, 0);
  const bankDifference = bankReconciliations.reduce((sum, rec) => sum + Math.abs(rec.difference), 0);
  const lowStockItems = inventoryReports.filter((item) => item.alertLevel !== 'Normal').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Calculator className="w-3.5 h-3.5" />
            <span>Agente Contable Autónomo</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Contabilidad, Estados Financieros y Control Operativo
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            El agente contable organiza ingresos, costos, gastos, activos, pasivos, patrimonio,
            flujo de efectivo, compras, recibos, conciliaciones e inventario diario. Deja cada
            documento listo para revisión, aprobación y exportación.
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs max-w-md">
          <div className="flex items-start gap-2 text-emerald-300">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Control: el agente prepara, clasifica y alerta. La aprobación final de estados
              financieros y envíos fiscales queda bajo responsable autorizado.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Ingresos recibidos',
            value: formatMoney(totalReceipts),
            icon: Banknote,
            tone: 'text-emerald-400',
          },
          {
            label: 'Compras pendientes',
            value: formatMoney(pendingPurchaseAmount),
            icon: ClipboardList,
            tone: 'text-amber-300',
          },
          {
            label: 'Diferencia bancaria',
            value: formatMoney(bankDifference),
            icon: Landmark,
            tone: bankDifference === 0 ? 'text-emerald-300' : 'text-rose-300',
          },
          {
            label: 'Alertas inventario',
            value: lowStockItems.toString(),
            icon: PackageCheck,
            tone: lowStockItems === 0 ? 'text-emerald-300' : 'text-amber-300',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-500 font-black tracking-wider">
                  {item.label}
                </span>
                <Icon className={`w-5 h-5 ${item.tone}`} />
              </div>
              <p className={`text-2xl font-black mt-3 ${item.tone}`}>{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {[
          {
            title: 'Estado de resultados',
            report: incomeReport,
            icon: TrendingUp,
            rows: [
              ['Ingresos', incomeReport?.totals.ingresos],
              ['Costos', incomeReport?.totals.costos],
              ['Gastos', incomeReport?.totals.gastos],
              ['Utilidad neta', incomeReport?.totals.utilidadNeta],
            ],
          },
          {
            title: 'Balance general',
            report: balanceReport,
            icon: FileSpreadsheet,
            rows: [
              ['Activos', balanceReport?.totals.activos],
              ['Pasivos', balanceReport?.totals.pasivos],
              ['Patrimonio', balanceReport?.totals.patrimonio],
            ],
          },
          {
            title: 'Estado de flujo de efectivo',
            report: cashFlowReport,
            icon: Banknote,
            rows: [
              ['Entradas', cashFlowReport?.totals.entradasEfectivo],
              ['Salidas', cashFlowReport?.totals.salidasEfectivo],
              ['Flujo neto', cashFlowReport?.totals.flujoNeto],
            ],
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-cyan-300" />
                  <h2 className="text-sm font-black text-white">{card.title}</h2>
                </div>
                {card.report && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTone(
                      card.report.status,
                    )}`}
                  >
                    {card.report.status}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-1">{card.report?.period}</p>
              <div className="mt-4 space-y-2">
                {card.rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs"
                  >
                    <span className="text-slate-400">{label}</span>
                    <span className="font-black text-white">{formatMoney(Number(value || 0))}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1.5">
                {card.report?.highlights.slice(0, 3).map((item) => (
                  <div key={item} className="flex items-start gap-2 text-[11px] text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-300 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-cyan-300 mt-4">{card.report?.nextAction}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Órdenes o solicitudes de compra
            </h2>
          </div>
          <div className="divide-y divide-slate-800">
            {purchaseRequests.map((request) => (
              <div key={request.id} className="p-4 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-cyan-300 font-bold">{request.requestNumber}</p>
                    <p className="font-bold text-white mt-1">{request.supplierName}</p>
                    <p className="text-slate-400 mt-1">{request.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-300">
                      {formatMoney(request.amount, request.currency)}
                    </p>
                    <span
                      className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTone(
                        request.status,
                      )}`}
                    >
                      {request.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Recibos de caja o ingreso
            </h2>
          </div>
          <div className="divide-y divide-slate-800">
            {cashReceipts.map((receipt) => (
              <div key={receipt.id} className="p-4 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-cyan-300 font-bold">{receipt.receiptNumber}</p>
                    <p className="font-bold text-white mt-1">{receipt.payerName}</p>
                    <p className="text-slate-400 mt-1">{receipt.concept}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-300">
                      {formatMoney(receipt.amount, receipt.currency)}
                    </p>
                    <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300">
                      {receipt.paymentMethod}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Conciliación bancaria
            </h2>
          </div>
          <div className="divide-y divide-slate-800">
            {bankReconciliations.map((rec) => (
              <div key={rec.id} className="p-4 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-white">
                      {rec.bankName} · {rec.accountMask}
                    </p>
                    <p className="text-slate-400 mt-1">{rec.period}</p>
                    <p className="text-slate-500 mt-2">
                      Interno {formatMoney(rec.internalBalance)} · Banco{' '}
                      {formatMoney(rec.bankStatementBalance)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-rose-300">{formatMoney(rec.difference)}</p>
                    <span
                      className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTone(
                        rec.status,
                      )}`}
                    >
                      {rec.status}
                    </span>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {rec.pendingItems.map((item) => (
                    <p key={item} className="text-[11px] text-slate-400">
                      - {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Inventario diario
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Item</th>
                  <th className="p-3">Inicial</th>
                  <th className="p-3">Entradas</th>
                  <th className="p-3">Salidas</th>
                  <th className="p-3">Final</th>
                  <th className="p-3">Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {inventoryReports.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{item.itemName}</td>
                    <td className="p-3 text-slate-300">{item.openingStock}</td>
                    <td className="p-3 text-emerald-300">{item.entries}</td>
                    <td className="p-3 text-amber-300">{item.exits}</td>
                    <td className="p-3 text-cyan-300 font-black">{item.closingStock}</td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTone(
                          item.alertLevel,
                        )}`}
                      >
                        {item.alertLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-black text-white uppercase tracking-wider">
          Reglas contables incorporadas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <p className="text-cyan-300 font-black">NIF B-6: Estado de Situación Financiera</p>
            <p className="text-slate-400 mt-2">
              Plantilla para balance general con activos, pasivos y capital contable, en forma de
              reporte vertical o cuenta horizontal. Facilita comparación por periodos y empresas.
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <p className="text-indigo-300 font-black">NIF B-7: Adquisiciones de Negocios</p>
            <p className="text-slate-400 mt-2">
              Guía para registrar compras, absorciones o fusiones: valuación de activos y pasivos,
              reconocimiento de crédito mercantil y diferencias por adquisición.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

