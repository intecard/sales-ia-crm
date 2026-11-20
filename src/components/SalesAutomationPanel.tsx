import { useEffect, useState } from 'react';
type Snapshot = {
  status?: { ownerCommandsReady?: boolean; templateChecks: Record<string, string>; readiness?: { outsideServiceWindow: boolean; ownerTemplate: boolean } };
  settings: {
    enabled: boolean;
    owner_phone: string;
    daily_goal: number;
    payment_instructions: string;
    followup_template: string;
    owner_template: string;
    template_language: string;
  };
  metrics: {
    paid_today: number;
    payment_pending: number;
    payment_review: number;
    human: number;
    measurement: string;
    strategies: Array<{ strategy: string; sent: number; paid: number; replied: number }>;
  };
  jobs: Array<{
    id: string;
    kind: string;
    state: string;
    last_error: string | null;
    created_at: string;
  }>;
};
const states: Record<string, string> = {
  pending: 'Pendiente',
  sending: 'Enviando',
  sent: 'Aceptado por WhatsApp',
  delivered: 'Entregado',
  read: 'Leído',
  failed: 'Falló',
  blocked: 'Requiere configuración',
  unknown: 'Verificar envío antes de reintentar',
  cancelled: 'Cancelado por control de contacto',
};
async function fetchSnapshot(): Promise<Snapshot> {
  const response = await fetch('/api/sales/automation', { credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'No se pudo consultar seguimiento.');
  return result;
}
export function SalesAutomationPanel() {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [followup, setFollowup] = useState(''),
    [owner, setOwner] = useState(''),
    [language, setLanguage] = useState('es');
  async function load() {
    try {
      const d = await fetchSnapshot();
      setData(d);
      setError('');
      return d as Snapshot;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }
  useEffect(() => {
    void fetchSnapshot()
      .then((d) => {
        if (d) {
          setData(d);
          setFollowup(d.settings.followup_template);
          setOwner(d.settings.owner_template);
          setLanguage(d.settings.template_language);
        }
      })
      .catch((e) => setError((e as Error).message));
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, []);
  async function save(enabled: boolean) {
    try {
      const r = await fetch('/api/sales/automation/settings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'sales' },
        body: JSON.stringify({
          enabled,
          followup_template: followup,
          owner_template: owner,
          template_language: language,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setNotice(
        'Configuración guardada. Se verificará la aprobación de las plantillas antes de enviar.',
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section
      className="rounded-2xl border border-cyan-700 bg-slate-900 p-5 text-slate-100 space-y-4"
      aria-label="Seguimiento comercial automático"
    >
      <h3 className="text-lg font-bold">Seguimiento y resultados comerciales</h3>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-300">
          {notice}
        </p>
      )}
      {data && (
        <>
          <div className="rounded-lg border border-amber-700 p-3 text-sm" role="status">
            <p>Seguimiento fuera de la ventana: {data.status?.readiness?.outsideServiceWindow ? 'plantilla verificada' : 'pendiente de aprobación o configuración'}.</p>
            <p>Avisos al dueño: {data.status?.readiness?.ownerTemplate ? 'plantilla verificada' : 'pendiente de aprobación o configuración'}.</p>
            <p>Cola: {data.jobs.filter(j => j.state === 'blocked').length} bloqueadas, {data.jobs.filter(j => ['failed', 'unknown'].includes(j.state)).length} para revisar (últimas 50 tareas).</p>
          </div>
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              ['Pagos validados hoy', `${data.metrics.paid_today} / ${data.settings.daily_goal}`],
              ['Pendientes de pago', data.metrics.payment_pending],
              ['Revisión bancaria', data.metrics.payment_review],
              ['Atención humana', data.metrics.human],
            ].map(([label, value]) => (
              <div className="bg-slate-800 rounded-lg p-3" key={label}>
                <p className="text-sm">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <p>
            Meta diaria: {data.settings.daily_goal} ventas con pago validado. Los comprobantes
            pendientes no cuentan como ventas.
          </p>
          <p className="text-sm">
            Avisos al dueño: +{data.settings.owner_phone}. Documento de pagos:{' '}
            {data.settings.payment_instructions ? 'cargado' : 'pendiente'}. Exterior en USD: US$60
            de inscripción y 5 pagos de US$30 (US$210 total).
          </p>
          <p className="text-sm">
            Seguimiento de 9:00 a. m. a 8:00 p. m., hora dominicana; máximo tres contactos
            automáticos por interesado, separados al menos 24 horas. Las bajas, la atención humana y
            los pagos en revisión detienen los recordatorios de cobro.
          </p>
          <div className="rounded-lg border border-slate-600 p-3 text-sm space-y-2">
            <p className="font-semibold">Asistente del director: {data.status?.ownerCommandsReady ? 'habilitado para mensajes firmados' : 'pendiente de conectar la firma de la aplicación de WhatsApp'}</p>
            <p>Desde +{data.settings.owner_phone}, escribe al WhatsApp institucional: resumen, estudiantes, pendientes, revisión, atención o fiscal. Para más resultados: pendientes 2.</p>
            <p>Con el ID de un caso puedes enviar: ficha ID, pausar ID, reanudar ID, seguimiento ID o matricular ID. Cada instrucción de cambio queda registrada. Matricular exige un pago validado en el CRM.</p>
            {!data.status?.ownerCommandsReady && <p>En Conexiones configura WHATSAPP_APP_SECRET con el secreto de la aplicación que recibe los mensajes de WhatsApp. El secreto de la aplicación de publicidad es distinto. Nunca lo envíes por chat.</p>}
          </div>
          <p className="text-sm text-amber-200">
            Fuera de la ventana de atención se requieren consentimiento y plantilla aprobada por
            Meta. Para recibir avisos libres, el dueño debe escribir al WhatsApp del negocio; para
            avisos posteriores se necesita una plantilla aprobada.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              ['Plantilla de seguimiento', followup, setFollowup],
              ['Plantilla de avisos al dueño', owner, setOwner],
              ['Idioma de las plantillas', language, setLanguage],
            ].map(([label, value, setter]) => (
              <label key={String(label)} className="text-sm">
                {String(label)}
                <input
                  className="mt-1 w-full rounded bg-slate-950 border border-slate-600 p-2 text-white"
                  value={String(value)}
                  onChange={(e) => (setter as (s: string) => void)(e.target.value)}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-300">
            Las plantillas configuradas deben contener un único parámetro de texto en el cuerpo. El
            sistema comprobará nombre, idioma, estructura y aprobación antes de usarlas.
          </p>
          <div className="flex gap-3">
            <button
              className="rounded bg-blue-600 px-4 py-2"
              onClick={() => void save(data.settings.enabled)}
            >
              Guardar plantillas
            </button>
            <button
              className="rounded border border-slate-500 px-4 py-2"
              onClick={() => void save(!data.settings.enabled)}
            >
              {data.settings.enabled ? 'Pausar seguimientos' : 'Activar seguimientos'}
            </button>
          </div>
          <h4 className="font-bold">Qué estrategias están funcionando</h4>
          <p className="text-xs text-slate-300">{data.metrics.measurement}</p>
          {data.metrics.strategies.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Estrategia</th>
                  <th>Contactos</th>
                  <th>Respondieron</th>
                  <th>Pagaron</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.strategies.map((r) => (
                  <tr key={r.strategy}>
                    <td>{r.strategy === 'clarify' ? 'Aclarar dudas' : 'Ofrecer orientación'}</td>
                    <td>{r.sent}</td>
                    <td>{r.replied}</td>
                    <td>{r.paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Aún no hay seguimientos enviados para comparar.</p>
          )}
          <h4 className="font-bold">Últimos envíos y bloqueos</h4>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Tipo</th>
                  <th className="text-left">Estado</th>
                  <th className="text-left">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="py-2">
                      {j.kind === 'owner' ? 'Aviso al dueño' : 'Seguimiento'}
                    </td>
                    <td>{states[j.state] || j.state}</td>
                    <td>{j.last_error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
