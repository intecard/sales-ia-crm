import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newConversation } from './whatsapp-conversation.ts';
import {
  rememberSalesPreferences,
  internationalCatalog,
  internationalPriceReply,
  usesInternationalUsd,
  USD_OFFER,
} from './sales-policy.ts';
import {
  followupEligibility,
  followupText,
  chooseStrategy,
  SalesFollowupAgent,
  type SalesAutomationSettings,
} from './sales-followup.ts';
import type { SalesStore, SalesOpportunity } from './sales-agent.ts';
const now = Date.parse('2026-11-18T19:00:00Z');
const sale = (change: Partial<SalesOpportunity> = {}): SalesOpportunity => ({
  contact_key: 'test',
  profile: { phone: '18090000000' },
  stage: 'payment_pending',
  control: 'auto',
  objection: '',
  expected_amount: 2500,
  paid_amount: null,
  next_action: '',
  follow_up_at: new Date(now - 1000).toISOString(),
  last_inbound_at: new Date(now - 20 * 3600000).toISOString(),
  updated_at: new Date(now).toISOString(),
  ...change,
});
test('USD is explicit, persists, and does not infer residency from phone', () => {
  const c = newConversation();
  rememberSalesPreferences(c, 'Quiero pagar en dólares');
  assert.equal(usesInternationalUsd(c), false);
  assert.match(internationalPriceReply(c, 'pagar en dólares')!.reply, /Resides fuera/);
  rememberSalesPreferences(c, 'Vivo en Estados Unidos');
  assert.equal(usesInternationalUsd(c), true);
  assert.match(internationalPriceReply(c, 'vivo fuera')!.reply, /US\$60.*5 pagos de US\$30/);
  rememberSalesPreferences(c, 'Prefiero pagar en pesos');
  assert.equal(usesInternationalUsd(c), false);
  rememberSalesPreferences(c, 'No vivo fuera, vivo en RD');
  assert.equal(c.facts.residesAbroad, false);
});
test('USD quote replaces academic price without mutating shared catalog', () => {
  const c = newConversation();
  c.facts = { residesAbroad: true, paymentCurrency: 'USD' };
  const source = {
    text: 'Inversión: inscripción RD$2,500.',
    courses: [{ investment: 'RD$2500', text: 'Inversión: inscripción RD$2,500.' }],
  };
  const result = internationalCatalog(source, c);
  assert.equal(result.courses[0].investment, USD_OFFER);
  assert.doesNotMatch(result.courses[0].text, /RD\$/);
  assert.match(source.text, /RD\$/);
});
test('no collections for reviewed, paid, opted-out or human-controlled cases', () => {
  for (const stage of ['won', 'payment_review'] as const)
    assert.equal(followupEligibility(sale({ stage }), now), 'NO_COLLECTION');
  for (const control of ['human', 'opted_out'] as const)
    assert.equal(followupEligibility(sale({ control }), now), 'CONTACT_PAUSED');
  assert.equal(
    followupEligibility(sale({ profile: { phone: '18090000000', followUpConsent: 'no' } }), now),
    'CONTACT_PAUSED',
  );
});
test('old contacts require explicit consent and a template; window fails closed', () => {
  assert.equal(followupEligibility(sale(), now), 'text');
  const old = sale({ last_inbound_at: new Date(now - 24 * 3600000).toISOString() });
  assert.equal(followupEligibility(old, now), 'CONSENT_REQUIRED');
  old.profile.followUpConsent = 'yes';
  assert.equal(followupEligibility(old, now), 'template');
  old.last_inbound_at = 'invalid';
  assert.equal(followupEligibility(old, now), 'INVALID_WINDOW');
});
test('contact consent is explicit and refusal wins', () => {
  const c = newConversation();
  rememberSalesPreferences(c, 'Puedes escribirme mañana');
  assert.equal(c.facts.followUpConsent, 'yes');
  rememberSalesPreferences(c, 'No quiero más mensajes');
  assert.equal(c.facts.followUpConsent, 'no');
});
test('follow-up pricing is international and never calls a receipt paid', () => {
  const msg = followupText(
    sale({ profile: { residesAbroad: true, paymentCurrency: 'USD' } }),
    'clarify',
  );
  assert.match(msg, /US\$210/);
  assert.match(msg, /no repitas la transferencia/);
  assert.match(msg, /BAJA/);
});
test('strategies use sufficient observations and do not change offers', () => {
  assert.equal(
    chooseStrategy('b', [
      { strategy: 'assist', sent: 50, paid: 1 },
      { strategy: 'clarify', sent: 50, paid: 30 },
    ]),
    'clarify',
  );
  assert.ok(
    ['assist', 'clarify'].includes(
      chooseStrategy('b', [{ strategy: 'clarify', sent: 1, paid: 1 }]),
    ),
  );
});
test('missing approved template is blocked before provider send', async () => {
  const updates: any[] = [];
  const settings = {
    enabled: true,
    owner_phone: '18097065502',
    owner_last_inbound_at: null,
    owner_template: '',
    followup_template: '',
    template_language: 'es',
  } as SalesAutomationSettings;
  const store = {
    settings: async () => ({ enabled: true }),
    request: async (resource: string, method?: string, body?: unknown) => {
      if (method === 'PATCH') {
        updates.push(body);
        return [];
      }
      return [settings];
    },
  } as unknown as SalesStore;
  const agent = new SalesFollowupAgent(store, {
    WHATSAPP_ACCESS_TOKEN: 'test',
    WHATSAPP_PHONE_NUMBER_ID: 'test',
  });
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error('Should not send');
  };
  try {
    await (agent as any).deliver(
      { id: 'test', kind: 'owner', payload: { text: 'Test' } },
      settings,
    );
    assert.equal(calls, 0);
    assert.equal(updates[0].state, 'blocked');
    assert.equal(updates[0].last_error, 'APPROVED_TEMPLATE_REQUIRED');
  } finally {
    globalThis.fetch = original;
  }
});
test('ambiguous network outcome is held for reconciliation, never auto retry', async () => {
  const updates: any[] = [];
  const settings = {
    enabled: true,
    owner_phone: '18097065502',
    owner_last_inbound_at: new Date().toISOString(),
  } as SalesAutomationSettings;
  const store = {
    settings: async () => ({ enabled: true }),
    request: async (_r: string, m?: string, b?: unknown) => {
      if (m === 'PATCH') {
        updates.push(b);
        return [];
      }
      return [settings];
    },
  } as unknown as SalesStore;
  const agent = new SalesFollowupAgent(store, {
    WHATSAPP_ACCESS_TOKEN: 'test',
    WHATSAPP_PHONE_NUMBER_ID: 'test',
  });
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('timeout after acceptance');
  };
  try {
    await (agent as any).deliver(
      { id: 'test', kind: 'owner', payload: { text: 'Test' } },
      settings,
    );
    assert.equal(updates[0].state, 'unknown');
  } finally {
    globalThis.fetch = original;
  }
});
