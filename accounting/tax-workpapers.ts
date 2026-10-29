import {createHash} from 'node:crypto';
import {z} from 'zod';
import {cents,amount,type Journal} from './engine.ts';

export const TAX_FORMS=['606','607','608','609','IT-1','IR-2','ACT'] as const;
export type TaxForm=(typeof TAX_FORMS)[number];
export const taxFormSchema=z.enum(TAX_FORMS);
export const taxPeriodSchema=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const evidenceSchema=z.object({
 bank:z.boolean(),sales:z.boolean(),purchases:z.boolean(),
 cancelledNcf:z.boolean(),foreignPayments:z.boolean(),otherSources:z.boolean(),
}).strict();
export const prepareTaxSchema=z.object({
 period:taxPeriodSchema,form:taxFormSchema,
 evidence:evidenceSchema.optional(),
}).strict();

export const FORM_DETAILS:Record<TaxForm,{label:string;cadence:'monthly'|'annual';meaning:string;official:string}> = {
 '606':{label:'Compras y gastos',cadence:'monthly',meaning:'Comprobantes de compras, costos, gastos, ITBIS y retenciones.',official:'https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/remisionInformacion/Paginas/formatoEnvioDatos.aspx'},
 '607':{label:'Ventas y operaciones',cadence:'monthly',meaning:'Ventas, comprobantes emitidos y operaciones reportables.',official:'https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/remisionInformacion/Paginas/formatoEnvioDatos.aspx'},
 '608':{label:'NCF anulados',cadence:'monthly',meaning:'Comprobantes anulados y razón documentada.',official:'https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/remisionInformacion/Paginas/formatoEnvioDatos.aspx'},
 '609':{label:'Pagos al exterior',cadence:'monthly',meaning:'Pagos al exterior que correspondan al formato.',official:'https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/remisionInformacion/Paginas/formatoEnvioDatos.aspx'},
 'IT-1':{label:'Declaración ITBIS',cadence:'monthly',meaning:'Liquidación ITBIS y anexos según obligaciones del contribuyente.',official:'https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/declaracionPagoImpuestos/declaracionesJuradasPFyPJ/Paginas/declaracionesJuradasPJ.aspx'},
 'IR-2':{label:'ISR sociedades',cadence:'annual',meaning:'Declaración anual y anexos contables-fiscales.',official:'https://dgii.gov.do/herramientas/formularios/formularioDeclaraciones/Paginas/ISR.aspx'},
 'ACT':{label:'Impuesto a activos',cadence:'annual',meaning:'Determinación anual de activos sujetos a impuesto cuando corresponda.',official:'https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/declaracionPagoImpuestos/Paginas/PagodeImpuesto.aspx'},
};
type Source={id:string;period:string;entry_date?:string;payload:Journal};
type Obligation={applicable:'pending_review'|'yes'|'no';status?:string;dueOn?:string;receipt?:string};
type Profile={legalName?:string;taxId?:string;address?:string;activity?:string;country?:string};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const zeroEvidence=(e?:z.infer<typeof evidenceSchema>)=>Boolean(e&&Object.values(e).every(Boolean));
const sumMoney=(entries:Source[],kind:'purchase'|'sale')=>
  amount(entries.filter(x=>x.payload.kind===kind).reduce((s,r)=>s+r.payload.lines.reduce((total,l)=>{
    if(kind==='purchase'&&['5101','6101'].includes(l.account))return total+cents(l.debit)-cents(l.credit);
    if(kind==='sale'&&l.account==='4101')return total+cents(l.credit)-cents(l.debit);
    return total;
  },0n),0n));
/** This is a preview of journal source data, not a DGII official form.
 * No entries never implies zero: the ledger might be incomplete or company
 * payments/invoices may exist in other systems.
 */
