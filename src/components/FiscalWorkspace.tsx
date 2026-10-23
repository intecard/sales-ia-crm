import { useCallback, useEffect, useState } from 'react';
import { DOCUMENT_TYPES } from '../../fiscal/contracts';
import type { FiscalCompany, FiscalDocumentInput } from '../../fiscal/engine';
type CompanyRow = { organization_id: string; profile: FiscalCompany; profile_hash: string };
type DocumentRow = {
  id: string;
  environment: string;
  status: 'draft' | 'reviewed' | 'cancelled';
  fiscal_status: string;
  payload: FiscalDocumentInput;
  issuer_snapshot: FiscalCompany;
  totals: Record<string, any>;
  request_hash: string;
  rule_version: string;
  created_at: string;
};
type Snapshot = {
  company: CompanyRow | null;
  documents: DocumentRow[];
  blockers: string[];
  hasMore: boolean;
};
const input = 'w-full bg-slate-950 border border-slate-600 rounded-lg p-2 text-sm text-white';
const button = 'rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-40';
const taxLabels = {
  ITBIS18: 'ITBIS 18%',
  ITBIS16: 'ITBIS 16%',
  ITBIS0: 'Gravado 0%',
  EXENTO: 'Exento',
};
const environmentLabels = {
  precertification: 'Precertificación',
  certification: 'Certificación',
  production: 'Producción',
};
function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((key) => parts.find((p) => p.type === key)!.value).join('-');
}
const newItem = (tax: FiscalCompany['defaultTax']) => ({
  description: '',
  kind: 'service' as const,
  unit: 'unidad',
  quantity: '1',
  unitPrice: '0',
  discount: '0',
  tax,
});
export function FiscalWorkspace({ organization }: { organization: { id: string; name: string } }) {
  const base = `/api/fiscal/${encodeURIComponent(organization.id)}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [offset, setOffset] = useState(0);
  const [profile, setProfile] = useState<FiscalCompany>({
    legalName: organization.name,
    tradeName: '',
    taxId: '',
    address: '',
    email: '',
    phone: '',
    activity: '',
    country: 'DO',
    currency: 'DOP',
    environment: 'precertification',
    enabledTypes: ['31', '32'],
    defaultTax: 'ITBIS18',
    providerName: '',
    authorizationReference: '',
    certificateReference: '',
    certificateExpiresOn: '',
  });
  const [type, setType] = useState<FiscalDocumentInput['type']>('32'),
    [issuedOn, setIssuedOn] = useState(today()),
    [receiver, setReceiver] = useState({
      name: '',
      taxId: '',
      email: '',
      country: 'DO',
      address: '',
    }),
    [currency, setCurrency] = useState<'DOP' | 'USD' | 'EUR'>('DOP'),
    [exchangeRate, setExchangeRate] = useState('1');
  const [items, setItems] = useState<FiscalDocumentInput['items']>([newItem('ITBIS18')]),
    [adjustments, setAdjustments] = useState<FiscalDocumentInput['adjustments']>([]),
    [notes, setNotes] = useState(''),
    [reference, setReference] = useState({
      number: '',
      issuedOn: today(),
      reason: '',
      code: '1' as '1' | '2' | '3',
    }),
    [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<any>(null),
    [selected, setSelected] = useState<DocumentRow | null>(null),
    [events, setEvents] = useState<any[]>([]),
    [registry, setRegistry] = useState<any>(null);
  const api = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const response = await fetch(path.startsWith('/api/') ? path : base + path, {
        headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'fiscal' },
        ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          data.error +
            (data.fields?.length
              ? ' ' + data.fields.map((f: any) => f.path + ': ' + f.message).join(' · ')
              : ''),
        );
      return data;
    },
    [base],
  );
  async function refresh(page = offset) {
    const data = await api<Snapshot>(`?offset=${page}`);
    setSnapshot(data);
    return data;
  }
  useEffect(() => {
    let active = true;
    void api<Snapshot>('?offset=0')
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
        if (data.company) {
          setProfile(data.company.profile);
          setCurrency(data.company.profile.currency);
          setExchangeRate(data.company.profile.currency === 'DOP' ? '1' : '');
          setType(
            data.company.profile.enabledTypes.includes('32')
              ? '32'
              : data.company.profile.enabledTypes[0],
          );
          setItems([newItem(data.company.profile.defaultTax)]);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    void api('/api/fiscal/registry')
      .then((data) => {
        if (active) setRegistry(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [organization.id, api]);
  const body = (): FiscalDocumentInput => ({
    idempotencyKey,
    type,
    issuedOn,
    receiver,
    currency,
    exchangeRate,
    items,
    adjustments,
    notes,
    ...(['33', '34'].includes(type) ? { reference } : {}),
  });
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile() {
    await api('/profile', profile);
    await refresh(0);
    setOffset(0);
    setNotice(
      'Perfil fiscal guardado para esta empresa. Las referencias declaradas no equivalen a una autorización verificada de la DGII.',
    );
  }
  async function prepare() {
    const rows = await api<DocumentRow[]>('/documents', body());
    setSelected(rows[0]);
    await refresh(0);
    setOffset(0);
    setNotice('Borrador comercial guardado. No se asignó e-NCF ni se transmitió a la DGII.');
    setReceiver({ name: '', taxId: '', email: '', country: 'DO', address: '' });
    setItems([newItem(profile.defaultTax)]);
    setAdjustments([]);
    setNotes('');
    setIdempotencyKey(crypto.randomUUID());
    setPreview(null);
  }
  async function select(row: DocumentRow) {
    setSelected(row);
    setEvents([]);
    setEvents(await api(`/documents/${row.id}/events`));
  }
  function setLine(index: number, field: string, value: string) {
    setPreview(null);
    setItems((old) => old.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }
  const label = (name: string, node: React.ReactNode) => (
    <label key={name} className="block text-xs space-y-1">
      <span>{name}</span>
      {node}
    </label>
  );
  return (
    <section className="space-y-5 text-slate-200" aria-label="Facturación fiscal multiempresa">
      <div className="rounded-2xl border border-cyan-700 bg-slate-900 p-5">
        <h2 className="text-2xl font-bold">Facturación por empresa · {organization.name}</h2>
        <p className="mt-2 text-sm">
          Bienes y servicios de cualquier sector. Perfil, impuestos, documentos y auditoría
          separados por empresa. Jurisdicción disponible: República Dominicana (DGII).
        </p>
        <p className="mt-2 text-sm text-amber-200">
          Preparación comercial y control fiscal previo. La firma, validación XSD, secuencias, envío
          y aceptación requieren completar la integración fiscal de cada emisor.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded bg-red-950 p-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded bg-emerald-950 p-3">
          {notice}
        </p>
      )}
      <details open className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <summary className="font-bold cursor-pointer">1. Perfil fiscal del emisor</summary>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {(
            [
              ['legalName', 'Razón social'],
              ['tradeName', 'Nombre comercial'],
              ['taxId', 'RNC / cédula del emisor'],
              ['activity', 'Actividad económica'],
              ['address', 'Dirección fiscal'],
              ['email', 'Correo de facturación'],
              ['phone', 'Teléfono'],
            ] as const
          ).map(([key, title]) =>
            label(
              title,
              <input
                className={input}
                value={profile[key]}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
              />,
            ),
          )}
          {label(
            'Ambiente',
            <select
              className={input}
              value={profile.environment}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  environment: e.target.value as FiscalCompany['environment'],
                })
              }
            >
              {Object.entries(environmentLabels).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
                </option>
              ))}
            </select>,
          )}
          {label(
            'Moneda predeterminada',
            <select
              className={input}
              value={profile.currency}
              onChange={(e) =>
                setProfile({ ...profile, currency: e.target.value as FiscalCompany['currency'] })
              }
            >
              {['DOP', 'USD', 'EUR'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>,
          )}
          {label(
            'Tratamiento de nuevas líneas (confirma con tu responsable fiscal)',
            <select
              className={input}
              value={profile.defaultTax}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  defaultTax: e.target.value as FiscalCompany['defaultTax'],
                })
              }
            >
              {Object.entries(taxLabels).map(([key, title]) => (
                <option value={key} key={key}>
                  {title}
                </option>
              ))}
            </select>,
          )}
        </div>
        <fieldset className="mt-4">
          <legend className="font-semibold text-sm">Tipos que utilizará esta empresa</legend>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {Object.entries(DOCUMENT_TYPES).map(([key, title]) => (
              <label key={key} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.enabledTypes.includes(key as any)}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      enabledTypes: e.target.checked
                        ? [...profile.enabledTypes, key as any]
                        : profile.enabledTypes.filter((t) => t !== key),
                    })
                  }
                />
                {key} · {title}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-3 text-xs text-slate-400">
          Seleccionar un tipo habilita su preparación, sujeto a las reglas particulares y
          autorización del emisor. No asigna secuencias ni autoriza emisión.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {(
            [
              ['providerName', 'Proveedor fiscal previsto'],
              ['authorizationReference', 'Referencia de autorización DGII'],
              ['certificateReference', 'Referencia del certificado en el almacén seguro'],
            ] as const
          ).map(([key, title]) =>
            label(
              title,
              <input
                className={input}
                value={profile[key]}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
              />,
            ),
          )}
          {label(
            'Vencimiento declarado del certificado',
            <input
              type="date"
              className={input}
              value={profile.certificateExpiresOn}
              onChange={(e) => setProfile({ ...profile, certificateExpiresOn: e.target.value })}
            />,
          )}
        </div>
        <p className="text-xs mt-3">
          Registra referencias de configuración; las claves privadas y contraseñas del certificado
          permanecen en el almacén seguro del proveedor. No se cargan en la conversación ni en este
          formulario.
        </p>
        <button
          className={button + ' mt-4 bg-blue-700'}
          disabled={busy}
          onClick={() => void run(saveProfile)}
        >
          Guardar perfil de esta empresa
        </button>
      </details>
      {snapshot?.company && (
        <details open className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <summary className="font-bold cursor-pointer">
            2. Preparar documento de bienes o servicios
          </summary>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            {label(
              'Tipo solicitado',
              <select
                className={input}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as any);
                  setPreview(null);
                }}
              >
                {snapshot.company.profile.enabledTypes.map((t) => (
                  <option key={t} value={t}>
                    {t} · {DOCUMENT_TYPES[t]}
                  </option>
                ))}
              </select>,
            )}
            {label(
              'Fecha del documento',
              <input
                type="date"
                className={input}
                value={issuedOn}
                onChange={(e) => {
                  setIssuedOn(e.target.value);
                  setPreview(null);
                }}
              />,
            )}
            {label(
              'Cliente / receptor',
              <input
                className={input}
                value={receiver.name}
                onChange={(e) => {
                  setReceiver({ ...receiver, name: e.target.value });
                  setPreview(null);
                }}
              />,
            )}
            {(['taxId', 'email', 'country', 'address'] as const).map((key) =>
              label(
                {
                  taxId: 'Identificación del receptor',
                  email: 'Correo del receptor',
                  country: 'País ISO (DO, US…)',
                  address: 'Dirección del receptor',
                }[key],
                <input
                  className={input}
                  value={receiver[key]}
                  onChange={(e) => {
                    setReceiver({
                      ...receiver,
                      [key]: key === 'country' ? e.target.value.toUpperCase() : e.target.value,
                    });
                    setPreview(null);
                  }}
                />,
              ),
            )}
            {label(
              'Moneda del documento',
              <select
                className={input}
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value as any);
                  setExchangeRate(e.target.value === 'DOP' ? '1' : '');
                  setPreview(null);
                }}
              >
                {['DOP', 'USD', 'EUR'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>,
            )}
            {label(
              'Tasa a DOP (no se consulta automáticamente)',
              <input
                className={input}
                inputMode="decimal"
                value={exchangeRate}
                onChange={(e) => {
                  setExchangeRate(e.target.value);
                  setPreview(null);
                }}
              />,
            )}
          </div>
          <div className="space-y-3 mt-4">
            {items.map((item, index) => (
              <fieldset key={index} className="border border-slate-700 rounded p-3">
                <legend className="text-sm">Línea {index + 1}</legend>
                <div className="grid sm:grid-cols-4 gap-2">
                  {label(
                    'Descripción',
                    <input
                      className={input}
                      value={item.description}
                      onChange={(e) => setLine(index, 'description', e.target.value)}
                    />,
                  )}
                  {label(
                    'Naturaleza',
                    <select
                      className={input}
                      value={item.kind}
                      onChange={(e) => setLine(index, 'kind', e.target.value)}
                    >
                      <option value="goods">Bien</option>
                      <option value="service">Servicio</option>
                    </select>,
                  )}
                  {(['quantity', 'unit', 'unitPrice', 'discount'] as const).map((key) =>
                    label(
                      {
                        quantity: 'Cantidad',
                        unit: 'Unidad',
                        unitPrice: 'Precio unitario (sin ITBIS)',
                        discount: 'Descuento en importe',
                      }[key],
                      <input
                        className={input}
                        value={item[key]}
                        onChange={(e) => setLine(index, key, e.target.value)}
                      />,
                    ),
                  )}
                  {label(
                    'Impuesto de esta línea',
                    <select
                      className={input}
                      value={item.tax}
                      onChange={(e) => setLine(index, 'tax', e.target.value)}
                    >
                      {Object.entries(taxLabels).map(([key, title]) => (
                        <option key={key} value={key}>
                          {title}
                        </option>
                      ))}
                    </select>,
                  )}
                  <button
                    className={button}
                    disabled={items.length === 1 || busy}
                    onClick={() => {
                      setItems(items.filter((_, i) => i !== index));
                      setPreview(null);
                    }}
                  >
                    Quitar línea
                  </button>
                </div>
              </fieldset>
            ))}
          </div>
          <button
            className={button + ' mt-3'}
            disabled={items.length >= 100 || busy}
            onClick={() => {
              setItems([...items, newItem(profile.defaultTax)]);
              setPreview(null);
            }}
          >
            Añadir bien o servicio
          </button>
          <details className="mt-4">
            <summary>Impuestos adicionales, cargos y retenciones declarados</summary>
            <p className="text-xs mt-2">
              Indica importes y conceptos confirmados por tu responsable fiscal. El motor no
              determina automáticamente obligaciones sectoriales.
            </p>
            {adjustments.map((a, i) => (
              <div key={i} className="grid sm:grid-cols-4 gap-2 mt-2">
                <select
                  className={input}
                  value={a.kind}
                  onChange={(e) => {
                    setAdjustments(
                      adjustments.map((r, j) =>
                        i === j ? { ...r, kind: e.target.value as any } : r,
                      ),
                    );
                    setPreview(null);
                  }}
                >
                  {['ISC', 'OTHER_TAX', 'CHARGE', 'ISR_WITHHOLDING', 'ITBIS_WITHHOLDING'].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
                <input
                  aria-label="Concepto del ajuste"
                  className={input}
                  value={a.description}
                  onChange={(e) => {
                    setAdjustments(
                      adjustments.map((r, j) =>
                        i === j ? { ...r, description: e.target.value } : r,
                      ),
                    );
                    setPreview(null);
                  }}
                />
                <input
                  aria-label="Importe del ajuste"
                  className={input}
                  value={a.amount}
                  onChange={(e) => {
                    setAdjustments(
                      adjustments.map((r, j) => (i === j ? { ...r, amount: e.target.value } : r)),
                    );
                    setPreview(null);
                  }}
                />
                <button
                  className={button}
                  onClick={() => {
                    setAdjustments(adjustments.filter((_, j) => j !== i));
                    setPreview(null);
                  }}
                >
                  Quitar ajuste
                </button>
              </div>
            ))}
            <button
              className={button + ' mt-2'}
              disabled={adjustments.length >= 20}
              onClick={() => {
                setAdjustments([...adjustments, { kind: 'CHARGE', description: '', amount: '0' }]);
                setPreview(null);
              }}
            >
              Añadir ajuste
            </button>
          </details>
          {['33', '34'].includes(type) && (
            <fieldset className="grid sm:grid-cols-2 gap-2 mt-4 border border-amber-700 p-3">
              <legend>Comprobante que modifica la nota</legend>
              {(['number', 'issuedOn', 'reason', 'code'] as const).map((key) =>
                label(
                  {
                    number: 'Número original',
                    issuedOn: 'Fecha original',
                    reason: 'Motivo',
                    code: 'Código de modificación (1, 2 o 3)',
                  }[key],
                  <input
                    className={input}
                    type={key === 'issuedOn' ? 'date' : 'text'}
                    value={reference[key]}
                    onChange={(e) => {
                      setReference({ ...reference, [key]: e.target.value });
                      setPreview(null);
                    }}
                  />,
                ),
              )}
            </fieldset>
          )}
          <div className="mt-4">
            {label(
              'Notas comerciales',
              <textarea
                className={input}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setPreview(null);
                }}
              />,
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              disabled={busy}
              className={button}
              onClick={() =>
                void run(async () => {
                  const data = await api<any>('/calculate', body());
                  setPreview(data.totals);
                })
              }
            >
              Calcular y comprobar datos
            </button>
            <button
              disabled={busy}
              className={button + ' bg-blue-700'}
              onClick={() => void run(prepare)}
            >
              Guardar borrador comercial
            </button>
          </div>
          {preview && (
            <div className="grid sm:grid-cols-3 gap-2 mt-4 text-sm">
              {[
                ['Subtotal', preview.subtotal],
                ['Descuentos', preview.discounts],
                ['ITBIS', preview.itbis],
                ['Total del documento', preview.fiscalTotal],
                ['Retenciones', preview.withholdings],
                ['Saldo calculado', preview.amountDue],
                ['Ruta fiscal prevista', preview.route],
                ['Equivalente DOP', preview.fiscalTotalDop],
              ].map(([title, value]) => (
                <p key={title} className="bg-slate-800 rounded p-2">
                  {title}: <strong>{value}</strong>
                </p>
              ))}
            </div>
          )}
        </details>
      )}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
        <h3 className="font-bold">3. Documentos persistentes de esta empresa</h3>
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await refresh();
            })
          }
        >
          Actualizar
        </button>
        <div className="overflow-auto">
          <table className="text-sm w-full">
            <thead>
              <tr>
                {['Fecha', 'Receptor', 'Tipo', 'Total', 'Ambiente', 'Estado'].map((v) => (
                  <th className="p-2 text-left" key={v}>
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot?.documents.map((row) => (
                <tr key={row.id}>
                  <td className="p-2">{row.payload.issuedOn}</td>
                  <td className="p-2">
                    <button
                      className="text-cyan-300 underline"
                      onClick={() => void run(() => select(row))}
                    >
                      {row.payload.receiver.name}
                    </button>
                  </td>
                  <td className="p-2">{row.payload.type}</td>
                  <td className="p-2">
                    {row.payload.currency} {row.totals.fiscalTotal}
                  </td>
                  <td className="p-2">
                    {environmentLabels[row.environment as keyof typeof environmentLabels]}
                  </td>
                  <td className="p-2">
                    {
                      {
                        draft: 'Borrador',
                        reviewed: 'Revisado comercialmente',
                        cancelled: 'Borrador descartado',
                      }[row.status]
                    }{' '}
                    · No transmitido
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!snapshot?.documents.length && (
          <p className="text-sm text-slate-400">
            No hay documentos guardados para esta empresa en esta página.
          </p>
        )}
        <div className="flex gap-3">
          <button
            className={button}
            disabled={busy || offset === 0}
            onClick={() =>
              void run(async () => {
                const n = Math.max(0, offset - 50);
                await refresh(n);
                setOffset(n);
              })
            }
          >
            Anteriores
          </button>
          <button
            className={button}
            disabled={busy || !snapshot?.hasMore}
            onClick={() =>
              void run(async () => {
                const n = offset + 50;
                await refresh(n);
                setOffset(n);
              })
            }
          >
            Siguientes
          </button>
        </div>
      </div>
      {selected && (
        <div className="border border-cyan-600 rounded-xl bg-slate-900 p-4 space-y-3">
          <h3 className="font-bold">Documento {selected.id}</h3>
          <p>
            {selected.payload.receiver.name} · {selected.payload.currency}{' '}
            {selected.totals.fiscalTotal} · {selected.rule_version}
          </p>
          <p className="text-sm">
            e-NCF, XML firmado, TrackId y QR: pendientes de integración fiscal verificada. Revisar
            un borrador no lo convierte en factura fiscal.
          </p>
          <div className="flex gap-3 flex-wrap">
            <a className={button} href={`${base}/documents/${selected.id}/print`}>
              Descargar representación comercial
            </a>
            <a className={button} href={`${base}/documents/${selected.id}/package`}>
              Descargar paquete JSON
            </a>
            <button
              className={button}
              disabled={busy || selected.status !== 'draft'}
              onClick={() =>
                void run(async () => {
                  const rows = await api<DocumentRow[]>(`/documents/${selected.id}/review`, {
                    reviewed: true,
                    expectedHash: selected.request_hash,
                  });
                  await select(rows[0]);
                  await refresh();
                  setNotice('Revisión comercial registrada; la aceptación fiscal sigue pendiente.');
                })
              }
            >
              Confirmar revisión comercial
            </button>
            <button
              className={button}
              disabled={busy || selected.status === 'cancelled'}
              onClick={() =>
                void run(async () => {
                  const rows = await api<DocumentRow[]>(`/documents/${selected.id}/cancel`, {
                    confirmed: true,
                  });
                  await select(rows[0]);
                  await refresh();
                  setNotice('Borrador descartado. Esta acción no anula un e-NCF en la DGII.');
                })
              }
            >
              Descartar borrador
            </button>
          </div>
          <details>
            <summary>Trazabilidad del documento</summary>
            {events.map((e) => (
              <p key={e.id} className="text-xs mt-1">
                {e.created_at} · {e.kind} · {e.actor}
              </p>
            ))}
          </details>
        </div>
      )}
      {snapshot?.blockers.length && (
        <div className="rounded-xl border border-amber-700 bg-slate-900 p-4">
          <h3 className="font-bold">Pendientes para emitir fiscalmente</h3>
          <ul className="list-disc pl-5 text-sm space-y-2 mt-2">
            {snapshot.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="border border-slate-700 rounded-xl p-4">
        <summary className="font-bold">Registro técnico de referencia DGII</summary>
        <p className="text-sm mt-2">
          Esquemas descargados con huella SHA-256 y versión de referencia. No se activan
          automáticamente como reglas de emisión aprobadas.
        </p>
        {registry && (
          <>
            <p className="text-xs my-2">Consultado: {registry.retrievedAt}</p>
            <ul className="text-xs space-y-2">
              {registry.records.map((r: any) => (
                <li key={r.sha256 + r.name}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 underline"
                  >
                    {r.name}
                  </a>{' '}
                  · SHA-256 <span className="break-all">{r.sha256}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  );
}
