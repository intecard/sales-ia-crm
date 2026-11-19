import { useEffect, useState } from 'react';
type Health = {
  integrations?: { whatsappConfigured?: boolean };
  salesAgent?: { ready?: boolean };
  salesAutomation?: {
    enabled?: boolean;
    readiness?: { outsideServiceWindow?: boolean; ownerTemplate?: boolean };
  };
  geminiModels?: { currentlyAvailable?: string[] };
};

export function OperationalStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const r = await fetch('/api/health', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!r.ok) throw Error('HEALTH_UNAVAILABLE');
        const data = await r.json();
        if (active) {
          setHealth(data);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  const connected = health?.integrations?.whatsappConfigured && health.salesAgent?.ready;
  const limited =
    !health?.salesAutomation?.readiness?.outsideServiceWindow ||
    !health?.salesAutomation?.readiness?.ownerTemplate ||
    !health?.geminiModels?.currentlyAvailable?.length;
  const label = error
    ? 'Estado sin verificar'
    : !health
      ? 'Consultando operación…'
      : !connected
        ? 'Conexión pendiente'
        : limited
          ? 'WhatsApp configurado · revisar pendientes'
          : 'WhatsApp y seguimiento configurados';
  return (
    <div
      role="status"
      className="hidden lg:block rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-200"
      title="Configuración consultada al servidor cada minuto. No garantiza entrega de mensajes ni disponibilidad continua."
    >
      {label}
    </div>
  );
}
