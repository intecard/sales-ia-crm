import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createIntegrationOAuth } from './integration-oauth.ts';

type HarnessOptions = { mismatch?: boolean; saveFailure?: boolean; missingScope?: boolean };
async function harness(options: HarnessOptions = {}) {
  let time = Date.now();
  const env: NodeJS.ProcessEnv = {
    APP_URL: 'https://crm.example.test', RENDER_API_KEY: 'private-render', RENDER_SERVICE_ID: 'service',
    META_APP_ID: '123', META_APP_SECRET: 'private-meta', META_PAGE_ID: '111', INSTAGRAM_BUSINESS_ACCOUNT_ID: '222', META_AD_ACCOUNT_ID: '333',
    GOOGLE_ADS_CLIENT_ID: 'client.apps.googleusercontent.com', GOOGLE_ADS_CLIENT_SECRET: 'private-google', GOOGLE_ADS_CUSTOMER_ID: '444', GOOGLE_ADS_DEVELOPER_TOKEN: 'private-developer',
    YOUTUBE_CLIENT_ID: 'youtube.apps.googleusercontent.com', YOUTUBE_CLIENT_SECRET: 'private-youtube', YOUTUBE_CHANNEL_ID: 'channel-1',
    YOUTUBE_REFRESH_TOKEN: 'previous-refresh',
  };
  let saved: Record<string, string> | null = null, calls = 0, verified = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    const url = String(input), form = new URLSearchParams(String(init?.body || ''));
    const out = (body: unknown) => new Response(JSON.stringify(body));
    if (url === 'https://oauth2.googleapis.com/token') {
      if (form.get('grant_type') === 'authorization_code') {
        assert.ok((form.get('code_verifier') || '').length >= 43);
        assert.equal(form.get('code'), 'one-time-code');
        return out({ access_token: 'private-access', refresh_token: 'new-private-refresh', scope: options.missingScope ? '' : 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/adwords' });
      }
      return out({ access_token: 'private-access' });
    }
    if (url.includes('/youtube/v3/channels')) return out({ items: [{ id: options.mismatch ? 'different-channel' : 'channel-1', snippet: { title: 'Channel' } }] });
    if (url.includes('googleads.googleapis.com')) return out({ results: [{ customer: { id: '444', currencyCode: 'DOP' } }] });
    if (url.includes('/oauth/access_token')) return out({ access_token: 'private-user-token' });
    if (url.includes('fields=id,access_token')) return out({ id: '111', access_token: 'private-page-token', instagram_business_account: { id: '222' } });
    if (url.includes('/111?')) return out({ id: '111', name: 'Page' });
    if (url.includes('/222?')) return out({ id: '222', username: 'Instagram' });
    if (url.includes('/act_333?')) return out({ id: 'act_333', account_status: 1, currency: 'DOP' });
    throw Error('Unexpected outbound endpoint');
  };
  const app = express(); app.use(express.json());
  app.use('/oauth', createIntegrationOAuth({ env, fetcher, now: () => time, persist: async values => { if (options.saveFailure) throw Error('private-provider-error'); saved = values; }, verified: async () => { verified++; } }));
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/oauth`;
  async function start(p = 'youtube') {
    const response = await fetch(`${base}/${p}/start`, { method: 'POST', headers: { Cookie: 'crm_sales_session=session-a', 'Content-Type': 'application/json' }, body: JSON.stringify({ redirectRegistered: true, reviewedPermissions: true }) });
    const data = await response.json();
    const state = new URL(data.authorizationUrl).searchParams.get('state')!;
    return { response, data, state, cookie: `crm_sales_session=session-a; crm_oauth_${p}=${state}` };
  }
  async function callback(p: string, state: string, cookie: string, suffix = '&code=one-time-code') {
    const bridge = await fetch(`${base}/${p}/callback?state=${state}${suffix}`, { headers: { Cookie: cookie.split(';').find(value => value.trim().startsWith('crm_oauth_'))?.trim() || '' }, redirect: 'manual' });
    if (!bridge.ok) return bridge;
    assert.equal(bridge.status, 200);
    const html = await bridge.text();
    assert.equal(html.includes('one-time-code'), false);
    assert.ok(html.includes('history.replaceState'));
    return fetch(`${base}/${p}/complete`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({state}), redirect: 'manual' });
  }
  return { env, base, start, callback, saved: () => saved, calls: () => calls, verified: () => verified, expire: () => { time += 600_001; }, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

test('OAuth renews all three providers server-side; secrets stay out of URLs and callback responses', async () => {
  const h = await harness();
  try {
    for (const provider of ['youtube', 'google_ads', 'meta']) {
      const flow = await h.start(provider);
      assert.equal(flow.response.status, 200);
      assert.ok(flow.response.headers.get('set-cookie')?.includes('HttpOnly'));
      assert.equal(JSON.stringify(flow.data).includes('private-'), false);
      const auth = new URL(flow.data.authorizationUrl);
      assert.equal(auth.searchParams.get('redirect_uri'), `https://crm.example.test/api/advertising/oauth/${provider}/callback`);
      if (provider !== 'meta') assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
      const response = await h.callback(provider, flow.state, flow.cookie);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).redirect, '/?integration_reconnected=' + provider);
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.ok(h.saved());
      assert.equal((await h.callback(provider, flow.state, flow.cookie)).status, 409);
    }
    assert.equal(h.verified(), 3);
  } finally { await h.close(); }
});

