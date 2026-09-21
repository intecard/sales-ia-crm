import {ThemeToggle} from './ThemeToggle';
import React, { useEffect, useState } from 'react';
import { Building2, Database, LogIn, PlayCircle, ShieldCheck } from 'lucide-react';
import { apiRequest, type ApiSession } from '../services/api';

type Props = { children: (session: ApiSession) => React.ReactNode };
type OrganizationOption = { id: string; name: string; slug: string; role: string };

export function SaaSAccessGate({ children }: Props) {
  const [databaseConfigured, setDatabaseConfigured] = useState<boolean | null>(null);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '', organizationSlug: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest<{ ready: boolean }>('/api/ready')
      .then((health) => setDatabaseConfigured(health.ready))
      .catch(() => setDatabaseConfigured(false));
  }, []);

  useEffect(() => {
    const organizationId = sessionStorage.getItem('sales-ai-org');
    if (organizationId) void apiRequest('/api/auth/me', {}, organizationId).then(() => setSession({ organizationId, demo: false })).catch(() => sessionStorage.removeItem('sales-ai-org'));
  }, []);
  useEffect(() => { if (session?.organizationId) sessionStorage.setItem('sales-ai-org', session.organizationId); }, [session]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        const response = await apiRequest<{ organization: { id: string } }>('/api/auth/register', {
          method: 'POST', body: JSON.stringify(form),
        });
        setSession({ organizationId: response.organization.id, demo: false });
      } else {
        const response = await apiRequest<{ organizations: OrganizationOption[] }>('/api/auth/login', {
          method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }),
        });
        if (response.organizations.length === 1) setSession({ organizationId: response.organizations[0].id, demo: false });
        else setOrganizations(response.organizations);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible completar la operación');
    } finally { setBusy(false); }
  };

  if (session) return <>{children(session)}</>;
  if (databaseConfigured === null) return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">Verificando plataforma…</div>;

  if (organizations.length > 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h1 className="text-xl font-bold mb-4">Selecciona una organización</h1>
          <div className="space-y-2">{organizations.map((org) => (
            <button key={org.id} onClick={() => setSession({ organizationId: org.id, demo: false })} className="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-indigo-900 border border-slate-700">
              <span className="font-semibold">{org.name}</span><span className="block text-xs text-slate-400">{org.role}</span>
            </button>
          ))}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <div className="mb-4"><ThemeToggle/></div><div className="flex items-center gap-3 mb-5"><div className="p-3 bg-indigo-600 rounded-xl"><Building2 /></div><div><img src="/logo-wide.png" className="crm-logo" alt="Sales AI CRM"/><p className="text-xs text-slate-400">CRM multiempresa</p></div></div>
        {!databaseConfigured && <div className="mb-4 p-3 rounded-xl bg-amber-950 border border-amber-700 text-sm"><Database className="inline w-4 h-4 mr-2" />PostgreSQL no está configurado. Puedes abrir la demostración sin datos reales.</div>}
        {databaseConfigured && (
          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && <><input required placeholder="Tu nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3" /><input required placeholder="Nombre de la empresa" value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3" /><input required placeholder="identificador-empresa" value={form.organizationSlug} onChange={(e) => setForm({ ...form, organizationSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3" /></>}
            <input required type="email" placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3" />
            <input required type="password" minLength={mode === 'register' ? 10 : 1} placeholder="Contraseña" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3" />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button disabled={busy} className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg p-3 font-semibold"><LogIn className="w-4 h-4" />{busy ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear organización'}</button>
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="w-full text-sm text-indigo-300">{mode === 'login' ? 'Crear una cuenta empresarial' : 'Ya tengo una cuenta'}</button>
          </form>
        )}
        <button onClick={() => setSession({ demo: true })} className="mt-4 w-full flex justify-center items-center gap-2 border border-slate-700 hover:bg-slate-800 rounded-lg p-3"><PlayCircle className="w-4 h-4" />Abrir demostración</button>
        <p className="mt-4 text-xs text-slate-500 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0" />La demostración no procesa dinero ni envía mensajes reales.</p>
      </div>
    </div>
  );
}
