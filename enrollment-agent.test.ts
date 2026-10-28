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

test('Firebase remains read-only detectable before paid campus enrollment activation',async()=>{
  let writes=0;
  const store={
    request:async()=>{writes++;return []},
    get:async()=>undefined,
  } as unknown as SalesStore;
  const agent=new EnrollmentAgent(store,{
    INTECA_FIREBASE_PROJECT_ID:'gen-lang-client-0415952714',
    INTECA_FIRESTORE_DATABASE_ID:'ai-studio-campusvirtualint-dbc5e5fa-0c2e-4740-85d5-91566cdb7d70',
  });
  const result=await agent.campusReadiness();
  assert.equal(result.campusConfigured,false);
  assert.equal(result.campusSyncEnabled,false);
  assert.equal(result.readyForEnrollment,false);
  assert.equal(result.errorCode,'CAMPUS_NOT_CONFIGURED');
  assert.equal(writes,0);
  await assert.rejects(agent.provision(row()),/CAMPUS_SYNC_NOT_ACTIVATED/);
  assert.equal(writes,0);
});
test('exact single course match may be saved once; mismatched or ambiguous catalog never auto-enrolled',async()=>{
  const title='Farmacología Aplicada para Visitadores Médicos';
  const documents=[{id:'course-pharma',get:(field:string)=>field==='title'?title:undefined}];
  const db={
    collection:(name:string)=>{
      assert.equal(name,'courses');
      return {get:async()=>({docs:documents})};
    }
  };
  const mappings:any[]=[];
  const store={
    request:async(path:string,method='GET',body?:any)=>{
      if(path.startsWith('crm_campus_course_mapping?course_title='))return mappings;
      if(path==='crm_campus_course_mapping'&&method==='POST'){
        mappings.push(body);return [body];
      }
      throw Error('UNEXPECTED '+path);
    }
  } as unknown as SalesStore;
  const agent=new EnrollmentAgent(store,{});
  const got=await agent.resolveCourseMapping(db as any,title);
  assert.equal(got.campus_course_id,'course-pharma');
  assert.equal(got.verified_by,'auto_exact_live');
  assert.equal(mappings.length,1);
  const again=await agent.resolveCourseMapping(db as any,title);
  assert.equal(again.campus_course_id,'course-pharma');
  assert.equal(mappings.length,1);
  // Similar course titles are NOT proof of equivalence.
  mappings.length=0;
  await assert.rejects(agent.resolveCourseMapping(db as any,'Técnico en Farmacología Aplicada para Visitadores Médicos'),/COURSE_MAPPING_REQUIRED/);
  documents.push({id:'duplicated',get:(field:string)=>field==='title'?title:undefined});
  await assert.rejects(agent.resolveCourseMapping(db as any,title),/COURSE_MAPPING_REQUIRED/);
  assert.equal(mappings.length,0);
});
test('an academic course map conflict cannot be overwritten by a background worker',async()=>{
  const title='Técnico en Pre-Certificaciones Médicas';
  const docs=[{id:'c_111',get:(field:string)=>field==='title'?title:undefined}];
  let calls=0;
  const agent=new EnrollmentAgent({
    request:async(path:string,method?:string)=>{
      if(path.startsWith('crm_campus_course_mapping?')){
        calls++;
        return calls===1?[]:[{campus_course_id:'different-course',campus_course_title:'Other'}];
      }
      if(path==='crm_campus_course_mapping'&&method==='POST')throw Error('duplicate primary key');
      throw Error('unexpected route');
    }
  } as unknown as SalesStore,{});
  await assert.rejects(agent.resolveCourseMapping({collection:()=>({get:async()=>({docs})})} as any,title),/COURSE_MAPPING_REQUIRED/);
});
