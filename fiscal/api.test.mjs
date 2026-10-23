import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
test('compiled fiscal API authenticates owner, scopes company data, exports escaped drafts and blocks emission', async () => {
  let output = '';
  const child = spawn(
    process.execPath,
    [
      '-e',
      `
 const http=require('node:http');const listen=http.Server.prototype.listen;http.Server.prototype.listen=function(...args){this.once('listening',()=>console.log('PORT='+this.address().port));return listen.apply(this,args);};
 const companies=new Map(),documents=new Map();
 global.fetch=async(url,options={})=>{const u=new URL(String(url));if(u.origin!=='https://fiscal.test.supabase')throw Error('Outbound disabled');const body=options.body?JSON.parse(options.body):{};const resource=u.pathname.split('/').at(-1);const out=value=>new Response(JSON.stringify(value));
 if(resource==='crm_save_fiscal_company'){const row={organization_id:body.p_org,profile:body.p_profile,profile_hash:body.p_hash};companies.set(body.p_org,row);return out([row]);}
 if(resource==='crm_fiscal_companies'){const org=u.searchParams.get('organization_id')?.slice(3);return out(companies.has(org)?[companies.get(org)]:[]);}
 if(resource==='crm_create_fiscal_draft'){const id='00000000-0000-4000-8000-000000000002';const row={id,organization_id:body.p_org,payload:body.p_payload,issuer_snapshot:body.p_issuer,totals:body.p_totals,request_hash:body.p_request_hash,rule_version:body.p_rules,environment:'precertification',status:'draft',fiscal_status:'not_transmitted'};documents.set(body.p_org+id,row);return out([row]);}
 if(resource==='crm_fiscal_documents'){const org=u.searchParams.get('organization_id')?.slice(3),id=u.searchParams.get('id')?.slice(3);return out(id?(documents.has(org+id)?[documents.get(org+id)]:[]):[...documents.values()].filter(r=>r.organization_id===org));}
 return out([]);};require('./dist/server.cjs');`,
    ],
    {
      cwd: new URL('..', import.meta.url).pathname,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '0',
        ADMIN_EMAIL: 'owner@example.test',
        ADMIN_PASSWORD: 'test-only-password',
        SUPABASE_URL: 'https://fiscal.test.supabase',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only',
        GEMINI_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (x) => (output += x));
  child.stderr.on('data', (x) => (output += x));
  try {
    for (let i = 0; i < 150 && !output.includes('PORT='); i++) await delay(40);
    const port = output.match(/PORT=(\d+)/)?.[1];
    assert.ok(port, output);
    const base = 'http://127.0.0.1:' + port;
    const post = (path, body, headers = {}) =>
      fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    const health = await (await fetch(base + '/api/health')).json();
    assert.equal(health.fiscalWorkspace.officialEmissionEnabled, false);
    assert.equal(health.fiscalWorkspace.multiCompany, true);
    assert.equal((await fetch(base + '/api/fiscal/registry')).status, 401);
    assert.equal((await post('/api/ai/generate-ecf-invoice', {})).status, 401);
    const login = await post('/api/auth/login', {
      email: 'owner@example.test',
      password: 'test-only-password',
    });
    assert.equal(login.status, 200);
    const Cookie = login.headers.get('set-cookie').split(';')[0],
      headers = { Cookie, 'X-CRM-Action': 'fiscal' };
    const p = {
      legalName: 'Company <script>alert(1)</script>',
      taxId: '123456789',
      address: 'Address',
      email: 'test@example.test',
      activity: 'Retail',
      enabledTypes: ['31', '32'],
      defaultTax: 'ITBIS18',
    };
    assert.equal((await post('/api/fiscal/company_a/profile', p, { Cookie })).status, 403);
    assert.equal((await post('/api/fiscal/company_a/profile', p, headers)).status, 200);
    const invalid = await post(
      '/api/fiscal/company_a/documents',
      { issuer: { taxId: 'other' } },
      headers,
    );
    assert.equal(invalid.status, 400);
    const input = {
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      type: '32',
      issuedOn: '2026-10-23',
      receiver: { name: 'Buyer' },
      items: [
        {
          description: '<img onerror="test">',
          kind: 'goods',
          unit: 'u',
          quantity: '1',
          unitPrice: '100',
          tax: 'ITBIS18',
        },
      ],
    };
    const response = await post('/api/fiscal/company_a/documents', input, headers);
    assert.equal(response.status, 201);
    const [doc] = await response.json();
    assert.equal(doc.totals.fiscalTotal, '118.00');
    assert.equal(doc.fiscal_status, 'not_transmitted');
    assert.equal(
      (await fetch(base + '/api/fiscal/company_b/documents/' + doc.id, { headers: { Cookie } }))
        .status,
      404,
    );
    const pack = await fetch(base + '/api/fiscal/company_a/documents/' + doc.id + '/package', {
      headers: { Cookie },
    });
    assert.equal(pack.status, 200);
    assert.equal(pack.headers.get('cache-control'), 'no-store');
    const data = await pack.json();
    assert.equal(data.eNcf, null);
    assert.equal(data.xml, null);
    assert.equal(data.productionReady, false);
    const print = await fetch(base + '/api/fiscal/company_a/documents/' + doc.id + '/print', {
      headers: { Cookie },
    });
    const html = await print.text();
    assert.match(html, /SIN VALIDEZ FISCAL/);
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img onerror='));
    assert.match(html, /&lt;script&gt;/);
    const issue = await post('/api/fiscal/company_a/documents/' + doc.id + '/issue', {}, headers);
    assert.equal(issue.status, 409);
    assert.equal((await issue.json()).transmitted, false);
    const old = await post('/api/ai/generate-ecf-invoice', {}, headers);
    assert.equal(old.status, 410);
    assert.equal((await post('/api/webhooks/dgii/ecf-status', { status: 'accepted' })).status, 503);
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null) await once(child, 'exit');
  }
});
