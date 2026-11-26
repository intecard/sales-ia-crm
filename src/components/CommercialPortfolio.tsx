import {useCallback,useEffect,useState} from 'react';
import {stageLabels,stages,type PortfolioCase,type PortfolioRow,type portfolioMetrics} from '../../team/portfolio';
import {subscribeSnapshot,fetchSnapshot} from '../lib/snapshot-subscription';
type Data={cases:PortfolioRow[];sampleLimited:boolean;period:string;goal:number|null;closures:number|null;metrics:ReturnType<typeof portfolioMetrics>};
const input='block w-full mt-1 rounded-md border border-slate-500 bg-slate-950 p-2 text-white';
const button='rounded-md bg-sky-700 px-4 py-2 text-white disabled:opacity-50';
const blank=():PortfolioCase=>({id:crypto.randomUUID(),revision:0,client:'',product:'',contact:'',source:'',stage:'prospect',followUp:'',nextAction:'',quote:null,evidence:''});
export function CommercialPortfolio({org,owner}:{org:string;owner:boolean}){
 const [data,setData]=useState<Data|null>(null),[draft,setDraft]=useState<PortfolioCase|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [target,setTarget]=useState('');
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('');
 const path='/api/team/'+encodeURIComponent(org)+'/portfolio';
 const read=useCallback((signal?:AbortSignal)=>fetchSnapshot<Data>(path,signal),[path]);
 useEffect(()=>subscribeSnapshot(read,setData,e=>setMessage(e.message),15000),[read]);
 const update=(p:Partial<PortfolioCase>)=>setDraft(d=>d?{...d,...p}:null);
 const rows=data?.cases.filter(r=>(!filter||r.stage===filter)&&`${r.payload.client} ${r.payload.product} ${r.payload.quote?.reference||''}`.toLowerCase().includes(query.toLowerCase()))||[];
 async function save(){if(!draft||busy)return;setBusy(true);setMessage('');try{
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CRM-Action':'team'},body:JSON.stringify(draft)});
  const d=await r.json();if(!r.ok)throw Error(d.error);setData(await read());setDraft(null);setMessage('Ficha guardada en esta empresa.');
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <details className="bg-slate-900 border border-slate-600 rounded-xl p-4 text-white"><summary className="cursor-pointer font-bold">Cartera comercial y cotizaciones</summary>
  <p className="text-sm text-slate-300 my-3">Organiza prospectos, propuestas y seguimientos de esta empresa. El cierre comercial con evidencia no registra un abono ni genera una factura.</p>
  {data&&<div className="grid grid-cols-2 md:grid-cols-4 gap-2 my-3">{[['Prospectos',data.metrics.stages.prospect],['Cotizaciones vencidas',data.metrics.staleQuotes],['Seguimientos por hacer',data.metrics.due],['Cierres registrados',data.metrics.stages.won]].map(([title,n])=><p key={title} className="border border-slate-600 rounded-md p-2">{title}<strong className="block text-lg">{n}</strong></p>)}</div>}
  {data&&<div className="my-3 flex flex-wrap gap-3 items-end"><p>Meta de cierres · {data.period}: <strong>{data.closures??'1,000 o más'} / {data.goal??'sin definir'}</strong></p>{owner&&<form className="flex gap-2 items-end" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await fetch(path+'/goal',{method:'POST',headers:{'Content-Type':'application/json','X-CRM-Action':'team'},body:JSON.stringify({target:Number(target)})});if(!r.ok)throw Error((await r.json()).error);setData(await read());setTarget('');}catch(err){setMessage((err as Error).message);}finally{setBusy(false);}}}><label>Nueva meta mensual<input required type="number" min={1} max={999} className={input} value={target} onChange={e=>setTarget(e.target.value)}/></label><button className={button} disabled={busy}>Guardar meta</button></form>}</div>}
  {data?.sampleLimited&&<p>Los indicadores muestran solo las 500 fichas actualizadas más recientes.</p>}
  <div className="flex gap-2 flex-wrap items-end"><label>Buscar<input value={query} onChange={e=>setQuery(e.target.value)} className={input} placeholder="Cliente, producto, cotización"/></label><label>Etapa<select value={filter} onChange={e=>setFilter(e.target.value)} className={input}><option value="">Todas</option>{stages.map(s=><option key={s} value={s}>{stageLabels[s]}</option>)}</select></label><button className={button} onClick={()=>{setDraft(blank());setMessage('');}}>Nueva ficha</button></div>
  {message&&<p role="status" className="my-2 text-amber-200">{message}</p>}
  {draft&&<form className="grid md:grid-cols-3 gap-3 border border-slate-600 p-3 my-3 rounded-md" onSubmit={e=>{e.preventDefault();void save();}}>
   <label>Cliente / empresa<input required maxLength={150} className={input} value={draft.client} onChange={e=>update({client:e.target.value})}/></label>
   <label>Producto / servicio<input required maxLength={150} className={input} value={draft.product} onChange={e=>update({product:e.target.value})}/></label>
   <label>Contacto<input maxLength={180} className={input} value={draft.contact} onChange={e=>update({contact:e.target.value})}/></label>
   <label>Fuente de prospección<input maxLength={100} className={input} value={draft.source} onChange={e=>update({source:e.target.value})}/></label>
   <label>Etapa<select className={input} value={draft.stage} onChange={e=>update({stage:e.target.value as PortfolioCase['stage']})}>{stages.filter(s=>s!=='won'||owner).map(s=><option key={s} value={s}>{stageLabels[s]}</option>)}</select></label>
   <label>Fecha de seguimiento<input type="date" className={input} value={draft.followUp} onChange={e=>update({followUp:e.target.value})}/></label>
   <label>Próximo paso<input maxLength={500} className={input} value={draft.nextAction} onChange={e=>update({nextAction:e.target.value})}/></label>
   <label>Evidencia de cierre / motivo de pérdida<input maxLength={300} className={input} value={draft.evidence} onChange={e=>update({evidence:e.target.value})}/></label>
   <label><input type="checkbox" checked={!!draft.quote} onChange={e=>update({quote:e.target.checked?{reference:'',amount:'',currency:'',validUntil:''}:null})}/> Registrar cotización</label>
   {draft.quote&&<>{([['reference','Referencia','text'],['amount','Importe','text'],['currency','Moneda ISO (DOP, USD…)','text'],['validUntil','Vigente hasta','date']] as const).map(([k,label,type])=><label key={k}>{label}<input required className={input} type={type} value={draft.quote![k]} onChange={e=>update({quote:{...draft.quote!,[k]:k==='currency'?e.target.value.toUpperCase():e.target.value}})}/></label>)}</>}
   <div className="flex gap-2 items-end"><button className={button} disabled={busy}>Guardar ficha</button><button type="button" className="p-2" disabled={busy} onClick={()=>setDraft(null)}>Cancelar</button></div>
  </form>}
  <div className="overflow-auto mt-3"><table className="text-sm w-full text-left"><thead><tr>{['Cliente / producto','Etapa','Cotización','Seguimiento',''].map((t,i)=><th className="p-2" key={i}>{t}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-slate-700"><td className="p-2"><strong>{r.payload.client}</strong><br/>{r.payload.product}</td><td className="p-2">{stageLabels[r.stage]}</td><td className="p-2">{r.payload.quote?`${r.payload.quote.currency} ${r.payload.quote.amount} · ${r.payload.quote.validUntil}`:'—'}</td><td className="p-2">{r.payload.followUp||'—'}<br/>{r.payload.nextAction}</td><td className="p-2"><button className={button} disabled={busy||(!owner&&['won','lost'].includes(r.stage))} onClick={()=>setDraft({...r.payload,id:r.id,revision:r.revision})}>Editar</button></td></tr>)}</tbody></table>{data&&!rows.length&&<p className="p-2">No hay fichas para este filtro.</p>}</div>
 </details>;
}
