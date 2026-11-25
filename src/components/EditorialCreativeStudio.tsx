import {useEffect,useMemo,useState} from 'react';
import type {CatalogCourse} from '../../whatsapp-catalog';
import {createEditorial,repeatedEditorial,type EditorialCreative} from '../../community-editorial';
import {editorialSvg} from '../../community-editorial-svg';
import {flyerOffer,isPublishableFlyer} from '../../community-flyer-offer';
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const historyKey='inteca-editorial-manual-v7';
function recentProposals():EditorialCreative[]{
 try{const value=JSON.parse(localStorage.getItem(historyKey)||'[]');return Array.isArray(value)?value.filter(c=>c?.version==='v7'&&Array.isArray(c.points)).slice(-60):[];}catch{return [];}
}
function firstUnused(course:CatalogCourse){
 const recent=recentProposals();
 for(let revision=0;revision<=240;revision++){
  const candidate=createEditorial(course,day(),'flyer',0,revision);
  if(!repeatedEditorial(candidate,recent)&&candidate.layout!==recent.at(-1)?.layout)return candidate;
 }
 throw Error('Las propuestas de este tema ya se usaron recientemente. Elige otro curso o amplía su contenido oficial.');
}
export function EditorialCreativeStudio(){
 const [courses,setCourses]=useState<CatalogCourse[]>([]),[selected,setSelected]=useState('');
 const [proposal,setCreative]=useState<EditorialCreative|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [vertical,setVertical]=useState(false),[logo,setLogo]=useState('');
 const course=courses.find(c=>c.title===selected);
 useEffect(()=>{let live=true;void fetch('/api/sales/catalog').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo cargar el catálogo.');if(live){setCourses(d.courses);setSelected(d.courses[0]?.title||'');if(d.courses[0])setCreative(firstUnused(d.courses[0]));}}).catch(e=>{if(live)setError(e.message);});
  void fetch('/inteca-logo.webp').then(r=>{if(!r.ok)throw Error();return r.blob();}).then(blob=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);})).then(v=>{if(live)setLogo(v);}).catch(()=>{});
  return()=>{live=false;};},[]);
 const creative=useMemo(()=>proposal||(course?createEditorial(course,day(),'flyer',0):null),[proposal,course]);
 const preview=useMemo(()=>{if(!course||!creative)return {url:'',error:''};
  try{const offer=flyerOffer(course,day());if(!isPublishableFlyer(offer))throw Error('Este curso necesita contenido, duración y precios confirmados en el catálogo.');
   const svg=editorialSvg({creative,course:course.title,vertical,logo,facts:`${offer.duration} · Inscripción ${offer.registration} · Mensualidad ${offer.monthly}`});
   return {url:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),error:''};
  }catch(e){return {url:'',error:(e as Error).message};}
 },[course,creative,vertical,logo]);
 const {url}=preview;
 function another(){if(!course)return;
  let history:EditorialCreative[]=[];try{const stored=JSON.parse(localStorage.getItem(historyKey)||'[]');if(Array.isArray(stored))history=stored.filter(c=>c?.version==='v7'&&Array.isArray(c.points)).slice(-60);}catch{/* Private browsing may disable local storage. */}
  if(creative)history.push(creative);
  let next:EditorialCreative|null=null;
  for(let revision=1;revision<=240;revision++){const c=createEditorial(course,day(),'flyer',0,revision);if(c.layout!==creative?.layout&&!repeatedEditorial(c,history)){next=c;break;}}
  if(!next){setError('Las propuestas disponibles para este tema ya se usaron recientemente. Elige otro curso o amplía su contenido oficial.');return;}
  try{localStorage.setItem(historyKey,JSON.stringify(history.slice(-60)));}catch{/* Preview still works. */}
  setCreative(next);setError('');
 }
 async function download(){if(!url)return;setBusy(true);try{
  const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('No se pudo preparar la imagen.'));img.src=url;});
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=vertical?1920:1350;canvas.getContext('2d')!.drawImage(img,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo exportar.')),'image/png'));
  const downloadUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=downloadUrl;a.download=`INTECA-${day()}-${creative?.layout}-${Date.now()}.png`;a.click();if(creative){try{localStorage.setItem(historyKey,JSON.stringify([...recentProposals(),creative].slice(-60)));}catch{/* Download still succeeds. */}}setTimeout(()=>URL.revokeObjectURL(downloadUrl),2000);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="rounded-2xl bg-slate-950 text-white p-5 space-y-4">
  <h3 className="text-xl font-bold">Estudio de contenido educativo</h3>
  <p>Casos, errores frecuentes, ejercicios y guías prácticas. Cada propuesta combina un tema del catálogo con una composición diferente.</p>
  <div className="flex gap-3 flex-wrap"><select aria-label="Curso de la nueva propuesta" value={selected} onChange={e=>{try{const next=courses.find(c=>c.title===e.target.value);if(next){setCreative(firstUnused(next));setSelected(next.title);setError('');}}catch(err){setError((err as Error).message);}}} className="bg-slate-800 p-2 rounded max-w-full">{courses.map(c=><option key={c.title}>{c.title}</option>)}</select>
  <select aria-label="Tamaño de la propuesta" value={vertical?'story':'flyer'} onChange={e=>setVertical(e.target.value==='story')} className="bg-slate-800 p-2 rounded"><option value="flyer">Flyer 1080 × 1350</option><option value="story">Historia 1080 × 1920</option></select>
  <button onClick={another} disabled={!course||busy} className="bg-teal-700 rounded p-3 disabled:opacity-40">Crear otra propuesta</button></div>
  {(error||preview.error)&&<p role="alert" className="text-amber-300">{error||preview.error}</p>}
  {url&&<img src={url} alt={creative?.headline||'Vista previa de contenido'} className="max-h-[680px] max-w-full rounded-xl"/>}
  {creative&&<p className="text-sm text-slate-300">{creative.angle} · {creative.topic}</p>}
  <button onClick={()=>void download()} disabled={!url||busy} className="bg-blue-700 p-3 rounded disabled:opacity-40">{busy?'Preparando…':'Descargar PNG'}</button>
  <p className="text-xs text-slate-300">Revisa la propuesta antes de publicarla. El botón recuerda las propuestas recientes en este navegador; el calendario automático utiliza el historial compartido del CRM.</p>
 </section>;
}
