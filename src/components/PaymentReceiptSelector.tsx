import { useEffect, useState } from 'react';
type Receipt = { id: string; created_at: string };
export function PaymentReceiptSelector({
  contactKey,
  onSelect,
}: {
  contactKey: string;
  onSelect: (id: string, reviewed: boolean) => void;
}) {
  const [receipts, setReceipts] = useState<Receipt[]>([]),
    [media, setMedia] = useState<Array<{ id: string; created_at: string }>>([]);
  const [selected, setSelected] = useState(''),
    [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/sales/${contactKey}/receipts`),
      fetch(`/api/sales/${contactKey}/events`),
    ])
      .then(async (responses) => {
        if (responses.some((r) => !r.ok)) throw Error('No se pudieron consultar los recibos.');
        const [files, events] = await Promise.all(responses.map((r) => r.json()));
        if (active) {
          setReceipts(files);
          setMedia(
            events.filter(
              (e: { details?: { mediaId?: string; mediaType?: string } }) =>
                e.details?.mediaId && ['image', 'document'].includes(e.details.mediaType || ''),
            ),
          );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [contactKey]);
  async function save(body: unknown) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/sales/${contactKey}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CRM-Action': 'sales' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setReceipts((old) => [data, ...old.filter((r) => r.id !== data.id)]);
      setSelected(data.id);
      setReviewed(false);
      onSelect(data.id, false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 5242880) {
      setError('Máximo 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => void save({ base64: String(reader.result).split(',')[1] });
    reader.readAsDataURL(file);
  }
  return (
    <div className="space-y-2 rounded-lg border border-slate-600 p-3 text-sm">
      <h5 className="font-semibold">1. Recibo de pago obligatorio</h5>
      <p className="text-xs text-slate-400">
        Descarga y revisa el original. Comprueba titular/destinatario, importe, fecha, referencia y
        a qué estudiante corresponde; después verifica el abono en el banco.
      </p>
      <label className="block">
        Adjuntar original (JPG, PNG, WebP o PDF)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={busy}
          onChange={(e) => void upload(e.target.files?.[0])}
          className="mt-1 block max-w-full text-xs"
        />
      </label>
      {media.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={busy}
          className="block rounded border border-slate-600 px-2 py-1 text-xs"
          onClick={() => void save({ eventId: item.id })}
        >
          Importar adjunto de WhatsApp · {new Date(item.created_at).toLocaleString('es-DO')}
        </button>
      ))}
      {receipts.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            aria-label="Seleccionar recibo"
            type="radio"
            checked={selected === item.id}
            onChange={() => {
              setSelected(item.id);
              setReviewed(false);
              onSelect(item.id, false);
            }}
          />
          <a
            className="text-indigo-300 underline"
            href={`/api/sales/receipts/${item.id}/content`}
            target="_blank"
            rel="noreferrer"
          >
            Descargar recibo · {new Date(item.created_at).toLocaleString('es-DO')}
          </a>
        </div>
      ))}
      <label className="flex gap-2">
        <input
          type="checkbox"
          disabled={!selected || busy}
          checked={reviewed}
          onChange={(e) => {
            setReviewed(e.target.checked);
            onSelect(selected, e.target.checked);
          }}
        />
        Revisé este recibo y comprobé que corresponde a este estudiante y a esta inscripción.
      </label>
      {busy && <p>Guardando el recibo privado…</p>}
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
