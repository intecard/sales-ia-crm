import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRequest, probeRenderPersistence, RenderPersistenceError } from './render-persistence.ts';

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
  assert.equal(calls[1].method, 'DELETE');
  assert.equal(calls[1].body, undefined);
});

test('already absent optional variable is cleared only after verifying the service still exists', async () => {
  const calls: string[] = [];
  await renderRequest('srv-test', 'secret', 'OPTIONAL', '', async (_url, init) => { calls.push(init!.method!); return new Response(null, { status: init!.method === 'DELETE' ? 404 : 200 }); });
  assert.deepEqual(calls, ['DELETE', 'GET']);
  await assert.rejects(renderRequest('missing', 'secret', 'OPTIONAL', '', async () => new Response(null, {status:404})), /OAUTH_RENDER_SERVICE/);
});
test('operational probe reproduces empty PUT rejection and removes only its own diagnostic variable', async () => {
  const methods: string[] = [];
  const result = await probeRenderPersistence('srv-test', 'secret', async (url, init) => {
    assert.ok(String(url).endsWith('/env-vars/CRM_OAUTH_RENDER_WRITE_PROBE'));
    methods.push(init!.method!);
    return new Response(null,{status:init!.method === 'DELETE' ? 204 : init!.body === '{"value":""}' ? 400 : 200});
  });
  assert.deepEqual(methods,['PUT','PUT','DELETE']);
  assert.deepEqual(result,{writeVerified:true,clearVerified:true,legacyEmptyPutStatus:400});
});
