import { useEffect, useRef, useState } from 'react';

type Turn = { speaker: 'customer' | 'agent'; text: string };
type Recognition = {
 lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
 onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
 onerror: ((event: { error: string }) => void) | null;
 onend: (() => void) | null; start(): void; stop(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function BrowserVoiceTrial({ organizationId }: { organizationId: string }) {
 const [turns, setTurns] = useState<Turn[]>([]), [draft, setDraft] = useState(''), [course, setCourse] = useState('');
 const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]), [voiceId, setVoiceId] = useState('');
 const [listening, setListening] = useState(false), [busy, setBusy] = useState(false), [speaking, setSpeaking] = useState(false);
 const [error, setError] = useState(''), [supported, setSupported] = useState(false), [audio, setAudio] = useState(false);
 const recognition = useRef<Recognition | null>(null), request = useRef<AbortController | null>(null), generation = useRef(0), locked = useRef(false);
 const transcript = useRef<HTMLDivElement>(null);
 function stopAudio() { window.speechSynthesis?.cancel(); setSpeaking(false); }
 function cancelAll() {
  generation.current++; request.current?.abort(); request.current = null;
  const r = recognition.current; recognition.current = null;
  if (r) { r.onresult = null; r.onerror = null; r.onend = null; r.abort(); }
  window.speechSynthesis?.cancel(); locked.current = false;
 }
 useEffect(() => {
  setSupported(Boolean((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition));
  setAudio('speechSynthesis' in window);
  function loadVoices() {
   const list = window.speechSynthesis?.getVoices().filter(v => /^es(?:-|_)/i.test(v.lang)) || [];
   list.sort((a,b) => score(b)-score(a)); setVoices(list);
   setVoiceId(current => list.some(v => v.voiceURI === current) ? current : list[0]?.voiceURI || '');
  }
  function score(v: SpeechSynthesisVoice) { return (/es[-_](MX|US|DO)/i.test(v.lang)?10:0)+(/Sabina|Dalia|Paulina|Paloma|Lupe|female|femenina/i.test(v.name)?20:0); }
  loadVoices(); window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
  const hide = () => { if (document.hidden) { cancelAll(); setListening(false); setBusy(false); setSpeaking(false); } };
  document.addEventListener('visibilitychange', hide);
  return () => { cancelAll(); window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices); document.removeEventListener('visibilitychange', hide); };
 }, []);
 useEffect(() => { cancelAll(); setTurns([]); setDraft(''); setCourse(''); setError(''); setListening(false); setBusy(false); setSpeaking(false); }, [organizationId]);
 useEffect(() => { transcript.current?.scrollTo({top: transcript.current.scrollHeight}); }, [turns, busy]);
 function speak(text: string) {
  if (!audio) return;
  stopAudio(); const utterance = new SpeechSynthesisUtterance(text);
  const chosen = voices.find(v => v.voiceURI === voiceId);
  if (chosen) utterance.voice = chosen;
  utterance.lang = chosen?.lang || 'es-MX'; utterance.rate = 0.96;
  const version = generation.current;
  utterance.onstart = () => { if(version===generation.current) setSpeaking(true); };
  utterance.onend = () => { if(version===generation.current) setSpeaking(false); };
  utterance.onerror = event => { if(version!==generation.current)return; setSpeaking(false); if(!['interrupted','canceled'].includes(event.error))setError('No se pudo reproducir la voz. Puedes leer la respuesta o pulsar Escuchar respuesta.'); };
  window.speechSynthesis.speak(utterance);
 }
 function listen() {
  if (locked.current || listening) return;
  const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
  if (!Constructor) return;
  stopAudio(); setError(''); const r = new Constructor(); recognition.current = r;
  r.lang = 'es-DO'; r.continuous = false; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = event => { if(recognition.current!==r)return; const text = Array.from(event.results).map(result => result[0]?.transcript || '').join(' '); setDraft(text.slice(0,1500)); };
  r.onerror = event => { if(recognition.current!==r)return; setListening(false); setError(event.error==='not-allowed' ? 'Permite el micrófono en el candado de la barra del navegador y vuelve a intentarlo.' : event.error==='no-speech' ? 'No se detectó voz. Pulsa Hablar y vuelve a intentarlo.' : 'El dictado no está disponible. Revisa el micrófono y la conexión, o escribe tu mensaje.'); };
  r.onend = () => { if(recognition.current===r){recognition.current=null;setListening(false);} };
  try { r.start(); setListening(true); } catch { recognition.current=null; setError('No se pudo iniciar el micrófono. Puedes escribir tu mensaje.'); }
 }
 async function send() {
  const text = draft.trim(); if (!text || locked.current || listening) return;
  locked.current = true; setBusy(true); setError(''); stopAudio();
  const controller = new AbortController(); request.current = controller; const version = generation.current;
  const timeout = window.setTimeout(() => controller.abort(), 45000);
  try {
   const response = await fetch(`/api/advertising/voice/${encodeURIComponent(organizationId)}/simulate`, { method:'POST', headers:{'Content-Type':'application/json','X-CRM-Action':'advertising'}, body:JSON.stringify({course,text,history:turns.slice(-16)}), signal:controller.signal });
   const result = await response.json();
   if (!response.ok || typeof result.reply!=='string' || !result.reply.trim()) throw Error('No se pudo obtener la respuesta. Revisa la sesión y la conexión de IA del CRM.');
   if (version!==generation.current) return;
   setTurns(previous => [...previous,{speaker:'customer',text},{speaker:'agent',text:result.reply}]); setDraft(''); speak(result.reply);
  } catch(e) { if(version===generation.current)setError(controller.signal.aborted ? 'La respuesta tardó demasiado. Tu mensaje sigue disponible para reintentar.' : (e as Error).message); }
  finally { clearTimeout(timeout); if(version===generation.current){locked.current=false;request.current=null;setBusy(false);} }
 }
 const last = [...turns].reverse().find(t => t.speaker==='agent');
 return <div className="space-y-3 rounded-xl border border-cyan-700 bg-slate-950 p-4 text-slate-100">
  <h3 className="text-lg font-bold">Hablar con Valeria Parkert · Prueba de voz sin Twilio</h3>
  <p className="text-sm text-slate-300">Usa tu micrófono y altavoces. No llama a ningún teléfono, no necesita tarjeta y no consume Twilio. Las respuestas usan la IA conectada al CRM y su cuota o tarifa existente. La voz del navegador puede diferir de la voz telefónica.</p>
  <p className="text-xs text-slate-300">Pulsa Hablar, dicta tu pregunta y pulsa Enviar a Valeria. El navegador puede procesar el audio con su proveedor de reconocimiento; el CRM recibe el texto. La conversación se conserva en este panel mientras esté abierto y no crea contactos, pagos ni matrículas.</p>
  <label className="block text-sm">Curso o producto (opcional)<input aria-label="Curso para hablar con Valeria" maxLength={250} disabled={busy||listening} value={course} onChange={e=>{stopAudio();setCourse(e.target.value);setTurns([]);}} className="mt-1 w-full rounded bg-slate-800 p-2"/></label>
  <label className="block text-sm">Voz de prueba en español<select aria-label="Voz de prueba en español" value={voiceId} onChange={e=>{stopAudio();setVoiceId(e.target.value);}} className="mt-1 w-full rounded bg-slate-800 p-2"><option value="">Predeterminada del dispositivo</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></label>
  {!supported&&<p className="text-amber-200">Este navegador no ofrece dictado. Prueba Chrome con permiso de micrófono o escribe tu pregunta.</p>}
  {!audio&&<p className="text-amber-200">Este navegador no ofrece lectura de voz; las respuestas aparecerán por escrito.</p>}
  <div ref={transcript} role="log" aria-label="Conversación de prueba con Valeria" aria-live="polite" className="max-h-80 space-y-3 overflow-auto rounded bg-slate-900 p-3">
   {!turns.length&&<p className="text-sm text-slate-300">Empieza con: «Hola, quiero información de Autorizaciones Médicas». Después puedes preguntar precios, horarios o instrucciones de pago.</p>}
   {turns.map((turn,i)=><p key={i} className="whitespace-pre-wrap text-sm"><strong className="text-cyan-200">{turn.speaker==='agent'?'Valeria':'Tú'}:</strong> {turn.text}</p>)}
  </div>
  <label className="block text-sm">Tu mensaje<textarea aria-label="Mensaje de voz o texto para Valeria" maxLength={1500} disabled={busy||listening} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Aquí aparecerá lo que digas; puedes corregirlo antes de enviarlo." className="mt-1 w-full rounded bg-slate-800 p-2"/></label>
  <div className="flex flex-wrap gap-2">
   <button disabled={busy||listening||turns.length>0} onClick={()=>{const text="Hola, soy Valeria Parkert, asistente de inteligencia artificial. ¿Sobre qué curso o producto te gustaría conversar?";setTurns([{speaker:"agent",text}]);speak(text);}} className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">Iniciar conversación de voz</button>
   <button disabled={!supported||busy||listening} onClick={listen} className="rounded bg-cyan-700 px-3 py-2 text-white disabled:opacity-50">Hablar por micrófono</button>
   {listening&&<button onClick={()=>recognition.current?.stop()} className="rounded border px-3 py-2">Terminé de hablar</button>}
   <button disabled={busy||listening||!draft.trim()} onClick={()=>void send()} className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50">Enviar a Valeria</button>
   <button disabled={!audio||!last||busy||listening} onClick={()=>last&&speak(last.text)} className="rounded border px-3 py-2 disabled:opacity-50">Escuchar respuesta</button>
   <button disabled={!speaking} onClick={stopAudio} className="rounded border px-3 py-2 disabled:opacity-50">Silenciar</button>
   <button onClick={()=>{cancelAll();setTurns([]);setDraft('');setError('');setListening(false);setBusy(false);setSpeaking(false);}} className="rounded border px-3 py-2">Limpiar prueba</button>
  </div>
  <p role="status" className="text-sm text-cyan-200">{listening?'Escuchando…':busy?'Valeria está preparando su respuesta…':speaking?'Valeria está hablando…':'Lista para conversar.'}</p>
  {error&&<p role="alert" className="text-amber-200">{error}</p>}
 </div>;
}
