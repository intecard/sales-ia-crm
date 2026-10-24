import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRequest, RenderPersistenceError } from './render-persistence.ts';

test('Render failures expose only fixed codes, never response secrets', async () => {
  for (const [status, code] of [[401, 'OAUTH_RENDER_AUTH'], [403, 'OAUTH_RENDER_PERMISSION'], [404, 'OAUTH_RENDER_SERVICE'], [429, 'OAUTH_RENDER_RATE'], [503, 'OAUTH_RENDER_UNAVAILABLE']] as const) {
    await assert.rejects(renderRequest('srv-test', 'secret', 'TOKEN', 'private-token', async () => new Response('private-provider-body', { status })), error => error instanceof RenderPersistenceError && error.code === code && error.httpStatus === status && !String(error).includes('private'));
  }
});
test('read preflight does not mutate and writes preserve individual key semantics', async () => {
  const calls: RequestInit[] = [];
  const fetcher: typeof fetch = async (_url, init) => { calls.push(init!); return Response.json({ value: 'private-response' }); };
  assert.equal(await renderRequest('srv-test', 'secret', undefined, undefined, fetcher), undefined);
  assert.equal(await renderRequest('srv-test', 'secret', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', '', fetcher), undefined);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[1].method, 'PUT');
  assert.equal(calls[1].body, '{"value":""}');
});
