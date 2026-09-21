import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Download,
  FileText,
  DollarSign,
  ShieldCheck,
  Search,
  ExternalLink,
  Plus,
  X,
  Sparkles,
  Zap,
  Building2
} from 'lucide-react';
import { PaymentTransaction, Lead, Course } from '../types';

interface PaymentsInvoicingProps {
  transactions: PaymentTransaction[];
  leads: Lead[];
  courses: Course[];
  onAddTransaction: (tx: PaymentTransaction) => void;
}

export const PaymentsInvoicing: React.FC<PaymentsInvoicingProps> = ({
  transactions,
  leads,
  courses,
  onAddTransaction
}) => {
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const totalRevenue = transactions.reduce((sum, t) => sum + (t.status === 'Completado' ? t.amount : 0), 0);

  const handleOpenInvoice = (tx: PaymentTransaction) => {
    setSelectedTx(tx);
    setIsInvoiceModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pasarelas de Pago Multi-Moneda & Facturación Automática</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Cobros, Comprobantes & Activación de Cursos</h1>
          <p className="text-xs text-slate-400 mt-1">
            Procesa pagos vía Stripe, PayPal, Square, Google Pay, Apple Pay y transferencias. Emitir facturas fiscales y enrolar al estudiante sin intervención humana.
          </p>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">Total Recaudado:</span>
            <span className="text-lg font-black text-emerald-400">${totalRevenue.toLocaleString()} USD</span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-slate-400 block text-[10px]">Integración Pasarelas:</span>
            <span className="text-xs font-bold text-cyan-300">● 7 Activas</span>
          </div>
        </div>
      </div>

      {/* Gateway Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {[
          { name: 'Stripe', logo: '💳', status: 'Conectado API' },
          { name: 'PayPal', logo: '🅿️', status: 'Conectado API' },
          { name: 'Square', logo: '⬛', status: 'Conectado API' },
          { name: 'Google Pay', logo: '🌐', status: 'Activo Mobile' },
          { name: 'Apple Pay', logo: '🍎', status: 'Activo iOS' },
          { name: 'Transferencias', logo: '🏦', status: 'Validación IA' }
        ].map((gw) => (
          <div key={gw.name} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center gap-2.5">
            <span className="text-xl">{gw.logo}</span>
            <div>
              <div className="font-bold text-white text-xs">{gw.name}</div>
              <span className="text-[10px] text-emerald-400 font-semibold">{gw.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Historial de Transacciones & Facturas</h2>
          <span className="text-xs text-slate-400">Total: <strong>{transactions.length}</strong> transacciones</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5">Ref. / Factura</th>
                <th className="p-3.5">Estudiante</th>
                <th className="p-3.5">Programa Académico</th>
                <th className="p-3.5">Pasarela</th>
                <th className="p-3.5">Monto</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5 text-right">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3.5 font-mono text-cyan-300 font-bold">
                    <div>{tx.invoiceNumber}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{tx.transactionRef}</div>
                  </td>
                  <td className="p-3.5 font-bold text-white">{tx.leadName}</td>
                  <td className="p-3.5 text-slate-300">{tx.courseTitle}</td>
                  <td className="p-3.5">
                    <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px]">
                      {tx.gateway}
                    </span>
                  </td>
                  <td className="p-3.5 font-extrabold text-emerald-400">${tx.amount} {tx.currency}</td>
                  <td className="p-3.5">
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => handleOpenInvoice(tx)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1 rounded-lg text-xs"
                    >
                      Ver Factura PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Invoice PDF Modal */}
      {isInvoiceModalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 space-y-6 shadow-2xl relative text-xs">
            <button
              onClick={() => setIsInvoiceModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Invoice Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg text-white">INTECA EDUCATION GROUP</span>
                </div>
                <p className="text-[10px] text-slate-400">RUC / TAX ID: 20601928301 • Campus Internacional</p>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold text-sm">{selectedTx.invoiceNumber}</span>
                <p className="text-[10px] text-slate-400">Emitido: {new Date(selectedTx.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Estudiante Matriculado:</span>
              <p className="font-bold text-sm text-white">{selectedTx.leadName}</p>
              <p className="text-slate-400">Estado de Cuenta: <span className="text-emerald-400 font-bold">PAGADO EN SU TOTALIDAD</span></p>
            </div>

            {/* Item Breakdown */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-950 p-2.5 font-bold text-slate-400 border-b border-slate-800 flex justify-between">
                <span>Descripción del Item</span>
                <span>Importe</span>
              </div>
              <div className="p-3.5 flex justify-between items-center bg-slate-900">
                <div>
                  <div className="font-bold text-white">{selectedTx.courseTitle}</div>
                  <div className="text-[10px] text-indigo-300">Código Activación: {selectedTx.courseActivationCode}</div>
                </div>
                <span className="font-black text-sm text-emerald-400">${selectedTx.amount} USD</span>
              </div>
            </div>

            {/* Activation Notice */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl text-emerald-300 text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <span>Acceso al Campus Virtual INTECA activado automáticamente. Credenciales enviadas por correo y WhatsApp.</span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => {
                  alert(`Descargando comprobante PDF: ${selectedTx.invoiceNumber}.pdf`);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Factura PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
