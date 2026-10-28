import { FiscalWorkspace } from './FiscalWorkspace';
import { PaymentGatewayPanel } from './PaymentGatewayPanel';
import type {
  CommercialQuote,
  Course,
  ElectronicInvoice,
  Lead,
  PaymentTransaction,
  SalesOpportunity,
} from '../types';
interface PaymentsInvoicingProps {
  organization: { id: string; name: string };
  transactions: PaymentTransaction[];
  leads: Lead[];
  courses: Course[];
  opportunities: SalesOpportunity[];
  quotes: CommercialQuote[];
  electronicInvoices: ElectronicInvoice[];
  onAddTransaction: (tx: PaymentTransaction) => void;
  deploymentMode?: 'production' | 'trial';
}
export function PaymentsInvoicing({ organization, transactions }: PaymentsInvoicingProps) {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {organization.id==='org_inteca_main' && <PaymentGatewayPanel />}
      <FiscalWorkspace key={organization.id} organization={organization} />
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-200">
        <h2 className="font-bold text-lg">Registro comercial de cobros</h2>
        <p className="mt-2 text-sm text-slate-400">
          Este historial de la sesión es independiente de los documentos fiscales persistentes del
          módulo superior. Un registro de cobro no acredita emisión ni aceptación de un e-CF.
        </p>
        <div className="overflow-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Cliente', 'Concepto', 'Importe', 'Estado registrado', 'Referencia'].map(
                  (title) => (
                    <th className="p-2 text-left" key={title}>
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="p-2">{tx.leadName}</td>
                  <td className="p-2">{tx.courseTitle}</td>
                  <td className="p-2">
                    {tx.currency} {tx.amount.toFixed(2)}
                  </td>
                  <td className="p-2">{tx.status}</td>
                  <td className="p-2">{tx.transactionRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!transactions.length && (
          <p className="text-sm mt-3 text-slate-400">Sin cobros registrados en esta sesión.</p>
        )}
      </section>
    </div>
  );
}
