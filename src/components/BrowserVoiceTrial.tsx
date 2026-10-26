import { useEffect, useRef, useState } from 'react';

type Turn = { speaker: 'customer' | 'agent'; text: string };
type Recognition = {
 lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
 onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
 onerror: ((event: { error: string }) => void) | null;
 onend: (() => void) | null; start(): void; stop(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const greeting = 'Hola, soy Valeria Parkert. Qué gusto saludarte. Cuéntame, ¿qué te gustaría aprender?';

export function BrowserVoiceTrial({ organizationId }: { organizationId: string }) {
 const [turns,setTurns]=useState<Turn[]>([]),[draft,setDraft]=useState(''),[course,setCourse]=useState('');
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[voiceId,setVoiceId]=useState(''),[rate,setRate]=useState(1);
 const [listening,setListening]=useState(false),[busy,setBusy]=useState(false),[speaking,setSpeaking]=useState(false),[active,setActive]=useState(false);
 const [error,setError]=useState(''),[supported,setSupported]=useState(false),[audio,setAudio]=useState(false),[continuous,setContinuous]=useState(true);
 const [mic,setMic]=useState('Sin comprobar'),[level,setLevel]=useState(0),[language,setLanguage]=useState('es-MX');
 const recognition=useRef<Recognition|null>(null),request=useRef<AbortController|null>(null),generation=useRef(0),locked=useRef(false),session=useRef(false);
 const micStream=useRef<MediaStream|null>(null),audioContext=useRef<AudioContext|null>(null),meterFrame=useRef(0);
 const silence=useRef<ReturnType<typeof setTimeout>|null>(null),restart=useRef<ReturnType<typeof setTimeout>|null>(null),emptyTurns=useRef(0),latestText=useRef('');
 const transcript=useRef<HTMLDivElement>(null),utteranceRef=useRef<SpeechSynthesisUtterance|null>(null),speechVersion=useRef(0),micPending=useRef(false);
 const current=useRef({turns,draft,course,voices,voiceId,rate,language,continuous});current.current={turns,draft,course,voices,voiceId,rate,language,continuous};
 const handlers=useRef({listen:()=>{},send:(_text:string)=>{}});
 function clearTimers(){if(silence.current)clearTimeout(silence.current);if(restart.current)clearTimeout(restart.current);silence.current=null;restart.current=null;}
 function stopAudio(){speechVersion.current++;window.speechSynthesis?.cancel();utteranceRef.current=null;setSpeaking(false);}
 function releaseMic(){cancelAnimationFrame(meterFrame.current);micStream.current?.getTracks().forEach(t=>t.stop());micStream.current=null;void audioContext.current?.close().catch(()=>{});audioContext.current=null;}
 function cancelAll(){
  generation.current++;session.current=false;clearTimers();request.current?.abort();request.current=null;
  const r=recognition.current;recognition.current=null;
  if(r){r.onresult=null;r.onerror=null;r.onend=null;r.abort();}
  speechVersion.current++;window.speechSynthesis?.cancel();utteranceRef.current=null;locked.current=false;releaseMic();latestText.current='';
 }
 function stop(){cancelAll();setActive(false);setListening(false);setBusy(false);setSpeaking(false);setLevel(0);setMic('Micrófono apagado');}
 function scheduleListen(){if(!session.current)return;if(restart.current)clearTimeout(restart.current);restart.current=setTimeout(()=>{restart.current=null;if(session.current)handlers.current.listen();},350);}
 async function prepareMic(){
  if(micStream.current?.active)return true;
  if(micPending.current)return false;
  if(!navigator.mediaDevices?.getUserMedia){setError('El navegador no permite acceder al micrófono. Abre el CRM por HTTPS en Chrome o Edge.');return false;}
  const version=generation.current;micPending.current=true;setMic('Esperando permiso de micrófono…');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(version!==generation.current){stream.getTracks().forEach(t=>t.stop());return false;}
   micStream.current=stream;setMic(stream.getAudioTracks()[0]?.label||'Micrófono predeterminado del navegador');
   // A local level meter distinguishes a silent/incorrect device from a dictation-service failure.
   try{
    const context=new AudioContext();audioContext.current=context;await context.resume();
    if(version!==generation.current)return false;
    const analyser=context.createAnalyser();analyser.fftSize=256;context.createMediaStreamSource(stream).connect(analyser);
    const data=new Uint8Array(analyser.fftSize);let last=0;
    const sample=(time:number)=>{if(version!==generation.current||!micStream.current)return;analyser.getByteTimeDomainData(data);if(time-last>120){let sum=0;for(const n of data)sum+=((n-128)/128)**2;setLevel(Math.min(100,Math.round(Math.sqrt(sum/data.length)*350)));last=time;}meterFrame.current=requestAnimationFrame(sample);};
    meterFrame.current=requestAnimationFrame(sample);
   }catch{/* Dictation can still work without the optional level meter. */}
   return true;
  }catch(e){if(version===generation.current){setMic('Micrófono no disponible');const name=(e as Error).name;setError(name==='NotAllowedError'?'El micrófono está bloqueado. Permítelo en el icono junto a la dirección del CRM y en Privacidad > Micrófono de Windows.':name==='NotFoundError'?'No se encontró un micrófono. Conecta uno y selecciónalo como entrada predeterminada.':name==='NotReadableError'?'No se pudo abrir el micrófono. Cierra otras aplicaciones que lo estén usando y revisa la entrada de Windows.':'No se pudo abrir el micrófono. Revisa los permisos y el dispositivo de entrada.');}return false;}
  finally{micPending.current=false;}
 }
 useEffect(()=>{
  setSupported(Boolean((window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition));setAudio('speechSynthesis' in window);
  function loadVoices(){const list=window.speechSynthesis?.getVoices().filter(v=>/^es(?:-|_)/i.test(v.lang))||[];const score=(v:SpeechSynthesisVoice)=>(/es[-_](MX|US|DO)/i.test(v.lang)?10:0)+(/Sabina|Dalia|Paulina|Paloma|Lupe|female|femenina/i.test(v.name)?20:0)+(/Natural|Neural|Online/i.test(v.name)?15:0);list.sort((a,b)=>score(b)-score(a));setVoices(list);setVoiceId(id=>list.some(v=>v.voiceURI===id)?id:list[0]?.voiceURI||'');}
  loadVoices();window.speechSynthesis?.addEventListener('voiceschanged',loadVoices);
  const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);
  return()=>{cancelAll();window.speechSynthesis?.removeEventListener('voiceschanged',loadVoices);document.removeEventListener('visibilitychange',hide);};
 },[]);
 useEffect(()=>{stop();setTurns([]);setDraft('');setCourse('');setError('');},[organizationId]);
 useEffect(()=>{transcript.current?.scrollTo({top:transcript.current.scrollHeight});},[turns,busy,draft]);
 function speak(text:string,resume=false){
  stopAudio();
  if(!audio){if(resume)scheduleListen();return;}
  const u=new SpeechSynthesisUtterance(text.replace(/\*+/g,'').replace(/RD\$\s*/g,'pesos dominicanos '));utteranceRef.current=u;
  const chosen=current.current.voices.find(v=>v.voiceURI===current.current.voiceId);if(chosen)u.voice=chosen;
  u.lang=chosen?.lang||'es-MX';u.rate=current.current.rate;u.pitch=1;
  const version=generation.current,sequence=speechVersion.current;
  const valid=()=>version===generation.current&&sequence===speechVersion.current;
  u.onstart=()=>{if(valid())setSpeaking(true);};
  u.onend=()=>{if(!valid())return;setSpeaking(false);utteranceRef.current=null;if(resume)scheduleListen();};
  u.onerror=event=>{if(!valid())return;setSpeaking(false);if(!['interrupted','canceled'].includes(event.error)){setError('No se pudo reproducir la voz. Pulsa Escuchar respuesta o selecciona otra voz.');session.current=false;setActive(false);releaseMic();setLevel(0);}};
  window.speechSynthesis.speak(u);
 }
 function recognize(){
  if(locked.current||recognition.current)return;
  const Constructor=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;if(!Constructor)return;
  stopAudio();setError('');latestText.current='';const r=new Constructor();recognition.current=r;
  r.lang=current.current.language;r.continuous=true;r.interimResults=true;r.maxAlternatives=1;let failure='';
  r.onresult=event=>{if(recognition.current!==r)return;const text=Array.from(event.results).map(result=>result[0]?.transcript||'').join(' ').trim().slice(0,1500);latestText.current=text;setDraft(text);emptyTurns.current=0;if(silence.current)clearTimeout(silence.current);if(text)silence.current=setTimeout(()=>{if(recognition.current===r)r.stop();},1800);};
  r.onerror=event=>{if(recognition.current!==r)return;failure=event.error;if(['not-allowed','service-not-allowed','audio-capture','network','language-not-supported'].includes(failure)){
   session.current=false;setActive(false);releaseMic();setLevel(0);
   setError(failure==='not-allowed'||failure==='service-not-allowed'?'Permite el micrófono para este sitio y comprueba que Chrome o Edge tenga acceso en Windows.':failure==='audio-capture'?'El reconocimiento no recibe audio. Selecciona tu micrófono en la configuración de sonido de Windows y en la configuración de micrófono del navegador.':failure==='language-not-supported'?'El servicio de dictado no admite ese idioma. Selecciona Español de México o Estados Unidos.':'El servicio de dictado no conecta. Revisa internet o prueba otro navegador; puedes escribir mientras tanto.');
  }};
  r.onend=()=>{
   if(recognition.current!==r)return;recognition.current=null;setListening(false);if(silence.current)clearTimeout(silence.current);silence.current=null;
   const text=latestText.current;latestText.current='';
   if(failure&&failure!=='no-speech'&&failure!=='aborted'){if(!session.current){releaseMic();setLevel(0);}return;}
   if(text&&session.current){handlers.current.send(text);return;}
   if(!text&&session.current){if(++emptyTurns.current<=2){setMic('Esperando tu voz… revisa la barra de nivel.');scheduleListen();}else{session.current=false;setActive(false);releaseMic();setLevel(0);setError('No llegó voz al dictado después de varios intentos. Pulsa Comprobar micrófono: si la barra no se mueve, cambia la entrada de Windows/Chrome. Si se mueve, prueba otro idioma o navegador.');}}
   else if(!session.current){releaseMic();setLevel(0);if(!text)setError('No llegó voz al dictado. Pulsa Comprobar micrófono y revisa si se mueve la barra.');}
  };
  try{r.start();setListening(true);}catch{recognition.current=null;session.current=false;setActive(false);releaseMic();setLevel(0);setError('No se pudo iniciar el dictado. Comprueba el micrófono o escribe tu mensaje.');}
 }
 async function listen(){if(locked.current||recognition.current)return;stopAudio();setError('');if(await prepareMic())recognize();}
 async function start(){
  if(locked.current||recognition.current||session.current)return;setError('');emptyTurns.current=0;
  if(!supported){setError('Este navegador no ofrece dictado. Prueba Chrome o Edge, o escribe tu mensaje.');return;}
  if(!await prepareMic())return;
  session.current=current.current.continuous;setActive(session.current);
  const text=current.current.turns.length?'Te escucho, cuéntame.':greeting;
  if(!current.current.turns.length)setTurns([{speaker:'agent',text}]);
  speak(text,session.current);
 }
 async function send(textOverride?:string){
  const text=(textOverride??current.current.draft).trim();if(!text||locked.current||recognition.current)return;
  locked.current=true;setBusy(true);setError('');stopAudio();const controller=new AbortController();request.current=controller;const version=generation.current;
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch(`/api/advertising/voice/${encodeURIComponent(organizationId)}/simulate`,{method:'POST',headers:{'Content-Type':'application/json','X-CRM-Action':'advertising'},body:JSON.stringify({course:current.current.course,text,history:current.current.turns.slice(-16).map(t=>({...t,text:t.text.slice(0,1000)}))}),signal:controller.signal});
   const result=await response.json();if(!response.ok||typeof result.reply!=='string'||!result.reply.trim())throw Error('No se pudo obtener la respuesta. Revisa la sesión y la conexión de IA del CRM.');if(version!==generation.current)return;
   setTurns(previous=>[...previous,{speaker:'customer',text},{speaker:'agent',text:result.reply}]);setDraft('');
   if(['end','opt_out','human','follow_up_requested'].includes(result.action)){session.current=false;setActive(false);releaseMic();setLevel(0);}
   speak(result.reply,session.current);
  }catch(e){if(version===generation.current){session.current=false;setActive(false);releaseMic();setLevel(0);setError(controller.signal.aborted?'La respuesta tardó demasiado. Tu mensaje sigue disponible para reintentar.':(e as Error).message);}}
  finally{clearTimeout(timeout);if(version===generation.current){locked.current=false;request.current=null;setBusy(false);}}
 }
 handlers.current={listen:()=>void listen(),send:text=>void send(text)};
 const last=[...turns].reverse().find(t=>t.speaker==='agent');
 return <div className="space-y-3 rounded-xl border border-cyan-700 bg-slate-950 p-4 text-slate-100">
  <h3 className="text-lg font-bold">Hablar con Valeria Parkert</h3>
  <p className="text-sm text-cyan-200">Voz en el CRM disponible · Asistente virtual de ventas · Sin Twilio ni tarjeta</p>
  <p className="text-sm text-slate-300">Pulsa Iniciar conversación y permite el micrófono. Valeria te saluda, escucha y responde por turnos, sin pulsar Enviar cada vez. Espera a que termine de hablar o pulsa Interrumpir y hablar.</p>
  <p className="text-xs text-slate-300">La voz depende de tu navegador; elige una voz femenina Natural/Neural si está disponible. El dictado puede usar servidores del navegador. Las respuestas usan la cuota o tarifa existente de IA del CRM. No se graba audio ni se realizan llamadas celulares, pagos o matrículas.</p>
  <label className="block text-sm">Curso o producto (opcional)<input aria-label="Curso para hablar con Valeria" maxLength={250} disabled={busy||listening||active||speaking} value={course} onChange={e=>{stop();setCourse(e.target.value);setTurns([]);}} className="mt-1 w-full rounded bg-slate-800 p-2"/></label>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="block text-sm">Voz en español<select aria-label="Voz de prueba en español" disabled={active||listening||busy||speaking} value={voiceId} onChange={e=>{stopAudio();setVoiceId(e.target.value);}} className="mt-1 w-full rounded bg-slate-800 p-2"><option value="">Predeterminada del dispositivo</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></label>
   <label className="block text-sm">Idioma del micrófono<select aria-label="Idioma del micrófono" disabled={active||listening||busy||speaking} value={language} onChange={e=>setLanguage(e.target.value)} className="mt-1 w-full rounded bg-slate-800 p-2"><option value="es-MX">Español latino (México)</option><option value="es-US">Español de Estados Unidos</option><option value="es-DO">Español de República Dominicana</option></select></label>
  </div>
  <label className="block text-sm">Velocidad de voz: {rate.toFixed(2)}<input aria-label="Velocidad de voz" disabled={speaking} type="range" min="0.85" max="1.1" step="0.05" value={rate} onChange={e=>setRate(Number(e.target.value))} className="ml-3"/></label>
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={continuous} disabled={active||listening||busy||speaking} onChange={e=>setContinuous(e.target.checked)}/>Conversación continua: escuchar y responder automáticamente</label>
  <div className="rounded border border-slate-700 p-3 text-sm"><p>Entrada: {mic}</p><meter aria-label="Nivel de audio del micrófono" min={0} max={100} value={level} className="mt-2 h-4 w-full"/><p className="text-xs text-slate-300">La barra debe moverse cuando hablas. El dictado usa el micrófono predeterminado de Chrome/Edge; puedes cambiarlo en Configuración del navegador → Permisos → Micrófono.</p></div>
  {!supported&&<p className="text-amber-200">Este navegador no ofrece dictado. Usa Chrome o Edge, o escribe tu pregunta.</p>}
  {!audio&&<p className="text-amber-200">Las respuestas aparecerán por escrito: este navegador no ofrece lectura de voz.</p>}
  <div ref={transcript} role="log" aria-label="Conversación de prueba con Valeria" aria-live="polite" className="max-h-80 space-y-3 overflow-auto rounded bg-slate-900 p-3">
   {!turns.length&&<p className="text-sm text-slate-300">Puedes preguntar por un curso, sus horarios, precios o cómo inscribirte.</p>}
   {turns.map((turn,i)=><p key={i} className="whitespace-pre-wrap text-sm"><strong className="text-cyan-200">{turn.speaker==='agent'?'Valeria':'Tú'}:</strong> {turn.text}</p>)}
  </div>
  <label className="block text-sm">Tu mensaje<textarea aria-label="Mensaje de voz o texto para Valeria" maxLength={1500} disabled={busy||listening} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Aquí verás tu voz convertida a texto. También puedes escribir." className="mt-1 w-full rounded bg-slate-800 p-2"/></label>
  <div className="flex flex-wrap gap-2">
   <button disabled={busy||listening||active||speaking} onClick={()=>void start()} className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">Iniciar conversación de voz</button>
   <button disabled={!supported||busy||listening} onClick={()=>{stopAudio();emptyTurns.current=0;void listen();}} className="rounded bg-cyan-700 px-3 py-2 text-white disabled:opacity-50">{speaking?'Interrumpir y hablar':'Hablar por micrófono'}</button>
   {listening&&<button onClick={()=>recognition.current?.stop()} className="rounded border px-3 py-2">Terminé de hablar</button>}
   <button disabled={busy||listening||!draft.trim()} onClick={()=>void send()} className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50">Enviar a Valeria</button>
   <button disabled={!audio||!last||busy||listening||active} onClick={()=>last&&speak(last.text)} className="rounded border px-3 py-2 disabled:opacity-50">Escuchar respuesta</button>
   <button onClick={stop} className="rounded border px-3 py-2">Terminar conversación</button>
   <button disabled={busy||active||listening||speaking} onClick={()=>{setError('');void prepareMic();}} className="rounded border px-3 py-2 disabled:opacity-50">Comprobar micrófono</button>
   <button onClick={()=>{stop();setTurns([]);setDraft('');setError('');}} className="rounded border px-3 py-2">Limpiar prueba</button>
  </div>
  <p role="status" className="text-sm text-cyan-200">{listening?'Te escucho…':busy?'Valeria está preparando su respuesta…':speaking?'Valeria está hablando…':active?'Conversación activa…':'Valeria está disponible para conversar.'}</p>
  {error&&<p role="alert" className="text-amber-200">{error}</p>}
 </div>;
}
