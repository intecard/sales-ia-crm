import { useEffect, useRef, useState } from 'react';
type Agent = { id: string; name: string; title: string; area: string };
const field = 'w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100';
const button = 'bg-blue-600 text-white rounded-lg px-3 py-2 disabled:opacity-50';
export function TeamChatStudio({
  organization,
  onOpenClients,
}: {
  organization: { id: string; name: string };
  onOpenClients?: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [agent, setAgent] = useState(''),
    [messages, setMessages] = useState<any[]>([]),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [members, setMembers] = useState<any[]>([]);
  const [person, setPerson] = useState({ name: '', email: '', password: '', area: 'Ventas' }),
    [note, setNote] = useState({ kind: 'course', course: '', date: '', content: '' }),
    [task, setTask] = useState('');
  const retry = useRef<{ id: string; agent: string; text: string } | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  const base = '/api/team/' + encodeURIComponent(organization.id);
  async function api(path = '', body?: unknown) {
    const r = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'team' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || 'No se pudo completar la solicitud.');
    return d;
  }
  async function refresh() {
    const d = await api();
    setData(d);
    setAgent((a) => (d.agents.some((v: Agent) => v.id === a) ? a : d.agents[0]?.id || ''));
    if (d.identity.owner) setMembers(await api('/members'));
  }
  useEffect(() => {
    let valid = true;
    setLoading(true);
    setData(null);
    setMessages([]);
    api()
      .then(async (d) => {
        if (!valid) return;
        setData(d);
        setAgent(d.agents[0]?.id || '');
        if (d.identity.owner) {
          const m = await api('/members');
          if (valid) setMembers(m);
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
      })
      .finally(() => {
        if (valid) setLoading(false);
      });
    return () => {
      valid = false;
    };
  }, [organization.id]);
  useEffect(() => {
    if (!agent) return;
    let valid = true;
    setMessages([]);
    const poll = () =>
      api('/messages/' + agent)
        .then((v) => {
          if (valid) setMessages(v);
        })
        .catch((e) => {
          if (valid) setError(e.message);
        });
    void poll();
    const timer = setInterval(poll, 10000);
    return () => {
      valid = false;
      clearInterval(timer);
    };
  }, [agent, organization.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setBusy(false);
    }
  }
  const selected = data?.agents.find((a: Agent) => a.id === agent);
  async function send() {
    if (!text.trim() || !agent) return;
    await act(async () => {
      if (!retry.current || retry.current.text !== text || retry.current.agent !== agent)
        retry.current = { id: crypto.randomUUID(), text, agent };
      await api('/chat', { requestId: retry.current.id, agentId: agent, message: text });
      setMessages(await api('/messages/' + agent));
      retry.current = null;
      setText('');
    });
  }
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chat Sales Studio · Equipo humano + IA</h1>
          <p className="text-sm text-slate-400">
            {organization.name} · Conversaciones internas con memoria por agente y empresa.
          </p>
        </div>
        {data?.identity.owner && onOpenClients && (
          <button className={button} onClick={onOpenClients}>
            Conversaciones con clientes
          </button>
        )}
      </header>
      {error && (
        <div
          role="alert"
          className="border border-rose-500 bg-rose-950/40 text-rose-300 rounded-lg p-3"
        >
          {error}
        </div>
      )}
      {loading ? (
        <p role="status">Cargando equipo…</p>
      ) : !data ? (
        <button className={button} onClick={() => void act(refresh)}>
          Reintentar conexión
        </button>
      ) : (
        <>
          <p className="text-sm text-cyan-300">
            Sesión: {data.identity.name} ·{' '}
            {data.identity.owner
              ? 'Administrador · acceso a todos los agentes'
              : data.identity.area}
            . Cada conversación es compartida con el personal autorizado de esa área.
          </p>
          <div className="grid lg:grid-cols-[260px_1fr] gap-4">
            <aside
              className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-2 max-h-[600px] overflow-auto"
              aria-label="Agentes disponibles"
            >
              {data.agents.map((a: Agent) => (
                <button
                  disabled={busy}
                  key={a.id}
                  onClick={() => {
                    setAgent(a.id);
                    setText('');
                    retry.current = null;
                  }}
                  aria-pressed={agent === a.id}
                  className={
                    'w-full text-left rounded-lg p-3 border ' +
                    (agent === a.id
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-950 border-slate-700')
                  }
                >
                  <strong className="block">{a.name}</strong>
                  <span className="block text-xs">{a.title}</span>
                  <span className="text-xs">{a.area}</span>
                </button>
              ))}
            </aside>
            <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col min-h-[550px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">{selected?.name || 'Selecciona un agente'}</h2>
              {data.identity.owner&&<button type="button" className="border border-rose-500 text-rose-300 rounded-lg px-3 py-2 text-sm" disabled={busy||!agent||!messages.length} onClick={()=>{
                if(window.confirm(`¿Eliminar todos los mensajes de la conversación con ${selected?.name}? Se borrarán también de la memoria del chat para el equipo. Las fechas, métricas y solicitudes guardadas por separado se conservarán. Esta acción no se puede deshacer.`))void act(async()=>{await api('/messages/'+agent+'/clear',{confirmed:true});setMessages([]);setText('');retry.current=null;});
              }}>Limpiar conversación</button>}
              </div>
              <p className="text-xs text-slate-400">
                Comparte objetivos, pide análisis o solicita un plan de trabajo. Las respuestas
                preparan propuestas; no publican campañas ni ejecutan pagos.
              </p>
              <div
                className="flex-1 overflow-auto max-h-[480px] space-y-3 py-4"
                role="log"
                aria-live="polite"
              >
                {!messages.length && (
                  <p className="text-slate-400">
                    Inicia una conversación. Ejemplo: «El curso inicia el 15 de noviembre. Prepara
                    un calendario de campaña y dime qué información necesitas».
                  </p>
                )}
                {messages.map((m) => (
                  <article
                    key={m.id}
                    className={
                      'rounded-lg border p-3 ' +
                      (m.sender === 'agent'
                        ? 'border-slate-700 bg-slate-950'
                        : 'border-blue-500/30 bg-blue-500/10')
                    }
                  >
                    <div className="text-xs text-slate-400 mb-2">
                      {m.author} · {new Date(m.created_at).toLocaleString('es-DO')}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </article>
                ))}
                <div ref={bottom} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="space-y-2"
              >
                <label className="text-sm block" htmlFor="team-message">
                  Mensaje a {selected?.name}
                </label>
                <textarea
                  id="team-message"
                  className={field}
                  rows={3}
                  maxLength={6000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy}
                />
                <button className={button} disabled={busy || !agent || !text.trim()}>
                  {busy ? 'Procesando…' : 'Enviar mensaje'}
                </button>
              </form>
            </section>
          </div>
          <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold">Información compartida para planificar</h2>
            <p className="text-sm text-slate-400">
              Fechas de cursos, métricas y objetivos que todos los agentes consultan en sus
              siguientes respuestas. Son datos declarados por el equipo; no acreditan pagos ni
              autorizan descuentos.
            </p>
            <form
              className="grid md:grid-cols-2 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await api('/notes', note);
                  setNote({ ...note, content: '' });
                  await refresh();
                });
              }}
            >
              <label>
                Tipo
                <select
                  className={field}
                  value={note.kind}
                  onChange={(e) => setNote({ ...note, kind: e.target.value })}
                >
                  <option value="course">Fecha de curso</option>
                  <option value="metric">Métrica del área</option>
                  <option value="brief">Objetivo / instrucciones de trabajo</option>
                </select>
              </label>
              <label>
                Curso o proyecto
                <input
                  className={field}
                  value={note.course}
                  maxLength={200}
                  onChange={(e) => setNote({ ...note, course: e.target.value })}
                />
              </label>
              <label>
                Fecha de inicio / referencia
                <input
                  type="date"
                  className={field}
                  value={note.date}
                  onChange={(e) => setNote({ ...note, date: e.target.value })}
                />
              </label>
              <label>
                Detalles
                <textarea
                  required
                  minLength={3}
                  maxLength={4000}
                  className={field}
                  value={note.content}
                  onChange={(e) => setNote({ ...note, content: e.target.value })}
                />
              </label>
              <button disabled={busy} className={button}>
                Guardar para el equipo
              </button>
            </form>
            <div className="max-h-64 overflow-auto space-y-2">
              {data.notes.map((n: any) => (
                <div className="border border-slate-700 rounded p-3" key={n.id}>
                  <strong>
                    {n.course || n.kind} {n.date && '· ' + n.date}
                  </strong>
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <small className="text-slate-400">
                    {n.author} · {new Date(n.created_at).toLocaleString('es-DO')}
                  </small>
                </div>
              ))}
            </div>
          </section>
          <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold">Solicitudes de trabajo · {selected?.name}</h2>
            <p className="text-sm text-slate-400">
              Registrar una solicitud la conserva en la bandeja del agente. No significa que se haya
              ejecutado. El equipo actualiza el estado con su nota de avance o evidencia.
            </p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await api('/tasks', { agentId: agent, content: task });
                  setTask('');
                  await refresh();
                });
              }}
            >
              <input
                aria-label="Solicitud de trabajo"
                className={field + ' flex-1'}
                required
                minLength={3}
                maxLength={4000}
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />
              <button disabled={busy || !agent} className={button}>
                Asignar solicitud
              </button>
            </form>
            {data.tasks
              .filter((t: any) => t.agent_id === agent)
              .map((t: any) => (
                <div key={t.id} className="border border-slate-700 rounded p-3 space-y-2">
                  <p>{t.content}</p>
                  <p className="text-xs text-slate-400">
                    {t.author} ·{' '}
                    {t.status === 'completed'
                      ? 'Completada por el equipo'
                      : t.status === 'in_progress'
                        ? 'En trabajo'
                        : 'Solicitada'}{' '}
                    · {t.evidence}
                  </p>
                  {['in_progress', 'completed'].map((status) => (
                    <button
                      disabled={busy}
                      key={status}
                      className={button + ' mr-2'}
                      onClick={() => {
                        const evidence = window.prompt(
                          'Describe el avance o la evidencia del trabajo realizado:',
                        );
                        if (evidence && evidence.trim().length >= 3)
                          void act(async () => {
                            await api('/tasks/' + t.id, { status, evidence });
                            await refresh();
                          });
                      }}
                    >
                      {status === 'completed' ? 'Marcar completada' : 'Registrar avance'}
                    </button>
                  ))}
                </div>
              ))}
          </section>
          {data.identity.owner && (
            <details className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <summary className="font-bold cursor-pointer">Accesos del personal por área</summary>
              <p className="text-sm text-slate-400 my-3">
                Crea una cuenta individual y entrega sus credenciales de forma privada. El personal
                entra por la misma pantalla y solo accede al chat de sus agentes. No se envían
                invitaciones automáticamente.
              </p>
              <form
                className="grid md:grid-cols-2 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    await api('/members', { ...person, organizationName: organization.name });
                    setPerson({ name: '', email: '', password: '', area: 'Ventas' });
                    await refresh();
                  });
                }}
              >
                {(['name', 'email', 'password'] as const).map((k) => (
                  <label key={k}>
                    {k === 'name'
                      ? 'Nombre'
                      : k === 'email'
                        ? 'Correo'
                        : 'Contraseña inicial (mínimo 12 caracteres)'}
                    <input
                      required
                      minLength={k === 'password' ? 12 : 2}
                      maxLength={200}
                      autoComplete={k === 'password' ? 'new-password' : 'off'}
                      type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'}
                      className={field}
                      value={person[k]}
                      onChange={(e) => setPerson({ ...person, [k]: e.target.value })}
                    />
                  </label>
                ))}
                <label>
                  Área
                  <select
                    className={field}
                    value={person.area}
                    onChange={(e) => setPerson({ ...person, area: e.target.value })}
                  >
                    {data.areas.map((a: string) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <button disabled={busy} className={button}>
                  Crear acceso
                </button>
              </form>
              <div className="space-y-2 mt-4">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap justify-between gap-2 border border-slate-700 rounded p-2"
                  >
                    <span>
                      {m.name} · {m.email} · {m.area} · {m.active ? 'Activo' : 'Desactivado'}
                    </span>
                    {m.active && (
                      <button
                        disabled={busy}
                        className={button}
                        onClick={() =>
                          void act(async () => {
                            await api('/members/' + m.id + '/disable', {});
                            await refresh();
                          })
                        }
                      >
                        Desactivar acceso
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
