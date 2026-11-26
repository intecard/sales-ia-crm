import assert from 'node:assert/strict';
import test from 'node:test';
import {reconcile,reconciliationSchema} from './operations.ts';
import {journalSchema,reports} from './engine.ts';
import {operationTemplate} from './operation-templates.ts';
const date='2026-11-20';
function item(id:string,reference:string,net:string){return {id,entry_date:date,payload:journalSchema.parse({requestId:crypto.randomUUID(),date,description:'Asiento de prueba',kind:'journal',evidence:reference,lines:[{account:'1101',debit:net},{account:'4101',credit:net}]})};}
test('bank reconciliation takes only one-to-one exact matches and leaves duplicates and missing entries for review',()=>{
 const bank=reconciliationSchema.parse({period:'2026-11',bank:[{date,reference:'REF 001',amount:'200'},{date,reference:'REPETIDO',amount:'150.00'},{date,reference:'REPETIDO',amount:'150'},{date,reference:'OTRO',amount:'-60'}]});
 const result=reconcile(bank,[item('matched','ref 001','200'),item('ambiguous','REPETIDO','150'),item('book','SOLO LIBRO','70')]);
 assert.deepEqual(result.movements.map(m=>m.status),['matched','ambiguous','ambiguous','bank_only']);
 assert.equal(result.matched,1);assert.equal(result.difference,'20.00');assert.deepEqual(result.unmatchedBook.map(r=>r.id),['ambiguous','book']);assert.equal(result.automaticPosting,false);
});
test('payroll templates balance the ledger and separate wage expense from outstanding payroll',()=>{
 const make=(t:'payroll_accrual'|'payroll_payment',total:string)=>{const p=operationTemplate[t];return {id:t,payload:journalSchema.parse({requestId:crypto.randomUUID(),date,description:p.label,kind:p.kind,evidence:'Comprobante de prueba',lines:[{account:p.debit,debit:total},{account:p.credit,credit:total}]})};};
 const posted=reports([make('payroll_accrual','1000'),make('payroll_payment','800')]);
 assert.equal(posted.expenses,'1000.00');assert.equal(posted.liabilities,'200.00');assert.equal(posted.cash,'-800.00');assert.equal(posted.balanceDifference,'0.00');
});
