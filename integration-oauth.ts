import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import { AdvertisingAgent } from './advertising-agent.ts';

export const OAUTH_PROVIDERS = ['meta', 'google_ads', 'youtube'] as const;
type Provider = (typeof OAUTH_PROVIDERS)[number];
type Pending = { provider: Provider; sessionHash: string; verifier: string; expires: number; configHash: string };
type Options = {
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  now?: () => number;
  persist: (variables: Record<string, string>) => Promise<void>;
  verified: () => Promise<unknown>;
};
const scopes: Record<Provider, string[]> = {
  meta: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish', 'ads_read', 'ads_management'],
  google_ads: ['https://www.googleapis.com/auth/adwords'],
  youtube: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/youtube.upload'],
};
const messages: Record<string, string> = {
  OAUTH_CONFIG: 'Falta la configuración del cliente OAuth o un APP_URL HTTPS válido.',
  OAUTH_STATE: 'La autorización venció, fue usada o no corresponde a esta sesión. Iníciala otra vez desde Agentes IA.',
  OAUTH_DENIED: 'No se concedió la autorización. No se modificaron las credenciales.',
  OAUTH_PROVIDER: 'El proveedor rechazó el intercambio. Revisa el cliente OAuth, el secreto y la URL de retorno registrada.',
  OAUTH_REFRESH: 'Google no devolvió un token de renovación. Repite la autorización con consentimiento.',
  OAUTH_SCOPE: 'No se concedieron todos los permisos solicitados. No se sustituyeron los accesos anteriores.',
  OAUTH_ACCOUNT: 'La cuenta autorizada no permite acceder a los destinos configurados. Revisa cuenta, permisos, APIs y acceso del developer token.',
  OAUTH_SAVE: 'No se pudieron guardar todos los accesos en Render. La conexión no se marca como completada; revisa Conexiones y repite la autorización.',
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function sessionHash(cookie: string) {
  return hash(cookie.split(';').map(value => value.trim()).find(value => value.startsWith('crm_sales_session=')) || '');
}
function provider(value: string): Provider {
  if (!OAUTH_PROVIDERS.includes(value as Provider)) throw Error('OAUTH_CONFIG');
  return value as Provider;
}

// Mounted behind the existing owner session and POST action-header middleware.
export function createIntegrationOAuth(options: Options) {
  const env = options.env || process.env, fetcher = options.fetcher || fetch, now = options.now || Date.now;
  const pending = new Map<string, Pending>();
  const router = express.Router();
  const version = () => /^v\d+\.0$/.test(env.META_GRAPH_API_VERSION || '') ? env.META_GRAPH_API_VERSION! : 'v26.0';
  function config(p: Provider) {
    let origin: URL;
    try { origin = new URL(env.APP_URL || ''); } catch { throw Error('OAUTH_CONFIG'); }
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Error('OAUTH_CONFIG');
    const prefix = p === 'google_ads' ? 'GOOGLE_ADS' : 'YOUTUBE';
    const clientId = p === 'meta' ? env.META_APP_ID : env[`${prefix}_CLIENT_ID`];
    const clientSecret = p === 'meta' ? env.META_APP_SECRET : env[`${prefix}_CLIENT_SECRET`];
    if (!clientId?.trim() || !clientSecret?.trim() || !env.RENDER_API_KEY || !env.RENDER_SERVICE_ID) throw Error('OAUTH_CONFIG');
    const redirectUri = `${origin.origin}/api/advertising/oauth/${p}/callback`;
    const configHash = hash(JSON.stringify([clientId, clientSecret, redirectUri, version(), env.META_PAGE_ID, env.INSTAGRAM_BUSINESS_ACCOUNT_ID, env.META_AD_ACCOUNT_ID, env.GOOGLE_ADS_CUSTOMER_ID, env.YOUTUBE_CHANNEL_ID]));
    return { clientId, clientSecret, redirectUri, configHash };
  }
  async function json(url: string, init: RequestInit) {
    try {
      const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw Error('OAUTH_PROVIDER');
      return await response.json();
    } catch { throw Error('OAUTH_PROVIDER'); }
  }
  router.get('/configuration', (_req, res) => {
    const providers = OAUTH_PROVIDERS.map(p => {
      try { const value = config(p); return { provider: p, ready: true, redirectUri: value.redirectUri, scopes: scopes[p] }; }
      catch { return { provider: p, ready: false, redirectUri: null, scopes: scopes[p] }; }
    });
    res.json({ providers, scope: 'platform_owner', requiresProviderRedirectRegistration: true });
  });
  router.post('/:provider/start', (req, res) => {
    try {
      const p = provider(String(req.params.provider));
      if (req.body?.redirectRegistered !== true || req.body?.reviewedPermissions !== true) return res.status(400).json({ error: 'Confirma la URL de retorno y revisa los permisos antes de autorizar.' });
      const c = config(p);
      for (const [state, entry] of pending) if (entry.expires <= now()) pending.delete(state);
      if (pending.size >= 20) return res.status(429).json({ error: 'Hay autorizaciones pendientes. Espera diez minutos antes de repetir.' });
      const state = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
      pending.set(state, { provider: p, sessionHash: sessionHash(req.headers.cookie || ''), verifier, expires: now() + 600_000, configHash: c.configHash });
      const url = new URL(p === 'meta' ? `https://www.facebook.com/${version()}/dialog/oauth` : 'https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: c.clientId!, redirect_uri: c.redirectUri, response_type: 'code', state, scope: scopes[p].join(p === 'meta' ? ',' : ' '), ...(p === 'meta' ? { auth_type: 'rerequest' } : { access_type: 'offline', prompt: 'consent select_account', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }) }).toString();
      res.cookie(`crm_oauth_${p}`, state, { httpOnly: true, secure: true, sameSite: 'lax', path: `/api/advertising/oauth/${p}`, maxAge: 600_000 });
      return res.json({ authorizationUrl: url.toString() });
    } catch { return res.status(409).json({ error: messages.OAUTH_CONFIG }); }
  });
  router.get('/:provider/callback', async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
    try {
      const p = provider(String(req.params.provider));
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const cookieState = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`crm_oauth_${p}=`))?.slice(`crm_oauth_${p}=`.length);
      const entry = pending.get(state), c = config(p);
      if (!entry || entry.provider !== p || entry.expires <= now() || state !== cookieState || entry.sessionHash !== sessionHash(req.headers.cookie || '') || entry.configHash !== c.configHash) throw Error('OAUTH_STATE');
      pending.delete(state);
      res.clearCookie(`crm_oauth_${p}`, { secure: true, sameSite: 'lax', path: `/api/advertising/oauth/${p}` });
      if (req.query.error) throw Error('OAUTH_DENIED');
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      if (!code || code.length > 4096) throw Error('OAUTH_PROVIDER');
      let variables: Record<string, string>;
      if (p === 'meta') {
        const token = await json(`https://graph.facebook.com/${version()}/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.clientId!, client_secret: c.clientSecret!, redirect_uri: c.redirectUri, code }).toString() });
        if (typeof token.access_token !== 'string' || !token.access_token) throw Error('OAUTH_PROVIDER');
        // Long-lived user token, followed by the access token for the existing Page.
        const long = await json(`https://graph.facebook.com/${version()}/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: c.clientId!, client_secret: c.clientSecret!, fb_exchange_token: token.access_token }).toString() });
        if (typeof long.access_token !== 'string' || !long.access_token || !/^\d+$/.test(env.META_PAGE_ID || '')) throw Error('OAUTH_ACCOUNT');
        const page = await json(`https://graph.facebook.com/${version()}/${env.META_PAGE_ID}?fields=id,access_token,instagram_business_account`, { headers: { Authorization: `Bearer ${long.access_token}` } });
        if (page.id !== env.META_PAGE_ID || typeof page.access_token !== 'string' || !page.access_token || page.instagram_business_account?.id !== env.INSTAGRAM_BUSINESS_ACCOUNT_ID) throw Error('OAUTH_ACCOUNT');
        variables = { META_PAGE_ACCESS_TOKEN: page.access_token, META_ADS_ACCESS_TOKEN: long.access_token };
      } else {
        const token = await json('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.clientId!, client_secret: c.clientSecret!, redirect_uri: c.redirectUri, code, code_verifier: entry.verifier, grant_type: 'authorization_code' }).toString() });
        if (typeof token.refresh_token !== 'string' || !token.refresh_token) throw Error('OAUTH_REFRESH');
        const granted = new Set(typeof token.scope === 'string' ? token.scope.split(' ') : []);
        if (!scopes[p].every(scope => granted.has(scope))) throw Error('OAUTH_SCOPE');
        variables = { [`${p === 'google_ads' ? 'GOOGLE_ADS' : 'YOUTUBE'}_REFRESH_TOKEN`]: token.refresh_token };
      }
      // Validate the intended existing accounts with temporary credentials, before saving.
      const temporary = new AdvertisingAgent({ request: async () => [] }, { get: async () => null }, { ...env, ...variables }, fetcher);
      try { for (const channel of p === 'meta' ? ['facebook', 'instagram', 'meta_ads'] as const : [p]) await temporary.verify(channel); }
      catch { throw Error('OAUTH_ACCOUNT'); }
      try { await options.persist(variables); } catch { throw Error('OAUTH_SAVE'); }
      Object.assign(env, variables);
      await options.verified();
      return res.redirect(303, '/?integration_reconnected=' + p);
    } catch (error) {
      const key = error instanceof Error && messages[error.message] ? error.message : 'OAUTH_PROVIDER';
      // Fixed public text only; no code, state, token, client secret, provider payload or stack.
      return res.status(409).type('text/plain').send(`${messages[key]}\n\nVuelve al CRM → Agentes IA → Plataformas compartidas.`);
    }
  });
  return router;
}
