import {z} from 'zod';
export const stages=['prospect','qualified','quoted','negotiation','won','lost'] as const;
export const stageLabels:Record<typeof stages[number],string>={prospect:'Prospecto',qualified:'Calificado',quoted:'Cotizado',negotiation:'Negociación',won:'Cierre registrado',lost:'Perdido'};
export const commercialDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{try{return new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}catch{return false;}});
const optionalDate=z.union([commercialDate,z.literal('')]);
export const quoteSchema=z.object({reference:z.string().trim().min(2).max(100),amount:z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/).refine(v=>Number(v)>0),currency:z.string().regex(/^[A-Z]{3}$/),validUntil:commercialDate}).strict();
export const portfolioSchema=z.object({
 id:z.string().uuid(),revision:z.number().int().min(0).max(1000000),
 client:z.string().trim().min(2).max(150),product:z.string().trim().min(2).max(150),source:z.string().trim().max(100),
 contact:z.string().trim().max(180),stage:z.enum(stages),followUp:optionalDate,nextAction:z.string().trim().max(500),
 quote:quoteSchema.nullable(),evidence:z.string().trim().max(300),
}).strict().superRefine((d,c)=>{
 if(['quoted','negotiation'].includes(d.stage)&&!d.quote)c.addIssue({code:'custom',message:'Registra referencia, importe, moneda y vigencia de la cotización.'});
 if(['won','lost'].includes(d.stage)&&d.evidence.length<3)c.addIssue({code:'custom',message:'Especifica la evidencia de cierre o el motivo de pérdida.'});
 if(!['won','lost'].includes(d.stage)&&(!d.followUp||!d.nextAction))c.addIssue({code:'custom',message:'Indica fecha y próximo paso del seguimiento.'});
});
export type PortfolioCase=z.infer<typeof portfolioSchema>;
export type PortfolioRow={id:string;stage:PortfolioCase['stage'];revision:number;payload:Omit<PortfolioCase,'id'|'revision'>;updated_at:string;created_at:string;closed_at?:string|null};
export function portfolioMetrics(rows:PortfolioRow[],day:string){
 const stagesCount=Object.fromEntries(stages.map(s=>[s,0])) as Record<typeof stages[number],number>;
 let due=0,staleQuotes=0;for(const r of rows){stagesCount[r.stage]++;if(r.stage==='won'||r.stage==='lost')continue;
  if(r.payload.followUp&&r.payload.followUp<=day)due++;
  if(r.payload.quote&&r.payload.quote.validUntil<day)staleQuotes++;
 }
 const resolved=stagesCount.won+stagesCount.lost;
 return {stages:stagesCount,due,staleQuotes,resolved,registeredWinRate:resolved?stagesCount.won/resolved:null};
}
