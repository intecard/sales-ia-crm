import { useEffect, useState } from 'react';

type Connection = { channel: string; state: string; message: string; checkedAt: string | null; readVerified: boolean };
const names: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', meta_ads: 'Meta Ads', google_ads: 'Google Ads', youtube: 'YouTube' };

export function SharedAgentConnections({ agentName }: { agentName: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/advertising/shared-connections', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw Error('Inicia sesión como administrador para consultar las conexiones.'); return response.json(); })
      .then(data => setConnections(data.connections))
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);
  async function verify() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/advertising/shared-connections/verify', { method: 'POST', headers: { 'X-CRM-Action': 'advertising' } });
      if (!response.ok) throw Error('No se pudo comprobar el acceso. Inicia sesión como administrador.');
      const data = await response.json(); setConnections(data.connections);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo comprobar el acceso.'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-white">Plataformas compartidas · {agentName}</h2>
        <p className="text-xs text-slate-400">Conexiones globales del administrador disponibles desde todos los agentes. No asocian automáticamente otras empresas con las cuentas de INTECA.</p></div>
      <button type="button" disabled={busy} onClick={() => void verify()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Comprobando…' : 'Verificar acceso real'}</button>
    </div>
    {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{connections.map(connection => <div key={connection.channel} className="rounded-lg border border-slate-700 p-3">
      <p className="font-medium text-white">{names[connection.channel] || connection.channel}</p>
      <p className={connection.readVerified ? 'text-xs text-emerald-300' : 'text-xs text-amber-300'}>{connection.message}</p>
      {connection.checkedAt && <p className="mt-1 text-xs text-slate-500">{new Date(connection.checkedAt).toLocaleString()}</p>}
    </div>)}</div>
    <p className="text-xs text-slate-400">La comprobación confirma lectura de la cuenta. Publicación, campañas y descuentos siguen el flujo de aprobación de Publicidad. Facturación y conversiones publicitarias requieren comprobación aparte.</p>
  </section>;
}
