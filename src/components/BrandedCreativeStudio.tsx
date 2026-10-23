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
export function BrandedCreativeStudio() {
  const [courses, setCourses] = useState<CatalogCourse[]>([]),
    [selected, setSelected] = useState(''),
    [format, setFormat] = useState('flyer'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    logo = useRef<HTMLImageElement | null>(null),
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
  function draw(scene = -1, progress = 1) {
    const el = canvas.current;
    if (!el || !course || !logo.current) return;
    const w = format === 'banner' ? 1600 : 1080,
      h = format === 'banner' ? 900 : 1350;
    if (el.width !== w) el.width = w;
    if (el.height !== h) el.height = h;
    const c = el.getContext('2d')!;
    c.resetTransform();
    const scale = w / 1080;
    c.scale(scale, scale);
    const H = h / scale;
    const gradient = c.createLinearGradient(0, 0, 1080, H);
    gradient.addColorStop(0, '#071b2b');
    gradient.addColorStop(1, '#10465b');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 1080, H);
    c.globalAlpha = 0.12;
    c.fillStyle = '#19cdd9';
    c.beginPath();
    c.arc(1100, 240, 420, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.drawImage(logo.current, 55, 35, 130, 130);
    textBlock(c, 'INTECA', 215, 83, 650, 55, 42);
    textBlock(c, 'FORMACIÓN PARA TU PRÓXIMO PASO', 215, 122, 760, 35, 19, '#62e5d1');
    const compact = format === 'banner';
    const titleY = compact ? 215 : 280;
    const titleH = compact ? 135 : 230;
    textBlock(c, course.title, 60, titleY, 960, titleH, compact ? 45 : 64);
    const detailY = compact ? 350 : 560;
    const detailH = compact ? 95 : 240;
    const benefits = course.description || course.text;
    const detail =
      scene === 0
        ? 'Tu próximo paso comienza con una habilidad nueva.'
        : scene === 2
          ? `${course.duration} · ${course.modality}. ${course.investment}`
          : scene === 3
            ? 'Solicita información y conoce el proceso de inscripción.'
            : benefits;
    textBlock(c, detail, 60, detailY, 950, detailH, compact ? 23 : 34, '#d7e7ef');
    if (!compact) {
      c.fillStyle = '#153e50';
      c.fillRect(55, 850, 970, 235);
      textBlock(c, `${course.duration} · ${course.modality}`, 80, 900, 910, 60, 28, '#71edce');
      textBlock(c, course.investment, 80, 970, 910, 90, 28);
      textBlock(
        c,
        course.schedule || 'Consulta la disponibilidad de grupos y horarios',
        60,
        1120,
        950,
        70,
        24,
        '#c3d7e4',
      );
    }
    if (compact)
      textBlock(c, `${course.duration} · ${course.investment}`, 60, 447, 950, 48, 19, '#71edce');
    const cy = H - 130;
    c.fillStyle = '#38e2b6';
    c.fillRect(55, cy, 970, 65);
    textBlock(
      c,
      'DA EL SIGUIENTE PASO · SOLICITA INFORMACIÓN',
      80,
      cy + 42,
      920,
      45,
      27,
      '#082c36',
    );
    textBlock(c, 'inteca.com.do  ·  intecaedu@gmail.com', 60, H - 28, 960, 35, 22, '#c3d7e4');
    if (scene >= 0) {
      c.fillStyle = '#38e2b6';
      c.fillRect(0, H - 6, 1080 * progress, 6);
    }
  }
  useEffect(() => {
    if (ready) draw();
  }, [selected, format, ready, courses]);
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
        Logo institucional, beneficios del catálogo y llamado a la acción. PNG de alta resolución y
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
      <canvas ref={canvas} className="max-w-full max-h-[600px] rounded-xl" />
      <div className="flex gap-3">
        <button
          disabled={!ready || !course || busy}
          onClick={() => void imageDownload()}
          className="bg-cyan-700 rounded p-3 disabled:opacity-40"
        >
          Descargar {format === 'banner' ? 'banner' : 'flyer'} PNG
        </button>
        <button
          disabled={!ready || !course || busy}
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
