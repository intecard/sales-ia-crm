import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AdvertisingAgent, hasDiscount, hasUnlistedPrice, campaignSchema } from './advertising-agent.ts';
import type { Catalog } from './whatsapp-catalog.ts';

function fixture() {
  const rows: any[] = []; const calls: { url: string; init?: RequestInit }[] = [];
  const env = { META_PAGE_ID: '123', META_PAGE_ACCESS_TOKEN: 'test-token', SUPABASE_URL: 'https://project.supabase.co' };
  const catalog: Catalog = { hash: 'catalog-v1', text: '', payments: '', generalSchedule: '', specialSchedules: [], courses: [{ title: 'Curso de prueba', text: '', duration: '5 meses', modality: 'Virtual', investment: 'Inscripción RD$2,500; mensualidad RD$2,000', schedule: '', description: '' }] };
  const store = { async request(resource: string, method = 'GET', body?: any) {
    if (method === 'POST') { const row = { id: randomUUID(), state: 'draft', discount_approved: false, approved_hash: null, approved_by: null, ...structuredClone(body) }; rows.push(row); return structuredClone([row]); }
    const params = new URLSearchParams(resource.split('?')[1]);
    const selected = rows.filter(row => [...params.entries()].every(([key, expression]) => {
      if (expression.startsWith('eq.')) return String(row[key]) === expression.slice(3);
      if (expression.startsWith('lte.')) return !!row[key] && row[key] <= expression.slice(4);
      return true;
    }));
    if (method === 'PATCH') for (const row of selected) Object.assign(row, structuredClone(body));
    return structuredClone(selected);
  } };
  let failWrite = false;
  const fetcher = async (url: any, init?: RequestInit) => { calls.push({ url: String(url), init }); if (failWrite && init?.method === 'POST') throw new Error('timeout'); return Response.json(init?.method === 'POST' ? { id: 'published-1' } : { id: '123', name: 'Test Page' }); };
  const agent = new AdvertisingAgent(store, { get: async () => catalog }, env, fetcher as typeof fetch);
  const input = campaignSchema.parse({ channel: 'facebook', title: 'Curso de prueba', courseTitle: 'Curso de prueba', body: 'Formación virtual. Inscripción RD$2,500. Solicita información.' });
  return { agent, store, rows, calls, input, catalog, env, failWrite: () => { failWrite = true; } };
}
test('promociones, precios no catalogados y unicode se detectan sin bloquear precios vigentes', () => {
  for (const text of ['20% OFF', 'Inscripción gratis', 'Beca del 50%', 'dеscuento con rebaja', '2 por 1', 'Sin costo', 'precio especial']) assert.equal(hasDiscount(text), true);
  assert.equal(hasDiscount('Modalidad 100% virtual'), false);
  assert.equal(hasUnlistedPrice('Inscripción RD$1,000', 'Inscripción RD$2,500'), true);
  assert.equal(hasUnlistedPrice('Inscripción RD$2,500', 'Inscripción RD$2,500'), false);
});
test('un borrador no puede publicar ni usar la IA para autoaprobarse', async () => {
  const f = fixture(); const row = await f.agent.create(f.input);
  await assert.rejects(f.agent.execute(row.id), /AD_APPROVAL/); assert.equal(f.calls.length, 0);
});
test('descuento, precio reducido e imagen requieren aprobación económica explícita', async () => {
  for (const changed of [{ body: 'Inscríbete con 20% OFF esta semana.' }, { body: 'Inscripción RD$1,000 para este curso.' }, { mediaUrl: 'https://project.supabase.co/storage/v1/object/public/media/ad.jpg' }]) {
    const f = fixture(); const row = await f.agent.create({ ...f.input, ...changed });
    assert.equal(row.discount_required, true);
    await assert.rejects(f.agent.approve(row.id, row.content_hash, false, 'owner', '123'), /AD_APPROVAL/);
    assert.equal(f.calls.length, 0);
  }
});
test('aprobación se liga al contenido, dueño y cuenta de destino', async () => {
  const f = fixture(); const row = await f.agent.create(f.input);
  await assert.rejects(f.agent.approve(row.id, 'altered', false, 'owner', '123'), /AD_STATE/);
  await assert.rejects(f.agent.approve(row.id, row.content_hash, false, '', '123'), /AD_APPROVAL/);
  await assert.rejects(f.agent.approve(row.id, row.content_hash, false, 'owner', '999'), /AD_STATE/);
  await f.agent.approve(row.id, row.content_hash, false, 'owner', '123');
  f.env.META_PAGE_ID = '999'; await assert.rejects(f.agent.execute(row.id), /AD_APPROVAL/); assert.equal(f.calls.length, 0);
});
test('dos ejecuciones concurrentes hacen una sola publicación', async () => {
  const f = fixture(); const row = await f.agent.create(f.input);
  await f.agent.approve(row.id, row.content_hash, false, 'owner', '123');
  const results = await Promise.allSettled([f.agent.execute(row.id), f.agent.execute(row.id)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.calls.filter(c => c.init?.method === 'POST').length, 1);
  assert.equal(f.rows[0].state, 'published');
});
test('catálogo actualizado o contenido manipulado invalidan publicación', async () => {
  const f = fixture(); const row = await f.agent.create(f.input);
  await f.agent.approve(row.id, row.content_hash, false, 'owner', '123');
  f.catalog.hash = 'catalog-v2'; await assert.rejects(f.agent.execute(row.id), /AD_CHANGED/);
  f.catalog.hash = 'catalog-v1'; f.rows[0].payload.body = 'Texto alterado'; await assert.rejects(f.agent.execute(row.id), /AD_APPROVAL/);
  assert.equal(f.calls.length, 0);
});
test('timeout no reintenta publicaciones de resultado incierto', async () => {
  const f = fixture(); const row = await f.agent.create({ ...f.input, scheduledAt: '2020-01-01T00:00:00.000Z' });
  await f.agent.approve(row.id, row.content_hash, false, 'owner', '123'); f.failWrite();
  await f.agent.tick(); await f.agent.tick();
  assert.equal(f.rows[0].state, 'review_required'); assert.equal(f.calls.filter(c => c.init?.method === 'POST').length, 1);
});
test('programación solo ejecuta aprobadas y vencidas', async () => {
  const f = fixture(); await f.agent.create({ ...f.input, scheduledAt: '2020-01-01T00:00:00.000Z' });
  const row = await f.agent.create({ ...f.input, scheduledAt: '2099-01-01T00:00:00.000Z' });
  await f.agent.approve(row.id, row.content_hash, false, 'owner', '123'); await f.agent.tick(); assert.equal(f.calls.length, 0);
});
test('sin conexión no se aprueba y los secretos nunca aparecen en configuración', async () => {
  const f = fixture(); const row = await f.agent.create(f.input); f.env.META_PAGE_ACCESS_TOKEN = '';
  await assert.rejects(f.agent.approve(row.id, row.content_hash, false, 'owner', '123'), /AD_MISSING/);
  assert.equal(JSON.stringify(f.agent.configuration()).includes('test-token'), false);
});
test('rechaza URLs de medios arbitrarias o internas', async () => {
  const f = fixture(); for (const mediaUrl of ['https://127.0.0.1/a', 'https://evil.test/a.mp4', 'https://project.supabase.co/rest/v1/secrets']) await assert.rejects(f.agent.create({ ...f.input, mediaUrl }), /AD_MEDIA/);
  assert.equal(f.rows.length, 0);
});
