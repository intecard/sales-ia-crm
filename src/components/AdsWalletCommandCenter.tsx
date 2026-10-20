import React, { useCallback, useEffect, useState } from 'react';
import type { OrganizationTenant } from '../types';
import type { AdPlan } from '../../advertising-plans';
import type { AdCampaign } from '../../advertising-agent';

const field = 'mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-white';
const button = 'rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40';
const money = (n: number) => `RD$${n.toLocaleString('es-DO', { maximumFractionDigits: 2 })}`;
type Snapshot = { plans: AdPlan[]; campaigns: AdCampaign[]; courses: { title: string; investment: string }[]; connections: { channel: string; configured: boolean; destination: string }[] };
async function api<T>(path = '', body?: unknown): Promise<T> {
  const response = await fetch(`/api/advertising${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'advertising' }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
  const data = await response.json(); if (!response.ok) throw Error(data.error || 'No se pudo completar la operación.'); return data;
}
export function AdsWalletCommandCenter({ currentOrg, onOpenAds, onConfigure }: { currentOrg: OrganizationTenant; onOpenAds: () => void; onConfigure: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [courseTitle, setCourseTitle] = useState(''); const [total, setTotal] = useState(1000); const [daily, setDaily] = useState(200);
  const [days, setDays] = useState(7); const [cac, setCac] = useState(500); const [channel, setChannel] = useState('meta_ads');
  const [reviews, setReviews] = useState<Record<string, boolean>>({}); const [evaluation, setEvaluation] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => { const result = await api<Snapshot>(); setSnapshot(result); setCourseTitle(old => old || result.courses[0]?.title || ''); }, []);
  const available = currentOrg.id === 'org_inteca_main';
  useEffect(() => { if (available) void refresh().catch(e => setError(e.message)); }, [available, refresh]);
  async function run(task: () => Promise<unknown>, message: string) { setBusy(true); setError(''); setNotice(''); try { await task(); await refresh(); setNotice(message); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  if (!available) return <div className="p-6">La conexión real de publicidad está habilitada para INTECA. Esta empresa requiere su propia configuración.</div>;
  return <main className="mx-auto max-w-6xl space-y-6 p-5 text-white">
    <header className="rounded-2xl bg-slate-900 p-5"><h1 className="text-2xl font-bold">Tarjeta, presupuesto y plan de publicidad</h1><p className="mt-2 text-sm text-slate-300">INTECA · Elige un curso, define cuánto puedes invertir y revisa el plan antes de preparar anuncios.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-900 p-3">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-900 p-3">{notice}</p>}
    <section className="space-y-3 rounded-2xl bg-slate-900 p-5"><h2 className="text-lg font-bold">1. Registrar la tarjeta con la plataforma</h2>
      <p className="text-sm text-slate-300">Ingresa el número completo, vencimiento y CVC únicamente en la página segura de Meta o Google. Ellos gestionan el método de pago para sus cargos posteriores. Este CRM no recibe ni almacena esos datos.</p>
      <div className="flex flex-wrap gap-3"><a className={button} href="https://business.facebook.com/" target="_blank" rel="noreferrer">Abrir Meta Business → Facturación y pagos</a><a className={button} href="https://ads.google.com/" target="_blank" rel="noreferrer">Abrir Google Ads → Facturación</a></div>
      <p className="text-xs text-slate-400">Registrar una tarjeta no conecta por sí solo el agente. También necesita permisos API sobre la cuenta publicitaria. YouTube Ads se paga desde Google Ads.</p>
      <div className="grid gap-2 sm:grid-cols-2">{snapshot?.connections.filter(c => c.channel.endsWith('_ads')).map(c => <p key={c.channel} className="rounded-lg border border-slate-700 p-3 text-sm">{c.channel === 'meta_ads' ? 'Meta Ads' : 'Google Ads'} · {c.configured ? 'Credenciales presentes; falta verificar acceso y facturación' : 'Pendiente de conexión'}<br/><span className="text-xs text-slate-400">Cuenta: {c.destination || 'Sin configurar'} · Tarjeta: sin verificación desde el CRM</span></p>)}</div>
      <button className={button} onClick={onConfigure}>Configurar conexiones</button>
    </section>
    <section className="space-y-4 rounded-2xl bg-slate-900 p-5"><h2 className="text-lg font-bold">2. Crear un plan con presupuesto limitado</h2>
      <p className="text-sm text-slate-300">Mínimo {money(1000)} para el plan completo, sin renovación automática. El monto mostrado es una propuesta: no se cobra ni se autoriza al abrir esta pantalla.</p>
      <label className="block text-sm">Curso del catálogo<select className={field} value={courseTitle} onChange={e => setCourseTitle(e.target.value)}>{snapshot?.courses.map(c => <option key={c.title}>{c.title}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Presupuesto total máximo (RD$)<input className={field} type="number" min={1000} max={1000000} step="0.01" value={total} onChange={e => setTotal(Number(e.target.value))}/></label>
      <label className="text-sm">Límite diario del plan (RD$)<input className={field} type="number" min={1} max={total} step="0.01" value={daily} onChange={e => setDaily(Number(e.target.value))}/></label>
      <label className="text-sm">Duración propuesta de la prueba (días)<input className={field} type="number" min={3} max={30} value={days} onChange={e => setDays(Number(e.target.value))}/></label>
      <label className="text-sm">Costo máximo objetivo por matrícula pagada (RD$)<input className={field} type="number" min={1} max={1000000} step="0.01" value={cac} onChange={e => setCac(Number(e.target.value))}/></label></div>
      <label className="block text-sm">Canal inicial<select className={field} value={channel} onChange={e => setChannel(e.target.value)}><option value="meta_ads">Meta Ads: Facebook e Instagram</option><option value="google_ads">Google Ads: búsqueda</option><option value="both">Meta Ads y Google Ads: presupuesto total compartido</option></select></label>
      <p className="text-xs text-slate-400">El costo objetivo se decide según tu margen. No es una promesa de ventas. Para un presupuesto pequeño conviene probar primero un solo canal.</p>
      <button className={button} disabled={busy || !courseTitle || total < 1000 || daily <= 0 || daily > total || cac <= 0} onClick={() => void run(() => api('/plans', { courseTitle, totalBudgetDop: total, dailyLimitDop: daily, durationDays: days, targetCacDop: cac, channels: channel === 'both' ? ['meta_ads', 'google_ads'] : [channel] }), 'Plan guardado. Revisa sus condiciones y autorízalo abajo.')}>Crear y guardar plan</button>
    </section>
    <section className="space-y-3"><h2 className="text-lg font-bold text-slate-800 dark:text-white">3. Revisar planes y resultados</h2>
      {!snapshot?.plans.length && <p className="rounded-xl bg-slate-900 p-4">Todavía no hay planes guardados.</p>}
      {snapshot?.plans.map(p => { const allocated = snapshot.campaigns.filter(c => c.plan_id === p.id && c.state !== 'rejected').reduce((sum, c) => sum + c.payload.totalBudgetDop, 0); return <article key={p.id} className="space-y-3 rounded-2xl bg-slate-900 p-5">
        <h3 className="font-bold">{p.payload.courseTitle} · {p.state === 'approved' ? 'Plan autorizado' : p.state === 'cancelled' ? 'Cancelado' : 'Pendiente de tu autorización'}</h3>
        <p className="text-sm">Total: {money(p.payload.totalBudgetDop)} · Diario: {money(p.payload.dailyLimitDop)} · {p.payload.durationDays} días propuestos</p>
        <p className="text-xs text-slate-400">Asignado a borradores cargados: {money(allocated)}. Esto no representa gasto realizado; la API limita la suma de todos los borradores del plan.</p>
        <p className="text-sm text-cyan-200">Pruebas: {money(p.strategy.testBudgetDop)} · Anuncios con resultados: {money(p.strategy.winnerBudgetDop)} · Reserva: {money(p.strategy.reserveDop)}</p>
        <p className="text-sm">{p.strategy.objective}</p><p className="text-sm text-slate-300">{p.strategy.audience}</p>
        <p className="text-sm text-slate-300">Datos vigentes: {p.strategy.courseFacts.duration} · {p.strategy.courseFacts.investment}</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">{p.strategy.steps.map(s => <li key={s}>{s}</li>)}</ol>
        <div className="grid gap-2 sm:grid-cols-2">{p.strategy.variants.map(v => <div key={v.name} className="rounded-xl border border-slate-700 p-3 text-sm"><strong>{v.name}</strong><p>{v.hypothesis}</p></div>)}</div>
        <p className="text-sm text-amber-200">{p.strategy.activation}</p>
        {p.state === 'draft' && <><label className="flex gap-2 text-sm"><input type="checkbox" checked={!!reviews[p.id]} onChange={e => setReviews({...reviews, [p.id]: e.target.checked})}/>Revisé y autorizo este plan y estos límites. Cada anuncio y descuento conserva su aprobación separada.</label><button className={button} disabled={busy || !reviews[p.id]} onClick={() => void run(() => api(`/plans/${p.id}/approve`, { contentHash: p.content_hash, reviewed: true }), 'Plan autorizado para preparar campañas dentro de sus límites. No se activó gasto.')}>Autorizar plan</button></>}
        {p.state === 'approved' && <button className={button} onClick={onOpenAds}>Preparar anuncios en Agentes IA → Publicidad</button>}
        <button className={`${button} ml-2`} disabled={busy} onClick={() => void run(async () => { const result = await api(`/plans/${p.id}/evaluate`, {}); setEvaluation(old => ({...old, [p.id]: result})); }, 'Evaluación actualizada. No se modificó ningún presupuesto externo.')}>Consultar evidencia y recomendación</button>
        {evaluation[p.id] && <div className="space-y-2 rounded-xl border border-slate-700 p-3 text-sm">{evaluation[p.id].observations.map((o: any) => <div key={o.channel}><strong>{o.channel === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}</strong><p>{o.recommendation.reason}</p>{o.metrics && <details><summary>Métricas de la cuenta · últimos 7 días</summary><pre className="overflow-auto text-xs">{JSON.stringify(o.metrics, null, 2)}</pre></details>}</div>)}<p className="text-amber-200">Atribución de matrículas pendiente. Aumentos y pausas automáticos todavía no están activos.</p></div>}
        {p.state !== 'cancelled' && <button className={`${button} ml-2 bg-slate-700`} disabled={busy} onClick={() => void run(() => api(`/plans/${p.id}/cancel`, {}), 'Plan cancelado en el CRM. Las campañas externas ya creadas se revisan en Meta o Google.')}>Cancelar plan en el CRM</button>}
      </article>; })}
    </section>
    <p className="rounded-xl border border-amber-400 bg-slate-900 p-4 text-sm text-amber-100">Los límites de este panel controlan las asignaciones del CRM. Antes de activar anuncios hay que establecer y comprobar los límites en Meta o Google; un presupuesto diario de plataforma puede ser un promedio. Esta versión mantiene las campañas pagadas en pausa.</p>
  </main>;
}
