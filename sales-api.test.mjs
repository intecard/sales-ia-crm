import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { setTimeout } from 'node:timers';
const { fetch } = globalThis;

test('sales endpoints enforce administrator session and explicit bank review; pause affects the webhook', async () => {
  let output = '';
  const child = spawn(
    process.execPath,
    [
      '-e',
      `
    const http = require('node:http');
    const listen = http.Server.prototype.listen;
    http.Server.prototype.listen = function(...args) {
      this.once('listening', () => console.log('TEST_PORT ' + this.address().port)); return listen.apply(this, args);
    };
    let enabled=true; const memory=new Map(); const sales=new Map();
    global.fetch=async(url, options={})=>{
      const resource=String(url), body=options.body ? JSON.parse(options.body) : {};
      if(resource.startsWith('https://graph.facebook.com/')) { console.log('TEST_SEND '+body.text.body); return new Response('{}'); }
      if(!resource.startsWith('https://test.supabase.test/')) throw new Error('Unexpected outbound network');
      if(resource.includes('crm_sales_settings')) { if(options.method==='PATCH') enabled=body.enabled; return new Response(JSON.stringify([{enabled}])); }
      if(resource.includes('crm_whatsapp_memory')) {
        if(options.method==='POST') { const row=Array.isArray(body)?body[0]:body; memory.set(row.conversation_key,row); return new Response('[]'); }
        const key=new URL(resource).searchParams.get('conversation_key')?.slice(3); return new Response(JSON.stringify(memory.has(key)?[memory.get(key)]:[]));
      }
      if(resource.includes('rpc/crm_record_sales_inbound')) {
        const row={contact_key:body.p_key,profile:body.p_profile,stage:body.p_signal,control:'auto',expected_amount:2500};
        sales.set(body.p_key,row); console.log('TEST_INBOUND '+body.p_event); return new Response(JSON.stringify([row]));
      }
      if(resource.includes('crm_sales_opportunities')) { const key=new URL(resource).searchParams.get('contact_key')?.slice(3); return new Response(JSON.stringify(key?(sales.has(key)?[sales.get(key)]:[]):[...sales.values()])); }
      if(resource.includes('crm_sales_events')) return new Response('[]');
      throw new Error('Unexpected request '+resource);
    };
    require('./dist/server.cjs');
  `,
    ],
    {
      cwd: import.meta.dirname,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '0',
        ADMIN_EMAIL: 'admin@example.test',
        ADMIN_PASSWORD: 'local-test-secret',
        GEMINI_API_KEY: '',
        SUPABASE_URL: 'https://test.supabase.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only',
        WHATSAPP_ACCESS_TOKEN: 'test-only',
        WHATSAPP_PHONE_NUMBER_ID: 'business-test',
        WHATSAPP_AUTO_REPLY_ENABLED: 'true',
        WHATSAPP_PAYMENT_INSTRUCTIONS: 'Banco de prueba TEST-ONLY',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (c) => {
    output += c;
  });
  child.stderr.on('data', (c) => {
    output += c;
  });
  async function waitFor(predicate) {
    const until = Date.now() + 8000;
    while (!predicate()) {
      if (Date.now() > until || child.exitCode !== null) throw Error(output);
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  try {
    await waitFor(() => /TEST_PORT (\d+)/.test(output));
    const endpoint = 'http://127.0.0.1:' + output.match(/TEST_PORT (\d+)/)[1];
    const req = (path, body, cookie = '', action = true) =>
      fetch(endpoint + path, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          ...(action ? { 'X-CRM-Action': 'sales' } : {}),
        },
        ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      });
    assert.equal((await req('/api/sales')).status, 401);
    assert.equal((await req('/api/sales/enrollments')).status, 401);
    assert.equal(
      (await req('/api/sales/receipts/00000000-0000-4000-8000-000000000001/content')).status,
      401,
    );
    const login = await req('/api/auth/login', {
      email: 'admin@example.test',
      password: 'local-test-secret',
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=Strict/);
    const cookie = login.headers.getSetCookie().find(value => value.startsWith('crm_sales_session=')).split(';')[0];
    assert.equal((await req('/api/sales', undefined, cookie)).status, 200);
    assert.equal((await req('/api/sales/settings', { enabled: false }, cookie, false)).status, 403);
    assert.equal((await req('/api/sales/settings', { enabled: false }, cookie)).status, 200);
    async function inbound(id, text) {
      return req('/api/webhooks/meta/whatsapp', {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'business-test' },
                  messages: [{ id, from: '18095550101', type: 'text', text: { body: text } }],
                },
              },
            ],
          },
        ],
      });
    }
    await inbound('paused', 'Hola');
    await waitFor(() => output.includes('TEST_INBOUND paused'));
    await new Promise((r) => setTimeout(r, 80));
    assert.doesNotMatch(output, /TEST_SEND/);
    await req('/api/sales/settings', { enabled: true }, cookie);
    await inbound('reported', 'Ya pagué');
    await waitFor(() => output.includes('TEST_SEND'));
    assert.match(output, /transferencia aún debe verificarse/);
    assert.equal(
      (await req('/api/agents/conversion/process-lead', { paymentConfirmed: true })).status,
      403,
    );
    assert.equal(
      (await req('/api/webhooks/payments', { status: 'paid', paymentConfirmed: true })).status,
      503,
    );
    assert.equal(
      (
        await req(
          '/api/sales/any/action',
          {
            action: 'verify_payment',
            data: { bank: 'Qik', reference: 'abc', amount: 2500, confirmed: false },
          },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          '/api/sales/any/action',
          {
            action: 'verify_payment',
            data: { bank: 'Qik', reference: 'abc', amount: 2500, confirmed: true },
          },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal((await req('/api/sales', undefined, 'crm_sales_session=forged')).status, 401);
    const publicForm = await req('/api/webhooks/web/forms', {
      fullName: 'Prueba local',
      courseTitle: 'Autorizaciones Médicas',
      paymentConfirmed: true,
    });
    assert.equal((await publicForm.json()).conversionLead.status, 'Seguimiento activo');
    const logout = await req('/api/auth/logout', {}, cookie);
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  } finally {
    const ended = once(child, 'exit');
    child.kill('SIGTERM');
    await ended;
  }
});
