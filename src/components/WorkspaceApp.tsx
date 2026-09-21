import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Bot,
  MessageSquare,
  Package,
  GitBranch,
  Megaphone,
  CreditCard,
  FolderLock,
  ChartNoAxesCombined,
  Settings,
  Building2,
  CalendarCheck,
  Plug,
  Plus,
  RefreshCw,
  LogOut,
  Menu,
  X,
  Download,
  Send,
  Sparkles,
  ShieldCheck,
  Images,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { ConnectedCRM } from './ConnectedCRM';
import './workspace.css';
import { ThemeToggle } from './ThemeToggle';
import { CreativeStudio } from './CreativeStudio';
type Row = Record<string, any>;
type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};
const tabs = [
  ['dashboard', 'Panel ejecutivo', LayoutDashboard],
  ['contacts', 'Leads CRM 360°', Users],
  ['knowledge', 'Conocimiento de cursos', FolderLock],
  ['agents', 'Agentes IA', Bot],
  ['chat', 'Chat Sales Studio', MessageSquare],
  ['products', 'Productos / Servicios', Package],
  ['funnels', 'Embudos & Workflows', GitBranch],
  ['marketing', 'IA Marketing & Ads', Megaphone],
  ['creative', 'Estudio creativo INTECA', Images],
  ['payments', 'Cobros & Comprobantes', CreditCard],
  ['paymentrequests', 'Solicitudes de pago', Send],
  ['paymentsettings', 'Medios de pago', CreditCard],
  ['documents', 'Bóveda de documentos', FolderLock],
  ['analytics', 'Analítica comercial', ChartNoAxesCombined],
  ['companies', 'Empresas cliente', Building2],
  ['activities', 'Seguimientos', CalendarCheck],
  ['settings', 'Multiempresa & Seguridad', Settings],
  ['connections', 'Integraciones', Plug],
  ['salespolicy', 'Vendedor IA & Web', Sparkles],
  ['license', 'Licencia & Plan', ShieldCheck],
] as const;
const empty = {
  agents: [],
  conversations: [],
  campaigns: [],
  payments: [],
  documents: [],
  workflows: [],
  contacts: [],
  products: [],
  deals: [],
  pipelines: [],
  activities: [],
  audit: [],
  connections: [],
} as Record<string, Row[]>;
const money = (v: unknown, c = 'DOP') =>
  `${c} ${Number(v || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleString('es-DO') : 'Sin fecha');
const status: Record<string, string> = {
  DRAFT: 'Borrador',
  AI_DRAFT: 'Borrador IA',
  MANUALLY_RECORDED: 'Registrado manualmente',
  ACCEPTED: 'Aceptado por proveedor',
  SENDING: 'Enviando',
  UNKNOWN: 'Verificar en proveedor',
  FAILED: 'Falló el envío',
  PENDING: 'Pendiente',
  COMPLETED: 'Cobro registrado',
  REFUNDED: 'Reembolso registrado',
  CANCELED: 'Cancelado',
  PAUSED: 'Sin verificar',
  CONNECTED: 'Actividad verificada',
  NOT_CONFIGURED: 'Sin configurar',
};
const intecaChannels = [
  ['Instagram INTECA', 'https://www.instagram.com/formacion.inteca/'],
  ['Facebook INTECA', 'https://www.facebook.com/profile.php?id=61577734884829'],
  [
    'Google Ads INTECA',
    'https://ads.google.com/aw/campaigns?ocid=8461661228&euid=6549250481&__u=9032363369&uscid=8461661228&__c=4760922572&authuser=0&workspaceId=0&subid=do-es-ha-awa-bk-c-lcg!o3~CjwKCAjwiL7VBhA-EiwAhZi9EKT81VLp7mG9mboktxZVaDN1iSqF84G4Hw0NqqRPVSYbAiZ-v4MoJhoCbhcQAvD_BwE~151942367446~aud-1026383325320:kwd-94527731~20529413226~807320573176',
  ],
] as const;
export function WorkspaceApp({ organizationId }: { organizationId: string }) {
  const [courseId, setCourseId] = useState(''),
    [course, setCourse] = useState<Row>({});
  const [methods, setMethods] = useState<Row>({ instructions: '', banks: [], gateways: [] });
  const [licence, setLicence] = useState<Row | null>(null),
    [licenseText, setLicenseText] = useState(''),
    [policy, setPolicy] = useState<Row>({
      website: '',
      businessContext: '',
      salesPlaybook:
        '1. Saluda y pregunta qué necesita el cliente. 2. Confirma su objetivo, presupuesto y plazo. 3. Recomienda solo productos del catálogo que encajen. 4. Explica el valor con datos verificables. 5. Ante una objeción, pregunta el motivo y responde con condiciones autorizadas. 6. Resume precio, moneda, alcance y condiciones. 7. Si acepta, ofrece el enlace autorizado de pago o deriva al equipo. Si no encaja, dilo sin presionar.',
      handoffEmail: '',
      checkoutUrl: '',
      dailyAiLimit: 30,
      enabled: false,
      autoPublishCampaigns: false,
      notifyAfterCampaignPublish: true,
    });
  const [theme, setTheme] = useState(() => localStorage.getItem('sales-ai-theme') || 'dark');
  const [tab, setTab] = useState('dashboard'),
    [data, setData] = useState(empty),
    [org, setOrg] = useState<Row>({}),
    [me, setMe] = useState<Row>({}),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false);
  const [editor, setEditor] = useState<{ kind: string; row?: Row } | null>(null),
    [form, setForm] = useState<Row>({}),
    [thread, setThread] = useState(''),
    [draft, setDraft] = useState(''),
    [agentId, setAgentId] = useState(''),
    [aiOutput, setAiOutput] = useState(''),
    [aiPrompt, setAiPrompt] = useState(''),
    [paymentPreview, setPaymentPreview] = useState<Row | null>(null);
  const request = useCallback(
    <T,>(path: string, init: RequestInit = {}) => apiRequest<T>(path, init, organizationId),
    [organizationId],
  );
  const can = (permission: string) => me.role === 'OWNER' || me.permissions?.includes(permission);
  const load = useCallback(async () => {
    const user = await request<Row>('/api/auth/me');
    setMe(user);
    const organization = await request<Row>('/api/platform/organization');
    setOrg(organization.organization);
    setLicence((await request<Row>('/api/workspace/license')).license);
    if (user.role === 'OWNER' || user.permissions.includes('settings.manage')) {
      const result = await request<Row>('/api/workspace/sales-policy');
      if (result.settings) setPolicy(result.settings);
    }
    const paths: Record<string, string> = {
      agents: '/api/workspace/agents',
      conversations: '/api/workspace/conversations',
      campaigns: '/api/workspace/campaigns',
      documents: '/api/workspace/documents',
      channelEvents: '/api/workspace/channel-events',
      workflows: '/api/workspace/workflows',
      products: '/api/crm/products',
      deals: '/api/crm/deals',
      pipelines: '/api/crm/pipelines',
      activities: '/api/operations/activities',
    };
    if (user.role === 'OWNER' || user.permissions.includes('payments.read')) {
      paths.payments = '/api/workspace/payments';
      paths.paymentrequests = '/api/workspace/payment-requests';
      setMethods((await request<Row>('/api/workspace/payment-methods')).settings);
    }
    if (user.role === 'OWNER' || user.permissions.includes('settings.manage')) {
      paths.audit = '/api/operations/audit';
      paths.connections = '/api/workspace/connections';
    }
    const values = await Promise.all(
      Object.entries(paths).map(async ([k, url]) => [k, (await request<Row>(url)).items]),
    );
    const contacts: Row[] = [];
    for (let page = 1; ; page++) {
      const result = await request<Row>(`/api/crm/contacts?pageSize=100&page=${page}`);
      contacts.push(...result.items);
      if (contacts.length >= result.pagination.total || !result.items.length) break;
    }
    setData({ ...empty, ...Object.fromEntries(values), contacts });
  }, [request]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      void load().catch((e) => {
        if (alive) setError(e.message);
      });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [load, tab]);
  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se completó la operación');
    } finally {
      setBusy(false);
    }
  };
  const change = (next: string) => {
    setTab(next);
    setMobile(false);
    setError('');
    setNotice('');
    setAiOutput('');
  };
  const choices = (items: Row[], label: (r: Row) => string) =>
    items.map((r) => ({ value: r.id, label: label(r) }));
  const fields = (kind: string): Field[] => {
    if (kind === 'agents')
      return [
        { key: 'name', label: 'Nombre del agente', required: true },
        { key: 'role', label: 'Especialidad', required: true },
        {
          key: 'systemPrompt',
          label: 'Instrucciones y límites del agente',
          type: 'textarea',
          required: true,
        },
        { key: 'active', label: 'Habilitado para consultas', type: 'checkbox' },
      ];
    if (kind === 'conversations')
      return [
        {
          key: 'contactId',
          label: 'Contacto',
          required: true,
          options: choices(data.contacts, (r) => `${r.firstName} ${r.lastName || ''}`),
        },
        {
          key: 'channel',
          label: 'Origen del registro',
          options: ['MANUAL', 'EMAIL', 'WHATSAPP'].map((v) => ({ value: v, label: v })),
        },
      ];
    if (kind === 'campaigns')
      return [
        { key: 'name', label: 'Nombre de campaña', required: true },
        {
          key: 'channel',
          label: 'Canal previsto',
          options: ['EMAIL', 'WHATSAPP', 'SMS', 'META', 'GOOGLE_ADS'].map((v) => ({
            value: v,
            label: v.replace('_', ' '),
          })),
        },
        { key: 'objective', label: 'Objetivo comercial', required: true },
        { key: 'audience', label: 'Audiencia autorizada', type: 'textarea', required: true },
        {
          key: 'content',
          label: 'Texto o instrucciones del anuncio',
          type: 'textarea',
          required: true,
        },
        {
          key: 'budgetAmount',
          label: 'Presupuesto máximo autorizado',
          type: 'number',
          required: true,
        },
        { key: 'budgetCurrency', label: 'Moneda', required: true },
        {
          key: 'autoPublish',
          label: 'Publicar automáticamente al conectar el proveedor',
          type: 'checkbox',
        },
        { key: 'scheduledAt', label: 'Fecha prevista', type: 'datetime-local' },
      ];
    if (kind === 'payment-requests')
      return [
        {
          key: 'contactId',
          label: 'Contacto',
          options: [
            { value: '', label: 'Sin asignar' },
            ...choices(data.contacts, (r) => r.firstName + ' ' + (r.lastName || '')),
          ],
        },
        { key: 'description', label: 'Concepto de pago', required: true },
        { key: 'amount', label: 'Importe solicitado', type: 'number', required: true },
        { key: 'currency', label: 'Moneda', required: true },
        { key: 'days', label: 'Validez en días (1 a 90)', type: 'number', required: true },
      ];
    if (kind === 'payments')
      return [
        {
          key: 'contactId',
          label: 'Contacto',
          options: [
            { value: '', label: 'Sin asignar' },
            ...choices(data.contacts, (r) => r.firstName + ' ' + (r.lastName || '')),
          ],
        },
        { key: 'amount', label: 'Importe', type: 'number', required: true },
        { key: 'currency', label: 'Moneda (DOP / USD)', required: true },
        { key: 'reference', label: 'Concepto o referencia', required: true },
        {
          key: 'method',
          label: 'Método registrado',
          options: [
            { value: 'CASH', label: 'Efectivo' },
            { value: 'TRANSFER', label: 'Transferencia' },
            { value: 'CARD_EXTERNAL', label: 'Tarjeta procesada externamente' },
          ],
        },
        {
          key: 'status',
          label: 'Estado',
          options: [
            { value: 'PENDING', label: 'Pendiente de cobro' },
            { value: 'COMPLETED', label: 'Ya cobrado' },
          ],
        },
      ];
    if (kind === 'workflows')
      return [
        { key: 'name', label: 'Nombre de la regla', required: true },
        { key: 'title', label: 'Título del seguimiento automático', required: true },
        {
          key: 'delayHours',
          label: 'Horas después de crear el contacto',
          type: 'number',
          required: true,
        },
        { key: 'active', label: 'Activar para nuevos contactos', type: 'checkbox' },
      ];
    if (kind === 'GEMINI')
      return [
        { key: 'apiKey', label: 'Clave privada de Gemini', type: 'password', required: true },
        { key: 'model', label: 'Modelo disponible en tu cuenta', required: true },
      ];
    if (['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(kind))
      return [
        {
          key: 'accessToken',
          label: 'Token de acceso autorizado',
          type: 'password',
          required: true,
        },
        { key: 'appSecret', label: 'Secreto de la app de Meta', type: 'password', required: true },
        {
          key: 'verifyToken',
          label: 'Token propio de verificación (mínimo 16 caracteres)',
          type: 'password',
          required: true,
        },
        {
          key: 'accountId',
          label:
            kind === 'WHATSAPP'
              ? 'ID del número en Meta (no el teléfono)'
              : 'ID de la cuenta empresarial o página',
          required: true,
        },
        {
          key: 'apiVersion',
          label: 'Versión de Graph API de tu aplicación (vNN.0)',
          required: true,
        },
        {
          key: 'agentId',
          label: 'Agente que atenderá el canal',
          options: [
            { value: '', label: 'Seleccionar agente' },
            ...choices(
              data.agents.filter((a) => a.active),
              (r) => r.name,
            ),
          ],
        },
        {
          key: 'autoReply',
          label: 'Autorizar respuestas automáticas a mensajes entrantes',
          type: 'checkbox',
        },
      ];
    if (kind === 'RESEND')
      return [
        { key: 'apiKey', label: 'Clave privada de Resend', type: 'password', required: true },
        { key: 'from', label: 'Correo remitente verificado', type: 'email', required: true },
      ];
    return [];
  };
  const open = (kind: string, row?: Row) => {
    setEditor({ kind, row });
    setError('');
    setForm(
      row
        ? {
            ...row,
            ...(kind === 'campaigns'
              ? {
                  audience: row.audience.description,
                  objective: row.audience.objective || '',
                  content: row.content.text,
                  budgetAmount: row.content.budgetAmount || 0,
                  budgetCurrency: row.content.budgetCurrency || org.currency || 'DOP',
                  autoPublish: !!row.content.autoPublish,
                  scheduledAt: row.scheduledAt
                    ? new Date(
                        new Date(row.scheduledAt).getTime() -
                          new Date(row.scheduledAt).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : '',
                }
              : {}),
          }
        : {
            days: 7,
            active: true,
            currency: org.currency || 'DOP',
            budgetCurrency: org.currency || 'DOP',
            budgetAmount: 0,
            autoPublish: kind === 'campaigns',
            method: 'TRANSFER',
            status: 'PENDING',
            channel: kind === 'campaigns' ? 'META' : 'MANUAL',
            delayHours: 24,
            contactId: kind === 'conversations' ? data.contacts[0]?.id : '',
            idempotencyKey: crypto.randomUUID(),
          },
    );
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    await act(async () => {
      const body: Row = {};
      for (const f of fields(editor.kind))
        body[f.key] =
          f.type === 'checkbox'
            ? !!form[f.key]
            : f.type === 'number'
              ? Number(form[f.key])
              : form[f.key] || '';
      if (editor.kind === 'campaigns') {
        body.audience = { description: body.audience, objective: body.objective };
        body.content = {
          text: body.content,
          budgetAmount: body.budgetAmount,
          budgetCurrency: String(body.budgetCurrency).toUpperCase(),
          autoPublish: body.autoPublish,
        };
        delete body.objective;
        delete body.budgetAmount;
        delete body.budgetCurrency;
        delete body.autoPublish;
        body.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt).toISOString() : null;
      }
      if (editor.kind === 'payment-requests') {
        if (!body.contactId) delete body.contactId;
        body.currency = String(body.currency).toUpperCase();
      }
      if (editor.kind === 'payments') {
        if (!body.contactId) delete body.contactId;
        body.currency = String(body.currency).toUpperCase();
        body.idempotencyKey = form.idempotencyKey;
      }
      const connection = ['GEMINI', 'RESEND', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(
        editor.kind,
      );
      const result = await request<Row>(
        '/api/workspace/' +
          (connection ? 'connections/' : '') +
          editor.kind +
          (editor.row ? '/' + editor.row.id : ''),
        { method: connection ? 'PUT' : editor.row ? 'PATCH' : 'POST', body: JSON.stringify(body) },
      );
      if (editor.kind === 'conversations') setThread(result.item.id);
      setEditor(null);
      setForm({});
      setNotice(
        connection
          ? 'Credenciales guardadas. Se verificarán al utilizar el proveedor.'
          : 'Guardado correctamente.',
      );
      await load();
    });
  };
  const selected = data.conversations.find((c) => c.id === thread);
  const generate = () =>
    act(async () => {
      const result = await request<Row>('/api/workspace/ai', {
        method: 'POST',
        body: JSON.stringify({
          prompt: aiPrompt || draft,
          agentId: agentId || undefined,
          conversationId: tab === 'chat' ? thread || undefined : undefined,
          purpose: tab === 'marketing' ? 'marketing' : tab === 'analytics' ? 'analysis' : 'chat',
        }),
      });
      setAiOutput(result.content);
      await load();
    });
  const upload = (file: File) =>
    act(async () => {
      if (file.size > 5 * 1024 * 1024) throw Error('El archivo supera 5 MB.');
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(Error('No se pudo leer'));
        r.readAsDataURL(file);
      });
      await request('/api/workspace/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'text/plain'),
          base64,
        }),
      });
      setNotice('Archivo guardado en la base de datos.');
      await load();
    });
  const download = (doc: Row) =>
    act(async () => {
      const response = await fetch('/api/workspace/documents/' + doc.id + '/download', {
        headers: { 'X-Organization-Id': organizationId },
        credentials: 'include',
      });
      if (!response.ok) throw Error('No se pudo descargar');
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  const core = ['contacts', 'products', 'companies', 'activities', 'settings', 'deals'].includes(
    tab,
  );
  const won = data.deals.filter((d) => d.status === 'WON'),
    closed = data.deals.filter((d) => d.status !== 'OPEN');
  const conversion = closed.length
    ? `${((won.length / closed.length) * 100).toFixed(1)}%`
    : 'Sin ventas cerradas';
  const aiPanel = (
    <section className="panel">
      <h2>
        <Sparkles size={18} />
        Asistente de{' '}
        {tab === 'marketing' ? 'contenido' : tab === 'analytics' ? 'análisis' : 'ventas'}
      </h2>
      <p className="muted">
        Genera una propuesta con Gemini y revísala antes de utilizarla. Requiere tu conexión de IA.
      </p>
      <label>
        Agente
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Asistente general</option>
          {data.agents
            .filter((a) => a.active)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Solicitud
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Describe lo que necesitas y las condiciones autorizadas"
        />
      </label>
      <button
        className="primary"
        disabled={busy || !aiPrompt.trim() || !can('ai.use')}
        onClick={() => void generate()}
      >
        <Sparkles size={16} />
        Generar borrador
      </button>
      {aiOutput && (
        <div className="ai-output">
          <span className="badge">Generado por IA · revisar</span>
          <p>{aiOutput}</p>
          <button
            onClick={() =>
              void act(async () => {
                await navigator.clipboard.writeText(aiOutput);
                setNotice('Texto copiado.');
              })
            }
          >
            Copiar texto
          </button>
          {tab === 'marketing' && can('crm.write') && (
            <button
              onClick={() => {
                open('campaigns');
                setForm((f) => ({ ...f, content: aiOutput }));
              }}
            >
              Guardar como campaña
            </button>
          )}
        </div>
      )}
    </section>
  );
  return (
    <div className="workspace" data-theme={theme}>
      <aside className={'workspace-nav ' + (mobile ? 'is-open' : '')}>
        <div className="brand">
          <img src="/logo-wide.png" alt="Sales AI CRM" />
        </div>
        <p className="nav-label">TU EMPRESA</p>
        <nav>
          {tabs.map(([key, label, Icon]) => (
            <button key={key} className={tab === key ? 'selected' : ''} onClick={() => change(key)}>
              <Icon size={18} />
              {label}
              {key === 'contacts' && <span>{data.contacts.length}</span>}
            </button>
          ))}
        </nav>
        <div className="nav-foot">
          <ShieldCheck size={16} />
          Cuenta real<small>{org.name || 'Cargando empresa…'}</small>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-header">
          <button className="mobile-toggle" aria-label="Menú" onClick={() => setMobile(!mobile)}>
            <Menu />
          </button>
          <div>
            <strong>{org.name || 'Sales AI CRM'}</strong>
            <small>
              {me.user?.name} · {me.role === 'OWNER' ? 'Propietario' : me.role}
            </small>
          </div>
          <span className="badge success">Datos de tu empresa</span>
          <ThemeToggle onChange={setTheme} />
          <button
            onClick={() =>
              void act(async () => {
                await request('/api/auth/logout', { method: 'POST' });
                sessionStorage.removeItem('sales-ai-org');
                location.reload();
              })
            }
          >
            <LogOut size={16} />
            Salir
          </button>
        </header>
        <div className="workspace-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">INTELIGENCIA COMERCIAL</p>
              <h1>{tabs.find((t) => t[0] === tab)?.[1] || 'Oportunidades'}</h1>
            </div>
            <button disabled={busy} onClick={() => void act(load)}>
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {busy && (
            <p role="status" className="muted">
              Procesando…
            </p>
          )}
          {!licence && (
            <div className="notice">
              Cuenta en modo consulta. Activa una licencia para guardar cambios. INTECA tiene
              licencia gratuita permanente.{' '}
              <button onClick={() => change('license')}>Licencia & Plan</button>
            </div>
          )}
          {core ? (
            <div className="core-embedded">
              <ConnectedCRM key={tab} organizationId={organizationId} initialTab={tab as any} />
            </div>
          ) : null}
          {tab === 'dashboard' && (
            <>
              <section className="hero">
                <div>
                  <span className="badge">TU CENTRO DE OPERACIONES</span>
                  <h2>Una vista clara de tus ventas.</h2>
                  <p>
                    Clientes, equipo y próximos pasos, conectados con los registros de{' '}
                    {org.name || 'tu empresa'}.
                  </p>
                </div>
                <button className="primary" onClick={() => change('chat')}>
                  Abrir Chat Sales Studio
                </button>
              </section>
              <div className="metrics">
                {[
                  ['Prospectos registrados', data.contacts.length],
                  ['Oportunidades abiertas', data.deals.filter((d) => d.status === 'OPEN').length],
                  ['Conversión de cierres', conversion],
                  [
                    'Seguimientos pendientes',
                    data.activities.filter((a) => !a.completedAt && a.type !== 'NOTE').length,
                  ],
                ].map(([label, value]) => (
                  <section className="panel metric" key={label}>
                    <p>{label}</p>
                    <strong>{value}</strong>
                  </section>
                ))}
              </div>
              <div className="two-col">
                <section className="panel">
                  <h2>
                    <Bot size={18} />
                    Tu equipo de agentes
                  </h2>
                  {!data.agents.length ? (
                    <Empty text="Configura el primer agente con las instrucciones de tu negocio." />
                  ) : (
                    data.agents.slice(0, 5).map((a) => (
                      <div className="list-row" key={a.id}>
                        <div className="avatar">{a.name.slice(0, 1)}</div>
                        <div>
                          <strong>{a.name}</strong>
                          <small>{a.role}</small>
                        </div>
                        <span className="badge">{a.active ? 'Habilitado' : 'Pausado'}</span>
                      </div>
                    ))
                  )}
                  <button onClick={() => change('agents')}>Administrar agentes</button>
                </section>
                <section className="panel">
                  <h2>
                    <CalendarCheck size={18} />
                    Próximos seguimientos
                  </h2>
                  {data.activities
                    .filter((a) => !a.completedAt && a.dueAt)
                    .slice(0, 6)
                    .map((a) => (
                      <div className="list-row" key={a.id}>
                        <div>
                          <strong>{a.title}</strong>
                          <small>{date(a.dueAt)}</small>
                        </div>
                        <span className="badge">
                          {new Date(a.dueAt) < new Date() ? 'Vencido' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  {!data.activities.length && (
                    <Empty text="Programa el siguiente paso de cada oportunidad." />
                  )}
                  <button onClick={() => change('activities')}>Ver seguimientos</button>
                </section>
              </div>
              <section className="panel">
                <h2>Actividad registrada</h2>
                {data.audit.slice(0, 8).map((a) => (
                  <div className="list-row" key={a.id}>
                    <span>{a.action}</span>
                    <small>{date(a.createdAt)}</small>
                  </div>
                ))}
                {!data.audit.length && (
                  <Empty text="Aquí aparecerán las operaciones disponibles para tu rol." />
                )}
              </section>
            </>
          )}
          {tab === 'knowledge' && (
            <section className="panel">
              <h2>Información autorizada para todos los agentes</h2>
              <p>
                Selecciona un curso del catálogo. Guarda su ficha y apruébala cuando hayas
                comprobado los datos. Se comparte con el chat, el asistente web y los canales
                sociales. Los datos vacíos, pendientes o vencidos se tratan como información por
                confirmar.
              </p>
              <label>
                Curso / producto
                <select
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setCourse(
                      data.products.find((p) => p.id === e.target.value)?.metadata
                        ?.courseKnowledge || {},
                    );
                  }}
                >
                  <option value="">Selecciona un curso</option>
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {courseId && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(async () => {
                      const body: Row = {};
                      for (const k of [
                        'modules',
                        'syllabus',
                        'duration',
                        'schedule',
                        'modality',
                        'requirements',
                        'fees',
                        'accreditations',
                        'certificate',
                        'policies',
                        'sources',
                      ])
                        body[k] = course[k] || '';
                      body.approved = !!course.approved;
                      body.validUntil = course.validUntil
                        ? new Date(course.validUntil).toISOString()
                        : null;
                      await request('/api/workspace/course-knowledge/' + courseId, {
                        method: 'PUT',
                        body: JSON.stringify(body),
                      });
                      setNotice(
                        'Ficha guardada. Los agentes usarán la versión aprobada en sus próximas respuestas.',
                      );
                      await load();
                    });
                  }}
                >
                  <p>
                    Precio base:{' '}
                    {money(
                      data.products.find((p) => p.id === courseId)?.price,
                      data.products.find((p) => p.id === courseId)?.currency,
                    )}
                    . Modifícalo en Productos / Servicios.
                  </p>
                  {[
                    ['modules', 'Módulos y temas'],
                    ['syllabus', 'Pénsum completo'],
                    ['duration', 'Duración y carga horaria'],
                    ['schedule', 'Horarios, fechas de inicio y zona horaria'],
                    ['modality', 'Modalidad y lugar'],
                    ['requirements', 'Requisitos y público dirigido'],
                    ['fees', 'Precio total, inscripción, cuotas y condiciones'],
                    ['accreditations', 'Avales otorgados: entidad, alcance y vigencia'],
                    ['certificate', 'Certificación que recibe el estudiante'],
                    ['policies', 'Políticas, descuentos autorizados y preguntas frecuentes'],
                    ['sources', 'Fuentes, documentos y fecha de verificación'],
                  ].map(([k, label]) => (
                    <label key={k}>
                      {label}
                      <textarea
                        value={course[k] || ''}
                        onChange={(e) => setCourse({ ...course, [k]: e.target.value })}
                      />
                    </label>
                  ))}
                  <label>
                    Vigente hasta (opcional)
                    <input
                      type="date"
                      value={(course.validUntil || '').slice(0, 10)}
                      onChange={(e) =>
                        setCourse({
                          ...course,
                          validUntil: e.target.value ? e.target.value + 'T23:59:59.999Z' : '',
                        })
                      }
                    />
                  </label>
                  {can('settings.manage') && (
                    <label>
                      <input
                        type="checkbox"
                        checked={!!course.approved}
                        onChange={(e) => setCourse({ ...course, approved: e.target.checked })}
                      />
                      He verificado esta ficha y autorizo su uso por los agentes
                    </label>
                  )}
                  <button className="primary" disabled={busy || !can('crm.write')}>
                    Guardar ficha
                  </button>
                </form>
              )}
            </section>
          )}
          {tab === 'agents' && (
            <>
              <section className="panel">
                <h2>Funciones comerciales establecidas</h2>
                <p>
                  El equipo está instruido para prospectar y captar clientes, fortalecer relaciones,
                  presentar productos, detectar necesidades, negociar dentro de las políticas, dar
                  seguimiento hasta cierre, cumplir metas, mantener actualizado el CRM y coordinar
                  con las áreas internas.
                </p>
                <p className="muted">
                  Los agentes preparan o registran acciones dentro de las funciones disponibles.
                  Nunca deben afirmar que contactaron, publicaron, negociaron o actualizaron datos
                  si el sistema o el proveedor no lo confirma. Las campañas comerciales autorizadas
                  pueden publicarse y deben notificarte después; las noticias, testimonios y cambios
                  institucionales requieren tu aprobación previa.
                </p>
              </section>
              <Toolbar
                text="Agentes con instrucciones propias. Las consultas se ejecutan al solicitarlas."
                action={can('settings.manage') ? () => open('agents') : undefined}
                label="Crear agente"
              />
              <div className="cards">
                {data.agents.map((a) => (
                  <section className="panel" key={a.id}>
                    <div className="avatar">
                      <Bot />
                    </div>
                    <h2>{a.name}</h2>
                    <span className="badge">{a.role}</span>
                    <p className="pre">{a.systemPrompt}</p>
                    <p>{a.active ? 'Habilitado para consultas' : 'Pausado'}</p>
                    {can('settings.manage') && (
                      <button onClick={() => open('agents', a)}>Editar agente</button>
                    )}
                  </section>
                ))}
              </div>
              {!data.agents.length && (
                <Empty text="No hay agentes ficticios. Crea los especialistas que necesita tu empresa." />
              )}
              {aiPanel}
            </>
          )}
          {tab === 'chat' && (
            <>
              <Toolbar
                text="Historial persistente. Registra conversaciones y prepara respuestas; enviar un correo requiere confirmación."
                action={can('crm.write') ? () => open('conversations') : undefined}
                label="Nueva conversación"
              />
              <div className="chat-grid">
                <section className="panel thread-list">
                  {data.conversations.map((c) => (
                    <button
                      key={c.id}
                      className={thread === c.id ? 'selected' : ''}
                      onClick={() => {
                        setThread(c.id);
                        setAiOutput('');
                      }}
                    >
                      <strong>
                        {c.contact?.firstName || 'Contacto eliminado'} {c.contact?.lastName}
                      </strong>
                      <small>
                        {c.channel} · {c.messages.length} mensajes
                      </small>
                    </button>
                  ))}
                  {!data.conversations.length && (
                    <Empty text="Crea un contacto y abre su conversación." />
                  )}
                </section>
                <section className="panel">
                  <h2>
                    {selected
                      ? `${selected.contact?.firstName || 'Conversación'} · ${selected.channel}`
                      : 'Selecciona una conversación'}
                  </h2>
                  {selected && can('crm.write') && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await request('/api/workspace/conversations/' + selected.id + '/mode', {
                            method: 'PATCH',
                            body: JSON.stringify({
                              status: selected.status === 'HUMAN' ? 'OPEN' : 'HUMAN',
                            }),
                          });
                          await load();
                        })
                      }
                    >
                      {selected.status === 'HUMAN'
                        ? 'Permitir agente automático'
                        : 'Tomar conversación · pausar IA'}
                    </button>
                  )}
                  <div className="messages">
                    {selected?.messages.map((m: Row) => (
                      <article
                        key={m.id}
                        className={'message ' + (m.direction === 'OUTBOUND' ? 'outbound' : '')}
                      >
                        <span className="badge">{status[m.status] || m.status}</span>
                        <p>{m.content}</p>
                        <small>{date(m.createdAt)}</small>
                        {m.direction === 'OUTBOUND' &&
                          ['DRAFT', 'AI_DRAFT'].includes(m.status) &&
                          can('crm.write') && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                const subject = window.prompt('Asunto del correo');
                                if (!subject) return;
                                if (
                                  !window.confirm(
                                    `Enviar este texto a ${selected.contact?.email || 'contacto sin correo'} mediante Resend?`,
                                  )
                                )
                                  return;
                                void act(async () => {
                                  const r = await request<Row>(
                                    '/api/workspace/messages/' + m.id + '/send-email',
                                    {
                                      method: 'POST',
                                      body: JSON.stringify({ subject, confirm: true }),
                                    },
                                  );
                                  setNotice(r.notice);
                                  await load();
                                });
                              }}
                            >
                              <Send size={14} />
                              Enviar por correo
                            </button>
                          )}
                      </article>
                    ))}
                  </div>
                  {selected && can('crm.write') && (
                    <>
                      <label>
                        Mensaje
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Escribe un mensaje recibido o un borrador de respuesta"
                        />
                      </label>
                      <div className="actions">
                        {[
                          ['INBOUND', 'Registrar recibido'],
                          ['OUTBOUND', 'Guardar borrador'],
                        ].map(([direction, label]) => (
                          <button
                            key={direction}
                            disabled={busy || !draft.trim()}
                            onClick={() =>
                              void act(async () => {
                                await request(
                                  '/api/workspace/conversations/' + thread + '/messages',
                                  {
                                    method: 'POST',
                                    body: JSON.stringify({ content: draft, direction }),
                                  },
                                );
                                setDraft('');
                                await load();
                              })
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </div>
              {selected && aiPanel}
            </>
          )}
          {tab === 'chat' &&
            selected &&
            ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(selected.channel) && (
              <section className="panel">
                <h2>Enviar al canal conectado</h2>
                <p>
                  Los borradores no se envían hasta confirmarlos. La IA automática se configura por
                  canal en Integraciones.
                </p>
                {can('crm.write') &&
                  selected.messages
                    .filter((m: Row) => ['DRAFT', 'AI_DRAFT'].includes(m.status))
                    .map((m: Row) => (
                      <div className="list-row" key={m.id}>
                        <p>{m.content}</p>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                '¿Enviar este mensaje al cliente por ' + selected.channel + '?',
                              )
                            )
                              void act(async () => {
                                await request('/api/workspace/messages/' + m.id + '/send-social', {
                                  method: 'POST',
                                  body: JSON.stringify({ confirm: true }),
                                });
                                await load();
                              });
                          }}
                        >
                          Enviar al cliente
                        </button>
                      </div>
                    ))}
              </section>
            )}
          {tab === 'chat' && (
            <section className="panel">
              <h2>Recepción y respuestas de canales</h2>
              {(data.channelEvents || []).slice(0, 20).map((e) => (
                <div className="list-row" key={e.id}>
                  <span>
                    {e.provider} ·{' '}
                    {e.status === 'NEEDS_HUMAN'
                      ? 'Requiere atención humana'
                      : status[e.status] || e.status}
                  </span>
                  <small>{e.error || date(e.createdAt)}</small>
                </div>
              ))}
            </section>
          )}
          {tab === 'funnels' && (
            <>
              <Toolbar
                text="Etapas reales de tus oportunidades y reglas de seguimiento."
                action={() => change('deals')}
                label="Gestionar oportunidades"
              />
              {data.pipelines.map((p) => (
                <section className="panel" key={p.id}>
                  <h2>{p.name}</h2>
                  <div className="kanban">
                    {p.stages.map((s: Row) => (
                      <div className="stage" key={s.id}>
                        <h3>
                          {s.name}
                          <span>{data.deals.filter((d) => d.stageId === s.id).length}</span>
                        </h3>
                        {data.deals
                          .filter((d) => d.stageId === s.id)
                          .map((d) => (
                            <article key={d.id}>
                              <strong>{d.title}</strong>
                              <p>{money(d.value, d.currency)}</p>
                              <small>
                                {d.status === 'WON'
                                  ? 'Ganado'
                                  : d.status === 'LOST'
                                    ? 'Perdido'
                                    : 'Abierto'}
                              </small>
                              <select
                                aria-label={'Etapa de ' + d.title}
                                disabled={!can('crm.write') || busy}
                                value={d.stageId}
                                onChange={(e) =>
                                  void act(async () => {
                                    await request('/api/operations/deals/' + d.id, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ stageId: e.target.value }),
                                    });
                                    await load();
                                  })
                                }
                              >
                                {p.stages.map((o: Row) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name}
                                  </option>
                                ))}
                              </select>
                            </article>
                          ))}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              <Toolbar
                text="Cuando se crea un contacto, la regla activa crea un seguimiento con fecha. No envía mensajes."
                action={can('settings.manage') ? () => open('workflows') : undefined}
                label="Crear automatización"
              />
              {data.workflows.map((w) => (
                <section className="panel list-row" key={w.id}>
                  <div>
                    <strong>{w.name}</strong>
                    <small>
                      {w.actions.title} · en {w.actions.delayHours} horas
                    </small>
                  </div>
                  {can('settings.manage') && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await request('/api/workspace/workflows/' + w.id, {
                            method: 'PATCH',
                            body: JSON.stringify({ active: !w.active }),
                          });
                          await load();
                        })
                      }
                    >
                      {w.active ? 'Pausar' : 'Activar'}
                    </button>
                  )}
                </section>
              ))}
            </>
          )}
          {tab === 'marketing' && (
            <>
              <Toolbar
                text="INTECA autoriza la publicación automática de campañas comerciales solo cuando el canal oficial y el presupuesto estén configurados. Después se notificará al propietario."
                action={can('crm.write') ? () => open('campaigns') : undefined}
                label="Crear campaña"
              />
              <div className="cards">
                {data.campaigns.map((c) => (
                  <section className="panel" key={c.id}>
                    <span className="badge">
                      {String(c.channel).replace('_', ' ')} ·{' '}
                      {c.status === 'PUBLISHED'
                        ? 'Publicada'
                        : c.status === 'FAILED'
                          ? 'Falló'
                          : 'Borrador'}
                    </span>
                    <h2>{c.name}</h2>
                    <small>
                      Objetivo: {c.audience.objective || 'Sin definir'} · Audiencia:{' '}
                      {c.audience.description}
                    </small>
                    <p className="pre">{c.content.text}</p>
                    <small>
                      Presupuesto máximo:{' '}
                      {money(c.content.budgetAmount, c.content.budgetCurrency || org.currency)} ·{' '}
                      {c.content.autoPublish
                        ? 'Publicación automática autorizada'
                        : 'Publicación manual'}
                    </small>
                    <small>Fecha prevista: {date(c.scheduledAt)}</small>
                    {can('crm.write') && (
                      <button onClick={() => open('campaigns', c)}>Editar campaña</button>
                    )}
                  </section>
                ))}
              </div>
              {aiPanel}
            </>
          )}
          {tab === 'creative' && (
            <CreativeStudio
              organizationId={organizationId}
              agents={data.agents}
              canManage={can('settings.manage')}
            />
          )}
          {tab === 'payments' && (
            <>
              <Toolbar
                text="Control de cobros registrados por tu equipo. Los comprobantes son internos, no facturas fiscales."
                action={can('payments.manage') ? () => open('payments') : undefined}
                label="Registrar cobro"
              />
              {!can('payments.read') ? (
                <Empty text="Tu rol no permite consultar cobros." />
              ) : (
                <section className="panel table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente / referencia</th>
                        <th>Importe</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p) => (
                        <tr key={p.id}>
                          <td>
                            {p.contact?.firstName || 'Sin contacto'}
                            <small>{p.metadata.reference}</small>
                          </td>
                          <td>{money(p.amount, p.currency)}</td>
                          <td>{status[p.status]}</td>
                          <td>
                            <button onClick={() => setPaymentPreview(p)}>Comprobante</button>
                            {can('payments.manage') &&
                              ['PENDING', 'COMPLETED'].includes(p.status) && (
                                <button
                                  disabled={busy}
                                  onClick={() => {
                                    const next = p.status === 'PENDING' ? 'COMPLETED' : 'REFUNDED';
                                    if (
                                      !window.confirm(
                                        next === 'COMPLETED'
                                          ? '¿Confirmas que recibiste este dinero?'
                                          : '¿Confirmas que devolviste este dinero externamente?',
                                      )
                                    )
                                      return;
                                    void act(async () => {
                                      await request('/api/workspace/payments/' + p.id, {
                                        method: 'PATCH',
                                        body: JSON.stringify({ status: next }),
                                      });
                                      await load();
                                    });
                                  }}
                                >
                                  {p.status === 'PENDING'
                                    ? 'Confirmar cobro'
                                    : 'Registrar reembolso'}
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.payments.length && <Empty text="Todavía no hay cobros registrados." />}
                </section>
              )}
              <section className="panel">
                <h2>Pagos de clientes</h2>
                <p>
                  Configura tus plataformas y cuentas bancarias, crea una solicitud y revisa el
                  comprobante enviado por el cliente. Las tarjetas se procesan en la página de la
                  plataforma elegida.
                </p>
                <div className="actions">
                  <button onClick={() => change('paymentsettings')}>
                    Configurar medios de pago
                  </button>
                  <button onClick={() => change('paymentrequests')}>
                    Solicitudes y comprobantes
                  </button>
                </div>
              </section>
            </>
          )}

          {tab === 'paymentsettings' &&
            (can('settings.manage') ? (
              <section className="panel">
                <h2>Medios de pago visibles para tus clientes</h2>
                <p className="muted">
                  Añade enlaces HTTPS de pago de tus plataformas y cuentas para depósitos o
                  transferencias. No introduzcas claves bancarias ni números de tarjeta.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(async () => {
                      await request('/api/workspace/payment-methods', {
                        method: 'PUT',
                        body: JSON.stringify(methods),
                      });
                      setNotice(
                        'Medios de pago guardados. Se mostrarán en las solicitudes de pago.',
                      );
                    });
                  }}
                >
                  <label>
                    Instrucciones para el cliente
                    <textarea
                      value={methods.instructions}
                      onChange={(e) => setMethods({ ...methods, instructions: e.target.value })}
                    />
                  </label>
                  <h2>Plataformas de pago con tarjeta</h2>
                  {methods.gateways.map((g: Row, i: number) => (
                    <div className="panel" key={i}>
                      <label>
                        Nombre de plataforma
                        <input
                          required
                          aria-label={'Plataforma ' + (i + 1)}
                          value={g.name}
                          onChange={(e) =>
                            setMethods({
                              ...methods,
                              gateways: methods.gateways.map((x: Row, j: number) =>
                                j === i ? { ...x, name: e.target.value } : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Enlace HTTPS de pago
                        <input
                          required
                          type="url"
                          aria-label={'Enlace de pago ' + (i + 1)}
                          value={g.url}
                          onChange={(e) =>
                            setMethods({
                              ...methods,
                              gateways: methods.gateways.map((x: Row, j: number) =>
                                j === i ? { ...x, url: e.target.value } : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setMethods({
                            ...methods,
                            gateways: methods.gateways.filter((_: Row, j: number) => i !== j),
                          })
                        }
                      >
                        Quitar plataforma
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setMethods({
                        ...methods,
                        gateways: [...methods.gateways, { name: '', url: '' }],
                      })
                    }
                  >
                    Agregar plataforma
                  </button>
                  <h2 className="section-gap">Cuentas bancarias</h2>
                  {methods.banks.map((b: Row, i: number) => (
                    <div className="panel" key={i}>
                      {[
                        ['bank', 'Banco'],
                        ['holder', 'Titular'],
                        ['account', 'Número de cuenta'],
                        ['accountType', 'Tipo de cuenta'],
                        ['currency', 'Moneda'],
                      ].map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            required
                            aria-label={label + ' ' + (i + 1)}
                            value={b[key]}
                            onChange={(e) =>
                              setMethods({
                                ...methods,
                                banks: methods.banks.map((x: Row, j: number) =>
                                  j === i
                                    ? {
                                        ...x,
                                        [key]:
                                          key === 'currency'
                                            ? e.target.value.toUpperCase()
                                            : e.target.value,
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setMethods({
                            ...methods,
                            banks: methods.banks.filter((_: Row, j: number) => i !== j),
                          })
                        }
                      >
                        Quitar cuenta
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setMethods({
                        ...methods,
                        banks: [
                          ...methods.banks,
                          {
                            bank: '',
                            holder: '',
                            account: '',
                            accountType: 'Ahorros',
                            currency: org.currency || 'DOP',
                          },
                        ],
                      })
                    }
                  >
                    Agregar cuenta bancaria
                  </button>
                  <div className="actions">
                    <button className="primary" disabled={busy}>
                      Guardar medios de pago
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <Empty text="Solo el administrador configura medios de pago." />
            ))}
          {tab === 'paymentrequests' && (
            <>
              <Toolbar
                text="Comparte la página de pago con el cliente y revisa sus comprobantes. Para compartir fuera del PC necesitas un servidor HTTPS."
                action={can('payments.manage') ? () => open('payment-requests') : undefined}
                label="Crear solicitud de pago"
              />
              {(data.paymentrequests || []).map((r) => (
                <section className="panel" key={r.id}>
                  <span className="badge">
                    {{
                      PENDING: 'Pendiente',
                      PROOF_RECEIVED: 'Comprobante por revisar',
                      PAID: 'Pago verificado',
                      REJECTED: 'No aprobado',
                      CANCELED: 'Cancelado',
                    }[r.status as string] || r.status}
                  </span>
                  <h2>
                    {r.description} · {money(r.amount, r.currency)}
                  </h2>
                  <small>Vence: {date(r.expiresAt)}</small>
                  <div className="actions">
                    <a
                      href={'/pagar.html?solicitud=' + encodeURIComponent(r.token)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir página del cliente
                    </a>
                    <button
                      onClick={() =>
                        void act(async () => {
                          await navigator.clipboard.writeText(
                            location.origin +
                              '/pagar.html?solicitud=' +
                              encodeURIComponent(r.token),
                          );
                          setNotice('Enlace copiado. Localhost solo funciona en esta computadora.');
                        })
                      }
                    >
                      Copiar enlace
                    </button>
                  </div>
                  {r.proofMeta.payerName && (
                    <p>
                      Pagador: {r.proofMeta.payerName} · Referencia: {r.proofMeta.reference}
                    </p>
                  )}
                  {r.proofs.map((d: Row) => (
                    <button key={d.id} disabled={busy} onClick={() => void download(d)}>
                      <Download size={15} />
                      {d.name}
                    </button>
                  ))}
                  {can('payments.manage') && !['PAID', 'CANCELED'].includes(r.status) && (
                    <div className="actions">
                      {[
                        ['APPROVE', 'Confirmar dinero recibido'],
                        ['REJECT', 'Rechazar comprobante'],
                        ['CANCEL', 'Cancelar solicitud'],
                      ].map(([decision, label]) => (
                        <button
                          key={decision}
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                decision === 'APPROVE'
                                  ? '¿Verificaste en tu banco o pasarela que recibiste este importe? Esta acción registra el cobro.'
                                  : '¿' + label + '?',
                              )
                            )
                              return;
                            const note =
                              window.prompt('Observación para el cliente (opcional)') || '';
                            void act(async () => {
                              await request('/api/workspace/payment-requests/' + r.id + '/review', {
                                method: 'POST',
                                body: JSON.stringify({ decision, note, confirm: true }),
                              });
                              await load();
                              setNotice('Revisión guardada.');
                            });
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
              {!(data.paymentrequests || []).length && (
                <Empty text="Crea una solicitud para que tu cliente vea cómo pagar y envíe su comprobante." />
              )}
            </>
          )}
          {tab === 'documents' && (
            <>
              <Toolbar text="PDF, imágenes, TXT y CSV, hasta 5 MB por archivo. Archivos privados por empresa e incluidos en el respaldo SQL." />
              {can('crm.write') && (
                <label className="upload">
                  Seleccionar archivo
                  <input
                    aria-label="Subir documento"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              <p className="muted">
                Almacenamiento local. No incluye antivirus; descarga únicamente archivos de origen
                conocido.
              </p>
              <div className="cards">
                {data.documents.map((d) => (
                  <section className="panel" key={d.id}>
                    <FolderLock />
                    <h2>{d.name}</h2>
                    <small>
                      {(d.sizeBytes / 1024).toFixed(1)} KB · {date(d.createdAt)}
                    </small>
                    <div className="actions">
                      <button disabled={busy} onClick={() => void download(d)}>
                        <Download size={16} />
                        Descargar
                      </button>
                      {can('crm.write') && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm('¿Eliminar este archivo de la bóveda?'))
                              void act(async () => {
                                await request('/api/workspace/documents/' + d.id, {
                                  method: 'DELETE',
                                });
                                await load();
                              });
                          }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              {!data.documents.length && <Empty text="Tu bóveda está vacía." />}
            </>
          )}
          {tab === 'analytics' && (
            <>
              <section className="panel">
                <h2>Resultados y proyección por moneda</h2>
                <p className="muted">
                  La proyección suma valor × probabilidad de las oportunidades abiertas. Es una
                  estimación comercial, no una predicción validada.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Moneda</th>
                        <th>Ventas ganadas</th>
                        <th>Cobros registrados*</th>
                        <th>Proyección ponderada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...new Set([
                          ...data.deals.map((d) => d.currency),
                          ...data.payments.map((p) => p.currency),
                        ]),
                      ].map((c) => (
                        <tr key={c}>
                          <td>{c}</td>
                          <td>
                            {money(
                              won
                                .filter((d) => d.currency === c)
                                .reduce((n, d) => n + Number(d.value), 0),
                              c,
                            )}
                          </td>
                          <td>
                            {can('payments.read')
                              ? money(
                                  data.payments
                                    .filter((p) => p.currency === c && p.status === 'COMPLETED')
                                    .reduce((n, p) => n + Number(p.amount), 0),
                                  c,
                                )
                              : 'Sin permiso'}
                          </td>
                          <td>
                            {money(
                              data.deals
                                .filter((d) => d.currency === c && d.status === 'OPEN')
                                .reduce((n, d) => n + (Number(d.value) * d.probability) / 100, 0),
                              c,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">
                  *Excluye registros reembolsados. Conversión entre oportunidades cerradas:{' '}
                  {conversion}.
                </p>
              </section>
              <section className="panel">
                <h2>Origen de tus contactos</h2>
                {[...new Set(data.contacts.map((c) => c.source || 'Sin especificar'))].map(
                  (source) => {
                    const count = data.contacts.filter(
                      (c) => (c.source || 'Sin especificar') === source,
                    ).length;
                    return (
                      <div className="bar-row" key={source}>
                        <span>{source}</span>
                        <div>
                          <i
                            style={{
                              width: `${(count / Math.max(1, data.contacts.length)) * 100}%`,
                            }}
                          />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    );
                  },
                )}
                {!data.contacts.length && <Empty text="Sin contactos para analizar." />}
              </section>
              {aiPanel}
            </>
          )}
          {tab === 'connections' && (
            <>
              <section className="panel">
                <h2>Direcciones oficiales de INTECA</h2>
                <p>
                  Abre las cuentas oficiales para revisar o ejecutar manualmente trabajos aprobados.
                  El acceso final depende de que tu navegador tenga iniciada la sesión correcta.
                </p>
                <div className="actions">
                  {intecaChannels.map(([label, url]) => (
                    <a
                      className="button-link"
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {label}
                    </a>
                  ))}
                </div>
                <p className="muted">
                  Estos accesos no entregan contraseñas a los agentes. Las campañas comerciales
                  pueden automatizarse dentro de los límites autorizados al conectar las API
                  oficiales. Noticias, testimonios y cambios institucionales siempre requieren tu
                  aprobación previa.
                </p>
              </section>
              <p className="muted">
                Las claves se guardan cifradas y nunca se muestran de nuevo. Guardar una clave no
                confirma que funcione.
              </p>
              <div className="cards">
                {[
                  [
                    'GEMINI',
                    'Gemini · IA',
                    'Generación de borradores para agentes, chat y marketing.',
                  ],
                  [
                    'RESEND',
                    'Resend · correo',
                    'Envío individual de un borrador a un contacto, con confirmación.',
                  ],
                  [
                    'WHATSAPP',
                    'WhatsApp Business',
                    'Recepción de mensajes y respuesta por la API oficial.',
                  ],
                  [
                    'FACEBOOK',
                    'Facebook Messenger',
                    'Mensajes privados de una página empresarial.',
                  ],
                  [
                    'INSTAGRAM',
                    'Instagram profesional',
                    'Mensajes privados mediante Instagram Login.',
                  ],
                ].map(([key, title, description]) => (
                  <section className="panel" key={key}>
                    <Plug />
                    <h2>{title}</h2>
                    <p>{description}</p>
                    <span className="badge">
                      {
                        status[
                          data.connections.find((c) => c.provider === key)?.status ||
                            'NOT_CONFIGURED'
                        ]
                      }
                    </span>
                    {['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(key) && (
                      <p>
                        Respuesta automática:{' '}
                        {data.connections.find((c) => c.provider === key)?.autoReply
                          ? 'Autorizada'
                          : 'Desactivada'}
                      </p>
                    )}
                    {can('settings.manage') && (
                      <div className="actions">
                        <button onClick={() => open(key)}>Configurar</button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm('¿Eliminar las credenciales de ' + key + '?'))
                              void act(async () => {
                                await request('/api/workspace/connections/' + key, {
                                  method: 'DELETE',
                                });
                                await load();
                              });
                          }}
                        >
                          Desconectar
                        </button>
                      </div>
                    )}
                  </section>
                ))}
              </div>
              <section className="panel">
                <h2>Conectar mensajería empresarial</h2>
                <p>
                  Configura tu aplicación de Meta y sus permisos. Pega en Meta la dirección HTTPS
                  pública del CRM seguida de /api/channels/{organizationId}/WHATSAPP (o FACEBOOK o
                  INSTAGRAM). Usa el mismo token de verificación en ambos sitios. Las credenciales
                  guardadas necesitan una prueba real antes de considerar el canal operativo.
                </p>
                <p>
                  La respuesta automática está desactivada por defecto. Selecciona un agente activo
                  y autorízala al configurar cada canal. Los archivos y casos pendientes pasan a
                  atención humana; no hay transcripción automática de audios. Google Ads y Meta Ads
                  aún no publican campañas.
                </p>
                {licence?.tier === 'INTECA_LIFETIME' && (
                  <p>
                    WhatsApp de INTECA:{' '}
                    <a href="https://wa.me/18096435502" target="_blank" rel="noreferrer">
                      +1 809-643-5502
                    </a>
                    . Este teléfono no sustituye al ID del número en Meta.
                  </p>
                )}
              </section>
            </>
          )}

          {tab === 'license' && (
            <section className="panel">
              <h2>Licencia de {org.name}</h2>
              <p>
                {licence?.tier === 'INTECA_LIFETIME'
                  ? 'INTECA · Gratuita y permanente'
                  : licence
                    ? 'Licencia comercial activa'
                    : 'Pendiente de activación'}
              </p>
              <p>
                Vencimiento:{' '}
                {licence?.tier === 'INTECA_LIFETIME'
                  ? 'Sin vencimiento'
                  : licence?.expiresAt
                    ? date(licence.expiresAt)
                    : 'Sin licencia'}
              </p>
              <label>
                Identificador para solicitar licencia
                <input readOnly value={organizationId} />
              </label>
              <p className="muted">
                La licencia habilita el software. Los consumos de IA, correo, hosting y publicidad
                se contratan aparte. Las demás empresas requieren una licencia comercial emitida por
                el propietario después de confirmar su compra.
              </p>
              {can('settings.manage') && (
                <>
                  <label>
                    Licencia firmada
                    <textarea
                      aria-label="Licencia firmada"
                      value={licenseText}
                      onChange={(e) => setLicenseText(e.target.value)}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy || !licenseText.trim()}
                    onClick={() =>
                      void act(async () => {
                        await request('/api/workspace/license/activate', {
                          method: 'POST',
                          body: JSON.stringify({ token: licenseText.trim() }),
                        });
                        setLicenseText('');
                        await load();
                        setNotice('Licencia activada.');
                      })
                    }
                  >
                    Activar licencia
                  </button>
                </>
              )}
            </section>
          )}
          {tab === 'salespolicy' &&
            (can('settings.manage') ? (
              <>
                <section className="panel">
                  <h2>Información autorizada para el vendedor IA</h2>
                  <p className="muted">
                    Carga los productos y sus precios en Catálogo. Añade aquí las condiciones,
                    garantías y respuestas autorizadas. Un buen guion mejora la conversación, pero
                    no garantiza ventas.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(async () => {
                        const result = await request<Row>('/api/workspace/sales-policy', {
                          method: 'PUT',
                          body: JSON.stringify({
                            ...policy,
                            dailyAiLimit: Number(policy.dailyAiLimit),
                          }),
                        });
                        setPolicy(result.settings);
                        setNotice('Información comercial guardada.');
                      });
                    }}
                  >
                    {[
                      ['website', 'Sitio web HTTPS de la empresa'],
                      ['handoffEmail', 'Correo para atención humana'],
                      ['checkoutUrl', 'Enlace HTTPS de pago autorizado'],
                    ].map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          value={policy[key] || ''}
                          onChange={(e) => setPolicy({ ...policy, [key]: e.target.value })}
                        />
                      </label>
                    ))}
                    <label>
                      Información del negocio, políticas y condiciones
                      <textarea
                        aria-label="Información del negocio"
                        value={policy.businessContext}
                        onChange={(e) => setPolicy({ ...policy, businessContext: e.target.value })}
                      />
                    </label>
                    <label>
                      Guion comercial y manejo de objeciones
                      <textarea
                        aria-label="Guion comercial"
                        rows={8}
                        value={policy.salesPlaybook}
                        onChange={(e) => setPolicy({ ...policy, salesPlaybook: e.target.value })}
                      />
                    </label>
                    <label>
                      Límite diario de consultas IA desde la web
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={policy.dailyAiLimit}
                        onChange={(e) =>
                          setPolicy({ ...policy, dailyAiLimit: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!policy.enabled}
                        onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })}
                      />
                      Habilitar asistente web
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!policy.autoPublishCampaigns}
                        onChange={(e) =>
                          setPolicy({ ...policy, autoPublishCampaigns: e.target.checked })
                        }
                      />
                      Autorizar campañas automáticas dentro del público, presupuesto y condiciones
                      registrados
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!policy.notifyAfterCampaignPublish}
                        onChange={(e) =>
                          setPolicy({ ...policy, notifyAfterCampaignPublish: e.target.checked })
                        }
                      />
                      Notificar al propietario después de cada publicación o intento fallido
                    </label>
                    <p className="muted">
                      Noticias, testimonios y cambios institucionales siempre requieren aprobación
                      previa.
                    </p>
                    <button className="primary" disabled={busy}>
                      Guardar política comercial
                    </button>
                  </form>
                </section>
                {policy.widgetKey && (
                  <section className="panel">
                    <h2>Conectar a tu página web</h2>
                    <p>
                      Inserta este iframe en tu sitio. Para visitantes externos, el CRM debe estar
                      alojado en un servidor HTTPS y permitir que tu sitio lo inserte. La dirección
                      localhost solo permite pruebas en esta computadora.
                    </p>
                    <textarea
                      aria-label="Código del asistente web"
                      readOnly
                      value={
                        '<iframe src="' +
                        location.origin +
                        '/sales-widget.html?company=' +
                        encodeURIComponent(organizationId) +
                        '&key=' +
                        encodeURIComponent(policy.widgetKey) +
                        '" title="Asistente comercial IA" width="380" height="650" style="border:0;border-radius:16px"></iframe>'
                      }
                    />
                    <a
                      href={
                        '/sales-widget.html?company=' +
                        encodeURIComponent(organizationId) +
                        '&key=' +
                        encodeURIComponent(policy.widgetKey)
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Probar asistente en otra pestaña
                    </a>
                  </section>
                )}
              </>
            ) : (
              <Empty text="Solo el administrador puede cambiar las condiciones comerciales." />
            ))}
        </div>
      </main>
      {editor && (
        <div className="modal-backdrop">
          <section className="panel modal" role="dialog" aria-modal="true" aria-label="Editor">
            <div className="toolbar">
              <h2>{editor.row ? 'Editar' : 'Crear / configurar'}</h2>
              <button
                aria-label="Cerrar editor"
                disabled={busy}
                onClick={() => {
                  setEditor(null);
                  setForm({});
                }}
              >
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              {fields(editor.kind).map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.type === 'checkbox' ? (
                    <input
                      aria-label={f.label}
                      type="checkbox"
                      checked={!!form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                    />
                  ) : f.options ? (
                    <select
                      aria-label={f.label}
                      required={f.required}
                      value={form[f.key] || ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      aria-label={f.label}
                      required={f.required}
                      value={form[f.key] || ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      aria-label={f.label}
                      required={f.required}
                      type={f.type || 'text'}
                      min={0}
                      step={f.key === 'delayHours' ? 1 : 0.01}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
              {error && (
                <p role="alert" className="alert">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                Guardar
              </button>
            </form>
          </section>
        </div>
      )}
      {paymentPreview && (
        <div className="modal-backdrop">
          <section className="panel modal receipt" role="dialog" aria-label="Comprobante">
            <button className="no-print" onClick={() => setPaymentPreview(null)}>
              Cerrar
            </button>
            <h2>{org.name}</h2>
            <p>COMPROBANTE INTERNO · SIN VALIDEZ FISCAL</p>
            <p>Referencia: {paymentPreview.id}</p>
            <p>Fecha: {date(paymentPreview.createdAt)}</p>
            <p>
              Cliente: {paymentPreview.contact?.firstName} {paymentPreview.contact?.lastName}
            </p>
            <p>Concepto: {paymentPreview.metadata.reference}</p>
            <h2>{money(paymentPreview.amount, paymentPreview.currency)}</h2>
            <p>Estado: {status[paymentPreview.status]}</p>
            <button className="no-print primary" onClick={() => window.print()}>
              Imprimir / guardar PDF
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
function Toolbar({ text, action, label }: { text: string; action?: () => void; label?: string }) {
  return (
    <div className="toolbar">
      <p className="muted">{text}</p>
      {action && (
        <button className="primary" onClick={action}>
          <Plus size={16} />
          {label}
        </button>
      )}
    </div>
  );
}
