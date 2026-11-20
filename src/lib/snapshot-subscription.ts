// Read-only polling: one request at a time, bounded duration, and no emissions
// after a component changes scope or unmounts. Never use this for mutations.
export function subscribeSnapshot<T>(
  read: (signal: AbortSignal) => Promise<T>,
  receive: (value: T) => void,
  fail: (error: Error) => void,
  interval = 0,
) {
  const lifetime = new AbortController();
  let pending = false;
  async function poll() {
    if (pending || lifetime.signal.aborted) return;
    pending = true;
    try {
      const value = await read(AbortSignal.any([lifetime.signal, AbortSignal.timeout(30000)]));
      if (!lifetime.signal.aborted) receive(value);
    } catch (error) {
      if (!lifetime.signal.aborted) fail(error instanceof Error ? error : Error('No se pudo consultar el estado.'));
    } finally { pending = false; }
  }
  void poll();
  const timer = interval > 0 ? setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') void poll();
  }, interval) : null;
  return () => { lifetime.abort(); if (timer) clearInterval(timer); };
}

export async function fetchSnapshot<T = any>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: signal || AbortSignal.timeout(30000) });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || 'No se pudo consultar el estado. Revisa tu sesión y la conexión.');
  return data;
}
