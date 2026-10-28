import { useEffect, useState } from 'react';

type Creative={id:string;scheduled_at:string;state:string;payload:{title:string;courseTitle:string;kind:string;script?:unknown}};
type LocalStatus={
 provider:string;engine:string;serverReady:boolean;referencePresent:boolean;referenceSource?:string;storageReady:boolean;databaseReady?:boolean;videoBucketReady?:boolean;referenceBucketReady?:boolean;
 workerConnected:boolean;workerLastSeen:string|null;autoEnabled:boolean;
 maxDailyCreatives:number;queued:number;rendering:number;readyForReview:number;
 externalGenerationFees:boolean;readyForProduction:boolean;message:string|null;
};
type LocalJob={
 id:string;community_job_id:string;asset_key:string;state:string;progress:number;created_at:string;error_code:string|null;readyForReview:boolean;
};
export function LocalVideoPanel({calendar}: {calendar:Creative[]}) {
 const [status,setStatus]=useState<LocalStatus|null>(null);
 const [jobs,setJobs]=useState<LocalJob[]>([]);
 const [busy,setBusy]=useState(false);
 const [referenceFile,setReferenceFile]=useState<File|null>(null);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 async function refresh(signal?:AbortSignal){
   const r=await fetch('/api/advertising/community/video/local/status',{cache:'no-store',signal});
   if(!r.ok)throw new Error('No se pudo consultar el motor propio.');
   setStatus(await r.json());
   const j=await fetch('/api/advertising/community/video/local/jobs',{cache:'no-store',signal});
   if(j.ok)setJobs(await j.json());
 }
 useEffect(()=>{
   const controller=new AbortController();
   void refresh(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
   const t=setInterval(()=>{if(document.visibilityState==='visible')void refresh(controller.signal).catch(()=>{});},20000);
   return()=>{controller.abort();clearInterval(t);};
 },[]);
 async function post(action:string,payload:unknown){
   setBusy(true);setError('');setMessage('');
   try{
     const r=await fetch('/api/advertising/community/video/local/'+action,{
       method:'POST',headers:{'Content-Type':'application/json','X-CRM-Action':'advertising'},body:JSON.stringify(payload),
     });
     const result=await r.json();
     if(!r.ok)throw new Error(result.error||'No se pudo completar la acción.');
     setMessage(action==='settings'?'Preferencia de generación automática guardada.':'Guion enviado a la cola de la GPU local.');
     await refresh();
   }catch(e){setError((e as Error).message);}
   finally{setBusy(false);}
 }
 async function uploadOfficialReference(){
   if(!referenceFile)return;
   if(referenceFile.type!=='image/png'||referenceFile.size<1024||referenceFile.size>6*1024*1024){
     setError('La imagen oficial debe ser PNG y pesar entre 1 KB y 6 MB.');
     return;
   }
   setBusy(true);setError('');setMessage('');
   try{
     const r=await fetch('/api/advertising/community/video/local/reference',{
       method:'POST',
       headers:{'Content-Type':'image/png','X-CRM-Action':'advertising'},
       body:referenceFile,
     });
     const data=await r.json();
     if(!r.ok)throw Error(data.error||'No fue posible instalar la imagen.');
     setMessage('Referencia oficial INTEQUITO almacenada en Supabase privado y disponible para el trabajador de video. La producción automática sigue desactivada.');
     setReferenceFile(null);
     await refresh();
   }catch(e){setError((e as Error).message);}
   finally{setBusy(false);}
 }
 const draftJobs=calendar.filter(j=>j.state==='brief'&&(j.payload.kind==='short'||j.payload.kind==='promo_video')&&j.payload.script);
 const unique=Array.from(new Map(draftJobs.map(j=>[j.payload.courseTitle+'|'+j.scheduled_at.slice(0,13)+'|'+j.payload.kind,j])).values()).slice(0,12);
 const existing=new Set(jobs.map(j=>j.community_job_id));
 const ready=Boolean(status?.readyForProduction);
 return <section className="rounded-xl border border-cyan-700 p-4 space-y-3">
  <h3 className="font-bold text-white">Motor propio INTECA · videos autónomos sin tarifa externa por clip</h3>
  <p className="text-sm text-slate-300">ComfyUI + Wan 2.2 (escenas), Piper (narración española) y FFmpeg (montaje, subtítulos y WhatsApp 809-643-5502). Trabaja en una GPU que pertenece a INTECA, mientras este CRM guarda guiones, estado y resultados. No necesita credenciales de HeyGen o Runway.</p>
  <div className="grid gap-2 text-xs text-slate-100 sm:grid-cols-2 md:grid-cols-4">
    <div className="rounded bg-slate-800 p-3">Conexión CRM: <strong>{status?.serverReady?'Token y Supabase listos':'Pendiente'}</strong></div>
    <div className="rounded bg-slate-800 p-3">Imagen INTEQUITO: <strong>{status?.referencePresent?'Instalada':'Pendiente'}</strong></div>
    <div className="rounded bg-slate-800 p-3">Base de datos: <strong>{status?.databaseReady?'Lista':'Pendiente'}</strong></div>
    <div className="rounded bg-slate-800 p-3">GPU de INTECA: <strong>{status?.workerConnected?'Conectada':'Desconectada'}</strong></div>
  </div>
  {status?.message&&<p className="text-sm text-amber-200">{status.message}</p>}
  <div className="rounded-xl border border-slate-600 bg-slate-900/60 p-3 space-y-2">
    <h4 className="font-semibold text-white text-sm">Referencia oficial de INTEQUITO (solo administrador)</h4>
    <p className="text-xs text-slate-300">Selecciona el PNG original del personaje, sin cambiar su rostro, uniforme ni logotipo. Se almacena en un bucket privado de Supabase. Nunca se publica como archivo público ni se envía a HeyGen o Runway desde este módulo.</p>
    <div className="flex flex-wrap items-center gap-3">
      <input type="file" accept="image/png" aria-label="Seleccionar imagen PNG oficial de INTEQUITO" disabled={busy}
        onChange={e=>setReferenceFile(e.target.files?.[0]||null)}
        className="block max-w-full text-xs text-slate-200 file:mr-2 file:rounded file:bg-slate-700 file:px-3 file:py-2 file:text-white"/>
      <button type="button" onClick={()=>void uploadOfficialReference()} disabled={busy||!referenceFile}
        className="rounded bg-cyan-700 px-3 py-2 text-white text-sm font-semibold disabled:opacity-40">
        Instalar imagen oficial
      </button>
      <button type="button" onClick={()=>void refresh().catch(e=>setError(e.message))}
        className="rounded border border-slate-500 px-3 py-2 text-slate-200 text-sm">Verificar conexiones</button>
    </div>
    {status?.referencePresent&&<div className="flex items-start gap-3">
       <img src="/api/advertising/community/video/local/reference" alt="Referencia oficial de INTEQUITO"
         className="h-24 w-20 rounded bg-white object-contain"/>
       <p className="text-xs text-emerald-300">Imagen de referencia instalada. Fuente: {status.referenceSource==='private_storage'?'Supabase privado':'archivo oficial del servidor'}. Esta imagen no acredita que exista una GPU conectada.</p>
    </div>}
    <p className="text-xs text-slate-400">Almacenamiento videos: {status?.videoBucketReady?'Verificado':'Pendiente'} · Almacenamiento del personaje: {status?.referenceBucketReady?'Verificado':'Pendiente'}. La imagen solo puede sustituirla el administrador autenticado.</p>
  </div>
  <p className="text-xs text-slate-400">Trabajos en cola: {status?.queued??'—'} · Procesando: {status?.rendering??'—'} · Pendientes de revisión: {status?.readyForReview??'—'}. Los modelos no garantizan identidad perfecta ni sincronización labial. La publicación final requiere aprobación; la generación local no genera cobros de proveedores de video, pero sí consume electricidad y GPU.</p>
  <div className="flex flex-wrap items-center gap-3">
    <button type="button" disabled={busy||(!ready&&!status?.autoEnabled)} onClick={()=>void post('settings',{enabled:!status?.autoEnabled})}
      className="rounded bg-cyan-700 px-3 py-2 text-white disabled:opacity-40">
      {status?.autoEnabled?'Pausar producción automática':'Activar producción automática'}
    </button>
    <span className="text-xs text-slate-400">{status?.autoEnabled?'Programación autónoma habilitada hasta 8 creatividades diarias.':'Desactivada hasta que la GPU y la imagen estén listas.'}</span>
  </div>
  {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
  {message&&<p className="text-sm text-cyan-200">{message}</p>}
  <details className="rounded border border-slate-700 p-3"><summary className="cursor-pointer text-sm text-cyan-200">Enviar un guion a mi generador (sin créditos externos)</summary>
    <div className="mt-2 space-y-2">
      {unique.map(j=><div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-800 p-2">
        <div><p className="text-sm text-slate-100">{j.payload.courseTitle}</p><p className="text-xs text-slate-400">{j.payload.kind==='short'?'Reel':'Video informativo'} · {new Date(j.scheduled_at).toLocaleString('es-DO',{timeZone:'America/Santo_Domingo'})}</p></div>
        <button type="button" disabled={busy||!status?.serverReady||!status.storageReady||existing.has(j.id)}
          className="rounded border border-cyan-500 px-2 py-1 text-sm text-cyan-200 disabled:opacity-40"
          onClick={()=>void post('queue',{communityJobId:j.id})}>{existing.has(j.id)?'En cola / registrado':'Generar en mi GPU'}</button>
      </div>)}
      {!unique.length&&<p className="text-sm text-slate-400">No hay guiones pendientes en el calendario consultado.</p>}
    </div>
  </details>
  <details className="rounded border border-slate-700 p-3"><summary className="cursor-pointer text-sm text-cyan-200">Ver producciones y resultados</summary>
    <div className="mt-2 space-y-2">
    {jobs.slice(0,30).map(j=><div key={j.id} className="flex flex-wrap justify-between gap-2 rounded bg-slate-800 p-2 text-sm text-slate-200">
      <span>{j.state==='ready_for_review'?'Video listo para revisión':j.state==='rendering'?'GPU produciendo':j.state==='queued'?'En cola':j.state==='failed'?'Error de producción':'Revisión técnica'} · {j.progress}% · {new Date(j.created_at).toLocaleString('es-DO')}</span>
      {j.readyForReview&&<a href={'/api/advertising/community/video/local/jobs/'+j.id+'/file'} target="_blank" rel="noreferrer" className="text-cyan-200 underline">Revisar MP4</a>}
      {j.error_code&&<span className="text-amber-200">{j.error_code}</span>}
    </div>)}
    {!jobs.length&&<p className="text-sm text-slate-400">Aún no hay videos locales registrados.</p>}
    </div>
  </details>
  <p className="text-xs text-slate-400">No se publican automáticamente videos experimentales. Las escenas y el audio requieren un flujo ComfyUI real y revisión de precisión académica. Tutorial: docs/INTEQUITO_LOCAL_VIDEO.md.</p>
 </section>;
}
