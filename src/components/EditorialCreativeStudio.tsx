import {useEffect,useState} from 'react';
import type {CatalogCourse} from '../../whatsapp-catalog';

const base='/api/advertising/community/photos/local';
const action={'X-CRM-Action':'advertising'};
const historyKey='inteca-studio-current-photo-v1';
type Job={asset:string;state:'queued'|'rendering'|'uploading'|'ready'|'failed'};
const progress:Record<Job['state'],string>={
 queued:'Foto en cola. El equipo puede estar terminando otra imagen.',
 rendering:'Generando una escena fotográfica nueva. Puedes dejar esta página y volver.',
 uploading:'Armando el flyer con los datos del catálogo.',
 ready:'Flyer fotográfico listo.',
 failed:'No se pudo completar la foto. Revisa el generador local o sube una foto distinta.',
};
async function data<T>(url:string,options?:RequestInit){
 const response=await fetch(url,{cache:'no-store',...options});
 const value=await response.json();
 if(!response.ok)throw Error(value.error||'No se pudo preparar el flyer.');
 return value as T;
}
function recentAsset(){
 try{
  const id=sessionStorage.getItem(historyKey)||'';
  return /^[a-f0-9]{32}$/.test(id)?id:'';
 }catch{return '';}
}
export function EditorialCreativeStudio(){
 const [courses,setCourses]=useState<CatalogCourse[]>([]),[selected,setSelected]=useState('');
 const [job,setJob]=useState<Job|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [format,setFormat]=useState<'flyer'|'story'>('flyer');
 const [connected,setConnected]=useState<boolean|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  const options={signal:controller.signal};
  void data<{courses:CatalogCourse[]}>('/api/sales/catalog',options).then(d=>{
   setCourses(d.courses);setSelected(d.courses[0]?.title||'');
  }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  const asset=recentAsset();
  if(asset)void data<Job>(base+'/studio/'+asset,options).then(setJob).catch(()=>{});
  const check=()=>void data<{connected:boolean}>(base+'/status',options)
   .then(d=>setConnected(d.connected)).catch(()=>{if(!controller.signal.aborted)setConnected(null);});
  check();
  const timer=window.setInterval(check,30_000);
  return ()=>{window.clearInterval(timer);controller.abort();};
 },[]);
 const asset=job?.asset;
 const pending=!!job&&['queued','rendering','uploading'].includes(job.state);
 useEffect(()=>{
  if(!asset||!pending)return;
  const controller=new AbortController();
  const poll=()=>void data<Job>(base+'/studio/'+asset,{signal:controller.signal}).then(setJob)
    .catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  const timer=window.setInterval(poll,6000);
  return ()=>{window.clearInterval(timer);controller.abort();};
 },[asset,pending]);

 async function generate(photo?:File){
  if(!selected||busy)return;
  if(photo&&(!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size>4*1024*1024)){
   setError('Elige una foto JPG, PNG o WebP de hasta 4 MB.');return;
  }
  setBusy(true);setError('');
  try{
   const query=new URLSearchParams({course:selected,format});
   const result=await data<Job>(base+(photo?'/studio/photo?'+query:'/studio'),{
    method:'POST',headers:{...action,'Content-Type':photo?.type||'application/json'},
    body:photo||JSON.stringify({course:selected,format}),
   });
   setJob(result);
   try{sessionStorage.setItem(historyKey,result.asset);}catch{/* The session may block local storage. */}
  }catch(e){setError(e instanceof Error?e.message:'No se pudo generar la fotografía.');}
  finally{setBusy(false);}
 }
 const url=job?.state==='ready'?base+'/studio/'+job.asset+'/image':'';
 return <section className="rounded-2xl bg-slate-950 text-white p-5 space-y-4">
  <h3 className="text-xl font-bold">Estudio de flyers fotográficos</h3>
  <p>Genera una escena distinta para cada pieza. El CRM añade el logo, el nombre completo del curso, su duración y los precios del catálogo.</p>
  <p className="text-sm text-slate-300">{connected?'Equipo de fotos conectado.':connected===false?'Equipo de fotos desconectado. Enlázalo en Community Manager → Generador local de fotos, o usa una foto propia.':'Verificando el equipo de fotos…'}</p>
  <div className="flex gap-3 flex-wrap">
   <select aria-label="Curso para el flyer" value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy||pending} className="bg-slate-800 p-2 rounded max-w-full">
    {courses.map(c=><option key={c.title}>{c.title}</option>)}
   </select>
   <select aria-label="Tamaño del flyer" value={format} onChange={e=>setFormat(e.target.value==='story'?'story':'flyer')} disabled={busy||pending} className="bg-slate-800 p-2 rounded">
    <option value="flyer">Flyer 1080 × 1350</option><option value="story">Historia 1080 × 1920</option>
   </select>
   <button onClick={()=>void generate()} disabled={!selected||busy||pending||connected!==true} className="bg-teal-700 rounded p-3 disabled:opacity-40">Generar foto nueva</button>
   <label className="rounded border border-cyan-600 p-2">
    Usar foto propia
    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!selected||busy||pending} className="block mt-1 text-sm max-w-full"
     onChange={e=>{const photo=e.currentTarget.files?.[0];e.currentTarget.value='';if(photo)void generate(photo);}}/>
   </label>
  </div>
  {error&&<p role="alert" className="text-amber-300">{error}</p>}
  {job&&<p role="status" className="text-sm text-cyan-100">{progress[job.state]}</p>}
  {url&&<>
   <img src={url} alt="Flyer fotográfico con datos del curso" className="max-h-[760px] max-w-full rounded-xl"/>
   <a href={url} download={'INTECA-'+job?.asset.slice(0,8)+'.jpg'} className="inline-block bg-blue-700 p-3 rounded">Descargar flyer</a>
  </>}
  <p className="text-xs text-slate-300">El estudio guarda el flyer para revisar y descargar. No lo publica en redes.</p>
 </section>;
}
