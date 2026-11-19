import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWithFallback } from './ai-resilience.ts';

test('provider outage falls back once, cools down failure, and never logs raw credentials', async () => {
  const cooldowns = new Map<string, number>();
  const attempted: string[] = [],
    logs: string[] = [];
  const options = {
    models: ['primary', 'backup', 'backup'],
    cooldowns,
    cooldownMs: 120000,
    clock: () => 1000,
    onFailure: (_model: string, code: string) => logs.push(code),
    generate: async (model: string, timeout: number) => {
      attempted.push(model);
      assert.ok(timeout <= 12000);
      if (model === 'primary')
        throw Object.assign(Error('private provider payload'), { status: 503 });
      return { text: 'Respuesta útil' };
    },
  };
  assert.equal((await generateWithFallback(options)).text, 'Respuesta útil');
  assert.deepEqual(attempted, ['primary', 'backup']);
  assert.equal(cooldowns.get('primary'), 121000);
  attempted.length = 0;
  await generateWithFallback(options);
  assert.deepEqual(attempted, ['backup']);
  assert.deepEqual(logs, ['AI_PROVIDER_TEMPORARILY_UNAVAILABLE']);
});
test('authentication and content restrictions stop without changing providers', async () => {
  for (const failure of [401, 403, 'SAFETY']) {
    let calls = 0;
    await assert.rejects(
      generateWithFallback({
        models: ['a', 'b'],
        cooldowns: new Map(),
        cooldownMs: 100,
        generate: async () => {
          calls++;
          if (typeof failure === 'number') throw { status: failure };
          return { text: '', candidates: [{ finishReason: failure }] };
        },
      }),
    );
    assert.equal(calls, 1);
  }
});
test('empty or truncated answers use backup, exhausted budget cannot start another request', async () => {
  let now = 0,
    calls = 0;
  await assert.rejects(
    generateWithFallback({
      models: ['a', 'b'],
      cooldowns: new Map(),
      cooldownMs: 100,
      clock: () => now,
      budgetMs: 2000,
      generate: async () => {
        calls++;
        now = 2001;
        return { text: 'partial', candidates: [{ finishReason: 'MAX_TOKENS' }] };
      },
    }),
  );
  assert.equal(calls, 1);
  calls = 0;
  assert.equal(
    (
      await generateWithFallback({
        models: ['a', 'b'],
        cooldowns: new Map(),
        cooldownMs: 100,
        generate: async () => ({ text: ++calls === 1 ? '' : 'ready' }),
      })
    ).text,
    'ready',
  );
});
