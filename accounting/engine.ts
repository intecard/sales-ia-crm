import { z } from 'zod';
import { organizationSchema } from '../fiscal/engine.ts';
export const ACCOUNTS = {
  '1101': ['Caja y bancos','asset'], '1102': ['Cuentas por cobrar','asset'],
  '1103': ['Inventario','asset'], '1104': ['ITBIS por evaluar / recuperar','asset'],
  '1201': ['Activos fijos','asset'], '2101': ['Cuentas por pagar','liability'],
  '2102': ['ITBIS por pagar','liability'], '2103': ['Retenciones por pagar','liability'],
  '3101': ['Capital y patrimonio','equity'], '4101': ['Ingresos','income'],
  '5101': ['Costo de ventas','expense'], '6101': ['Gastos operativos','expense'],
} as const;
export const money = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/);
export const cents = (v: string) => { const [a,b='']=v.split('.'); return BigInt(a)*100n+BigInt(b.padEnd(2,'0')); };
export const amount = (v: bigint) => `${v<0n?'-':''}${(v<0n?-v:v)/100n}.${((v<0n?-v:v)%100n).toString().padStart(2,'0')}`;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{try{return new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}catch{return false;}});
export const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const line = z.object({account:z.enum(Object.keys(ACCOUNTS) as [keyof typeof ACCOUNTS,...(keyof typeof ACCOUNTS)[]]),debit:money.default('0'),credit:money.default('0')}).strict().refine(l=>(cents(l.debit)>0n)!==(cents(l.credit)>0n),'Cada línea debe tener débito o crédito, no ambos.');
export const journalSchema = z.object({requestId:z.string().uuid(),date,description:z.string().trim().min(3).max(500),kind:z.enum(['journal','purchase','sale','collection','payment','reversal']),counterparty:z.string().trim().max(200).default(''),taxId:z.string().regex(/^(\d{9}|\d{11})?$/).default(''),ncf:z.string().regex(/^(B\d{10}|E\d{12})?$/).default(''),evidence:z.string().trim().max(1000).default(''),reverses:z.string().uuid().optional(),lines:z.array(line).min(2).max(100)}).strict().superRefine((v,c)=>{
 if(v.lines.reduce((s,l)=>s+cents(l.debit)-cents(l.credit),0n)!==0n)c.addIssue({code:'custom',message:'El asiento no está balanceado.'});
 if(v.kind==='reversal'&&!v.reverses)c.addIssue({code:'custom',message:'Identifica el asiento a reversar.'});
 if(v.kind!=='reversal'&&v.reverses)c.addIssue({code:'custom',message:'Referencia reservada a reversiones.'});
});
export type Journal = z.infer<typeof journalSchema>;
export function reports(rows: {id:string;payload:Journal;created_at?:string}[]) {
 const balances:Record<string,bigint>=Object.fromEntries(Object.keys(ACCOUNTS).map(k=>[k,0n]));let debit=0n,credit=0n;
 for(const r of rows)for(const l of r.payload.lines){balances[l.account]+=cents(l.debit)-cents(l.credit);debit+=cents(l.debit);credit+=cents(l.credit);}
 const total=(kind:string)=>Object.entries(ACCOUNTS).filter(([,a])=>a[1]===kind).reduce((s,[k])=>s+balances[k],0n);
 const assets=total('asset'),liabilities=-total('liability'),equity=-total('equity'),income=-total('income'),expenses=total('expense'),profit=income-expenses;
 return {trialBalance:Object.entries(ACCOUNTS).map(([code,[name,type]])=>({code,name,type,balance:amount(balances[code])})),debit:amount(debit),credit:amount(credit),balanced:debit===credit,assets:amount(assets),liabilities:amount(liabilities),equity:amount(equity),income:amount(income),expenses:amount(expenses),profit:amount(profit),balanceDifference:amount(assets-liabilities-equity-profit),cash:amount(balances['1101']),receivables:amount(balances['1102']),payables:amount(-balances['2101'])};
}
export const obligationsSchema=z.object({period,items:z.array(z.object({form:z.enum(['606','607','608','609','623','987','612','613','615','616','629','IT-1','IR-17','IR-3','IR-2','IR-1','ACT','IR-18']),applicable:z.enum(['pending_review','yes','no']),dueOn:z.union([date,z.literal('')]),status:z.enum(['pending','prepared','submitted']),receipt:z.string().max(1000).default(''),notes:z.string().max(1000).default('')}).strict().refine(v=>v.status!=='submitted'||!!v.receipt.trim(),'Una presentación requiere referencia de la constancia.')).max(30)}).strict();
export { organizationSchema };
