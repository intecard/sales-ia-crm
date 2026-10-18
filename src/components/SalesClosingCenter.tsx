import { PaymentReceiptSelector } from './PaymentReceiptSelector';
import React, { useCallback, useEffect, useState } from 'react';
import type { SalesOpportunity } from '../../sales-agent';

type SalesEvent = {
  id: string;
  kind: string;
  actor: string;
  created_at: string;
  details: {
    text?: string;
    note?: string;
    amount?: number;
    bank?: string;
    reference?: string;
    mediaType?: string;
    mediaId?: string;
  };
};
type Snapshot = {
  settings: { enabled: boolean };
  opportunities: SalesOpportunity[];
  hasMore: boolean;
};
const stages: Record<string, string> = {
  new: 'Consulta nueva',
  interested: 'Interesado',
  enrollment: 'Inscripción en curso',
  payment_pending: 'Pago pendiente',
  payment_review: 'Revisar pago',
  won: 'Pago validado',
};
const money = (value: number | null) =>
  value === null
    ? 'Por confirmar'
    : new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleString('es-DO') : 'Sin tarea pendiente';
const inputClass =
  'w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white';
const buttonClass =
  'rounded-lg border border-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-40';
async function api<T>(path: string, body?: unknown): Promise<T> {
  const result = await fetch(`/api/sales${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'sales' },
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  });
  const data = await result.json();
  if (!result.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}
export function SalesClosingCenter() {
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState('');
  const [events, setEvents] = useState<SalesEvent[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const [bank, setBank] = useState('Banreservas');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [receiptId, setReceiptId] = useState('');
  const [receiptReviewed, setReceiptReviewed] = useState(false);
  const [note, setNote] = useState('');
  const [followAt, setFollowAt] = useState('');
  const refresh = useCallback(async () => {
    try {
      const data = await api<Snapshot>(`?offset=${offset}`);
      setSnapshot(data);
      setError('');
      setRefreshedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    }
  }, [offset]);
  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    if (selected)
      void api<SalesEvent[]>(`/${selected}/events`)
        .then((data) => {
          if (active) setEvents(data);
        })
        .catch((err) => {
          if (active) setError(err.message);
        });
    return () => {
      active = false;
    };
  }, [selected]);
  function selectContact(key: string) {
    setReceiptId('');
    setReceiptReviewed(false);
    setSelected(key);
    setEvents([]);
    setReference('');
    setAmount('');
    setConfirmed(false);
    setNote('');
    setFollowAt('');
    setNotice('');
  }
  const opportunity = snapshot?.opportunities.find((item) => item.contact_key === selected);
  async function act(action: string, data: unknown = {}) {
    if (!opportunity) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/${opportunity.contact_key}/action`, { action, data });
      setNotice('Guardado en Supabase.');
      setConfirmed(false);
      setReference('');
      await refresh();
      setEvents(await api<SalesEvent[]>(`/${opportunity.contact_key}/events`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    if (!snapshot) return;
    setBusy(true);
    setError('');
    try {
      await api('/settings', { enabled: !snapshot.settings.enabled });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const list = snapshot?.opportunities || [];
  const filtered = list.filter(
    (item) =>
      !filter ||
      item.stage === filter ||
      (filter === 'due' &&
        item.follow_up_at &&
        new Date(item.follow_up_at).getTime() <= refreshedAt),
  );
  return (
    <section className="space-y-5 text-slate-200" aria-label="Ventas y cierre conectado">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Ventas y Cierre · WhatsApp</h2>
            <p className="mt-1 text-sm text-slate-400">
              Conversaciones, oportunidades y tareas guardadas en Supabase.
            </p>
          </div>
          <button
            className={buttonClass}
            disabled={busy || !snapshot}
            onClick={() => void toggle()}
          >
            {snapshot?.settings.enabled
              ? 'Pausar respuestas automáticas'
              : 'Activar respuestas automáticas'}
          </button>
        </div>
        <p className="mt-3 text-sm">
          Estado:{' '}
          <strong className={snapshot?.settings.enabled ? 'text-emerald-400' : 'text-amber-300'}>
            {snapshot ? (snapshot.settings.enabled ? 'Activo' : 'Pausado') : 'Consultando…'}
          </strong>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          El agente responde consultas, guía la inscripción y entrega las cuentas oficiales. Las
          transferencias requieren revisión en el banco. Los seguimientos aparecen como tareas; no
          envían mensajes solos.
        </p>
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-red-500/50 bg-red-950 p-3 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[
          ['En esta página', list.length],
          ['Pagos por revisar', list.filter((item) => item.stage === 'payment_review').length],
          ['Pagos validados', list.filter((item) => item.stage === 'won').length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filtrar oportunidades"
          className={`${inputClass} max-w-xs`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todas las etapas</option>
          <option value="due">Seguimientos vencidos</option>
          {Object.entries(stages).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className={buttonClass} onClick={() => void refresh()}>
          Actualizar
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800 text-xs">
            <tr>
              <th className="p-3">Cliente / curso</th>
              <th className="p-3">Etapa</th>
              <th className="p-3">Próximo paso</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.contact_key}
                className={`border-t border-slate-800 ${selected === item.contact_key ? 'bg-indigo-950' : 'bg-slate-900'}`}
              >
                <td className="p-3">
                  <button
                    onClick={() => selectContact(item.contact_key)}
                    className="text-left font-semibold text-indigo-300 underline underline-offset-4"
                  >
                    {item.profile.fullName || item.profile.profileName || 'Contacto de WhatsApp'}
                  </button>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.profile.course || 'Curso pendiente'}
                  </p>
                </td>
                <td className="p-3">
                  {stages[item.stage]}
                  {item.control !== 'auto' && (
                    <p className="mt-1 text-xs text-amber-300">
                      {item.control === 'human' ? 'Atención humana' : 'No contactar'}
                    </p>
                  )}
                </td>
                <td className="p-3 text-xs">
                  {item.next_action}
                  <p className="mt-1 text-slate-400">{date(item.follow_up_at)}</p>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-slate-400">
                  {snapshot
                    ? 'No hay oportunidades con este filtro. Las conversaciones nuevas de WhatsApp aparecerán aquí.'
                    : 'Esperando conexión…'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <button
          className={buttonClass}
          disabled={!offset}
          onClick={() => {
            setOffset(Math.max(0, offset - 100));
            setSelected('');
          }}
        >
          Anterior
        </button>
        <span className="text-xs">Página {offset / 100 + 1}</span>
        <button
          className={buttonClass}
          disabled={!snapshot?.hasMore}
          onClick={() => {
            setOffset(offset + 100);
            setSelected('');
          }}
        >
          Siguiente
        </button>
      </div>
      {opportunity && (
        <div className="space-y-5 rounded-2xl border border-indigo-700 bg-slate-900 p-5">
          <h3 className="text-lg font-bold">
            {opportunity.profile.fullName ||
              opportunity.profile.profileName ||
              'Detalle de oportunidad'}
          </h3>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[
              ['Curso', opportunity.profile.course],
              ['Horario solicitado', opportunity.profile.schedule],
              ['Correo', opportunity.profile.email],
              ['WhatsApp / ID', opportunity.profile.phone || opportunity.profile.whatsappUserId],
              ['Inscripción', money(opportunity.expected_amount)],
              ['Objeción detectada', opportunity.objection || 'Ninguna registrada'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="break-words">{value || 'Pendiente'}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || opportunity.control === 'opted_out'}
              className={buttonClass}
              onClick={() => void act(opportunity.control === 'auto' ? 'pause' : 'resume')}
            >
              {opportunity.control === 'auto' ? 'Tomar atención humana' : 'Reactivar agente'}
            </button>
            <button
              disabled={busy || !opportunity.follow_up_at}
              className={buttonClass}
              onClick={() => void act('complete_task')}
            >
              Completar tarea
            </button>
          </div>
          {opportunity.stage !== 'won' ? (
            <form
              className="space-y-3 border-t border-slate-700 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void act('verify_payment', {
                  bank,
                  reference,
                  amount: Number(amount),
                  confirmed,
                  receiptId,
                  receiptReviewed,
                });
              }}
            >
              <h4 className="font-semibold">Validar transferencia de inscripción</h4>
              <PaymentReceiptSelector
                key={opportunity.contact_key}
                contactKey={opportunity.contact_key}
                onSelect={(id, reviewed) => {
                  setReceiptId(id);
                  setReceiptReviewed(reviewed);
                }}
              />
              <p className="text-xs text-slate-400">
                Comprueba el abono en la cuenta bancaria y que corresponde a este cliente. El
                importe debe coincidir con la inscripción acordada. Una vez validado, el agente de
                matrícula procesará el acceso y las notificaciones cuando las conexiones estén
                listas.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs">
                  Banco
                  <select
                    className={inputClass}
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                  >
                    <option>Banreservas</option>
                    <option>Qik</option>
                    <option>Banco Popular</option>
                  </select>
                </label>
                <label className="text-xs">
                  Referencia bancaria
                  <input
                    required
                    minLength={3}
                    maxLength={100}
                    className={inputClass}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <label className="text-xs">
                  Importe recibido (RD$)
                  <input
                    required
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    className={inputClass}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              </div>
              {!opportunity.expected_amount && (
                <button
                  type="button"
                  disabled={busy || !Number(amount)}
                  className={buttonClass}
                  onClick={() => void act('quote', { amount: Number(amount) })}
                >
                  Fijar este importe como inscripción acordada
                </button>
              )}
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Confirmé en el banco el abono, el cliente y la referencia.
              </label>
              <button
                disabled={
                  busy ||
                  !confirmed ||
                  !receiptId ||
                  !receiptReviewed ||
                  !opportunity.profile.fullName ||
                  !opportunity.profile.course ||
                  !opportunity.expected_amount
                }
                className={`${buttonClass} bg-emerald-800`}
              >
                Validar pago y registrar cierre
              </button>
              {(!opportunity.profile.fullName || !opportunity.profile.course) && (
                <p className="text-xs text-amber-300">
                  El cliente debe confirmar su nombre completo y el curso por WhatsApp antes de
                  validar.
                </p>
              )}
            </form>
          ) : (
            <p className="rounded-lg bg-emerald-950 p-3 text-sm">
              Pago validado: {money(opportunity.paid_amount)}. Consulta el progreso de la matrícula,
              del campus y de las notificaciones en el agente de Conversión y Matrícula.
            </p>
          )}
          <form
            className="space-y-2 border-t border-slate-700 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void act('follow_up', { note, at: new Date(followAt).toISOString() });
            }}
          >
            <h4 className="font-semibold">Programar tarea de seguimiento</h4>
            <label className="block text-xs">
              Próximo paso
              <input
                required
                minLength={3}
                maxLength={1000}
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej.: confirmar disponibilidad del grupo"
              />
            </label>
            <label className="block text-xs">
              Fecha y hora local
              <input
                required
                type="datetime-local"
                className={inputClass}
                value={followAt}
                onChange={(e) => setFollowAt(e.target.value)}
              />
            </label>
            <button disabled={busy || opportunity.control === 'opted_out'} className={buttonClass}>
              Guardar tarea
            </button>
          </form>
          <div className="border-t border-slate-700 pt-4">
            <h4 className="mb-3 font-semibold">Actividad reciente</h4>
            <div className="max-h-80 space-y-3 overflow-auto">
              {events.map((event) => (
                <article key={event.id} className="rounded-lg bg-slate-950 p-3 text-sm">
                  <p className="text-xs text-slate-400">
                    {date(event.created_at)} · {event.kind === 'inbound' ? 'Cliente' : event.actor}{' '}
                    · {event.kind}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {event.details.text ||
                      event.details.note ||
                      (event.details.amount
                        ? `${money(event.details.amount)} ${event.details.bank || ''} ${event.details.reference || ''}`
                        : 'Estado actualizado')}
                  </p>
                  {event.details.mediaId && (
                    <p className="mt-1 text-xs text-amber-300">
                      Adjunto recibido ({event.details.mediaType}). Revisa el original en el canal
                      de WhatsApp antes de validar.
                    </p>
                  )}
                </article>
              ))}
              {!events.length && (
                <p className="text-sm text-slate-400">
                  Todavía no hay actividad nueva en este panel.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
