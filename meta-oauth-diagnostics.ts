// Fixed diagnostics only: never return provider messages, tokens, or request URLs.
export class MetaOAuthError extends Error {
  readonly stage: string; readonly httpStatus: number; readonly providerCode?: number; readonly providerSubcode?: number;
  constructor(stage: string, httpStatus: number, providerCode?: number, providerSubcode?: number, code = 'OAUTH_META_EXCHANGE') { super(code); this.stage = stage; this.httpStatus = httpStatus; this.providerCode = providerCode; this.providerSubcode = providerSubcode; }
}
export async function metaOAuthJson(url: string, init: RequestInit, stage: string, fetcher: typeof fetch = fetch) {
  let response: Response;
  try { response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(20_000) }); }
  catch { throw new MetaOAuthError(stage, 0, undefined, undefined, 'OAUTH_META_NETWORK'); }
  let data: any;
  try { data = await response.json(); } catch { throw new MetaOAuthError(stage, response.status); }
  if (!response.ok || data?.error) {
    const e = data?.error;
    const message = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
    const code = /client secret|app secret|client_secret/.test(message) ? 'OAUTH_META_SECRET'
      : /redirect_uri|redirect uri|redirect url/.test(message) ? 'OAUTH_META_REDIRECT'
      : /authorization code|verification code|code has been used|code was issued/.test(message) ? 'OAUTH_META_CODE'
      : stage === 'page_access' ? 'OAUTH_META_PAGE' : 'OAUTH_META_EXCHANGE';
    throw new MetaOAuthError(stage, response.status, Number.isInteger(e?.code) ? e.code : undefined, Number.isInteger(e?.error_subcode) ? e.error_subcode : undefined, code);
  }
  return data;
}
export async function probeMetaClient(env: NodeJS.ProcessEnv, fetcher: typeof fetch = fetch) {
  const clientId = env.META_APP_ID?.trim(), secret = env.META_APP_SECRET?.trim();
  if (!clientId || !secret) return { clientVerified: false, code: 'OAUTH_CONFIG' };
  try {
    const data = await metaOAuthJson('https://graph.facebook.com/v26.0/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: 'client_credentials' }).toString(),
    }, 'client_check', fetcher);
    return { clientVerified: typeof data.access_token === 'string' && !!data.access_token };
  } catch (error) {
    return error instanceof MetaOAuthError ? { clientVerified: false, code: error.message, stage: error.stage, httpStatus: error.httpStatus, providerCode: error.providerCode, providerSubcode: error.providerSubcode } : { clientVerified: false, code: 'OAUTH_META_EXCHANGE' };
  }
}
