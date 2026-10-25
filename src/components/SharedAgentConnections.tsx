import { useEffect, useState } from 'react';

type Connection = { channel: string; state: string; message: string; checkedAt: string | null; readVerified: boolean; providerReason?: string; httpStatus?: number };
type OAuthProvider = { provider: string; ready: boolean; redirectUri: string | null; scopes: string[]; clientId?: string; cloudConsoleUrl?: string };
const names: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', meta_ads: 'Meta Ads', google_ads: 'Google Ads', youtube: 'YouTube' };

export function SharedAgentConnections({ agentName }: { agentName: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [oauth, setOauth] = useState<OAuthProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('meta');
  const [redirectRegistered, setRedirectRegistered] = useState(false);
  const [reviewedPermissions, setReviewedPermissions] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);
  const [googleAccounts, setGoogleAccounts] = useState<{configuredCustomerId: string; directlyAccessibleCustomerIds: string[]; note: string} | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function loadConnections() {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        const response = await fetch('/api/advertising/shared-connections', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw Error('No se pudieron consultar las conexiones. Comprueba tu sesión de administrador.');
        const data = await response.json();
        if (!controller.signal.aborted) { setConnections(data.connections); setError(''); }
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudieron consultar las conexiones.'); }
      finally { loading = false; }
    }
    void loadConnections();
    const timer = window.setInterval(() => void loadConnections(), 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void loadConnections(); };
    document.addEventListener('visibilitychange', onVisible);
    void fetch('/api/advertising/oauth/configuration', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) return; const data = await response.json(); setOauth(data.providers); })
      .catch(() => { /* The primary connection request reports authentication failures. */ });
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
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
  async function readGoogleAccounts() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/advertising/google-ads/accounts', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'No se pudieron consultar las cuentas de Google Ads.');
      setGoogleAccounts(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron consultar las cuentas.'); }
    finally { setBusy(false); }
  }
  async function reconnect() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/advertising/oauth/${selectedProvider}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'advertising' }, body: JSON.stringify({ redirectRegistered, reviewedPermissions }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'No se pudo iniciar la autorización.');
      const destination = new URL(data.authorizationUrl);
      if (destination.protocol !== 'https:' || !['www.facebook.com', 'accounts.google.com'].includes(destination.hostname)) throw Error('Destino de autorización no válido.');
      window.location.assign(destination.toString());
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar la autorización.'); setBusy(false); }
  }
  const selected = oauth.find(item => item.provider === selectedProvider);
  return <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-white">Plataformas compartidas · {agentName}</h2>
        <p className="text-xs text-slate-400">Conexiones globales del administrador disponibles desde todos los agentes. No asocian automáticamente otras empresas con las cuentas de INTECA.</p></div>
      <button type="button" disabled={busy} onClick={() => void verify()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Comprobando…' : 'Verificar acceso real'}</button>
    </div>
    {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
    <button type="button" onClick={() => setShowReconnect(value => !value)} className="text-sm text-blue-300 underline">{showReconnect ? 'Cerrar reconexión' : 'Reconectar Meta, Google Ads o YouTube'}</button>
    {showReconnect && <div className="space-y-3 rounded-lg border border-blue-700 p-3 text-sm text-slate-200">
      <p>Autoriza tu cuenta en el proveedor. El servidor comprobará las cuentas ya configuradas y guardará los nuevos accesos en Render. Esta acción sustituye los tokens anteriores; los agentes usarán los nuevos permisos concedidos.</p>
      <label className="block">Plataforma<select value={selectedProvider} onChange={event => { setSelectedProvider(event.target.value); setRedirectRegistered(false); setReviewedPermissions(false); }} className="ml-2 rounded bg-slate-800 p-2"><option value="meta">Meta: Facebook, Instagram y anuncios</option><option value="google_ads">Google Ads</option><option value="youtube">YouTube</option></select></label>
      {selectedProvider === 'google_ads' && <div className="space-y-2">
        <p>El acceso a Google Ads API se administra en Google Cloud, en el proyecto que contiene el cliente OAuth del CRM. No se necesita un token de desarrollador.</p>
        {selected?.clientId && <p className="break-all text-xs">Cliente OAuth configurado: {selected.clientId}</p>}
        {selected?.cloudConsoleUrl && <a href={selected.cloudConsoleUrl} target="_blank" rel="noreferrer" className="block text-blue-300 underline">Abrir acceso a Google Ads API en Google Cloud</a>}
        <p className="text-xs">Verifica el proyecto seleccionado y su nivel de acceso. Si figura Test, solicita Explorer para operar con cuentas publicitarias de producción. La cuenta administradora y la cuenta donde se publicarán los anuncios tienen IDs diferentes.</p>
        <button type="button" disabled={busy} onClick={() => void readGoogleAccounts()} className="text-blue-300 underline">Consultar cuentas de Google Ads accesibles</button>
        {googleAccounts && <div className="rounded bg-slate-800 p-2"><p>ID configurado: {googleAccounts.configuredCustomerId}</p><p>IDs con acceso directo: {googleAccounts.directlyAccessibleCustomerIds.join(', ') || 'Ninguno'}</p><p className="text-xs">{googleAccounts.note}</p><p className="text-xs">Compara el ID con la cuenta publicitaria de INTECA. Si corresponde a otra cuenta, corrígelo en Conexiones. El CRM no cambia el destino de tus anuncios automáticamente.</p></div>}
      </div>}
      {selected?.ready ? <>
        <p>Primero registra exactamente esta URL en los retornos OAuth autorizados del cliente correspondiente en Meta Developers o Google Cloud:</p>
        <code className="block break-all rounded bg-slate-950 p-2">{selected.redirectUri}</code>
        <p>Permisos que solicitará el proveedor:</p>
        <ul className="list-inside list-disc break-all text-xs">{selected.scopes.map(scope => <li key={scope}>{scope}</li>)}</ul>
        <label className="block"><input type="checkbox" checked={redirectRegistered} onChange={event => setRedirectRegistered(event.target.checked)} /> La URL de retorno está registrada en el cliente del proveedor.</label>
        <label className="block"><input type="checkbox" checked={reviewedPermissions} onChange={event => setReviewedPermissions(event.target.checked)} /> Revisé los permisos. Quiero autorizar esta conexión y guardar los accesos del CRM.</label>
        <button type="button" disabled={busy || !redirectRegistered || !reviewedPermissions} onClick={() => void reconnect()} className="rounded bg-blue-600 px-3 py-2 disabled:opacity-50">Autorizar en {selectedProvider === 'meta' ? 'Meta' : 'Google'}</button>
      </> : <p className="text-amber-300">Falta el cliente OAuth, su secreto, APP_URL HTTPS o la conexión de Render. Completa esos campos en Conexiones.</p>}
      <p className="text-xs text-slate-400">Si el proveedor exige verificación de la aplicación, aprobación de permisos o habilitar una API, debes completar ese requisito allí. Este proceso no aprueba facturación, activa anuncios ni concede descuentos.</p>
    </div>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{connections.map(connection => <div key={connection.channel} className="rounded-lg border border-slate-700 p-3">
      <p className="font-medium text-white">{names[connection.channel] || connection.channel}</p>
      <p className={connection.readVerified ? 'text-xs text-emerald-300' : 'text-xs text-amber-300'}>{connection.message}</p>
      {connection.httpStatus && <p className="mt-1 break-all text-xs text-amber-200">HTTP {connection.httpStatus}{connection.providerReason ? ` · ${connection.providerReason}` : ''}</p>}
      {connection.checkedAt && <p className="mt-1 text-xs text-slate-500">{new Date(connection.checkedAt).toLocaleString()}</p>}
    </div>)}</div>
    <p className="text-xs text-slate-400">Revisión automática cada 10 minutos mientras el servidor esté activo y al abrir este panel. Google Ads y YouTube renuevan su acceso automáticamente si su autorización sigue válida. Solo reconecta cuando el proveedor lo requiera.</p>
    <p className="text-xs text-slate-400">La comprobación confirma lectura de la cuenta. Publicación, campañas y descuentos siguen el flujo de aprobación de Publicidad. Facturación y conversiones publicitarias requieren comprobación aparte.</p>
  </section>;
}
