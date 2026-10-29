import {useCallback,useEffect,useState} from 'react';
type Form='606'|'607'|'608'|'609'|'IT-1'|'IR-2'|'ACT';
type Draft={id:string;created_at:string;payload:{
 state:string;issuer:{legalName:string;taxId:string;address:string}|null;
 sourceCount:number;entries:Array<{sourceJournalId:string;counterparty:string;ncf:string;indicativeTotal:string;missingOfficialFields:string[]}>;
 amountsIndicativeOnly:{purchases:string;sales:string};warnings:string[];
 classification:string;officialFileGenerated:boolean;submittedToDGII:boolean;period:string;
}};
type Summary={period:string;companyProfile:{legalName:string;taxId:string;address:string;activity:string}|null;
 forms:Array<{form:Form;label:string;meaning:string;cadence:'monthly'|'annual';official:string;
 obligation:{applicable:'pending_review'|'yes'|'no';dueOn:string;status:string};
 latestDraft:Draft|null}>};
const btn='rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 px-3 py-2 text-white text-xs font-semibold';
export function TaxFormsWorkspace({organization,period}:{organization:{id:string;name:string};period:string}){
 const base='/api/accounting/'+encodeURIComponent(organization.id);
 const [data,setData]=useState<Summary|null>(null),[selected,setSelected]=useState<Form>('606');
 const [evidence,setEvidence]=useState<Record<string,boolean>>({
 bank:false,sales:false,purchases:false,cancelledNcf:false,foreignPayments:false,otherSources:false});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  const response=await fetch(base+'/tax-forms?period='+period,{cache:'no-store'});
  const json=await response.json();if(!response.ok)throw Error(json.error||'No se pudieron cargar los formularios');
  setData(json);
 },[base,period]);
 useEffect(()=>{setError('');void refresh().catch(e=>setError(e.message));},[refresh]);
 const prepare=async(form:Form)=>{
   const response=await fetch(base+'/tax-forms/prepare',{
    method:'POST',headers:{'Content-Type':'application/json','X-CRM-Action':'accounting'},
    body:JSON.stringify({period,form,evidence:Object.values(evidence).every(Boolean)?evidence:undefined}),
   });
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Error al preparar borrador');
   return json as Draft;
 };
 const run=async(forms:Form[])=>{
  setBusy(true);setError('');setNotice('');
  try{
   const succeeded:Form[]=[];const failures:string[]=[];
   for(const form of forms){try{const draft=await prepare(form);setSelected(form);succeeded.push(form);}catch(e){failures.push(form+': '+(e as Error).message);}}
   await refresh();
   if(failures.length)setError(failures.join(' · '));
   setNotice(succeeded.length+' borrador(es) interno(s) preparados y guardados. No se ha enviado nada a DGII.');
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 };
 const active=data?.forms.find(f=>f.form===selected);
 const draft=active?.latestDraft;
 const evidenceFields:Array<{key:string;label:string}>=[
 {key:'bank',label:'Bancos, cajas y conciliación revisados'},
 {key:'sales',label:'Todas las ventas y facturas revisadas'},
 {key:'purchases',label:'Compras, gastos y proveedores revisados'},
 {key:'cancelledNcf',label:'NCF anulados y secuencias contrastados'},
 {key:'foreignPayments',label:'Pagos al exterior contrastados'},
 {key:'otherSources',label:'Otras cuentas, pagos, e-CF y fuentes contrastados'},
 ];
 return <details className="bg-slate-950 border border-cyan-800 rounded-xl p-4 space-y-3" open>
  <summary className="font-bold text-lg text-cyan-200 cursor-pointer">Agente fiscal · 606 · 607 · 608 · 609 · IT-1 · IR-2 · ACT</summary>
  <p className="text-xs text-slate-300 mt-3">El agente analiza el libro de INTECA, cruza el perfil fiscal guardado y crea expedientes internos por período. Nunca inventa RNC, operaciones ni declaraciones en cero; los borradores requieren validación humana y envío posterior en la Oficina Virtual DGII.</p>
  {!data?.companyProfile&&<p role="alert" className="p-3 rounded-lg bg-amber-950 text-amber-200 text-xs">No hay perfil fiscal validado para esta empresa. Regístralo en Pasarelas y Facturación antes de utilizar valores de la razón social y RNC. No se inventarán datos.</p>}
  {data?.companyProfile&&<p className="text-xs text-emerald-200">Datos del expediente: {data.companyProfile.legalName} · RNC registrado {data.companyProfile.taxId}. Verifica su vigencia en la DGII.</p>}
  {error&&<p role="alert" className="p-3 bg-rose-950 rounded text-xs">{error}</p>}
  {notice&&<p role="status" className="p-3 bg-emerald-950 rounded text-xs">{notice}</p>}
  <div className="flex flex-wrap gap-2 mt-3">
   <button className={btn} disabled={busy||!data} onClick={()=>void run(['606','607','608','609','IT-1','IR-2','ACT'])}>Preparar los 7 formularios con datos disponibles</button>
   <button className={btn} disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>Actualizar</button>
  </div>
  <div className="overflow-auto">
   <table className="w-full text-xs"><thead><tr className="text-left text-slate-300"><th className="p-2">DGII</th><th>Periodicidad</th><th>Aplicabilidad</th><th>Borrador guardado</th><th>Acción</th></tr></thead><tbody>
    {data?.forms.map(f=><tr key={f.form} className="border-t border-slate-700">
      <td className="p-2 font-semibold">{f.form} · {f.label}</td>
      <td>{f.cadence==='annual'?'Anual · año fiscal':'Mensual · '+period}</td>
      <td>{f.obligation.applicable==='yes'?'Asignada (según registro CRM)':f.obligation.applicable==='no'?'No asignada (según CRM)':'Pendiente de comprobar en DGII'}</td>
      <td>{f.latestDraft?.payload.state==='zero_candidate_requires_human_review'?'Cero: propuesta por verificar':f.latestDraft?'Borrador incompleto':'Sin preparar'}</td>
      <td className="flex gap-2 p-2">
       <button className={btn} disabled={busy} onClick={()=>{setSelected(f.form);void run([f.form]);}}>Preparar</button>
       <button className="rounded border border-slate-500 px-2" onClick={()=>{setSelected(f.form);setCurrentDraft(null);}}>Ver</button>
      </td>
    </tr>)}
   </tbody></table>
  </div>
  <div className="rounded-xl border border-slate-700 p-3 space-y-2 text-xs">
   <p className="font-bold">{active?.form} · {active?.meaning}</p>
   <p className="text-slate-300">Período {draft?.payload.period||period} · {draft?.payload.sourceCount||0} movimientos del libro usados. La ausencia de asientos no prueba ausencia de operaciones.</p>
   {draft&&<>
    <p className="text-amber-200">{draft.payload.classification} · No presentado</p>
    <p>Importes de referencia del libro: compras RD$ {draft.payload.amountsIndicativeOnly.purchases}, ventas RD$ {draft.payload.amountsIndicativeOnly.sales}. No son bases fiscales definitivas.</p>
    <ul className="list-disc pl-5 text-amber-200">{draft.payload.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
    {draft.payload.entries.length>0&&<div className="max-h-40 overflow-auto text-slate-300">{draft.payload.entries.map(x=><p key={x.sourceJournalId}>{x.ncf||'NCF pendiente'} · {x.counterparty||'Tercero pendiente'} · RD$ {x.indicativeTotal} — {x.missingOfficialFields.join(', ')}</p>)}</div>}
    <button className={btn} onClick={()=>{const json=JSON.stringify(draft.payload,null,2);const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='borrador-'+selected+'-'+period+'.json';a.click();URL.revokeObjectURL(url);}}>Descargar papel de trabajo JSON (no oficial)</button>
   </>}
   <a href={active?.official} target="_blank" rel="noopener noreferrer" className="block underline text-cyan-300">Consultar instructivo oficial DGII</a>
  </div>
  <details className="rounded-lg border border-slate-700 p-3">
   <summary className="cursor-pointer font-semibold text-xs">Control opcional para revisar una declaración sin operaciones</summary>
   <p className="text-xs text-amber-200 my-2">Marcar estos puntos implica que una persona revisó TODAS las fuentes, no solo el libro contable. El agente solo recomendará un posible cero cuando aplique y el período esté cerrado; nunca enviará la declaración.</p>
   <div className="grid sm:grid-cols-2 gap-2">{evidenceFields.map(e=><label key={e.key} className="text-xs"><input type="checkbox" checked={evidence[e.key]} onChange={v=>setEvidence(prev=>({...prev,[e.key]:v.target.checked}))}/> {e.label}</label>)}</div>
  </details>
  <p className="text-xs text-slate-400">Las constancias de presentaciones reales se registran manualmente en «Obligaciones tributarias y constancias» después de confirmarlas en la DGII. El agente no transmite declaraciones ni firma digitalmente.</p>
 </details>;
}
