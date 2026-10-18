import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildWhatsAppTextPayload, extractWhatsAppMessages, resolveWhatsAppRecipient } from './whatsapp-routing.ts';

test('username-only text routes to the complete BSUID, never a fabricated telephone', () => {
  const message = { from_user_id: 'DO.123ABC456', id: 'wamid.test', type: 'text', text: { body: 'Hola' } };
  const recipient = resolveWhatsAppRecipient(message);
  assert.ok(recipient);
  const payload = buildWhatsAppTextPayload(recipient, 'Hola, ¿cómo podemos ayudarte?');
  assert.equal('to' in payload, false);
  assert.ok('recipient' in payload);
  assert.equal(payload.recipient, 'DO.123ABC456');
  assert.equal(payload.recipient_type, 'individual');
});

test('existing phone-number messages retain the to field', () => {
  const recipient = resolveWhatsAppRecipient({ from: '18095550123', from_user_id: 'DO.123ABC456', type: 'text' });
  assert.ok(recipient);
  const payload = buildWhatsAppTextPayload(recipient, 'Hola');
  assert.ok('to' in payload);
  assert.equal(payload.to, '18095550123');
  assert.equal('recipient' in payload, false);
});

test('parent BSUID is preserved and malformed phone cannot be converted into a destination', () => {
  assert.deepEqual(resolveWhatsAppRecipient({ from_parent_user_id: 'DO.ENT.abc123', type: 'text' }), { kind: 'bsuid', id: 'DO.ENT.abc123' });
  assert.equal(resolveWhatsAppRecipient({ from: 'DO.1234567', type: 'text' }), undefined);
  assert.equal(resolveWhatsAppRecipient({ from: 18095550123, type: 'text' }), undefined);
});

test('system events and missing senders cannot produce a reply', () => {
  assert.equal(resolveWhatsAppRecipient({ from_user_id: 'DO.123', type: 'system' }), undefined);
  assert.equal(resolveWhatsAppRecipient({ from: '18095550123', type: 'unknown' }), undefined);
  assert.equal(resolveWhatsAppRecipient({ type: 'text', text: { body: 'Hola' } }), undefined);
});

test('only incoming messages for the configured business number enter the reply pipeline', () => {
  const message = { from_user_id: 'DO.123ABC456', id: 'wamid.test', type: 'text' };
  const value = { metadata: { phone_number_id: 'business-test' }, messages: [message] };
  const event = { entry: [{ changes: [
    { field: 'messages', value },
    { field: 'smb_message_echoes', value },
    { field: 'history', value },
    { field: 'messages', value: { ...value, metadata: { phone_number_id: 'other-business' } } },
    { field: 'messages', value: { statuses: [{ status: 'delivered' }] } },
  ] }] };
  assert.deepEqual(extractWhatsAppMessages(event, 'business-test'), [message]);
  assert.deepEqual(extractWhatsAppMessages({ entry: null }, 'business-test'), []);
});
