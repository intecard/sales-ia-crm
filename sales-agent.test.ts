import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newConversation, rememberUser } from './whatsapp-conversation.ts';
import {
  salesSignal,
  salesReply,
  issueSalesSession,
  verifySalesSession,
  type SalesOpportunity,
} from './sales-agent.ts';

test('sales separates price, instructions, reported transfers and refusal', () => {
  const conversation = newConversation();
  rememberUser(conversation, 'Quiero inscribirme en Autorizaciones Médicas', 'a');
  assert.equal(salesSignal('Inscripción', conversation), 'enrollment');
  assert.equal(salesSignal('Cuánto cuesta', conversation), 'enrollment');
  assert.equal(salesSignal('Dame las instrucciones de pago', conversation), 'payment_pending');
  assert.equal(salesSignal('Ya pagué', conversation), 'payment_review');
  assert.equal(salesSignal('No he pagado todavía', conversation), 'enrollment');
  assert.equal(salesSignal('Necesito hablar con un asesor', conversation), 'human');
  assert.equal(salesSignal('No me escriban más', conversation), 'opted_out');
  conversation.facts.paymentRequested = true;
  assert.equal(
    salesSignal('Mensaje recibido de tipo image.', conversation, 'image'),
    'payment_review',
  );
});
test('receipt does not imply paid or enrollment; verified payment is not downgraded', () => {
  const sale = { stage: 'payment_review' } as SalesOpportunity;
  assert.match(salesReply(sale, 'payment_review', 'Ya pagué')!.reply, /aún debe verificarse/);
  assert.match(salesReply(sale, 'new', 'Estado del pago')!.reply, /todavía no está validado/);
  sale.stage = 'won';
  assert.match(salesReply(sale, 'payment_review', 'Ya pagué')!.reply, /ya está validado/);
  assert.match(salesReply(sale, 'new', 'Estado del pago')!.reply, /campus siguen pendientes/);
});
test('signed administrator session rejects forgery, expiration and password rotation', () => {
  const token = issueSalesSession('test-secret', 'admin@example.test', 1000);
  const cookie = `other=1; crm_sales_session=${token}`;
  assert.equal(verifySalesSession(cookie, 'test-secret', 'admin@example.test', 1001), true);
  assert.equal(verifySalesSession(cookie, 'rotated', 'admin@example.test', 1001), false);
  assert.equal(verifySalesSession(cookie, 'test-secret', 'other@example.test', 1001), false);
  assert.equal(
    verifySalesSession(cookie, 'test-secret', 'admin@example.test', 1000 + 8 * 3600000),
    false,
  );
  assert.equal(
    verifySalesSession(cookie.replace(/.$/, '!'), 'test-secret', 'admin@example.test', 1001),
    false,
  );
  assert.equal(
    verifySalesSession('crm_sales_session=forged', 'test-secret', 'admin@example.test'),
    false,
  );
});
