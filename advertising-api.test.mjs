import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('API compilada exige sesión de dueño, acción explícita y bloquea descuentos de generación', async () => {
  let output = '';
  const child = spawn(process.execPath, ['-e', `
    const http = require('node:http'); const listen = http.Server.prototype.listen;
    http.Server.prototype.listen = function(...args) { this.once('listening', () => console.log('TEST_PORT='+this.address().port)); return listen.apply(this,args); };
    global.fetch = async () => { throw new Error('External network disabled in test'); };
    require('./dist/server.cjs');
  `], { cwd: import.meta.dirname, env: { ...process.env, NODE_ENV: 'production', PORT: '0', ADMIN_EMAIL: 'owner@example.test', ADMIN_PASSWORD: 'test-only-password', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  try {
    for (let i = 0; i < 100 && !output.includes('TEST_PORT='); i++) await delay(50);
    const port = output.match(/TEST_PORT=(\d+)/)?.[1]; assert.ok(port, output);
    const base = 'http://127.0.0.1:'+port;
    const post = (path, body, headers={}) => fetch(base+path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    assert.equal((await fetch(base+'/api/advertising')).status, 401);
    assert.equal((await post('/api/advertising/campaigns', {})).status, 401);
    const login = await post('/api/auth/login', { email: 'owner@example.test', password: 'test-only-password' }); assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/api/advertising/campaigns', {}, { Cookie: cookie })).status, 403);
    assert.equal((await post('/api/advertising/campaigns', {}, { Cookie: cookie, 'X-CRM-Action': 'advertising' })).status, 400);
    assert.equal((await post('/api/ai/generate-marketing', { promotionOffer: '50% de descuento' })).status, 401);
    const blocked = await post('/api/ai/generate-marketing', { promotionOffer: '50% de descuento' }, { Cookie: cookie });
    assert.equal(blocked.status, 409); assert.match((await blocked.json()).error, /autorización/);
    const anonymousApproval = await post('/api/advertising/campaigns/00000000-0000-4000-8000-000000000001/approve', { reviewed: true, approveDiscount: true }, { 'X-CRM-Action': 'advertising' });
    assert.equal(anonymousApproval.status, 401);
  } finally { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit'); }
});
