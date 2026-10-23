import { useEffect, useState } from 'react';
import type { SalesOpportunity } from '../../sales-agent';
const labels: Record<string, string> = {
  new: 'Consulta',
  interested: 'Interesado',
  enrollment: 'Inscripción',
  payment_pending: 'Pago pendiente',
  payment_review: 'Revisión de pago',
  won: 'Pago validado',
};
const escape = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function InterestedPipeline() {
  const [rows, setRows] = useState<SalesOpportunity[]>([]),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false);
  async function refresh() {
    try {
      const response = await fetch('/api/sales/interested-document');
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setRows(data.rows);
      setLoaded(true);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => clearInterval(timer);
  }, []);
  const columns = [
    'Nombre',
    'Teléfono',
    'Correo',
    'Curso',
    'Solicita llamada',
    'Etapa',
    'Objeción',
    'Próxima acción',
    'Seguimiento',
  ];
  const cells = (r: SalesOpportunity) => [
    r.profile.fullName || r.profile.profileName || 'Por solicitar',
    r.profile.phone || 'Por solicitar',
    r.profile.email || 'Por solicitar',
    r.profile.course || 'Por definir',
    r.profile.callbackConsent === 'yes'
      ? 'Sí'
      : r.profile.callbackConsent === 'no'
        ? 'No'
        : 'No consultado',
    labels[r.stage],
    r.objection,
    r.next_action,
    r.follow_up_at || '',
  ];
  function download() {
    const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Registro de interesados INTECA</title><style>body{font:14px Arial;padding:28px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}th{background:#163b63;color:white}</style><h1>INTECA · Registro de interesados</h1><p>Generado: ${escape(new Date().toLocaleString('es-DO'))} · ${rows.length} contactos. Uso interno.</p><table><thead><tr>${columns.map((c) => `<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${rows
      .map(
        (r) =>
          `<tr>${cells(r)
            .map((c) => `<td>${escape(c)}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</tbody></table></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'INTECA-registro-interesados.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="rounded-2xl border border-cyan-700 bg-slate-900 p-5 space-y-4 text-slate-200">
      <h2 className="font-bold text-xl">Interesados y embudo real de los agentes</h2>
      <p className="text-sm">
        Los contactos entrantes de WhatsApp se registran y avanzan según su conversación. El pago
        requiere validación. El documento se actualiza desde los registros guardados en Supabase.
      </p>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {Object.entries(labels).map(([key, label]) => (
          <span key={key} className="rounded bg-slate-800 p-2">
            {label}: {loaded ? rows.filter((r) => r.stage === key).length : '—'}
          </span>
        ))}
      </div>
      <button onClick={() => void refresh()} className="border rounded p-2 mr-3">
        Actualizar
      </button>
      <button
        disabled={!loaded}
        onClick={download}
        className="bg-blue-600 rounded p-2 disabled:opacity-40"
      >
        Descargar documento de interesados
      </button>
      <div className="overflow-auto max-h-96">
        <table className="text-xs w-full">
          <thead>
            <tr>
              {columns.map((c) => (
                <th className="p-2 text-left" key={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contact_key}>
                {cells(r).map((c, i) => (
                  <td className="p-2 border-t border-slate-700" key={i}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs">
        “No consultado” no autoriza llamadas. Captar nuevos contactos depende de anuncios publicados
        y canales conectados; aquí no se inventan leads.
      </p>
    </section>
  );
}
