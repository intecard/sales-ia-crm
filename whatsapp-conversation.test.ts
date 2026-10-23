import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ConversationStore, conversationKey, newConversation, rememberUser, rememberReply, fallbackReply, paymentReply, isPaymentQuestion } from './whatsapp-conversation.ts';

test('registration remembers selected course, name and updated schedule without restarting the pitch', () => {
  const state = newConversation();
  let id = 0;
  const turn = (text: string) => {
    rememberUser(state, text, String(++id));
    const result = fallbackReply(state, text);
    rememberReply(state, result.reply, result.awaiting);
    return result.reply;
  };
  assert.match(turn('Hola'), /asistente virtual/);
  turn('Autorizaciones médicas');
  assert.match(turn('Inscripción'), /nombre completo/);
  turn('Tarde');
  assert.match(turn('Luis alcides Ramirez Escalante'), /correo/);
  turn('Sábado y dame las instrucciones de pago');
  assert.equal(state.facts.fullName, 'Luis alcides Ramirez Escalante');
  assert.equal(state.facts.schedule, 'sabado tarde');
  assert.equal(state.facts.course, 'Técnico u Oficial de Autorizaciones Médicas');
  assert.equal(state.facts.paymentRequested, true);
  assert.doesNotMatch(turn('Cuál es la mensualidad'), /nombre|horario|beneficio|Hola/);
  assert.match(turn('Cuál es la mensualidad'), /2,000/);
  const payment = paymentReply(state, 'Banco de prueba: cuenta TEST-ONLY. Titular: institución de prueba.');
  assert.match(payment.reply, /TEST-ONLY/);
  assert.doesNotMatch(payment.reply, /¿/);
  assert.equal(isPaymentQuestion('¿Cuánto pago de mensualidad?'), false);
  assert.equal(isPaymentQuestion('Ya pagué, revisa el comprobante'), false);
  assert.equal(isPaymentQuestion('¿Cómo puedo pagar?'), true);
  assert.equal(isPaymentQuestion('Dame las instrucciones de pago'), true);
});

test('bounds history while keeping facts, ignores replay and does not turn a course question into enrollment', () => {
  const state = newConversation();
  rememberUser(state, 'Quiero inscribirme en autorizaciones médicas', '1');
  state.awaiting = 'fullName';
  rememberUser(state, 'Luis Ramirez', '2');
  rememberUser(state, 'Luis Ramirez', '2');
  assert.equal(state.turns.length, 2);
  rememberUser(state, '¿También ofrecen enfermería?', '3');
  assert.match(state.facts.course!, /Autorizaciones/);
  for (let i = 0; i < 40; i++) rememberUser(state, 'Consulta ' + i, String(i + 10));
  assert.equal(state.turns.length, 24);
  assert.equal(state.facts.fullName, 'Luis Ramirez');
  rememberUser(state, 'Prefiero enfermería', '90');
  assert.equal(state.facts.course, 'Enfermería');
});

test('contact/business isolation and serialized messages include previous writes', async () => {
  const store = new ConversationStore();
  const key = conversationKey('business', 'bsuid', 'DO.test');
  assert.notEqual(key, conversationKey('other-business', 'bsuid', 'DO.test'));
  await Promise.all([store.serial(key, async () => {
    const state = await store.get(key);
    rememberUser(state, 'Me llamo Luis Ramirez', 'a');
    await new Promise(resolve => setTimeout(resolve, 20));
    await store.save(key, state);
  }), store.serial(key, async () => {
    const state = await store.get(key);
    assert.equal(state.facts.fullName, 'Luis Ramirez');
    rememberUser(state, 'Tarde', 'b');
    await store.save(key, state);
  })]);
  assert.equal((await store.get(key)).turns.length, 2);
  assert.deepEqual((await store.get('different-contact')).facts, {});
  assert.equal(store.status().survivesRestart, false);
});

test('Supabase adapter reloads after restart, handles expiry and falls back honestly on failure', async () => {
  const originalFetch = globalThis.fetch;
  let row: any;
  let unavailable = false;
  globalThis.fetch = async (_url, init) => {
    if (unavailable) return new Response('{}', { status: 503 });
    if (init?.method === 'POST') { row = JSON.parse(String(init.body)); return new Response(null, { status: 201 }); }
    return new Response(JSON.stringify(row ? [row] : []));
  };
  try {
    const first = new ConversationStore('https://supabase.test', 'test-key');
    const state = newConversation();
    rememberUser(state, 'Me llamo Luis Ramirez', 'a');
    rememberReply(state, 'Gracias, ¿qué curso?', 'course', 'a');
    await first.save('test-key', state);
    const restarted = new ConversationStore('https://supabase.test', 'test-key');
    assert.equal((await restarted.get('test-key')).facts.fullName, 'Luis Ramirez');
    assert.equal(restarted.status().survivesRestart, true);
    row.expires_at = '2000-01-01T00:00:00Z';
    assert.deepEqual((await new ConversationStore('https://supabase.test', 'test-key').get('test-key')).facts, {});
    unavailable = true;
    await restarted.save('test-key', state);
    assert.equal(restarted.status().survivesRestart, false);
    assert.equal((await restarted.get('test-key')).facts.fullName, 'Luis Ramirez');
  } finally { globalThis.fetch = originalFetch; }
});

test('recuerda permiso explícito de llamada y permite revocarlo', () => {
  const c = newConversation();
  rememberUser(c, 'Me pueden llamar para explicarme el curso', 'call-1');
  assert.equal(c.facts.callbackConsent, 'yes');
  rememberUser(c, 'No me llamen', 'call-2');
  assert.equal(c.facts.callbackConsent, 'no');
  rememberUser(c, 'Gracias', 'call-3');
  assert.equal(c.facts.callbackConsent, 'no');
});
