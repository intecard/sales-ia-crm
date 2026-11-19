import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCatalog, rememberCatalogCourse } from './whatsapp-catalog.ts';
import { newConversation } from './whatsapp-conversation.ts';
import { internationalCatalog } from './sales-policy.ts';
import { salesCoachingReply } from './sales-coaching.ts';
import type { SalesOpportunity } from './sales-agent.ts';
const catalog = parseCatalog(
  readFileSync(new URL('./test-fixtures/whatsapp-catalog.txt', import.meta.url), 'utf8'),
);

test('budget coaching quotes the selected official plan, never grants discounts or changes enrollment', () => {
  const c = newConversation();
  rememberCatalogCourse(catalog, c, 'Farmacología');
  const result = salesCoachingReply(catalog, c, 'Está muy caro, tienen descuento?')!;
  assert.match(result.reply, /10,500/);
  assert.match(result.reply, /No tengo un descuento autorizado/);
  assert.equal(c.facts.wantsEnrollment, undefined);
  c.facts.residesAbroad = true;
  c.facts.paymentCurrency = 'USD';
  const usd = salesCoachingReply(internationalCatalog(catalog, c), c, 'Muy caro')!;
  assert.match(usd.reply, /US\$60/);
  assert.match(usd.reply, /5 pagos de US\$30/);
  assert.doesNotMatch(usd.reply, /10,500/);
});
test('unknown course and unavailable catalog cannot yield fabricated prices or schedules', () => {
  const c = newConversation();
  assert.match(salesCoachingReply(catalog, c, 'Muy caro')!.reply, /Qué programa/);
  assert.equal(salesCoachingReply(null, c, 'Muy caro'), null);
  assert.equal(salesCoachingReply(catalog, c, 'buenos días'), null);
  rememberCatalogCourse(catalog, c, 'Farmacología');
  const hours = salesCoachingReply(catalog, c, 'No me sirve el horario')!.reply;
  assert.match(hours, /8:00–10:00/);
  assert.match(hours, /cupos/);
});
test('paid, review, opt out and human control never receive sales objection collection', () => {
  const c = newConversation();
  rememberCatalogCourse(catalog, c, 'Farmacología');
  for (const state of [
    { stage: 'won' },
    { stage: 'payment_review' },
    { control: 'human' },
    { control: 'opted_out' },
  ])
    assert.equal(
      salesCoachingReply(catalog, c, 'Muy caro', {
        stage: 'interested',
        control: 'auto',
        ...state,
      } as Pick<SalesOpportunity, 'stage' | 'control'>),
      null,
    );
});
