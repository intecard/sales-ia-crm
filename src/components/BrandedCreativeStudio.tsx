import { useEffect, useRef, useState } from 'react';
import type { CatalogCourse } from '../../whatsapp-catalog';
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function textBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  color = '#fff',
) {
  let lines: string[] = [];
  for (; size >= 12; size -= 2) {
    ctx.font = `600 ${size}px Arial`;
    lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      if (ctx.measureText(`${line} ${word}`).width > width && line) {
        lines.push(line);
        line = word;
      } else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    if (lines.length * size * 1.3 <= height) break;
  }
  ctx.fillStyle = color;
  lines
    .slice(0, Math.floor(height / (size * 1.3)))
    .forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.3));
}
function courseVisual(title: string) {
  const t = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/farmac|visita.*medic/.test(t)) return { image: '/creative/pharmacy.webp', hook: 'CONOCIMIENTO QUE FORTALECE TU PERFIL', benefit: 'Da el siguiente paso en tu formación en el sector salud.' };
  if (/enfermer|promotor.*salud/.test(t)) return { image: '/creative/nursing.webp', hook: 'TRANSFORMA TU VOCACIÓN EN PREPARACIÓN', benefit: 'Aprende habilidades para una atención más humana y profesional.' };
  return { image: '/creative/call-center.webp', hook: 'PREPÁRATE PARA TU PRÓXIMA OPORTUNIDAD', benefit: 'Fortalece tu perfil para los procesos administrativos del sector salud.' };
}
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth-sw)/2, (img.naturalHeight-sh)/2, sw, sh, x, y, w, h);
}
export function BrandedCreativeStudio() {
  const [courses, setCourses] = useState<CatalogCourse[]>([]),
    [selected, setSelected] = useState(''),
    [format, setFormat] = useState('flyer'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const [photoReady, setPhotoReady] = useState(false), [seats, setSeats] = useState(''), [deadline, setDeadline] = useState(''), [confirmedScarcity, setConfirmedScarcity] = useState(false), [customPhotos, setCustomPhotos] = useState<Record<string,string>>({});
  const canvas = useRef<HTMLCanvasElement>(null),
    logo = useRef<HTMLImageElement | null>(null),
    photo = useRef<HTMLImageElement | null>(null),
    recorder = useRef<MediaRecorder | null>(null);
  const course = courses.find((c) => c.title === selected);
  useEffect(() => {
    let active = true;
    void fetch('/api/sales/catalog')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (active) {
          setCourses(data.courses);
          setSelected(data.courses[0]?.title || '');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    const img = new Image();
    img.onload = () => {
      logo.current = img;
      if (active) setReady(true);
    };
    img.onerror = () => {
      if (active) setError('No se pudo cargar el logo institucional.');
    };
    img.src = '/inteca-logo.webp';
    return () => {
      active = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
    };
  }, []);
  const visual = courseVisual(selected);
  useEffect(() => {
    if (!selected) return;
    let active=true; setPhotoReady(false); photo.current=null;
    const img=new Image();
    img.onload=()=>{if(active){photo.current=img;setPhotoReady(true);}};
    img.onerror=()=>{if(active)setError('No se pudo cargar la imagen del curso. Selecciona otra imagen antes de exportar.');};
    img.src=customPhotos[selected] || visual.image;
    return()=>{active=false;};
  },[selected,customPhotos,visual.image]);
  useEffect(()=>{setSeats('');setDeadline('');setConfirmedScarcity(false);},[selected]);
  function draw(scene = -1, progress = 1) {
    const el=canvas.current;
    if(!el || !course || !logo.current || !photo.current || !photoReady)return;
    const compact=format==='banner';const w=compact?1600:1080,h=compact?900:1350;
    if(el.width!==w)el.width=w;if(el.height!==h)el.height=h;
    const c=el.getContext('2d')!;c.resetTransform();c.fillStyle='#071e30';c.fillRect(0,0,w,h);
    // Photograph remains a real raster asset, while all catalog data stays editable and exact.
    if(compact){cover(c,photo.current,760,0,840,h);const fade=c.createLinearGradient(650,0,1200,0);fade.addColorStop(0,'#071e30');fade.addColorStop(1,'rgba(7,30,48,0)');c.fillStyle=fade;c.fillRect(650,0,550,h);}
    else {cover(c,photo.current,0,320,1080,570);const fade=c.createLinearGradient(0,650,0,910);fade.addColorStop(0,'rgba(7,30,48,0)');fade.addColorStop(1,'#071e30');c.fillStyle=fade;c.fillRect(0,650,1080,260);}
    c.drawImage(logo.current,40,24,108,108);
    textBlock(c,'INTECA',168,70,550,44,38);
    textBlock(c,'INSTITUTO TÉCNICO DEL CARIBE',168,103,620,28,18,'#70efcf');
    const textW=compact?720:970;
    textBlock(c,visual.hook,48,compact?175:164,textW,34,compact?22:23,'#ffd15c');
    textBlock(c,course.title,48,compact?242:222,textW,compact?160:105,compact?52:48);
    let opportunity='TU PRÓXIMO PASO PROFESIONAL EMPIEZA AQUÍ';
    const count=Number(seats);
    const validDeadline=deadline && deadline>=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(confirmedScarcity){const parts=[];if(Number.isInteger(count)&&count>0)parts.push(`${count} CUPOS DISPONIBLES`);if(validDeadline)parts.push('CIERRE '+deadline.split('-').reverse().join('/'));if(parts.length)opportunity=parts.join(' · ');}
    const detail=scene===0?visual.benefit:scene===3?'Pregunta por el grupo disponible y conoce cómo iniciar tu inscripción.':course.description||course.text;
    textBlock(c,detail,48,compact?427:887,textW,compact?100:96,compact?27:28,'#dcebf0');
    c.fillStyle='#123c4f';c.fillRect(40,compact?542:1000,compact?710:1000,compact?176:177);
    textBlock(c,`${course.duration} · ${course.modality}`,58,compact?580:1037,compact?675:960,40,compact?24:27,'#77f1d0');
    textBlock(c,course.investment,58,compact?622:1080,compact?675:960,compact?84:72,compact?25:28);
    if(!compact)textBlock(c,course.schedule||'Consulta los grupos y horarios disponibles',48,1196,970,42,19,'#c8dbe5');
    const cy=compact?750:1240;c.fillStyle='#ffc94d';c.fillRect(40,cy,compact?710:1000,64);
    textBlock(c,'ESCRÍBENOS HOY · QUIERO INSCRIBIRME',58,cy+41,compact?675:960,46,compact?25:28,'#082638');
    textBlock(c,opportunity,48,compact?735:1223,textW,30,compact?17:19,'#ffda7b');
    textBlock(c,'inteca.com.do · intecaedu@gmail.com',48,h-15,compact?710:970,26,compact?20:21,'#c9e3ea');
    if(scene>=0){c.fillStyle='#38e2b6';c.fillRect(0,h-5,w*progress,5);}
  }
  useEffect(()=>{if(ready&&photoReady)draw();},[selected,format,ready,photoReady,courses,seats,deadline,confirmedScarcity]);
  async function uploadPhoto(file?: File){
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){setError('Usa una imagen JPG, PNG o WebP de hasta 8 MB.');return;}
    const reader=new FileReader();reader.onload=()=>{setError('');setCustomPhotos(old=>({...old,[selected]:String(reader.result)}));};reader.readAsDataURL(file);
  }
  async function imageDownload() {
    draw();
    canvas.current?.toBlob((blob) => {
      if (blob) save(blob, `INTECA-${format}.png`);
    }, 'image/png');
  }
  async function videoDownload() {
    if (!canvas.current || !course) return;
    if (typeof MediaRecorder === 'undefined' || !canvas.current.captureStream) {
      setError('Este navegador no admite exportación de video. Usa Chrome o Edge actualizado.');
      return;
    }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    if (!mime) {
      setError('No hay codificador WebM disponible.');
      return;
    }
    setBusy(true);
    setError('');
    const stream = canvas.current.captureStream(20);
    const chunks: Blob[] = [];
    const recording = new MediaRecorder(stream, { mimeType: mime });
    recorder.current = recording;
    recording.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recording.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (chunks.length) save(new Blob(chunks, { type: mime }), 'INTECA-video-informativo.webm');
      setBusy(false);
      draw();
    };
    recording.onerror = () => {
      setError('No se pudo exportar el video.');
      setBusy(false);
      stream.getTracks().forEach((t) => t.stop());
    };
    recording.start();
    const start = performance.now();
    function frame() {
      if (recording.state !== 'recording') return;
      const elapsed = performance.now() - start;
      draw(Math.min(3, Math.floor(elapsed / 7500)), Math.min(1, elapsed / 30000));
      if (elapsed >= 30000) recording.stop();
      else requestAnimationFrame(frame);
    }
    frame();
  }
  return (
    <section className="rounded-2xl border border-cyan-700 bg-slate-900 p-5 space-y-4 text-slate-200">
      <h2 className="text-xl font-bold">Estudio INTECA · Flyers, banners y videos</h2>
      <p className="text-sm">
        Fotografía relacionada con el curso, logo institucional, gancho, datos del catálogo y llamado a la acción. PNG de alta resolución y
        video informativo WebM de 30 segundos con texto en pantalla, sin audio.
      </p>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-3 flex-wrap">
        <select
          aria-label="Curso del material"
          disabled={busy}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-slate-800 rounded p-2 max-w-full"
        >
          {courses.map((c) => (
            <option key={c.title}>{c.title}</option>
          ))}
        </select>
        <select
          aria-label="Formato del material"
          disabled={busy}
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="bg-slate-800 rounded p-2"
        >
          <option value="flyer">Flyer vertical 1080 × 1350</option>
          <option value="banner">Banner 1600 × 900</option>
        </select>
      </div>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <label>Imagen propia para este curso<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>void uploadPhoto(e.target.files?.[0])} className="block mt-2 max-w-full" /></label>
        <label>Cupos disponibles confirmados<input type="number" min="1" step="1" value={seats} disabled={busy} onChange={e=>setSeats(e.target.value)} placeholder="Sin cantidad confirmada" className="block bg-slate-800 rounded p-2 mt-2 w-full" /></label>
        <label>Fecha real de cierre<input type="date" value={deadline} disabled={busy} onChange={e=>setDeadline(e.target.value)} className="block bg-slate-800 rounded p-2 mt-2 w-full" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmedScarcity} disabled={busy} onChange={e=>setConfirmedScarcity(e.target.checked)} />Confirmo que los cupos y la fecha indicados son reales para este curso y autorizo mostrarlos.</label>
      <p className="text-xs text-slate-400">Las escenas predeterminadas son ilustraciones generadas con IA. No representan personal ni instalaciones reales de INTECA. Sin cupos o fecha confirmados se utiliza un mensaje de oportunidad, sin escasez inventada.</p>
      {!photoReady && <p role="status">Cargando imagen del curso…</p>}
      <canvas ref={canvas} className="max-w-full max-h-[600px] rounded-xl" />
      <div className="flex gap-3">
        <button
          disabled={!ready || !photoReady || !course || busy}
          onClick={() => void imageDownload()}
          className="bg-cyan-700 rounded p-3 disabled:opacity-40"
        >
          Descargar {format === 'banner' ? 'banner' : 'flyer'} PNG
        </button>
        <button
          disabled={!ready || !photoReady || !course || busy}
          onClick={() => void videoDownload()}
          className="bg-blue-700 rounded p-3 disabled:opacity-40"
        >
          {busy ? 'Creando video… Mantén esta pestaña abierta' : 'Crear video informativo'}
        </button>
      </div>
      <p className="text-xs">
        Revisa el material antes de publicar. Los videos se descargan en WebM; la publicación en
        redes y la conversión a MP4 son pasos separados.
      </p>
    </section>
  );
}
