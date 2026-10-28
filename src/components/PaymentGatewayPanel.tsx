import { useEffect,useState } from 'react';

type Opportunity={contactKey:string;name:string;course:string;amountDop:number;stage:string};
type PaymentOrder={id:string;contactKey:string;course:string;amountMinor:number;currency:string;preferredProvider:string;state:string;link:string|null;createdAt:string;expiresAt:string};
type GatewayStatus={preferredProvider:string;merchantStatus:string;sandboxCertified:boolean;productionCertified:boolean;linkInfrastructureReady:boolean;checkoutAvailable:boolean;reason:string;manualReceiptFlowPreserved:boolean;acceptedCurrency:string};

const amount=(minor:number)=>new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'}).format(minor/100);
export function PaymentGatewayPanel(){
 const [status,setStatus]=useState<GatewayStatus|null>(null);
 const [eligible,setEligible]=useState<Opportunity[]>([]);
 const [orders,setOrders]=useState<PaymentOrder[]>([]);
 const [contactKey,setContactKey]=useState('');
 const [provider,setProvider]=useState<'unselected'|'azul'|'cardnet'>('unselected');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const selected=eligible.find(x=>x.contactKey===contactKey);
 async function reload(signal?:AbortSignal){
   const base='/api/sales/gateway/';
   const response=await Promise.all(['status','eligible','orders'].map(k=>fetch(base+k,{cache:'no-store',signal})));
   if(response.some(x=>!x.ok))throw Error('No se pudo consultar el módulo de pago. Comprueba la sesión y la migración de Supabase.');
   const [st,el,ord]=await Promise.all(response.map(x=>x.json()));
   if(!signal?.aborted){
     setStatus(st);setEligible(el.opportunities||[]);setOrders(ord.orders||[]);
   }
 }
 useEffect(()=>{
  const controller=new AbortController();
  void reload(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[]);
 async function prepare(){
  if(!contactKey)return;
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/sales/gateway/orders',{
    method:'POST',headers:{'Content-Type':'application/json','X-CRM-Action':'sales'},
    body:JSON.stringify({contactKey,provider}),
   });
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'No se pudo preparar la solicitud.');
   setNotice('Solicitud preparada. El enlace es informativo; el pago con tarjeta no estará disponible hasta la contratación y certificación.');
   await reload();
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function copy(link:string){
  try{await navigator.clipboard.writeText(link);setNotice('Enlace informativo copiado. Aún no permite pagos.');}
  catch{setError('No se pudo copiar el enlace; utiliza el enlace para abrirlo.');}
 }
 return <section className="rounded-xl border border-cyan-800 bg-slate-900 p-5 text-slate-100 space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 className="text-lg font-bold">Pasarela de tarjetas · Preparada para contratación</h2>
      <p className="text-sm text-slate-300">AZUL / CardNET · Solicitudes de pago y páginas para estudiantes sin almacenar datos de tarjetas.</p>
    </div>
    <span className="rounded border border-amber-500 px-3 py-1 text-amber-200 text-sm">
     {status?.checkoutAvailable?'Cobros disponibles':'Pagos con tarjeta no habilitados'}
    </span>
   </div>
   <p className="text-sm text-slate-300">Conservamos el método actual de comprobantes y verificación bancaria. Las solicitudes de tarjeta utilizarán el importe cotizado en el CRM, no cantidades modificadas por el cliente. Los pagos nunca se marcarán como recibidos sin verificación independiente de la pasarela.</p>
   <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
     <div className="rounded bg-slate-800 p-3">Contrato: <strong>{status?.merchantStatus==='production'?'Producción':'Pendiente'}</strong></div>
     <div className="rounded bg-slate-800 p-3">Enlaces firmados: <strong>{status?.linkInfrastructureReady?'Listos':'Sin configurar'}</strong></div>
     <div className="rounded bg-slate-800 p-3">Pruebas sandbox: <strong>{status?.sandboxCertified?'Aprobadas':'Pendientes'}</strong></div>
     <div className="rounded bg-slate-800 p-3">Cobro real: <strong>{status?.checkoutAvailable?'Habilitado':'Bloqueado'}</strong></div>
   </div>
   <div className="rounded-lg border border-slate-700 p-3 space-y-3">
    <h3 className="font-semibold text-white">Crear una solicitud de pago para un interesado</h3>
    <p className="text-xs text-slate-400">Se crea a partir de una oportunidad con monto definido. El enlace se podrá consultar, pero no permitirá introducir tarjetas mientras la pasarela no esté contratada.</p>
    <div className="grid md:grid-cols-2 gap-3">
      <label className="block text-sm">Oportunidad cotizada
        <select value={contactKey} onChange={e=>setContactKey(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-600 p-2 text-slate-100">
          <option value="">Selecciona una oportunidad</option>
          {eligible.map(x=><option key={x.contactKey} value={x.contactKey}>{x.name} · {x.course} · {amount(Math.round(x.amountDop*100))}</option>)}
        </select>
      </label>
      <label className="block text-sm">Pasarela futura
        <select value={provider} onChange={e=>setProvider(e.target.value as typeof provider)} className="mt-1 w-full rounded bg-slate-800 border border-slate-600 p-2 text-slate-100">
         <option value="unselected">Pendiente de seleccionar</option>
         <option value="azul">AZUL (por contratar)</option>
         <option value="cardnet">CardNET (por contratar)</option>
        </select>
      </label>
    </div>
    {selected&&<p className="text-sm text-cyan-200">Cotización registrada: {selected.course} · {amount(Math.round(selected.amountDop*100))}</p>}
    <button type="button" onClick={()=>void prepare()} disabled={!contactKey||busy||!status?.linkInfrastructureReady} className="rounded bg-cyan-700 px-4 py-2 font-semibold text-white disabled:opacity-40">
      Preparar enlace informativo
    </button>
    {error&&<p role="alert" className="text-sm text-amber-300">{error}</p>}
    {notice&&<p className="text-sm text-cyan-200">{notice}</p>}
   </div>
   <details className="rounded-lg border border-slate-700 p-3">
     <summary className="cursor-pointer font-semibold">Solicitudes recientes ({orders.length})</summary>
     <div className="mt-3 space-y-2">
      {orders.map(order=><div key={order.id} className="rounded bg-slate-800 p-3 flex flex-wrap justify-between items-center gap-3 text-sm">
       <div><p className="font-semibold">{order.course} · {amount(order.amountMinor)}</p>
        <p className="text-xs text-slate-400">Estado: {order.state} · Vence {new Date(order.expiresAt).toLocaleDateString('es-DO')}</p></div>
       {order.link&&<div className="flex gap-2">
         <a href={order.link} target="_blank" rel="noreferrer" className="text-cyan-200 underline">Vista estudiante</a>
         <button type="button" onClick={()=>void copy(order.link!)} className="rounded border border-cyan-700 px-2 py-1">Copiar enlace</button>
       </div>}
      </div>)}
      {!orders.length&&<p className="text-sm text-slate-400">No hay solicitudes de pago con tarjeta preparadas.</p>}
     </div>
   </details>
   <p className="text-xs text-slate-400">Próxima activación: contrato comercial, credenciales sandbox/producción, adaptador certificado de AZUL o CardNET, comprobación de firmas, pruebas reales y activación por administrador. Nunca ingreses números completos de tarjetas ni secretos bancarios en el CRM o en este chat.</p>
 </section>;
}
