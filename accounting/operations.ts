import {z} from 'zod';
import {amount,cents,journalSchema,type Journal} from './engine.ts';
const evidence=z.string().trim().min(3).max(170);
const bankRow=z.object({date:journalSchema.shape.date,reference:evidence,amount:z.string().regex(/^-?(0|[1-9]\d{0,11})(\.\d{1,2})?$/),}).strict().refine(v=>Number(v.amount)!==0,'El movimiento debe tener importe distinto de cero.');
export const reconciliationSchema=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),bank:z.array(bankRow).min(1).max(500)}).strict().refine(d=>d.bank.every(r=>r.date.startsWith(d.period)),'Los movimientos deben corresponder al período seleccionado.');
const norm=(s:string)=>s.trim().toUpperCase();
const signed=(v:string)=>v.startsWith('-')?-cents(v.slice(1)):cents(v);
const netBank=(j:Journal)=>j.lines.filter(x=>x.account==='1101').reduce((s,l)=>s+cents(l.debit)-cents(l.credit),0n);
/** A positive bank movement must equal a debit to cash/bank. Exact date and evidence reference are required. */
export function reconcile(input:z.infer<typeof reconciliationSchema>, ledger:{id:string;entry_date:string;payload:Journal}[]){
 const key=(date:string,ref:string,total:bigint)=>JSON.stringify([date,norm(ref),total.toString()]);
 const book=ledger.map(l=>({id:l.id,date:l.entry_date,reference:l.payload.evidence,net:netBank(l.payload)})).filter(l=>l.net!==0n);
 const byKey=new Map<string,typeof book>(), bankCount=new Map<string,number>();
 for(const l of book){if(!l.reference.trim())continue;const k=key(l.date,l.reference,l.net);byKey.set(k,[...(byKey.get(k)||[]),l]);}
 for(const r of input.bank){const k=key(r.date,r.reference,signed(r.amount));bankCount.set(k,(bankCount.get(k)||0)+1);}
 const used=new Set<string>();
 const movements=input.bank.map(r=>{const k=key(r.date,r.reference,signed(r.amount)),matches=byKey.get(k)||[];
  const status=bankCount.get(k)!>1||matches.length>1?'ambiguous':matches.length===1?'matched':'bank_only';
  const journalId=status==='matched'?matches[0].id:null;if(journalId)used.add(journalId);return {...r,status,journalId};
 });
 const unmatchedBook=book.filter(l=>!used.has(l.id)).map(({net,...l})=>({...l,amount:amount(net)}));
 const difference=input.bank.reduce((s,r)=>s+signed(r.amount),0n)-book.reduce((s,r)=>s+r.net,0n);
 return {movements,unmatchedBook,difference:amount(difference),matched:used.size,period:input.period,source:'Libro diario y movimientos aportados por el usuario',automaticPosting:false};
}
