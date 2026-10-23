import { useCallback, useEffect, useState } from 'react';
import type { Enrollment } from '../../enrollment-agent';
type State = {
  enrollments: Enrollment[];
  mappings: Array<{ course_title: string; campus_course_title: string; campus_course_id: string }>;
  paid: Array<{
    contact_key: string;
    profile: { fullName?: string; email?: string; course?: string };
  }>;
  configuration: {
    campusConfigured: boolean;
    emailConfigured: boolean;
    whatsappConfigured: boolean;
    whatsappTemplateConfigured: boolean;
  };
  errors: Record<string, string>;
};
const btn =
  'rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-40';
const input = 'w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white';
const status = (value: string) =>
  ({
    pending: 'Pendiente',
    sending: 'Envío en curso',
    accepted: 'Aceptado por el proveedor',
    review: 'Revisión requerida',
    active: 'Curso asignado',
  })[value] || value;
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/sales${path}`, {
    headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'sales' },
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'No se pudo completar la operación.');
  return data;
}
export function EnrollmentCenter() {
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<Array<{ id: string; title: string }>>([]),
    [courseTitle, setCourseTitle] = useState(''),
    [campusCourseId, setCampusCourseId] = useState('');
  const [crmCourses, setCrmCourses] = useState<Array<{ title: string }>>([]);
  useEffect(() => {
    void api<{ courses: Array<{ title: string }> }>('/catalog')
      .then((data) => {
        setCrmCourses(data.courses);
        setCourseTitle(data.courses[0]?.title || '');
      })
      .catch((e) => setError(e.message));
    void loadCourses();
  }, []);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const refresh = useCallback(async () => {
    try {
      const result = await api<State>('/enrollments');
      setState(result);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0),
      interval = setInterval(() => void refresh(), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [refresh]);
  async function loadCourses() {
    setBusy(true);
    setError('');
    try {
      setCatalog(await api('/campus-courses'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function mapCourse() {
    setBusy(true);
    setError('');
    try {
      await api('/course-mapping', { courseTitle, campusCourseId });
      await refresh();
      setNotice('Curso asociado. Las matrículas pendientes pueden reintentarse.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function retry(row: Enrollment) {
    setBusy(true);
    setError('');
    try {
      await api(`/enrollments/${row.id}/retry`, { confirmedNotSent: Boolean(checked[row.id]) });
      await refresh();
      setNotice('Procesamiento solicitado. Actualiza para ver el resultado de cada paso.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5 text-slate-200" aria-label="Conversión y matrícula conectada">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="text-xl font-bold text-white">Conversión y Matrícula</h2>
        <p className="mt-2 text-sm">
          Recibo revisado y abono confirmado → matrícula única → curso en el campus → bienvenida por
          correo y WhatsApp.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Un comprobante por sí solo no demuestra que el dinero llegó. Valida el recibo y la
          transferencia en el agente de Ventas y Cierre. La matrícula se crea únicamente después de
          esa validación y con los datos del estudiante completos.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Campus Firebase', state?.configuration.campusConfigured],
          ['Correo de salida', state?.configuration.emailConfigured],
          ['WhatsApp', state?.configuration.whatsappConfigured],
        ].map(([name, ready]) => (
          <div key={String(name)} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
            <h3 className="text-sm">{name}</h3>
            <p className={`mt-1 text-sm ${ready ? 'text-emerald-400' : 'text-amber-300'}`}>
              {state
                ? ready
                  ? 'Credenciales configuradas'
                  : 'Pendiente de conexión'
                : 'Consultando…'}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        La configuración se comprueba en cada operación. Fuera de la ventana de conversación de
        WhatsApp, la bienvenida requiere una plantilla aprobada. Los estados “aceptado por el
        proveedor” no garantizan lectura ni entrega final.
      </p>
      {state && (!state.configuration.campusConfigured || !state.configuration.emailConfigured) && (
        <div className="rounded-xl border border-amber-500/40 bg-slate-900 p-4 text-sm">
          <p className="font-semibold">Conexiones pendientes</p>
          <p className="mt-1">
            Para completar el proceso, conecta la cuenta de servicio del Firebase de INTECA y el
            correo institucional mediante Resend por HTTPS en{' '}
            <a
              className="text-indigo-300 underline"
              href="https://dashboard.render.com/web/srv-damn5dpmirbc73amt2l0/env"
              target="_blank"
              rel="noreferrer"
            >
              la configuración segura de Render
            </a>
            . No pegues claves en mensajes al estudiante. Las operaciones pendientes se conservan.
          </p>
        </div>
      )}
      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h3 className="font-semibold">Asociar cada curso vendido con su curso del campus</h3>
        <p className="text-xs text-slate-400">
          Selecciona el curso real; el agente no adivina equivalencias ni cambia el programa
          elegido.
        </p>
        <button className={btn} disabled={busy} onClick={() => void loadCourses()}>
          Consultar cursos del campus
        </button>
        <label className="block text-xs">
          Nombre del curso en el CRM
          <select
            className={input}
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
          >
            <option value="">Seleccionar curso del catálogo</option>
            {crmCourses.map((c) => (
              <option key={c.title} value={c.title}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          Curso existente en el campus
          <select
            className={input}
            value={campusCourseId}
            onChange={(e) => setCampusCourseId(e.target.value)}
          >
            <option value="">Seleccionar curso</option>
            {catalog.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        {!catalog.length && (
          <p className="text-sm text-amber-300">
            No se han cargado cursos del campus. Revisa la sesión y la conexión; los cursos del
            catálogo no sustituyen los identificadores reales del campus.
          </p>
        )}
        <button
          className={btn}
          disabled={busy || !campusCourseId || !courseTitle.trim()}
          onClick={() => void mapCourse()}
        >
          Guardar asociación
        </button>
        {state?.mappings.map((mapping) => (
          <p key={mapping.course_title} className="text-xs text-emerald-300">
            {mapping.course_title} → {mapping.campus_course_title}
          </p>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Últimas 200 matrículas</h3>
        <button className={btn} onClick={() => void refresh()}>
          Actualizar
        </button>
      </div>
      {state?.paid
        .filter((p) => !state.enrollments.some((e) => e.contact_key === p.contact_key))
        .map((p) => (
          <p key={p.contact_key} className="rounded-lg border border-amber-500/50 p-3 text-sm">
            {p.profile.fullName || 'Cliente con pago validado'}: pendiente de matrícula. Revisa que
            tenga recibo validado, nombre, correo y contacto de WhatsApp. No se han enviado
            credenciales.
          </p>
        ))}
      {!state?.enrollments.length && (
        <p className="rounded-lg border border-slate-700 p-5 text-sm text-slate-400">
          Aquí aparecerán las matrículas creadas después de validar un pago con su recibo.
        </p>
      )}
      {state?.enrollments.map((row) => (
        <article
          key={row.id}
          className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4"
        >
          <div>
            <h4 className="font-semibold text-white">
              {row.full_name} · {row.registration_code}
            </h4>
            <p className="text-sm">{row.course_title}</p>
            <p className="text-xs text-slate-400">{row.email}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>Campus: {status(row.campus_status)}</p>
            <p>Correo: {status(row.email_status)}</p>
            <p>WhatsApp: {status(row.whatsapp_status)}</p>
          </div>
          {row.last_error && (
            <p className="text-sm text-amber-300">
              {row.last_error
                .split(',')
                .map((code) => state.errors[code] || 'Requiere revisión de la conexión.')
                .join(' ')}
            </p>
          )}
          {(['sending', 'review'].includes(row.email_status) ||
            ['sending', 'review'].includes(row.whatsapp_status)) && (
            <label className="flex gap-2 text-xs">
              <input
                type="checkbox"
                checked={Boolean(checked[row.id])}
                onChange={(e) => setChecked((old) => ({ ...old, [row.id]: e.target.checked }))}
              />
              Comprobé en los proveedores que los mensajes con resultado incierto no se enviaron.
            </label>
          )}
          <button
            className={btn}
            disabled={
              busy ||
              (row.campus_status === 'active' &&
                row.email_status === 'accepted' &&
                row.whatsapp_status === 'accepted')
            }
            onClick={() => void retry(row)}
          >
            Reintentar pasos pendientes
          </button>
        </article>
      ))}
    </section>
  );
}
