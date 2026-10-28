import {useEffect,useState} from 'react';
type Checkout={course:string;amountMinor:number;currency:string;state:string;checkoutAvailable:boolean;provider:string;expiresAt:string;message:string;whatsapp:string};
export function PublicCardPayment(){
 const token=window.location.pathname.split('/').filter(Boolean)[1]||'';
 const [data,setData]=useState<Checkout|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
   const controller=new AbortController();
   void fetch('/api/payments/checkout/'+encodeURIComponent(token),{cache:'no-store',signal:controller.signal})
     .then(async r=>{if(!r.ok)throw Error('Este enlace no está disponible. Solicita uno nuevo a INTECA.');return r.json();})
     .then(x=>{if(!controller.signal.aborted)setData(x);})
     .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
     .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
   return()=>controller.abort();
 },[token]);
 const amount=new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'}).format((data?.amountMinor||0)/100);
 return <main className="min-h-screen bg-slate-950 text-slate-100 p-4 flex items-center justify-center">
   <div className="w-full max-w-xl rounded-2xl border border-cyan-800 bg-slate-900 p-7 space-y-5 shadow-xl">
     <div className="flex items-center justify-between gap-3">
       <div><span className="text-xl font-extrabold tracking-wide text-cyan-300">INTECA</span><p className="text-xs text-slate-400">Instituto Técnico del Caribe</p></div>
       <span className="rounded-full bg-amber-500/15 border border-amber-500 px-3 py-1 text-xs text-amber-200">Pasarela en preparación</span>
     </div>
     <h1 className="text-2xl font-bold">Consulta de solicitud de pago</h1>
     {loading&&<p className="text-slate-300">Consultando la solicitud…</p>}
     {error&&<p role="alert" className="text-amber-200">{error}</p>}
     {data&&<>
       <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
         <p className="text-xs text-slate-400">Programa académico</p>
         <p className="font-semibold mt-1">{data.course}</p>
         <p className="text-xs text-slate-400 mt-4">Importe cotizado</p>
         <p className="text-3xl font-bold text-cyan-300">{amount}</p>
       </div>
       <p className="text-sm text-amber-200">{data.message}</p>
       <button type="button" disabled className="w-full py-3 rounded-xl bg-slate-700 text-slate-300 cursor-not-allowed font-semibold">
         Pagar con tarjeta · Próximamente
       </button>
       <a href={data.whatsapp} target="_blank" rel="noopener noreferrer" className="block text-center rounded-xl bg-cyan-700 px-4 py-3 font-semibold">
         Solicitar información sobre otras formas de pago
       </a>
       <p className="text-xs text-slate-400">Nunca envíes los números de tu tarjeta, CVV, claves bancarias ni códigos OTP por WhatsApp. Los cobros se habilitarán únicamente en la página segura del proveedor contratado.</p>
     </>}
     <a href="https://www.inteca.com.do/" className="block text-center text-sm text-slate-400 underline">Volver al sitio oficial de INTECA</a>
   </div>
 </main>;
}
