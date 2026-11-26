import {useState} from 'react';
import type {reconcile} from '../../accounting/operations';
const field='bg-slate-950 text-white border border-slate-600 p-2 rounded-lg w-full';
export function BankReconciliation({base,period}:{base:string;period:string}){
 const [lines,setLines]=useState(''),[data,setData]=useState<ReturnType<typeof reconcile>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function run(){
  setError('');setData(null);setBusy(true);
  try{
   const bank=lines.trim().split(/\r?\n/).filter(Boolean).map((line,i)=>{const parts=line.split('\t');if(parts.length!==3)throw Error('Línea '+(i+1)+': usa tres columnas separadas por tabuladores.');const [date,reference,amount]=parts.map(v=>v.trim());return{date,reference,amount};});
   const r=await fetch(base+'/reconcile',{method:'POST',headers:{'Content-Type':'application/json','X-CRM-Action':'accounting'},body:JSON.stringify({period,bank})});
   const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <details className="border border-slate-600 rounded-lg p-3"><summary className="cursor-pointer font-bold">Conciliación por movimiento · {period}</summary>
  <p className="text-sm my-2">Pega hasta 500 movimientos del período: fecha (AAAA-MM-DD), referencia e importe con signo. Usa un tabulador entre columnas y punto para los decimales. Compara con la referencia de evidencia del libro diario. Los casos repetidos se dejan para revisión.</p>
  <textarea aria-label="Movimientos bancarios" className={field} value={lines} onChange={e=>{setLines(e.target.value);setData(null);}} maxLength={100000} rows={5}/>
  <button className="bg-blue-700 text-white px-3 py-2 rounded-md" disabled={!lines.trim()||busy} onClick={()=>void run()}>Comparar movimientos</button>
  {error&&<p role="alert" className="text-amber-200">{error}</p>}
  {data&&<div className="space-y-2 my-2 text-sm"><p><strong>{data.matched} coincidencias exactas</strong> · Diferencia neta entre movimientos: {data.difference} · {data.unmatchedBook.length} partidas del libro por revisar.</p>
   <div className="max-h-64 overflow-auto"><table className="text-left w-full"><thead><tr><th>Fecha</th><th>Referencia</th><th>Importe</th><th>Resultado</th></tr></thead><tbody>{data.movements.map((v,i)=><tr key={i} className="border-t border-slate-700"><td>{v.date}</td><td>{v.reference}</td><td>{v.amount}</td><td>{v.status==='matched'?'Coincide':v.status==='ambiguous'?'Coincidencia ambigua':'Solo banco'}</td></tr>)}{data.unmatchedBook.map(v=><tr key={v.id} className="border-t border-slate-700"><td>{v.date}</td><td>{v.reference||'Sin referencia'}</td><td>{v.amount}</td><td>Solo libro</td></tr>)}</tbody></table></div>
   <p>Vista de revisión. No crea asientos, no importa el extracto al historial y no mueve fondos.</p>
  </div>}
 </details>;
}
