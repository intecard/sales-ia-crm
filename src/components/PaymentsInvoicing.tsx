import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import {
  CommercialQuote,
  Course,
  ElectronicInvoice,
  Lead,
  PaymentTransaction,
  SalesOpportunity,
} from '../types';

interface PaymentsInvoicingProps {
  transactions: PaymentTransaction[];
  leads: Lead[];
  courses: Course[];
  opportunities: SalesOpportunity[];
  quotes: CommercialQuote[];
  electronicInvoices: ElectronicInvoice[];
  onAddTransaction: (tx: PaymentTransaction) => void;
}

const formatMoney = (amount: number, currency = 'DOP') =>
  `${currency === 'DOP' ? 'RD$' : '$'}${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export const PaymentsInvoicing: React.FC<PaymentsInvoicingProps> = ({
  transactions,
  leads,
  courses,
  opportunities,
  quotes,
  electronicInvoices,
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<ElectronicInvoice | null>(null);

  const totalCollected = transactions.reduce(
    (sum, tx) => sum + (tx.status === 'Completado' ? tx.amount : 0),
    0,
  );
  const totalInvoiced = electronicInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const pendingPayments = transactions.filter((tx) => tx.status === 'Pendiente').length;
  const acceptedQuotes = quotes.filter((quote) => quote.status === 'Aceptada').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cobros, Cotizaciones y Facturación Electrónica</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Flujo Fiscal y Comercial Multiempresa
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Convierte oportunidades en cotizaciones, cotizaciones en facturas e-CF y pagos en
            reportes. DGII, bancos y pasarelas permanecen en modo demo hasta conectar credenciales
            oficiales.
          </p>
        </div>

        <div className="bg-amber-950/40 border border-amber-500/30 text-amber-200 rounded-xl p-3 text-xs flex items-start gap-2 max-w-md">
          <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
          <span>
            Seguridad comercial: no se marca matrícula/cliente activo hasta validar pago. Facturas
            DGII reales requieren certificado digital, secuencias y endpoints oficiales.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Cobrado confirmado',
            value: formatMoney(totalCollected),
            icon: CheckCircle2,
            tone: 'text-emerald-400',
          },
          {
            label: 'Facturado demo e-CF',
            value: formatMoney(totalInvoiced),
            icon: FileText,
            tone: 'text-cyan-300',
          },
          {
            label: 'Cotizaciones aceptadas',
            value: acceptedQuotes.toString(),
            icon: ShieldCheck,
            tone: 'text-indigo-300',
          },
          {
            label: 'Pagos pendientes',
            value: pendingPayments.toString(),
            icon: Zap,
            tone: 'text-amber-300',
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

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 text-xs">
        {[
          'Lead capturado',
          'Oportunidad calificada',
          'Cotización enviada',
          'Factura e-CF generada',
          'Pago validado',
          'Seguimiento y reporte',
        ].map((step, index) => (
          <div key={step} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-500 font-bold">Paso {index + 1}</span>
            <p className="text-white font-bold mt-1">{step}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Cotizaciones comerciales
            </h2>
            <span className="text-xs text-slate-400">{quotes.length} emitidas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Cotización</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-300">{quote.quoteNumber}</td>
                    <td className="p-3 text-white font-semibold">{quote.customerName}</td>
                    <td className="p-3">
                      <span className="bg-slate-800 border border-slate-700 text-slate-200 px-2 py-0.5 rounded">
                        {quote.status}
                      </span>
                    </td>
                    <td className="p-3 text-right text-emerald-400 font-black">
                      {formatMoney(quote.total, quote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Facturas electrónicas e-CF
            </h2>
            <span className="text-xs text-slate-400">{electronicInvoices.length} demo</span>
          </div>
          <div className="divide-y divide-slate-800">
            {electronicInvoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                onClick={() => setSelectedInvoice(invoice)}
                className="w-full p-4 text-left hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-300" />
                      <span className="font-mono text-cyan-300 font-bold">{invoice.eNcf}</span>
                    </div>
                    <p className="text-sm text-white font-bold mt-1">{invoice.customerName}</p>
                    <p className="text-[11px] text-slate-400">
                      {invoice.fiscalType} · RNC/Cédula {invoice.customerTaxId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-black">
                      {formatMoney(invoice.total, invoice.currency)}
                    </p>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                      {invoice.dgiiStatus}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Cobros y comprobantes
          </h2>
          <span className="text-xs text-slate-400">
            {leads.length} leads · {courses.length} productos base · {opportunities.length}{' '}
            oportunidades
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Referencia</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Producto / Servicio</th>
                <th className="p-3.5">Medio</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-mono text-cyan-300">
                    <div>{tx.invoiceNumber || 'Pendiente'}</div>
                    <div className="text-[10px] text-slate-500">{tx.transactionRef}</div>
                  </td>
                  <td className="p-3.5 font-bold text-white">{tx.leadName}</td>
                  <td className="p-3.5">{tx.courseTitle}</td>
                  <td className="p-3.5">
                    <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                      {tx.gateway}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                        tx.status === 'Completado'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-black text-emerald-400">
                    {formatMoney(tx.amount, tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        {[
          { name: 'WhatsApp Business', status: 'Configurable' },
          { name: 'Meta Ads Lead Forms', status: 'Pendiente credenciales' },
          { name: 'Google Ads', status: 'Pendiente credenciales' },
          { name: 'DGII e-CF', status: 'Modo demo seguro' },
        ].map((integration) => (
          <div
            key={integration.name}
            className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3"
          >
            <Building2 className="w-4 h-4 text-indigo-300" />
            <div>
              <p className="font-bold text-white">{integration.name}</p>
              <span className="text-slate-400">{integration.status}</span>
            </div>
          </div>
        ))}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl relative text-xs">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start justify-between border-b border-slate-800 pb-4 gap-4">
              <div>
                <h3 className="font-black text-lg text-white">Factura electrónica demo</h3>
                <p className="text-slate-400">
                  NCF: {selectedInvoice.ncf} · e-NCF: {selectedInvoice.eNcf}
                </p>
              </div>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold">
                {selectedInvoice.integrationMode}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Cliente</span>
                <p className="font-bold text-white mt-1">{selectedInvoice.customerName}</p>
                <p className="text-slate-400">RNC/Cédula: {selectedInvoice.customerTaxId}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold">
                  Estado fiscal
                </span>
                <p className="font-bold text-amber-300 mt-1">{selectedInvoice.dgiiStatus}</p>
                <p className="text-slate-400">Pago: {selectedInvoice.paymentStatus}</p>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-950 p-3 flex justify-between text-slate-400 font-bold">
                <span>Subtotal</span>
                <span>{formatMoney(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
              </div>
              <div className="p-3 flex justify-between text-slate-300 border-t border-slate-800">
                <span>ITBIS / Impuestos</span>
                <span>{formatMoney(selectedInvoice.taxAmount, selectedInvoice.currency)}</span>
              </div>
              <div className="p-3 flex justify-between text-white font-black border-t border-slate-800">
                <span>Total</span>
                <span className="text-emerald-400">
                  {formatMoney(selectedInvoice.total, selectedInvoice.currency)}
                </span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <span className="text-[10px] text-cyan-300 font-bold uppercase">Auditoría</span>
              {selectedInvoice.auditTrail.map((item) => (
                <div key={item} className="flex items-start gap-2 text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => alert(`Descarga demo preparada: ${selectedInvoice.eNcf}.pdf`)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Descargar representación PDF demo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
