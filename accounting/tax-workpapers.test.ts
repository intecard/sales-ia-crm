import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTaxWorkpaper,prepareTaxSchema,TAX_FORMS,FORM_DETAILS} from './tax-workpapers.ts';
import type {Journal} from './engine.ts';
const company={legalName:'Empresa de Prueba SRL',taxId:'123456789',address:'Calle ficticia, Santo Domingo',country:'DO',activity:'Formación'};
const all={bank:true,sales:true,purchases:true,cancelledNcf:true,foreignPayments:true,otherSources:true};
const purchase:Journal={requestId:'11111111-1111-4111-8111-111111111111',date:'2026-10-08',
 kind:'purchase',description:'Compra registrada',taxId:'',ncf:'',evidence:'',counterparty:'Proveedor',
 lines:[{account:'6101',debit:'250.00',credit:'0'},{account:'2101',debit:'0',credit:'250.00'}]};
const sale:Journal={...purchase,requestId:'22222222-2222-4222-8222-222222222222',kind:'sale',
 description:'Ingreso',lines:[{account:'1101',debit:'800.00',credit:'0'},{account:'4101',debit:'0',credit:'800.00'}]};
const entries=[{id:'11111111-1111-4111-8111-111111111111',period:'2026-10',payload:purchase},
 {id:'22222222-2222-4222-8222-222222222222',period:'2026-10',payload:sale}];
const make=(form:(typeof TAX_FORMS)[number],rows=entries,extra:any={})=>prepareTaxWorkpaper({
 organization:'inteca_company',period:'2026-10',form,rows,
 profile:company,obligation:{applicable:'yes',dueOn:'',status:'pending'},
 periodClosed:true,...extra,
});
test('all seven form types have source-derived workpapers, never fake official filing',()=>{
 for(const form of TAX_FORMS){
  const x=make(form);
  assert.equal(x.form,form);assert.equal(x.submittedToDGII,false);
  assert.equal(x.officialFileGenerated,false);
  assert.equal(x.classification,'BORRADOR_INTERNO_NO_APTO_PARA_DGII');
  assert.match(x.sourceHash,/^[0-9a-f]{64}$/);
  assert.equal(x.state,'draft_incomplete');
  assert.ok(x.warnings.length>=1);
  assert.equal(x.cadence,FORM_DETAILS[form].cadence);
 }
});
test('606 and 607 include correct documents, but flag NCF, ITBIS, withholding and classification gaps',()=>{
 const p=make('606');assert.equal(p.entries.length,1);
 assert.equal(p.entries[0].indicativeTotal,'250.00');
 assert.ok(p.entries[0].missingOfficialFields.some(x=>x.includes('ITBIS')));
 assert.equal(p.amountsIndicativeOnly.purchases,'250.00');
 const s=make('607');assert.equal(s.entries.length,1);
 assert.equal(s.entries[0].indicativeTotal,'800.00');
 assert.ok(s.entries[0].missingOfficialFields.some(x=>x.includes('NCF')));
 assert.equal(s.amountsIndicativeOnly.sales,'800.00');
});
test('No ledger entries never means zero unless a confirmed obligation, profile, closed period and all sources attested',()=>{
 for(const form of TAX_FORMS){
  const empty=make(form,[]);
  assert.equal(empty.state,'draft_incomplete');
  assert.ok(empty.warnings.some(w=>w.includes('Sin asientos')||w.includes('año')||w.includes('comprobantes')||w.includes('no identifica')||w.includes('El libro')));
  const candidate=make(form,[],{evidence:all});
  if(['IR-2','ACT'].includes(form))assert.equal(candidate.state,'draft_incomplete');
  else assert.equal(candidate.state,'zero_candidate_requires_human_review');
 }
 assert.equal(make('606',[],{evidence:all,periodClosed:false}).state,'draft_incomplete');
 assert.equal(make('606',[],{evidence:all,profile:null}).state,'draft_incomplete');
 assert.equal(make('606',[],{evidence:all,obligation:{applicable:'pending_review'}}).state,'draft_incomplete');
});
test('A company identity from another org is not assumed; missing RNC remains missing',()=>{
 const x=make('IT-1',entries,{profile:null});
 assert.equal(x.issuer,null);
 assert.ok(x.warnings.some(x=>x.includes('RNC')));
});
test('Annual IR-2/ACT workpaper includes all journals in fiscal year and requires annexes',()=>{
 const more=[...entries,{id:'3',period:'2026-04',payload:{...sale,date:'2026-04-01'}},{id:'4',period:'2025-10',payload:{...sale,date:'2025-10-01'}}];
 const ir=make('IR-2',more);
 assert.equal(ir.period,'2026');assert.equal(ir.sourceCount,3);
 assert.equal(ir.sourceJournalIds.includes('4'),false);
 assert.ok(ir.warnings.some(x=>x.includes('estados financieros')));
});
test('Invalid form, invalid month or unrecognized evidence keys are rejected',()=>{
 assert.equal(prepareTaxSchema.safeParse({form:'999',period:'2026-10'}).success,false);
 assert.equal(prepareTaxSchema.safeParse({form:'606',period:'2026-13'}).success,false);
 assert.equal(prepareTaxSchema.safeParse({form:'607',period:'2026-10',evidence:{...all,guess:true}}).success,false);
});
