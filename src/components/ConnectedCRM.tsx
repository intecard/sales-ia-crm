import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Building2, Users, Package, TrendingUp, CheckSquare, Settings, LogOut, Plus, Download, Search, X, LayoutDashboard, RefreshCw } from 'lucide-react';

type Row = Record<string, any>;
type Field = { key: string; label: string; type?: string; required?: boolean; options?: { value: string; label: string }[] };
type Tab = 'dashboard' | 'contacts' | 'companies' | 'products' | 'deals' | 'activities' | 'settings';
const labels: Record<string, string> = { ACTIVE: 'Activo', WON: 'Ganado', LOST: 'Perdido', PAUSED: 'Pausado', OPEN: 'Abierto', PRODUCT: 'Producto', SERVICE: 'Servicio', COURSE: 'Curso', NOTE: 'Nota', TASK: 'Tarea', CALL: 'Llamada', EMAIL: 'Correo', MEETING: 'Reunión', FOLLOW_UP: 'Seguimiento' };
const options = (...values: string[]) => values.map(value => ({ value, label: labels[value] || value }));
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900';
const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50';

export function ConnectedCRM({ organizationId, initialTab = 'dashboard' }: { organizationId: string; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<Record<string, Row[]>>({ contacts: [], companies: [], products: [], deals: [], activities: [], pipelines: [], team: [], audit: [] });
  const [org, setOrg] = useState<Row>({});
  const [me, setMe] = useState<Row>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{ kind: string; row?: Row } | null>(null);
  const [form, setForm] = useState<Row>({});
  const request = useCallback(<T,>(path: string, init: RequestInit = {}) => apiRequest<T>(path, init, organizationId), [organizationId]);
  const can = (permission: string) => me.role === 'OWNER' || me.permissions?.includes(permission);
  const load = useCallback(async () => {
    try {
      const [user, organization, products, companies, deals, activities, pipelines] = await Promise.all([
        request<Row>('/api/auth/me'), request<Row>('/api/platform/organization'), request<Row>('/api/crm/products'), request<Row>('/api/operations/companies'), request<Row>('/api/crm/deals'), request<Row>('/api/operations/activities'), request<Row>('/api/crm/pipelines'),
      ]);
      const contacts: Row[] = [];
      for (let page = 1; ; page++) {
        const result = await request<Row>(`/api/crm/contacts?pageSize=100&page=${page}`);
        contacts.push(...result.items);
        if (contacts.length >= result.pagination.total || !result.items.length) break;
      }
      let team: Row[] = [], audit: Row[] = [];
      if (user.role === 'OWNER' || user.permissions.includes('settings.manage')) {
        const extra = await Promise.all([request<Row>('/api/operations/team'), request<Row>('/api/operations/audit')]);
        team = extra[0].items; audit = extra[1].items;
      }
      setMe(user); setOrg(organization.organization);
      setData({ contacts, products: products.items, companies: companies.items, deals: deals.items, activities: activities.items, pipelines: pipelines.items, team, audit });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible cargar los datos'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const open = (kind: string, row?: Row) => {
    setEditor({ kind, row }); setError('');
    setForm(row ? { ...row, tags: row.tags?.join(', '), dueAt: row.dueAt ? new Date(new Date(row.dueAt).getTime() - new Date(row.dueAt).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '' } : { currency: org.currency || 'DOP', status: kind === 'contacts' ? 'ACTIVE' : 'OPEN', type: kind === 'activities' ? 'TASK' : 'SERVICE', price: 0, value: 0, probability: 0, active: true, pipelineId: data.pipelines[0]?.id, stageId: data.pipelines[0]?.stages[0]?.id, role: 'SALES' });
  };
  const relation = (key: string, label: string, rows: Row[], name: (r: Row) => string): Field => ({ key, label, options: [{ value: '', label: 'Sin asignar' }, ...rows.map(r => ({ value: r.id, label: name(r) }))] });
  const fieldsFor = (kind: string): Field[] => {
    if (kind === 'contacts') return [{ key: 'firstName', label: 'Nombre', required: true }, { key: 'lastName', label: 'Apellido' }, { key: 'email', label: 'Correo', type: 'email' }, { key: 'phone', label: 'Teléfono' }, { key: 'source', label: 'Origen del contacto' }, { key: 'tags', label: 'Etiquetas separadas por coma' }, { key: 'status', label: 'Estado', options: options('ACTIVE','WON','LOST','PAUSED') }];
    if (kind === 'companies') return [{ key: 'name', label: 'Nombre de empresa', required: true }, { key: 'email', label: 'Correo', type: 'email' }, { key: 'phone', label: 'Teléfono' }, { key: 'website', label: 'Sitio web (https://...)', type: 'url' }];
    if (kind === 'products') return [{ key: 'name', label: 'Nombre', required: true }, { key: 'sku', label: 'Código / SKU' }, { key: 'type', label: 'Tipo', options: options('PRODUCT','SERVICE','COURSE') }, { key: 'description', label: 'Descripción' }, { key: 'price', label: 'Precio', type: 'number', required: true }, { key: 'currency', label: 'Moneda (DOP, USD...)', required: true }, { key: 'active', label: 'Disponible', type: 'checkbox' }];
    if (kind === 'deals') return [{ key: 'title', label: 'Oportunidad', required: true }, { key: 'value', label: 'Valor', type: 'number', required: true }, { key: 'currency', label: 'Moneda', required: true }, ...(!editor?.row ? [{ key: 'pipelineId', label: 'Embudos', options: data.pipelines.map(p => ({ value: p.id, label: p.name })) }] : []), { key: 'stageId', label: 'Etapa', options: (data.pipelines.find(p => p.id === form.pipelineId)?.stages || []).map((s: Row) => ({ value: s.id, label: s.name })) }, ...(editor?.row ? [{ key: 'status', label: 'Resultado', options: options('OPEN','WON','LOST') }] : []), { key: 'probability', label: 'Probabilidad estimada (0–100)', type: 'number' }, relation('contactId','Contacto',data.contacts,r => `${r.firstName} ${r.lastName || ''}`), relation('companyId','Empresa',data.companies,r => r.name), relation('productId','Producto / servicio',data.products,r => r.name)];
    if (kind === 'activities') return [{ key: 'title', label: 'Título', required: true }, { key: 'description', label: 'Notas' }, { key: 'type', label: 'Tipo', options: options('TASK','NOTE','CALL','EMAIL','MEETING','FOLLOW_UP') }, { key: 'dueAt', label: 'Fecha y hora (hora local de tu equipo)', type: 'datetime-local' }, relation('contactId','Contacto',data.contacts,r => `${r.firstName} ${r.lastName || ''}`), relation('dealId','Oportunidad',data.deals,r => r.title)];
    if (kind === 'organization') return [{ key: 'name', label: 'Nombre de tu empresa', required: true }, { key: 'currency', label: 'Moneda', required: true }, { key: 'timezone', label: 'Zona horaria', required: true }];
    if (kind === 'team') return [{ key: 'name', label: 'Nombre', required: true }, { key: 'email', label: 'Correo', type: 'email', required: true }, { key: 'password', label: 'Contraseña inicial (mínimo 10 caracteres)', type: 'password', required: true }, { key: 'role', label: 'Permisos', options: [{ value: 'MANAGER', label: 'Administrador' }, { value: 'SALES', label: 'Ventas' }, { value: 'VIEWER', label: 'Solo lectura' }] }];
    if (kind === 'pipelines') return [{ key: 'name', label: 'Nombre del embudo', required: true }, { key: 'stages', label: 'Etapas separadas por coma (mínimo 2)', required: true }];
    return [{ key: 'current', label: 'Contraseña actual', type: 'password', required: true }, { key: 'password', label: 'Nueva contraseña (mínimo 10 caracteres)', type: 'password', required: true }];
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editor) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const kind = editor.kind;
      const body: Row = {};
      for (const field of fieldsFor(kind)) {
        const value = form[field.key];
        body[field.key] = field.type === 'number' ? Number(value || 0) : field.type === 'checkbox' ? Boolean(value) : value ?? '';
      }
      for (const key of ['contactId','companyId','productId','dealId']) if (key in body && !body[key]) { if (editor.row) body[key] = null; else delete body[key]; }
      if (kind === 'contacts') body.tags = String(body.tags).split(',').map(v => v.trim()).filter(Boolean);
      if (kind === 'activities') body.dueAt = body.dueAt ? new Date(body.dueAt).toISOString() : null;
      if (kind === 'pipelines') body.stages = String(body.stages).split(',').map(v => v.trim()).filter(Boolean);
      let path = '/api/operations/' + kind;
      if (kind === 'contacts' || (!editor.row && ['products','deals'].includes(kind))) path = '/api/crm/' + kind;
      if (editor.row && kind !== 'organization') path += '/' + editor.row.id;
      await request(path, { method: editor.row ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      if (kind === 'password') { sessionStorage.removeItem('sales-ai-org'); location.reload(); return; }
      setEditor(null); setNotice('Cambios guardados en la base de datos.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar'); }
    finally { setSaving(false); }
  };
  const toggle = async (path: string, body: Row) => {
    setSaving(true); setError('');
    try { await request(path, { method: 'PATCH', body: JSON.stringify(body) }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar'); }
    finally { setSaving(false); }
  };
  const rows = (data[tab] || []).filter(r => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const csv = () => {
    const columns = fieldsFor(tab).map(f => f.key);
    const cell = (v: unknown) => { let value = Array.isArray(v) ? v.join(', ') : String(v ?? ''); if (/^[=+\-@\t\r]/.test(value)) value = "'" + value; return '"' + value.replaceAll('"', '""') + '"'; };
    const content = '\ufeff' + [columns.map(cell).join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `${tab}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const tabs = [{ id: 'dashboard', title: 'Resumen', icon: LayoutDashboard }, { id: 'contacts', title: 'Contactos', icon: Users }, { id: 'companies', title: 'Empresas', icon: Building2 }, { id: 'products', title: 'Catálogo', icon: Package }, { id: 'deals', title: 'Oportunidades', icon: TrendingUp }, { id: 'activities', title: 'Seguimientos', icon: CheckSquare }, { id: 'settings', title: 'Configuración', icon: Settings }];
  const money = (value: unknown, code = org.currency || 'DOP') => `${code} ${Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <div className="min-h-screen bg-slate-100 text-slate-800 md:flex">
    <aside className="bg-slate-950 text-slate-300 p-5 md:w-60 md:shrink-0"><div className="text-white font-black text-xl mb-1">SALES <span className="text-indigo-400">AI</span></div><p className="text-xs mb-8">CRM comercial · v0.4.0</p><nav className="flex flex-wrap md:block">{tabs.map(t => <button key={t.id} onClick={() => { setTab(t.id as Tab); setSearch(''); }} className={`w-full flex items-center gap-3 rounded-xl p-3 mb-1 text-sm text-left ${tab === t.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><t.icon size={18}/>{t.title}</button>)}</nav><p className="text-xs mt-8 text-slate-500">Tus cambios se guardan en PostgreSQL. No hay datos de ejemplo en esta vista.</p></aside>
    <main className="min-w-0 flex-1"><header className="bg-white border-b px-6 py-4 flex justify-between items-center gap-4"><div><strong>{org.name || 'Tu empresa'}</strong><p className="text-xs text-slate-500">{me.user?.name} · {me.role}</p></div><button className={btn + ' text-slate-600'} onClick={async () => { try { await request('/api/auth/logout', { method: 'POST' }); sessionStorage.removeItem('sales-ai-org'); location.reload(); } catch { setError('No se pudo cerrar sesión. Inténtalo nuevamente.'); } }}><LogOut size={16}/>Salir</button></header>
    <div className="p-4 md:p-8 max-w-7xl mx-auto"><div className="flex items-center justify-between mb-6"><div><p className="text-xs uppercase tracking-widest text-indigo-600 font-bold">Espacio de trabajo</p><h1 className="text-3xl font-bold mt-1">{tabs.find(t => t.id === tab)?.title}</h1></div><button disabled={loading} className={btn + ' bg-white border'} onClick={() => { setLoading(true); setError(''); void load(); }}><RefreshCw size={16}/>Actualizar</button></div>
    {error && <div role="alert" className="bg-red-50 border border-red-300 p-4 rounded-xl mb-4">No se completó la operación: {error}. Tus cambios no están confirmados.</div>}{notice && <div role="status" className="bg-emerald-50 p-3 rounded-lg mb-4">{notice}</div>}
    {loading ? <p className="p-8">Cargando datos de tu empresa…</p> : tab === 'dashboard' ? <><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{[['Contactos',data.contacts.length],['Oportunidades abiertas',data.deals.filter(d => d.status === 'OPEN').length],['Ventas ganadas',data.deals.filter(d => d.status === 'WON').length],['Tareas pendientes',data.activities.filter(a => !a.completedAt && a.type !== 'NOTE').length]].map(([label,value]) => <div key={label} className="bg-white border rounded-2xl p-6"><p className="text-sm text-slate-500">{label}</p><p className="text-4xl font-bold mt-3">{value}</p></div>)}</div><section className="bg-white border rounded-2xl p-6 mt-6"><h2 className="font-bold text-lg mb-4">Valor de oportunidades por moneda</h2>{[...new Set(data.deals.map(d => d.currency))].map(code => <p key={code} className="py-2 border-b">{code} · Abiertas: {money(data.deals.filter(d => d.status === 'OPEN' && d.currency === code).reduce((s,d) => s + Number(d.value),0),code)} · Ganadas: {money(data.deals.filter(d => d.status === 'WON' && d.currency === code).reduce((s,d) => s + Number(d.value),0),code)}</p>)}{!data.deals.length && <p className="text-slate-500">Crea tu primera oportunidad para empezar a medir tus ventas.</p>}<p className="text-xs text-slate-500 mt-4">Una venta ganada no equivale a dinero cobrado.</p></section><section className="bg-white border rounded-2xl p-6 mt-6"><h2 className="font-bold text-lg mb-3">Próximos seguimientos</h2>{data.activities.filter(a => !a.completedAt && a.dueAt).slice(0,8).map(a => <div key={a.id} className="py-3 border-b flex justify-between gap-4"><span>{a.title}</span><span className={new Date(a.dueAt) < new Date() ? 'text-red-600' : 'text-slate-500'}>{new Date(a.dueAt).toLocaleString('es-DO')}</span></div>)}</section></> : tab === 'settings' ? <div className="space-y-5"><section className="bg-white p-6 border rounded-2xl"><h2 className="font-bold text-lg">Empresa y cuenta</h2><p className="my-3">{org.name} · {org.currency} · {org.timezone}</p><div className="flex gap-3 flex-wrap">{can('settings.manage') && <><button className={btn + ' bg-indigo-600 text-white'} onClick={() => open('organization',org)}>Editar empresa</button><button className={btn + ' border'} onClick={() => open('pipelines')}>Crear embudo de ventas</button></>}<button className={btn + ' border'} onClick={() => open('password')}>Cambiar contraseña</button></div></section>{can('settings.manage') && <><section className="bg-white p-6 border rounded-2xl"><div className="flex justify-between"><h2 className="font-bold text-lg">Equipo</h2><button className={btn + ' border'} onClick={() => open('team')}>Agregar usuario</button></div>{data.team.map(member => <div key={member.id} className="py-3 border-b flex justify-between items-center gap-3"><div>{member.user.name}<p className="text-xs text-slate-500">{member.user.email} · {member.role.code} · {member.active ? 'Activo' : 'Desactivado'}</p></div>{member.role.code !== 'OWNER' && <button disabled={saving} className={btn + ' border'} onClick={() => void toggle(`/api/operations/team/${member.id}`,{ active: !member.active })}>{member.active ? 'Desactivar' : 'Activar'}</button>}</div>)}</section><section className="bg-white p-6 border rounded-2xl"><h2 className="font-bold text-lg">Actividad reciente de la empresa</h2>{data.audit.slice(0,20).map(a => <p key={a.id} className="py-2 border-b text-sm">{new Date(a.createdAt).toLocaleString('es-DO')} · {a.action}</p>)}</section></>}<section className="bg-amber-50 border border-amber-200 p-6 rounded-2xl"><h2 className="font-bold">Servicios externos pendientes</h2><p className="mt-2 text-sm">WhatsApp, correo, SMS, cobros en línea y almacenamiento de documentos requieren integración y credenciales del proveedor. No se envían mensajes ni se cobran pagos desde esta versión. La IA del servidor requiere una clave Gemini y un modelo disponible.</p></section></div> : <><div className="flex gap-3 flex-wrap mb-4"><label className="bg-white border rounded-lg flex items-center px-3 gap-2 flex-1"><Search size={16}/><input aria-label="Buscar registros" placeholder="Buscar en tus registros…" value={search} onChange={e => setSearch(e.target.value)} className="p-2.5 outline-none w-full"/></label><button onClick={csv} className={btn + ' bg-white border'}><Download size={16}/>Exportar CSV</button>{can('crm.write') && <button onClick={() => open(tab)} className={btn + ' bg-indigo-600 text-white'}><Plus size={16}/>Agregar</button>}</div><div className="bg-white border rounded-2xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-4">Nombre / título</th><th className="p-4">Información</th><th className="p-4">Estado / detalle</th><th className="p-4">Acciones</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t"><td className="p-4 font-medium">{r.name || r.title || `${r.firstName} ${r.lastName || ''}`}</td><td className="p-4 text-slate-600">{tab === 'products' ? money(r.price,r.currency) : tab === 'deals' ? money(r.value,r.currency) : tab === 'activities' ? r.dueAt ? new Date(r.dueAt).toLocaleString('es-DO') : 'Sin fecha' : r.email || r.phone || '—'}</td><td className="p-4">{tab === 'deals' ? `${r.stage?.name || ''} · ${labels[r.status]}` : tab === 'products' ? r.active ? 'Disponible' : 'Archivado' : tab === 'activities' ? r.completedAt ? 'Completado' : labels[r.type] : labels[r.status] || r.website || '—'}</td><td className="p-4">{can('crm.write') && <div className="flex gap-2"><button className="text-indigo-600 font-semibold" onClick={() => open(tab,r)}>Editar</button>{tab === 'activities' && <button disabled={saving} className="text-emerald-700 ml-3" onClick={() => void toggle(`/api/operations/activities/${r.id}`,{ completedAt: r.completedAt ? null : new Date().toISOString() })}>{r.completedAt ? 'Reabrir' : 'Completar'}</button>}</div>}</td></tr>)}</tbody></table>{!rows.length && <div className="text-center p-12 text-slate-500">No hay registros para mostrar.</div>}</div><p className="text-xs text-slate-500 mt-3">{rows.length} registros · Los contactos pueden pausarse y los productos archivarse desde Editar.</p></>}
    </div></main>
    {editor && <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="edit-title" className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6"><div className="flex justify-between items-center mb-5"><h2 id="edit-title" className="font-bold text-xl">{editor.row ? 'Editar' : 'Agregar'} registro</h2><button aria-label="Cerrar" disabled={saving} onClick={() => setEditor(null)}><X/></button></div><form onSubmit={save} className="space-y-4">{fieldsFor(editor.kind).map(f => <label key={f.key} className="block text-sm font-medium">{f.label}{f.options ? <select aria-label={f.label} required={f.required} className={inputClass + ' mt-1'} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value, ...(f.key === 'pipelineId' ? { stageId: data.pipelines.find(p => p.id === e.target.value)?.stages[0]?.id } : {}) })}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === 'checkbox' ? <input aria-label={f.label} type="checkbox" className="ml-3" checked={Boolean(form[f.key])} onChange={e => setForm({ ...form, [f.key]: e.target.checked })}/> : <input aria-label={f.label} required={f.required} type={f.type || 'text'} step={f.type === 'number' ? '0.01' : undefined} min={f.type === 'number' ? 0 : undefined} className={inputClass + ' mt-1'} value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}/>}</label>)}{error && <p role="alert" className="text-red-600">No se guardó: {error}</p>}<button disabled={saving} className={btn + ' w-full bg-indigo-600 text-white'}>{saving ? 'Guardando…' : 'Guardar'}</button></form></section></div>}
  </div>;
}
