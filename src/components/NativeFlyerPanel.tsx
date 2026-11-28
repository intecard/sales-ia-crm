import {useEffect,useState} from 'react';
import {fetchSnapshot} from '../lib/snapshot-subscription';

const base='/api/advertising/community/photos/local';
type Engine={enabled:boolean;paired:boolean;connected:boolean;recent:Array<{state:string;scheduled_at:string;error_code:string|null}>};
const states:Record<string,string>={rendering:'Generando foto',uploading:'Armando flyer',ready:'Flyer con foto listo',failed:'Foto no disponible'};
export function NativeFlyerPanel(){
 const [engine,setEngine]=useState<Engine|null>(null);
 const [token,setToken]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  const read=()=>void fetchSnapshot<Engine>(base+'/status',controller.signal)
    .then(setEngine).catch(()=>{if(!controller.signal.aborted)setEngine(null);});
  read();
  const id=window.setInterval(read,25_000);
  return ()=>{controller.abort();window.clearInterval(id);};
 },[]);
 async function action(name:'pair'|'disconnect'){
  setBusy(true);setNotice('');
  try{
   const response=await fetch(base+'/'+name,{method:'POST',headers:{'X-CRM-Action':'advertising','Content-Type':'application/json'},body:'{}'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error);
   setToken(data.token||'');
   setEngine(await fetchSnapshot<Engine>(base+'/status'));
   if(name==='disconnect')setNotice('Equipo desconectado.');
  }catch(e){setNotice(e instanceof Error?e.message:'No se pudo guardar el cambio.');}
  finally{setBusy(false);}
 }
 const status=!engine?'Estado no disponible':engine.connected?'Equipo conectado':engine.paired?'Esperando al equipo':'Falta enlazar un equipo';
 const recent=engine?.recent.slice(0,5)??[];
 return <div className="rounded-lg border border-slate-600 p-3 text-sm text-slate-200 space-y-2">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <p className="font-semibold">Generador local de fotos</p>
   <span className="rounded-full bg-slate-800 px-3 py-1 text-cyan-200">{status}</span>
  </div>
  <p>El equipo de INTECA genera una foto nueva por pieza sin pagar por imagen. Si no hay foto lista, el flyer espera dentro de su horario; el calendario no lo sustituye por un icono.</p>
  <div className="flex flex-wrap gap-2">
   <a href={base+'/download'} className="rounded border border-slate-600 px-3 py-2 text-white">Descargar generador</a>
   <button type="button" onClick={()=>void action('pair')} disabled={busy||!engine}
    className="rounded bg-cyan-700 px-3 py-2 text-white disabled:opacity-50">{engine?.paired?'Crear un nuevo código':'Crear código de enlace'}</button>
   {engine?.paired&&<button type="button" onClick={()=>void action('disconnect')} disabled={busy}
    className="rounded border border-slate-600 px-3 py-2 text-white disabled:opacity-50">Desconectar equipo</button>}
  </div>
  {token&&<div className="rounded-lg bg-slate-800 p-3 space-y-2">
   <p>Este código privado se muestra una sola vez. El código anterior deja de funcionar al crear uno nuevo.</p>
   <input aria-label="Código privado del equipo" className="w-full rounded bg-slate-950 p-2 font-mono text-white" readOnly value={token} onClick={e=>e.currentTarget.select()}/>
   <button type="button" className="text-cyan-300 underline" onClick={()=>void navigator.clipboard.writeText(token).then(()=>setNotice('Código copiado.')).catch(()=>setNotice('Selecciona y copia el código manualmente.'))}>Copiar código</button>
  </div>}
  <details>
   <summary className="cursor-pointer text-cyan-200">Instalar en Windows 64 bits</summary>
   <ol className="mt-2 list-decimal space-y-1 pl-5">
    <li>Instala Python 3.10 o superior si el equipo aún no lo tiene.</li>
    <li>Descarga el generador y abre PowerShell en la carpeta de la descarga.</li>
    <li>Ejecuta <code>py -3 .\inteca_fotos.py --install --pair</code>. La primera instalación descarga el modelo (unos 7 GB).</li>
    <li>Pega el código de enlace y deja la ventana abierta para preparar los próximos flyers.</li>
   </ol>
  </details>
  {notice&&<p role="status" className="text-cyan-200">{notice}</p>}
  {recent.length>0&&<div className="space-y-1 border-t border-slate-700 pt-2">
    <p className="font-semibold">Próximas fotos</p>
    {recent.map((job,index)=><p key={job.scheduled_at+index} className="text-slate-300">
      {new Date(job.scheduled_at).toLocaleString('es-DO',{timeZone:'America/Santo_Domingo',dateStyle:'medium',timeStyle:'short'})} · {states[job.state]||'En preparación'}
    </p>)}
  </div>}
 </div>;
}
