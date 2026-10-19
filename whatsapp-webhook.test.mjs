import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { setTimeout } from 'node:timers';
const catalogFixture = readFileSync(new URL('./test-fixtures/whatsapp-catalog.txt', import.meta.url), 'utf8');
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('compiled webhook replies to BSUID and phone, isolates failures and suppresses duplicates', async () => {
  const sends = [];
  let output = '';
  // All provider calls are intercepted in the child: no real WhatsApp message is sent.
  const child = spawn(process.execPath, ['-e', `
    let failed = false;
    const http = require('node:http');
    const listen = http.Server.prototype.listen;
    http.Server.prototype.listen = function(...args) {
      this.once('listening', () => console.log('TEST_LISTEN ' + this.address().port));
      return listen.apply(this, args);
    };
    global.fetch = async (url, options) => {
      if (String(url).includes('/knowledge-base/Catalogo_Academico_INTECA_2026.txt')) return new Response(${JSON.stringify(catalogFixture)});
      if (!String(url).startsWith('https://graph.facebook.com/')) throw new Error('Unexpected network request');
      const body = JSON.parse(options.body);
      console.log('TEST_SEND ' + JSON.stringify(body));
      if (body.recipient === 'DO.fail123' && !failed) {
        failed = true;
        return new Response(JSON.stringify({error:{code:131009}}), {status:400});
      }
      return new Response(JSON.stringify({messages:[{id:'wamid.out'}]}), {status:200});
    };
    require('./dist/server.cjs');
  `], {
    cwd: import.meta.dirname,
    env: { ...process.env, NODE_ENV: 'production', PORT: '0', GEMINI_API_KEY: '',
      WHATSAPP_AUTO_REPLY_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'test-token',
      WHATSAPP_PHONE_NUMBER_ID: 'business-test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  async function waitFor(predicate) {
    const end = Date.now() + 8000;
    while (!predicate()) {
      if (Date.now() > end || child.exitCode !== null) throw new Error('Test server did not reach expected state: ' + output);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  try {
    // Use an OS-assigned local port without changing the production server.
    await waitFor(() => /TEST_LISTEN (\d+)/.test(output));
    const port = output.match(/TEST_LISTEN (\d+)/)[1];
    const endpoint = 'http://127.0.0.1:' + port;
    const message = (id, sender) => ({ id, ...sender, type: 'text', text: { body: 'Hola' } });
    async function post(messages, field = 'messages') {
      const result = await globalThis.fetch(endpoint + '/api/webhooks/meta/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field,
          value: { metadata: { phone_number_id: 'business-test' }, messages },
        }] }] }),
      });
      assert.equal(result.status, 200);
    }
    function sent() {
      return output.split('\n').filter(line => line.startsWith('TEST_SEND ')).map(line => JSON.parse(line.slice(10)));
    }
    await post([
      message('bad-send', { from_user_id: 'DO.fail123' }),
      message('good-id', { from_user_id: 'DO.123ABC456' }),
      message('good-phone', { from: '18095550123' }),
    ]);
    await waitFor(() => sent().length === 3 && (output.match(/Respuesta enviada exitosamente/g) || []).length === 2);
    sends.push(...sent());
    assert.equal(sends[1].recipient, 'DO.123ABC456');
    assert.equal('to' in sends[1], false);
    assert.equal(sends[2].to, '18095550123');
    await post([message('good-id', { from_user_id: 'DO.123ABC456' })]);
    await post([message('echo-id', { from_user_id: 'DO.123ABC456' })], 'smb_message_echoes');
    await post([message('bad-send', { from_user_id: 'DO.fail123' })]);
    await waitFor(() => sent().length === 4 && (output.match(/Respuesta enviada exitosamente/g) || []).length === 3);
    assert.equal(sent()[3].recipient, 'DO.fail123');
  } finally {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
});

