// Never include Render response bodies or credentials in errors or logs.
export class RenderPersistenceError extends Error {
  readonly code: string;
  readonly httpStatus?: number;
  constructor(code: string, httpStatus?: number) { super(code); this.code = code; this.httpStatus = httpStatus; }
}
export async function renderRequest(serviceId: string, apiKey: string, key?: string, value?: string, fetcher: typeof fetch = fetch) {
  if (!serviceId?.trim() || !apiKey?.trim()) throw new RenderPersistenceError('OAUTH_RENDER_CONFIG');
  let response: Response;
  try {
    response = await fetcher(`https://api.render.com/v1/services/${encodeURIComponent(serviceId.trim())}${key ? `/env-vars/${encodeURIComponent(key)}` : ''}`, {
      method: key ? 'PUT' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey.trim()}`, ...(key ? { 'Content-Type': 'application/json' } : {}) },
      ...(key ? { body: JSON.stringify({ value }) } : {}),
    });
  } catch { throw new RenderPersistenceError('OAUTH_RENDER_UNAVAILABLE'); }
  if (!response.ok) {
    const code = response.status === 401 ? 'OAUTH_RENDER_AUTH' : response.status === 403 ? 'OAUTH_RENDER_PERMISSION' : response.status === 404 ? 'OAUTH_RENDER_SERVICE' : response.status === 429 ? 'OAUTH_RENDER_RATE' : response.status >= 500 ? 'OAUTH_RENDER_UNAVAILABLE' : 'OAUTH_SAVE';
    throw new RenderPersistenceError(code, response.status);
  }
  // The response may contain secrets. Consume it without returning or logging it.
  await response.arrayBuffer();
}