export function prepareTaxWorkpaper(args:{
 organization:string;period:string;form:TaxForm;
 rows:Source[];profile:Profile|null;obligation:Obligation|null;
 evidence?:z.infer<typeof evidenceSchema>;periodClosed?:boolean;
}){
 const {organization,period,form,rows,profile,obligation,evidence}=args;
 const annual=FORM_DETAILS[form].cadence==='annual';
 const source=rows.filter(r=>annual?r.period.startsWith(period.slice(0,4)+'-'):r.period===period);
 const purchases=source.filter(r=>r.payload.kind==='purchase');
 const sales=source.filter(r=>r.payload.kind==='sale');
 const warnings:string[]=[];
 const identity=profile?.country==='DO'&&/^\d{9}$/.test(profile?.taxId||'')&&Boolean(profile?.legalName?.trim()&&profile?.address?.trim());
 if(!identity)warnings.push('Falta perfil fiscal validado: razón social, RNC de 9 dígitos y dirección de esta empresa.');
 if(obligation?.applicable!=='yes')warnings.push('Verificar obligación de '+form+' en DGII para este RNC; no asumir aplicabilidad.');
 if(!args.periodClosed)warnings.push('El período no está cerrado o conciliado; el registro puede estar incompleto.');
 if(annual)warnings.push('Año fiscal y cierre deben confirmarse; se requieren estados financieros, ajustes, anexos y reglas fiscales vigentes.');
 else warnings.push('Validar documentación externa, NCF, retenciones y conciliaciones antes de generar el archivo oficial.');
 if(form==='IT-1')warnings.push('No calcular ITBIS automáticamente desde débitos/créditos contables; confirmar base gravada, exenciones, anticipos y anexos.');
 if(form==='ACT')warnings.push('La cuenta de activos no permite determinar por sí sola la base imponible de ACT ni su exención.');
 if(['608','609'].includes(form))warnings.push('El diario contable actual no identifica con precisión los NCF anulados ni los pagos sujetos a 609.');
 const relevant=form==='606'?purchases:form==='607'?sales:[];
 const mapped=relevant.map(r=>{
  const missing:string[]=[];
  if(!r.payload.taxId)missing.push('RNC/identificación del tercero');
  if(!r.payload.ncf)missing.push('NCF o e-NCF');
  if(!r.payload.evidence)missing.push('Factura/documento soporte');
  if(form==='606')missing.push('Tipo de gasto, ITBIS y retenciones DGII por documento');
  if(form==='607')missing.push('Tipo NCF, gravado/exento e ITBIS y resumen consumidor final');
  return {sourceJournalId:r.id,entryDate:r.entry_date||r.payload.date,
   counterparty:r.payload.counterparty,taxId:r.payload.taxId,ncf:r.payload.ncf,
   description:r.payload.description,evidence:r.payload.evidence,
   indicativeTotal:sumMoney([r],form==='606'?'purchase':'sale'),
   missingOfficialFields:missing};
 });
 if(mapped.some(x=>x.missingOfficialFields.length))warnings.push('Faltan campos de detalle obligatorios en los comprobantes seleccionados.');
 const unrelatedEvidence=form==='608'||form==='609'||form==='IT-1'||annual;
 if(unrelatedEvidence)warnings.push('El libro diario no demuestra por sí solo la ausencia de todas las operaciones de este formulario.');
 const candidateZero=!annual && obligation?.applicable==='yes' && Boolean(args.periodClosed)
  && Boolean(identity) && zeroEvidence(evidence) && source.length===0;
 if(source.length===0&&!candidateZero)warnings.push('Sin asientos NO significa declaración en cero. Revisar bancos, facturación, NCF anulados, exterior y otras fuentes.');
 const state=candidateZero?'zero_candidate_requires_human_review':'draft_incomplete';
 const data={organization,form,period:annual?period.slice(0,4):period,requestedPeriod:period,
  cadence:FORM_DETAILS[form].cadence,classification:'BORRADOR_INTERNO_NO_APTO_PARA_DGII',
  state,issuer:identity?{legalName:profile!.legalName,taxId:profile!.taxId,address:profile!.address,activity:profile!.activity}:null,
  applicability:obligation?.applicable||'pending_review',
  sourceCount:source.length,sourceJournalIds:source.map(x=>x.id),
  amountsIndicativeOnly:{purchases:sumMoney(source,'purchase'),sales:sumMoney(source,'sale')},
  entries:mapped,zeroEvidenceProvided:zeroEvidence(evidence),periodClosed:Boolean(args.periodClosed),
  warnings,requiresHumanApproval:true,officialFileGenerated:false,submittedToDGII:false,
  dgiiGuide:FORM_DETAILS[form].official,preparedAt:new Date().toISOString()};
 return {...data,sourceHash:sha({organization,form,period,source:source.map(r=>[r.id,r.payload]),profile,obligation,evidence,closed:args.periodClosed})};
}