test('compiled webhook gives Gemini ordered history and facts, isolates contacts, and answers payment directly', async () => {
  let output = '';
  const child = spawn(process.execPath, ['-e', `
    const http = require('node:http');
    const listen = http.Server.prototype.listen;
    http.Server.prototype.listen = function(...args) {
      this.once('listening', () => console.log('TEST_LISTEN ' + this.address().port));
      return listen.apply(this, args);
    };
    global.fetch = async (url, options) => {
      if (String(url).includes('/knowledge-base/Catalogo_Academico_INTECA_2026.txt')) return new Response(${JSON.stringify(catalogFixture)});
      const target = String(url);
      const body = JSON.parse(options.body);
      if (target.startsWith('https://graph.facebook.com/')) {
        console.log('TEST_SEND ' + JSON.stringify(body));
        return new Response(JSON.stringify({messages:[{id:'wamid.test'}]}));
      }
      if (!target.includes('generativelanguage.googleapis.com')) throw new Error('Unexpected network request');
      const fields = body.generationConfig.responseSchema.properties.awaiting.enum;
      if (fields.includes('') || !fields.includes('none')) throw new Error('Invalid Gemini enum');
      const context = JSON.parse(body.contents[0].parts[0].text);
      console.log('TEST_CONTEXT ' + JSON.stringify(context));
      console.log('TEST_SYSTEM ' + JSON.stringify(body.systemInstruction));
      const last = context.history.at(-1).text;
      let reply = '¿Qué curso te interesa?', awaiting = 'course';
      if (last.includes('Autorizaciones')) { reply = 'Es virtual. ¿Deseas inscribirte?'; awaiting = 'none'; }
      if (last === 'Inscripción' || last === 'Tarde') { reply = '¿Cuál es tu nombre completo?'; awaiting = 'fullName'; }
      if (context.rememberedFacts.fullName) { reply = 'Tengo tu nombre y horario. ¿Cuál es tu correo?'; awaiting = 'email'; }
      await new Promise(resolve => setTimeout(resolve, 25));
      return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({reply,awaiting})}]},finishReason:'STOP'}]}));
    };
    require('./dist/server.cjs');
  `], { cwd: import.meta.dirname, env: { ...process.env, NODE_ENV:'production', PORT:'0',
    GEMINI_API_KEY:'test-key', GEMINI_MODEL:'test-model', GEMINI_FALLBACK_MODELS:'test-model',
    SUPABASE_URL:'', SUPABASE_SERVICE_ROLE_KEY:'',
    WHATSAPP_PAYMENT_INSTRUCTIONS:'Banco de prueba: TEST-ONLY. Titular de prueba.',
    WHATSAPP_AUTO_REPLY_ENABLED:'true', WHATSAPP_ACCESS_TOKEN:'test-token', WHATSAPP_PHONE_NUMBER_ID:'business-test' },
    stdio:['ignore','pipe','pipe'] });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  async function waitFor(predicate) {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > deadline || child.exitCode !== null) throw new Error(output);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  const records = prefix => output.split('\n').filter(line => line.startsWith(prefix)).map(line => JSON.parse(line.slice(prefix.length)));
  try {
    await waitFor(() => /TEST_LISTEN (\d+)/.test(output));
    const port = output.match(/TEST_LISTEN (\d+)/)[1];
    let id = 0;
    async function post(text, sender = 'DO.contactA') {
      const result = await globalThis.fetch('http://127.0.0.1:' + port + '/api/webhooks/meta/whatsapp', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
          metadata:{phone_number_id:'business-test'},messages:[{id:'msg-' + (++id),from_user_id:sender,type:'text',text:{body:text}}]
        }}]}]}) });
      assert.equal(result.status, 200);
    }
    for (const [index, text] of ['Hola', 'Autorizaciones Médicas', 'Inscripción'].entries()) {
      await post(text); await waitFor(() => records('TEST_SEND ').length >= index + 1);
    }
    // Two separate webhooks arrive while Gemini is still handling the first.
    await post('Tarde');
    await post('Luis alcides Ramirez Escalante');
    await waitFor(() => records('TEST_SEND ').length === 5);
    const contexts = records('TEST_CONTEXT ');
    assert.equal(contexts.length, 4);
    assert.equal(contexts[1].previousQuestionRequested, '');
    assert.match(records('TEST_SEND ')[1].text.body, /5 meses/);
    assert.match(records('TEST_SEND ')[1].text.body, /8:00–10:00/);
    assert.equal(contexts[3].rememberedFacts.fullName, 'Luis alcides Ramirez Escalante');
    assert.equal(contexts[3].rememberedFacts.schedule, 'tarde');
    assert.equal(contexts[3].rememberedFacts.course, 'Técnico u Oficial de Autorizaciones Médicas');
    assert.deepEqual(contexts[3].history.map(turn => turn.role), ['user','assistant','user','assistant','user','assistant','user','assistant','user']);
    assert.match(JSON.stringify(records('TEST_SYSTEM ')[0]), /Responde PRIMERO/);
    assert.match(JSON.stringify(records('TEST_SYSTEM ')[0]), /FUENTE ÚNICA/);
    assert.doesNotMatch(JSON.stringify(records('TEST_SYSTEM ')[0]), /FUENTE SECUNDARIA/);
    await post('Sábado y dame las instrucciones de pago');
    await waitFor(() => records('TEST_SEND ').length === 6);
    assert.equal(records('TEST_CONTEXT ').length, 4, 'payment must not invent bank data with Gemini');
    assert.match(records('TEST_SEND ')[5].text.body, /TEST-ONLY/);
    assert.doesNotMatch(records('TEST_SEND ')[5].text.body, /¿|oportunidades laborales/);
    await post('Hola', 'DO.contactB');
    await waitFor(() => records('TEST_SEND ').length === 7);
    assert.deepEqual(records('TEST_CONTEXT ')[4].rememberedFacts, {});
    assert.equal(records('TEST_CONTEXT ')[4].history.length, 1);
    await post('Cuales tienen?', 'DO.contactB');
    await waitFor(() => records('TEST_SEND ').length === 8);
    assert.match(records('TEST_SEND ')[7].text.body, /Farmacología/);
    await post('Farmacología', 'DO.contactB');
    await waitFor(() => records('TEST_SEND ').length === 9);
    assert.match(records('TEST_SEND ')[8].text.body, /4 meses/);
    await post('Cuales son los horarios?', 'DO.contactB');
    await waitFor(() => records('TEST_SEND ').length === 10);
    assert.match(records('TEST_SEND ')[9].text.body, /11:00 a. m.–1:00/);
    assert.doesNotMatch(records('TEST_SEND ')[9].text.body, /Hola|Autorizaciones/);
    assert.equal(records('TEST_CONTEXT ').length, 5, 'catalog facts work without Gemini');
  } finally {
    const exited = once(child,'exit'); child.kill('SIGTERM'); await exited;
  }
});
