import React, { useCallback, useEffect, useState } from 'react';
import type { AdPlan } from '../../advertising-plans';
import type { AdCampaign, AdChannel } from '../../advertising-agent';

const names: Record<AdChannel, string> = { facebook: 'Facebook', instagram: 'Instagram', meta_ads: 'Meta Ads', google_ads: 'Google Ads', youtube: 'YouTube' };
const states: Record<string, string> = { draft: 'Pendiente de revisión', approved: 'Aprobada', executing: 'En ejecución: no repetir', published: 'Publicada', prepared: 'Creada en pausa: completar anuncio en la plataforma', uploaded_private: 'Video subido en privado', review_required: 'Revisar resultado en la plataforma', blocked: 'Bloqueada: requiere nuevo borrador', rejected: 'Rechazada / cancelada' };
type Snapshot = { plans: AdPlan[]; campaigns: AdCampaign[]; courses: { title: string; investment: string }[]; connections: { channel: AdChannel; configured: boolean; missing: string[]; capability: string; destination: string }[] };
const field = 'w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white';
const button = 'rounded-lg border border-slate-600 px-3 py-2 text-sm text-white disabled:opacity-40 hover:bg-slate-700';
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/advertising${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'advertising' }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.'); return data;
}
export function AdvertisingCenter({ onConfigure }: { onConfigure?: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [channel, setChannel] = useState<AdChannel>('facebook');
  const [courseTitle, setCourseTitle] = useState('');
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState(''); const [discountDetails, setDiscountDetails] = useState('');
  const [planId, setPlanId] = useState(''); const [totalBudgetDop, setTotalBudgetDop] = useState(0);
  const [dailyBudget, setDailyBudget] = useState(0); const [schedule, setSchedule] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [reviews, setReviews] = useState<Record<string, boolean>>({}); const [discounts, setDiscounts] = useState<Record<string, boolean>>({});
  const [metrics, setMetrics] = useState<unknown>(null);
  const [verified, setVerified] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => { const data = await api<Snapshot>(''); setSnapshot(data); setCourseTitle(old => old || data.courses[0]?.title || ''); }, []);
  useEffect(() => { const timer = setTimeout(() => { void refresh().catch(e => setError(e.message)); }, 0); return () => clearTimeout(timer); }, [refresh]);
  async function run(task: () => Promise<unknown>, message = '') {
    setBusy(true); setError(''); setNotice('');
    try { await task(); await refresh(); setNotice(message); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const selectedCourse = snapshot?.courses.find(c => c.title === courseTitle);
  return <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white space-y-5">
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-xl font-bold">Agente de Publicidad</h2><p className="text-sm text-slate-300">INTECA · Campañas y aprobaciones guardadas en Supabase</p></div><button className={button} disabled={busy} onClick={() => void run(refresh)}>Actualizar</button></div>
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Descuento autónomo: <strong>0%</strong>. Toda campaña requiere tu revisión. Cada descuento necesita además tu autorización expresa para ese contenido exacto. Cambiar el contenido requiere un nuevo borrador.</div>
    <p className="text-sm text-slate-300">Facebook e Instagram publican después de tu aprobación. Meta Ads y Google Ads crean campañas en pausa para completar segmentación y anuncios. YouTube sube el video en privado para revisarlo antes de publicarlo. La programación ejecuta únicamente borradores aprobados.</p>
    {error && <p role="alert" className="rounded-lg bg-red-900/40 p-3">{error}</p>}{notice && <p role="status" className="rounded-lg bg-emerald-900/40 p-3">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{snapshot?.connections.map(c => <div key={c.channel} className="rounded-xl border border-slate-700 p-3">
      <h3 className="font-bold">{names[c.channel]}</h3><p className="text-xs text-slate-400">Cuenta destino: {c.destination || 'Pendiente'}</p><p className="text-sm text-amber-200">{verified[c.channel] || (c.configured ? 'Credenciales presentes; falta comprobar acceso' : 'Pendiente de conexión')}</p><p className="text-xs text-slate-400 mt-1">{c.capability}</p>
      {!!c.missing.length && <details className="text-xs mt-2"><summary>Datos necesarios para conectar</summary><ul className="break-all">{c.missing.map(k => <li key={k}>{k}</li>)}</ul></details>}
      <button className={`${button} mt-2`} disabled={busy || !c.configured} onClick={() => void run(async () => { const result = await api<{ name: string; id: string }>('/verify', { channel: c.channel }); setVerified(old => ({ ...old, [c.channel]: `Lectura verificada: ${result.name || result.id}. Publicación aún sin probar.` })); })}>Comprobar cuenta</button>
      {c.channel.endsWith('_ads') && <button className={`${button} mt-2`} disabled={busy || !c.configured} onClick={() => void run(async () => setMetrics(await api('/metrics', { channel: c.channel })))}>Consultar métricas reales</button>}
    </div>)}</div>
    {metrics !== null && <pre className="overflow-auto text-xs">{JSON.stringify(metrics, null, 2)}</pre>}
    <button className={button} disabled={!onConfigure} onClick={onConfigure}>Configurar conexiones en Multiempresa y Seguridad</button>
    <div className="border-t border-slate-700 pt-4 space-y-3"><h3 className="font-bold">Preparar una campaña</h3>
      <label className="block text-sm">Curso del catálogo de Supabase<select className={field} value={courseTitle} onChange={e => setCourseTitle(e.target.value)}>{snapshot?.courses.map(c => <option key={c.title}>{c.title}</option>)}</select></label>
      <p className="text-xs text-slate-300">{selectedCourse?.investment || 'El catálogo debe estar disponible para preparar contenido.'}</p>
      <label className="block text-sm">Canal<select className={field} value={channel} onChange={e => setChannel(e.target.value as AdChannel)}>{Object.entries(names).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <button className={button} disabled={busy || !courseTitle} onClick={() => void run(async () => {
        const response = await fetch('/api/ai/generate-marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseTitle, contentType: names[channel], organizationName: 'INTECA', targetAudience: 'Personas interesadas en formación técnica del sector salud en República Dominicana' }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo generar el contenido.'); setTitle(String(result.content.title).slice(0, 100)); setBody(result.content.bodyText);
      }, 'Borrador generado. Revisa precios, horarios y afirmaciones antes de guardarlo.')}>Generar borrador con IA y catálogo</button>
      <label className="block text-sm">Título<input className={field} maxLength={100} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block text-sm">Contenido<textarea className={field} rows={7} maxLength={5000} value={body} onChange={e => setBody(e.target.value)} /></label>
      <label className="block text-sm">Archivo público de Supabase (opcional para Facebook)<input className={field} type="url" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://…supabase.co/storage/v1/object/public/…" /></label>
      <p className="text-xs text-slate-400">Instagram: JPEG y texto hasta 2,200 caracteres. YouTube: MP4 hasta 20 MB. El dueño debe revisar también cualquier texto o promoción dentro de la imagen o del video.</p>
      <label className="block text-sm">Descuento propuesto, importe y condiciones (dejar vacío si no hay)<textarea className={field} rows={2} value={discountDetails} onChange={e => setDiscountDetails(e.target.value)} placeholder="Esto solicita revisión; no autoriza el descuento." /></label>
      {channel.endsWith('_ads') && <div className="space-y-2"><label className="block text-sm">Plan autorizado (créalo en Tarjeta & Pauta IA)<select className={field} value={planId} onChange={e => setPlanId(e.target.value)}><option value="">Selecciona un plan</option>{snapshot?.plans.filter(p => p.state === 'approved' && p.payload.courseTitle === courseTitle && p.payload.channels.includes(channel as 'meta_ads' | 'google_ads')).map(p => <option key={p.id} value={p.id}>{p.payload.courseTitle} · Total RD${p.payload.totalBudgetDop} · {p.id.slice(0,8)}</option>)}</select></label>
      <label className="block text-sm">Asignación total de esta campaña (RD$)<input className={field} type="number" min={1} max={1000000} step="0.01" value={totalBudgetDop} onChange={e => setTotalBudgetDop(Number(e.target.value))}/></label>
      <label className="block text-sm">Asignación diaria de esta campaña (RD$)<input className={field} type="number" min={1} max={100000} step="0.01" value={dailyBudget} onChange={e => setDailyBudget(Number(e.target.value))}/></label><p className="text-xs">El servidor impide asignar más que el total y el límite diario del plan entre todos sus anuncios. La campaña externa se crea en pausa; falta configurar su límite de gasto en la plataforma.</p></div>}
      <label className="block text-sm">Ejecutar después de aprobar, en la fecha indicada (opcional; hora de tu dispositivo)<input className={field} type="datetime-local" value={schedule} onChange={e => setSchedule(e.target.value)} /></label>
      <button className={`${button} bg-blue-700`} disabled={busy || !courseTitle || title.length < 3 || body.length < 10} onClick={() => void run(async () => { await api('/campaigns', { channel, courseTitle, title, body, mediaUrl, discountDetails, dailyBudget, totalBudgetDop, planId: channel.endsWith('_ads') ? planId || null : null, scheduledAt: schedule ? new Date(schedule).toISOString() : null }); setTitle(''); setBody(''); setDiscountDetails(''); }, 'Campaña guardada. Revisa y autoriza abajo; todavía no se publicó.')}>Guardar para revisión</button>
    </div>
    <div className="border-t border-slate-700 pt-4 space-y-3"><h3 className="font-bold">Campañas y solicitudes de autorización</h3>
      {!snapshot?.campaigns.length && <p className="text-sm text-slate-400">Todavía no hay campañas guardadas.</p>}
      {snapshot?.campaigns.map(c => <article key={c.id} className="rounded-xl border border-slate-700 p-4 space-y-2">
        <h4 className="font-bold">{c.payload.title}</h4><p className="text-xs text-cyan-200">{names[c.payload.channel]} · {states[c.state] || c.state}</p><p className="whitespace-pre-wrap text-sm">{c.payload.body}</p>
        {c.payload.mediaUrl && <a className="text-cyan-300 underline text-sm" href={c.payload.mediaUrl} target="_blank" rel="noreferrer">Revisar imagen o video</a>}
        {c.discount_required && <p className="text-sm text-amber-200">Revisión económica requerida (incluye imágenes y videos): {c.payload.discountDetails || 'Revisa precios, términos promocionales y cualquier oferta contenida en el archivo adjunto.'}</p>}
        {c.scheduled_at && <p className="text-xs">Programada: {new Date(c.scheduled_at).toLocaleString()}</p>}
        {c.last_error && <p className="text-xs text-red-200">Código: {c.last_error}. Revisa conexiones o el resultado externo antes de crear un nuevo borrador.</p>}
        {c.approved_by && <p className="text-xs text-emerald-200">Revisada por {c.approved_by}{c.discount_approved ? ' · Descuento autorizado para esta campaña' : ''}</p>}
        {!!Object.keys(c.result).length && <pre className="overflow-auto whitespace-pre-wrap text-xs text-slate-300">{JSON.stringify(c.result, null, 2)}</pre>}
        {c.state === 'draft' && <div className="space-y-2 text-sm">
          <p className="text-xs">Cuenta destino: {snapshot.connections.find(x => x.channel === c.payload.channel)?.destination || 'Conecta el canal antes de autorizar'}</p>
          <label className="flex gap-2"><input type="checkbox" checked={!!reviews[c.id]} onChange={e => setReviews({ ...reviews, [c.id]: e.target.checked })} />Revisé contenido, archivo, precios, destino y fecha. Autorizo esta operación exacta.</label>
          <label className="flex gap-2"><input type="checkbox" checked={!!discounts[c.id]} onChange={e => setDiscounts({ ...discounts, [c.id]: e.target.checked })} />Autorizo expresamente el descuento o beneficio económico indicado en esta campaña, incluida su imagen o video.</label>
          <button className={`${button} bg-emerald-800`} disabled={busy || !reviews[c.id] || !snapshot.connections.find(x => x.channel === c.payload.channel)?.configured || (c.discount_required && !discounts[c.id])} onClick={() => void run(() => api(`/campaigns/${c.id}/approve`, { reviewed: true, contentHash: c.content_hash, approveDiscount: !!discounts[c.id], destination: snapshot.connections.find(x => x.channel === c.payload.channel)?.destination || '' }), c.scheduled_at ? 'Aprobada: se ejecutará a partir de la fecha indicada si la conexión está lista.' : 'Aprobada. Puedes ejecutar la operación.')}>Autorizar esta campaña</button>
        </div>}
        {c.state === 'approved' && <button className={button} disabled={busy} onClick={() => void run(() => api(`/campaigns/${c.id}/execute`, {}), 'Operación confirmada por la plataforma. Consulta el resultado de la campaña.')}>{c.payload.channel.endsWith('_ads') ? 'Crear campaña en pausa' : c.payload.channel === 'youtube' ? 'Subir video privado' : 'Publicar ahora'}</button>}
        {['draft', 'approved'].includes(c.state) && <button className={`${button} ml-2`} disabled={busy} onClick={() => void run(() => api(`/campaigns/${c.id}/reject`, {}), 'Campaña cancelada.')}>Rechazar / cancelar</button>}
      </article>)}
    </div>
  </section>;
}
