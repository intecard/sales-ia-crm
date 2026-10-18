import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EnrollmentAgent,
  receiptMime,
  welcomeText,
  whatsappWelcomePayload,
  type Enrollment,
} from './enrollment-agent.ts';
import { SalesStore, type SalesOpportunity } from './sales-agent.ts';
const row = (): Enrollment => ({
  id: '00000000-0000-4000-8000-000000000001',
  contact_key: 'test',
  payment_id: 'payment-test',
  registration_code: 'INTECA-TEST',
  full_name: 'Estudiante de prueba',
  email: 'student@example.test',
  course_title: 'Curso de prueba',
  campus_course_id: 'course-test',
  campus_uid: 'uid-test',
  campus_status: 'active',
  email_status: 'pending',
  whatsapp_status: 'pending',
  email_provider_id: null,
  whatsapp_provider_id: null,
  last_error: '',
  lease_token: 'lease-test',
  attempts: 0,
});
const sale = (now = Date.now()) =>
  ({
    contact_key: 'test',
    control: 'auto',
    profile: { phone: '18095550101' },
    last_inbound_at: new Date(now).toISOString(),
  }) as SalesOpportunity;
test('receipt rejects scripts and oversize data; recognizes actual document signatures', () => {
  assert.equal(receiptMime(Buffer.from('%PDF-1.7\nTEST')), 'application/pdf');
  assert.throws(() => receiptMime(Buffer.from('<html>not a receipt</html>')), /RECEIPT_INVALID/);
  assert.throws(() => receiptMime(Buffer.alloc(5242881)), /RECEIPT_INVALID/);
});
test('welcome never claims campus access before provisioning and never fabricates credentials', () => {
  const r = row();
  r.campus_status = 'pending';
  assert.throws(() => welcomeText(r, 'https://campus.example.test'), /PAYMENT_REQUIRED/);
  r.campus_status = 'active';
  const text = welcomeText(r, 'https://campus.example.test');
  assert.match(text, /INTECA-TEST/);
  assert.match(text, /student@example.test/);
  assert.match(text, /Olvidé mi contraseña/);
  assert.doesNotMatch(text, /Contraseña temporal:/);
});
test('WhatsApp routes BSUID, enforces opt-out and window, uses template only when configured', () => {
  const r = row(),
    s = sale(100000000);
  const env = { INTECA_CAMPUS_BASE_URL: 'https://campus.example.test' };
  assert.equal(whatsappWelcomePayload(r, s, env, 100000001).type, 'text');
  s.profile = { whatsappUserId: 'DO.Test123' };
  const payload = whatsappWelcomePayload(r, s, env, 100000001);
  assert.equal('recipient' in payload && payload.recipient, 'DO.Test123');
  assert.equal('to' in payload, false);
  assert.throws(
    () => whatsappWelcomePayload(r, s, env, 100000000 + 24 * 3600000),
    /WHATSAPP_WINDOW_CLOSED/,
  );
  const template = whatsappWelcomePayload(
    r,
    s,
    { ...env, WHATSAPP_ENROLLMENT_TEMPLATE_NAME: 'approved_test' },
    100000000 + 24 * 3600000,
  );
  assert.equal(template.type, 'template');
  s.control = 'opted_out';
  assert.throws(() => whatsappWelcomePayload(r, s, env, 100000001), /CONTACT_OPTED_OUT/);
});
test('no receipt means no campus provisioning or student notification', async () => {
  const patches: Record<string, unknown>[] = [];
  const store = {
    request: async (path: string, _method?: string, body?: unknown) => {
      if (path.startsWith('crm_sales_payments')) return [{ receipt_id: null }];
      patches.push(body as Record<string, unknown>);
      return [{}];
    },
    get: async () => sale(),
  } as unknown as SalesStore;
  const agent = new EnrollmentAgent(store, {});
  let provisioned = false;
  agent.provision = async () => {
    provisioned = true;
    return { campus_status: 'active', campus_uid: 'uid', campus_course_id: 'c' };
  };
  await agent.process(row());
  assert.equal(provisioned, false);
  assert.equal(patches.at(-1)?.last_error, 'PAYMENT_REQUIRED');
});
test('uncertain sends after restart are held for human review, never silently repeated', async () => {
  const patches: Record<string, unknown>[] = [];
  const store = {
    request: async (path: string, _method?: string, body?: unknown) => {
      if (path.startsWith('crm_sales_payments')) return [{ receipt_id: 'receipt-test' }];
      patches.push(body as Record<string, unknown>);
      return [{}];
    },
    get: async () => sale(),
  } as unknown as SalesStore;
  const agent = new EnrollmentAgent(store, {}),
    r = row();
  r.email_status = 'sending';
  r.whatsapp_status = 'sending';
  await agent.process(r);
  assert.equal(r.email_status, 'review');
  assert.equal(r.whatsapp_status, 'review');
  assert.match(String(patches.at(-1)?.last_error), /EMAIL_REVIEW_REQUIRED/);
  assert.match(String(patches.at(-1)?.last_error), /WHATSAPP_REVIEW_REQUIRED/);
});
test('successful WhatsApp sends require provider acknowledgement and persist ID', async () => {
  const original = globalThis.fetch;
  const patches: Record<string, unknown>[] = [];
  const store = {
    request: async (path: string, _method?: string, body?: unknown) => {
      if (path.startsWith('crm_sales_payments')) return [{ receipt_id: 'receipt-test' }];
      patches.push(body as Record<string, unknown>);
      return [{}];
    },
    get: async () => sale(),
  } as unknown as SalesStore;
  const agent = new EnrollmentAgent(store, {
      WHATSAPP_ACCESS_TOKEN: 'fake-test-only',
      WHATSAPP_PHONE_NUMBER_ID: 'test-only',
    }),
    r = row();
  r.email_status = 'accepted';
  let count = 0;
  globalThis.fetch = async () => {
    count++;
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.TEST' }] }));
  };
  try {
    await agent.process(r);
    assert.equal(r.whatsapp_status, 'accepted');
    assert.equal(r.whatsapp_provider_id, 'wamid.TEST');
    assert.equal(count, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('Resend persists acknowledgement, uses idempotency, and holds ambiguous failures', async () => {
  const original = globalThis.fetch;
  const store = {
    request: async (path: string) =>
      path.startsWith('crm_sales_payments') ? [{ receipt_id: 'test-receipt' }] : [{}],
    get: async () => sale(),
  } as unknown as SalesStore;
  const agent = new EnrollmentAgent(store, {
    RESEND_API_KEY: 'test-only',
    EMAIL_FROM: 'test@example.test',
  });
  assert.equal(agent.status().emailConfigured, true);
  let count = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(
      (init?.headers as Record<string, string>)['Idempotency-Key'],
      `crm-enrollment/${row().id}`,
    );
    count++;
    return new Response(JSON.stringify({ id: 'email-test' }));
  };
  try {
    const r = row();
    r.whatsapp_status = 'accepted';
    await agent.process(r);
    assert.equal(r.email_status, 'accepted');
    assert.equal(r.email_provider_id, 'email-test');
    await agent.process(r);
    assert.equal(count, 1);
    globalThis.fetch = async () => {
      throw new Error('simulated timeout');
    };
    const uncertain = row();
    uncertain.whatsapp_status = 'accepted';
    await agent.process(uncertain);
    assert.equal(uncertain.email_status, 'review');
    assert.match(uncertain.last_error, /EMAIL_REVIEW_REQUIRED/);
  } finally {
    globalThis.fetch = original;
  }
});
