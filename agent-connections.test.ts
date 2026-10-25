import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentConnections } from './agent-connections.ts';
import { CHANNELS, ProviderAccessError } from './advertising-agent.ts';

test('shared evidence verifies all configured channels once, expires and invalidates after credential change', async () => {
  let now = Date.parse('2026-10-23T12:00:00Z');
  let calls = 0;
  const env = { META_PAGE_ACCESS_TOKEN: 'private-token' };
  const pool = new AgentConnections({
    configuration: () => CHANNELS.map(channel => ({ channel, configured: channel !== 'youtube', missing: [] })),
    verify: async channel => { calls++; await Promise.resolve(); if (channel === 'instagram') throw Error('provider returned private-token'); return { readVerified: true, writeVerified: true }; },
  }, env, () => now);
  assert.equal(pool.snapshot()[0].state, 'not_checked');
  const first = pool.refresh();
  assert.equal(first, pool.refresh());
  const results = await first;
  assert.equal(calls, 4);
  assert.equal(results.find(row => row.channel === 'youtube')!.state, 'missing_credentials');
  assert.equal(results.find(row => row.channel === 'instagram')!.state, 'provider_rejected');
  assert.equal(results[0].readVerified, true);
  assert.equal(results[0].writeVerified, false);
  assert.equal(JSON.stringify(results).includes('private-token'), false);
  now += 15 * 60_000;
  assert.equal(pool.snapshot()[0].state, 'verified_read');
  assert.equal(pool.snapshot()[0].diagnosticStale, true);
  assert.equal(pool.snapshot()[1].state, 'provider_rejected');
  assert.equal(pool.snapshot()[0].readVerified, false);
  env.META_PAGE_ACCESS_TOKEN = 'replacement';
  assert.equal(pool.snapshot()[0].state, 'not_checked');
});

test('credential rotation during a check cannot validate the replacement credential', async () => {
  const env = { META_PAGE_ACCESS_TOKEN: 'old' };
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pool = new AgentConnections({
    configuration: () => CHANNELS.map(channel => ({ channel, configured: true, missing: [] })),
    verify: async () => { await gate; return { readVerified: true, writeVerified: false }; },
  }, env);
  const pending = pool.refresh();
  env.META_PAGE_ACCESS_TOKEN = 'new'; release();
  assert.equal((await pending).every(row => row.state === 'not_checked'), true);
});

test('diagnostics distinguish invalid account IDs from rejected credentials without provider text', async () => {
  const pool = new AgentConnections({
    configuration: () => CHANNELS.map(channel => ({ channel, configured: true, missing: [] })),
    verify: async channel => { if (channel === 'facebook') throw Error('AD_MISSING'); throw new ProviderAccessError(400, 190); },
  }, {});
  const rows = await pool.refresh();
  assert.equal(rows[0].state, 'invalid_configuration');
  assert.equal(rows[1].failureReason, 'credentials');
  assert.equal(rows[1].httpStatus, 400);
  assert.equal(rows[1].providerCode, 190);
});

test('provider reason allowlist discards arbitrary error text', () => {
  assert.equal(new ProviderAccessError(400, null, 'invalid_grant').reason, 'credentials');
  assert.equal(new ProviderAccessError(403, null, 'DEVELOPER_TOKEN_NOT_APPROVED').providerReason, 'DEVELOPER_TOKEN_NOT_APPROVED');
  assert.equal(new ProviderAccessError(400, null, 'private-token-should-not-leak').providerReason, null);
});

 test('automatic checks reuse evidence, coalesce requests and recheck failed channels after ten minutes', async () => {
  let now = Date.parse('2026-10-25T12:00:00Z'); let calls = 0;
  const pool = new AgentConnections({
    configuration: () => CHANNELS.map(channel => ({channel, configured: true, missing: []})),
    verify: async channel => { calls++; if(channel === 'meta_ads') throw new ProviderAccessError(401, 190); return {readVerified: true, writeVerified: false}; },
  }, {}, () => now);
  await Promise.all([pool.ensureFresh(), pool.ensureFresh()]);
  assert.equal(calls, 5);
  now += 9 * 60_000; await pool.ensureFresh(); assert.equal(calls, 5);
  now += 60_000; const rows = await pool.ensureFresh(); assert.equal(calls, 10);
  assert.equal(rows.find(row => row.channel === 'meta_ads')!.state, 'provider_rejected');
  assert.equal(rows.find(row => row.channel === 'google_ads')!.readVerified, true);
  assert.equal(rows.every(row => row.checkedAt === new Date(now).toISOString()), true);
});
