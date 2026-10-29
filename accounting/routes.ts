import express from 'express';
import { z } from 'zod';
import { ACCOUNTS, journalSchema, reports, organizationSchema, period, obligationsSchema } from './engine.ts';
import {TAX_FORMS,FORM_DETAILS,prepareTaxSchema,prepareTaxWorkpaper} from './tax-workpapers.ts';
type Store={request:(resource:string,method?:string,body?:unknown)=>Promise<any[]>};
export function createAccountingRouter(store:Store,actor:()=>string){
 const r=express.Router();
 const run=(fn:(req:express.Request,res:express.Response)=>Promise<unknown>)=>(req:express.Request,res:express.Response)=>void fn(req,res).catch(e=>res.status(e instanceof z.ZodError?400:409).json({error:e instanceof z.ZodError?e.issues.map(i=>i.message).join(' · '):'No se pudo confirmar la operación. Comprueba el período, el balance, los duplicados y el almacenamiento.'}));
 r.use('/:org',(req,res,next)=>organizationSchema.safeParse(req.params.org).success?next():res.status(400).json({error:'Empresa inválida.'}));
 const rows=async(org:string,p?:string)=>{const data=await store.request(`crm_accounting_journals?organization_id=eq.${encodeURIComponent(org)}${p?`&period=lte.${p}`:''}&select=*&order=entry_date,id&limit=5001`);if(data.length>5000)throw Error('REPORT_LIMIT');return data;};
 r.get('/:org',run(async(req,res)=>{const p=period.parse(req.query.period);const all=await rows(String(req.params.org),p),current=all.filter(v=>v.period===p);const settings=await store.request(`crm_accounting_periods?organization_id=eq.${encodeURIComponent(String(req.params.org))}&period=eq.${p}&select=*`);res.json({accounts:ACCOUNTS,entries:current,period:p,periodReport:reports(current),cumulativeReport:reports(all),settings:settings[0]||null,officialEmissionEnabled:false});}));
 r.get('/:org/agent-review',run(async(req,res)=>{const p=period.parse(req.query.period);const all=await rows(String(req.params.org),p);const current=all.filter(v=>v.period===p);const report=reports(current);const obligations=(await store.request(`crm_accounting_periods?organization_id=eq.${encodeURIComponent(String(req.params.org))}&period=eq.${p}&select=payload`))[0]?.payload;res.json({agent:'Agente IA Contable y Facturación',period:p,source:'supabase_ledger',report,alerts:[...(!current.length?['Sin asientos en este período. Revisa las obligaciones antes de preparar una presentación en cero.']:[]),...current.filter(v=>['purchase','sale'].includes(v.payload.kind)&&(!v.payload.evidence||!v.payload.ncf)).map(v=>`Revisar soporte y comprobante del asiento ${v.id}.`),...(!obligations?['Falta confirmar las obligaciones del RNC para este período.']:obligations.items.filter((v:any)=>v.applicable==='pending_review'||(v.applicable==='yes'&&(!v.dueOn||v.status!=='submitted'))).map((v:any)=>`Formulario ${v.form}: revisar aplicabilidad, vencimiento y constancia.`))],nextSteps:['Contrastar los movimientos con sus evidencias.','Confirmar el tratamiento de ITBIS y retenciones con el responsable fiscal.','Preparar los formatos oficiales aplicables y validarlos antes de presentar.'],officialSubmission:false,automaticPosting:false});}));
 r.post('/:org/journals',run(async(req,res)=>{const body=journalSchema.parse(req.body);res.status(201).json(await store.request('rpc/crm_accounting_post','POST',{p_org:String(req.params.org),p_payload:body,p_actor:actor()}));}));
 r.post('/:org/reverse/:id',run(async(req,res)=>{const id=z.string().uuid().parse(req.params.id);const original=(await store.request(`crm_accounting_journals?organization_id=eq.${encodeURIComponent(String(req.params.org))}&id=eq.${id}&select=*`))[0];if(!original)throw Error('NOT_FOUND');const input=z.object({requestId:z.string().uuid(),date:z.string(),reason:z.string().min(3).max(400)}).parse(req.body);const body=journalSchema.parse({...original.payload,requestId:input.requestId,date:input.date,kind:'reversal',reverses:id,description:input.reason,lines:original.payload.lines.map((l:any)=>({...l,debit:l.credit,credit:l.debit}))});res.status(201).json(await store.request('rpc/crm_accounting_post','POST',{p_org:String(req.params.org),p_payload:body,p_actor:actor()}));}));
 r.post('/:org/period',run(async(req,res)=>{const body=obligationsSchema.extend({closed:z.boolean(),bankBalance:z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/),reconciliationNotes:z.string().max(2000)}).parse(req.body);res.json(await store.request('rpc/crm_accounting_period_save','POST',{p_org:String(req.params.org),p_payload:body,p_actor:actor()}));}));
 r.get('/:org/export',run(async(req,res)=>{const p=period.parse(req.query.period);const data=(await rows(String(req.params.org),p)).filter(v=>v.period===p);const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const output=[['Fecha','Asiento','Tipo','Descripción','Tercero','RNC','NCF','Cuenta','Débito','Crédito','Evidencia'],...data.flatMap(v=>v.payload.lines.map((l:any)=>[v.entry_date,v.id,v.payload.kind,v.payload.description,v.payload.counterparty,v.payload.taxId,v.payload.ncf,l.account,l.debit,l.credit,v.payload.evidence]))].map(row=>row.map(cell).join(',')).join('\r\n');res.type('text/csv').attachment(`contabilidad-${p}.csv`).send('\uFEFF'+output);}));

 // Seven DGII obligations: agent-prepared, source-linked drafts. No direct filing.
 r.get('/:org/tax-forms',run(async(req,res)=>{
   const p=period.parse(req.query.period);
   const org=String(req.params.org);
   const [company,settings,saved]=await Promise.all([
     store.request('crm_fiscal_companies?organization_id=eq.'+encodeURIComponent(org)+'&select=profile'),
     store.request('crm_accounting_periods?organization_id=eq.'+encodeURIComponent(org)+'&period=eq.'+p+'&select=payload'),
     store.request('crm_tax_workpapers?organization_id=eq.'+encodeURIComponent(org)+'&select=*&order=created_at.desc&limit=100'),
   ]);
   const obligations=settings[0]?.payload?.items||[];
   return res.json({period:p,companyProfile:company[0]?.profile?{
    legalName:company[0].profile.legalName,
    taxId:company[0].profile.taxId,
    address:company[0].profile.address,
    activity:company[0].profile.activity,
   }:null,companyVerified:Boolean(company[0]?.profile),
   forms:TAX_FORMS.map(form=>({
     form,...FORM_DETAILS[form],
     obligation:obligations.find((i:any)=>i.form===form)||{
       form,applicable:'pending_review',dueOn:'',status:'pending',receipt:'',notes:''},
     latestDraft:saved.find((i:any)=>i.form===form)||
       null,
   })),officialSubmission:false,zeroSubmission:false,
   reference:'https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/remisionInformacion/Paginas/formatoEnvioDatos.aspx'});
 }));
 r.post('/:org/tax-forms/prepare',run(async(req,res)=>{
   const {period:p,form,evidence}=prepareTaxSchema.parse(req.body);
   const org=String(req.params.org);
   const end=TAX_FORMS.includes(form)&&['IR-2','ACT'].includes(form)?p.slice(0,4)+'-12':p;
   const [all,company,settings]=await Promise.all([
     rows(org,end),
     store.request('crm_fiscal_companies?organization_id=eq.'+encodeURIComponent(org)+'&select=profile'),
     store.request('crm_accounting_periods?organization_id=eq.'+encodeURIComponent(org)+'&period=eq.'+p+'&select=payload'),
   ]);
   const item=settings[0]?.payload?.items?.find((x:any)=>x.form===form)||null;
   const candidate=prepareTaxWorkpaper({
     organization:org,period:p,form,rows:all,
     profile:company[0]?.profile||null,obligation:item,
     evidence,periodClosed:settings[0]?.payload?.closed===true,
   });
   const resource='crm_tax_workpapers?organization_id=eq.'+encodeURIComponent(org)+
     '&form=eq.'+form+'&fiscal_period=eq.'+candidate.period+
     '&source_hash=eq.'+candidate.sourceHash+'&limit=1';
   const existing=await store.request(resource);
   if(existing.length)return res.json({...existing[0],alreadyPrepared:true});
   const inserted=await store.request('crm_tax_workpapers','POST',{
     organization_id:org,form,fiscal_period:candidate.period,
     source_hash:candidate.sourceHash,payload:candidate,created_by:actor(),
   });
   return res.status(201).json(inserted[0]||{payload:candidate});
 }));
 r.get('/:org/tax-forms/drafts',run(async(req,res)=>{
   const org=String(req.params.org);
   const p=period.parse(req.query.period);
   const data=await store.request('crm_tax_workpapers?organization_id=eq.'+
     encodeURIComponent(org)+'&select=*&order=created_at.desc&limit=250');
   return res.json({period:p,records:data.filter((r:any)=>
     r.fiscal_period===p||r.fiscal_period===p.slice(0,4))});
 }));
 r.get('/:org/tax-forms/drafts/:id',run(async(req,res)=>{
   const org=String(req.params.org),id=z.string().uuid().parse(req.params.id);
   const data=await store.request('crm_tax_workpapers?organization_id=eq.'+
     encodeURIComponent(org)+'&id=eq.'+id+'&select=*');
   if(!data[0])return res.status(404).json({error:'Borrador no encontrado'});
   return res.json(data[0]);
 }));
 // Working papers only. Official 606/607/608/609 column validation and filing remain distinct.
 r.get('/:org/tax-workpaper',run(async(req,res)=>{const p=period.parse(req.query.period);const data=(await rows(String(req.params.org),p)).filter(v=>v.period===p);res.json({period:p,classification:'PAPEL_DE_TRABAJO_NO_PRESENTADO',formats:['606','607','608','609'],records:data.map(v=>({id:v.id,...v.payload})),warnings:['No es un TXT oficial validado ni una declaración presentada.','El tratamiento tributario, las retenciones, la obligación y las anulaciones requieren revisión.','El ITBIS de compras no se convierte automáticamente en crédito fiscal.']});}));
 return r;
}
