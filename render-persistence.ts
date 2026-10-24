// Never include Render response bodies or credentials in errors or logs.
export class RenderPersistenceError extends Error {
  readonly code: string;
  readonly httpStatus?: number;
  constructor(code: string, httpStatus?: number) { super(code); this.code = code; this.httpStatus = httpStatus; }
}
export async function renderRequest(serviceId: string, apiKey: string, key?: string, value?: string, fetcher: typeof fetch = fetch) {
  if (!serviceId?.trim() || !apiKey?.trim()) throw new RenderPersistenceError('OAUTH_RENDER_CONFIG');
  const clearing = Boolean(key) && value === '';
  let response: Response;
  try {
    response = await fetcher(`https://api.render.com/v1/services/${encodeURIComponent(serviceId.trim())}${key ? `/env-vars/${encodeURIComponent(key)}` : ''}`, {
      method: clearing ? 'DELETE' : key ? 'PUT' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey.trim()}`, ...(key && !clearing ? { 'Content-Type': 'application/json' } : {}) },
      ...(key && !clearing ? { body: JSON.stringify({ value }) } : {}),
    });
  } catch { throw new RenderPersistenceError('OAUTH_RENDER_UNAVAILABLE'); }
  if (clearing && response.status === 404) {
    // Distinguish an already absent variable from a missing/inaccessible service.
    await renderRequest(serviceId, apiKey, undefined, undefined, fetcher);
    return;
  }
  if (!response.ok) {
    const code = response.status === 400 ? 'OAUTH_RENDER_REQUEST' : response.status === 401 ? 'OAUTH_RENDER_AUTH' : response.status === 403 ? 'OAUTH_RENDER_PERMISSION' : response.status === 404 ? 'OAUTH_RENDER_SERVICE' : response.status === 429 ? 'OAUTH_RENDER_RATE' : response.status >= 500 ? 'OAUTH_RENDER_UNAVAILABLE' : 'OAUTH_SAVE';
    throw new RenderPersistenceError(code, response.status);
  }
  // The response may contain secrets. Consume it without returning or logging it.
  await response.arrayBuffer();
}

// Opt-in operational probe uses only a dedicated, non-secret diagnostic variable.
// It reproduces the old empty PUT and always removes the probe afterwards.
export async function probeRenderPersistence(serviceId: string, apiKey: string, fetcher: typeof fetch = fetch) {
  const key = 'CRM_OAUTH_RENDER_WRITE_PROBE';
  let emptyPutStatus: number | null = null;
  try {
    await renderRequest(serviceId, apiKey, key, 'diagnostic-only', fetcher);
    const response = await fetcher(`https://api.render.com/v1/services/${encodeURIComponent(serviceId.trim())}/env-vars/${key}`, {
      method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '' }),
    });
    emptyPutStatus = response.status;
    await response.arrayBuffer();
  } finally {
    await renderRequest(serviceId, apiKey, key, '', fetcher);
  }
  return { writeVerified: true, clearVerified: true, legacyEmptyPutStatus: emptyPutStatus };
}
