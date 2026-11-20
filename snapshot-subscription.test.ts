import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeSnapshot } from './src/lib/snapshot-subscription.ts';

test('a superseded view never receives a slow response, even if its transport ignores abort', async () => {
  let complete!: (value: string) => void;
  let signal!: AbortSignal;
  const values: string[] = [];
  const stop = subscribeSnapshot(s => { signal = s; return new Promise<string>(resolve => { complete = resolve; }); }, v => values.push(v), () => assert.fail('Unmounted errors must not be emitted'));
  stop(); complete('old company'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(signal.aborted, true); assert.deepEqual(values, []);
});
test('a failed read is reported once and polling does not overlap slow requests', async () => {
  let calls = 0, complete!: (v: number) => void;
  const values: number[] = [], errors: string[] = [];
  const stop = subscribeSnapshot(() => { calls++; return new Promise<number>(resolve => { complete = resolve; }); }, v => values.push(v), e => errors.push(e.message), 5);
  await new Promise(resolve => setTimeout(resolve, 22));
  assert.equal(calls, 1); complete(7); await new Promise(resolve => setImmediate(resolve)); stop();
  assert.deepEqual(values,[7]); assert.equal(errors.length,0);
  const stopFailure=subscribeSnapshot(async()=>{throw Error('Unavailable');},()=>assert.fail(),e=>errors.push(e.message));
  await new Promise(resolve=>setImmediate(resolve));stopFailure();assert.deepEqual(errors,['Unavailable']);
});