test('state, browser session, TTL and explicit permission review are mandatory', async () => {
  const h = await harness();
  try {
    assert.equal((await fetch(h.base + '/youtube/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
    const flow = await h.start();
    assert.equal((await h.callback('youtube', flow.state, flow.cookie.replace('session-a', 'session-b'))).status, 409);
    assert.equal((await h.callback('youtube', flow.state, 'crm_sales_session=session-a')).status, 409);
    assert.equal(h.calls(), 0);
    h.expire();
    assert.equal((await h.callback('youtube', flow.state, flow.cookie)).status, 409);
    assert.equal(h.saved(), null);
  } finally { await h.close(); }
});

test('denial, changed destinations, missing scopes and persistence failure do not replace active credentials', async () => {
  for (const mode of ['denied', 'configChanged', 'mismatch', 'missingScope', 'saveFailure']) {
    const h = await harness({ mismatch: mode === 'mismatch', missingScope: mode === 'missingScope', saveFailure: mode === 'saveFailure' });
    try {
      const flow = await h.start();
      if (mode === 'configChanged') h.env.YOUTUBE_CHANNEL_ID = 'changed';
      const response = await h.callback('youtube', flow.state, flow.cookie, mode === 'denied' ? '&error=access_denied' : '&code=one-time-code');
      assert.equal(response.status, 409);
      const text = await response.text(); assert.equal(text.includes('private-'), false);
      assert.equal(h.env.YOUTUBE_REFRESH_TOKEN, 'previous-refresh');
      assert.equal(h.verified(), 0);
    } finally { await h.close(); }
  }
});

test('cross-site callback captures no credentials and exchanges code only on the same-origin owner completion', async () => {
  const h = await harness();
  try {
    const flow = await h.start();
    const oauthCookie = flow.cookie.split(';')[1].trim();
    const bridge = await fetch(h.base + '/youtube/callback?state=' + flow.state + '&code=one-time-code', { headers: { Cookie: oauthCookie } });
    assert.equal(bridge.status,200);
    assert.equal(h.calls(),0);
    assert.equal(h.saved(),null);
    const wrong = await fetch(h.base+'/youtube/complete',{method:'POST',headers:{'Content-Type':'application/json',Cookie:oauthCookie},body:JSON.stringify({state:flow.state})});
    assert.equal(wrong.status,409);assert.equal(h.calls(),0);
    const valid = await fetch(h.base+'/youtube/complete',{method:'POST',headers:{'Content-Type':'application/json',Cookie:flow.cookie},body:JSON.stringify({state:flow.state})});
    assert.equal(valid.status,200);assert.ok(h.saved());
  } finally { await h.close(); }
});
