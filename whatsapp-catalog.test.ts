import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CatalogStore, parseCatalog, catalogReply, catalogPaymentReply, catalogFallback, catalogPrompt, rememberCatalogCourse, findCourses } from './whatsapp-catalog.ts';
import { newConversation, rememberUser, rememberReply } from './whatsapp-conversation.ts';

const fixture = readFileSync(new URL('./test-fixtures/whatsapp-catalog.txt', import.meta.url), 'utf8');

test('uses current catalog for course list, price, exact schedules and unconfirmed durations', () => {
  const catalog = parseCatalog(fixture), chat = newConversation();
  assert.equal(catalog.courses.length, 5);
  assert.equal(catalog.payments, '');
  assert.equal(findCourses(catalog, 'Máster en autorizaciones')[0].duration, '12 meses');
  assert.equal(findCourses(catalog, 'Autorizaciones')[0].duration, '5 meses');
  rememberCatalogCourse(catalog, chat, 'Farmacología');
  assert.match(catalogReply(catalog, chat, 'precio')!.reply, /10,500/);
  const hours = catalogReply(catalog, chat, '¿Cuáles son los horarios?')!.reply;
  assert.match(hours, /8:00–10:00/); assert.match(hours, /11:00 a. m.–1:00/);
  assert.match(hours, /5:00–6:30/); assert.match(hours, /cupos/);
  const sunday = catalogReply(catalog, chat, 'Horario domingo')!.reply;
  assert.doesNotMatch(sunday, /7:00–9:00/);
  const nursing = catalogReply(catalog, chat, 'Horario de enfermería')!.reply;
  assert.match(nursing, /únicamente sábados o domingos/); assert.doesNotMatch(nursing, /7:00|2:00/);
  const billing = catalogReply(catalog, chat, 'Cuánto dura Facturación')!.reply;
  assert.match(billing, /pendiente de confirmación/); assert.doesNotMatch(billing, /5 meses/);
  assert.match(catalogReply(catalog, chat, 'Cuales tienen?')!.reply, /Facturación/);
  assert.equal(chat.facts.course, 'Farmacología Aplicada para Visitadores Médicos');
  assert.doesNotMatch(catalogPrompt(catalog), /docs\/knowledge/);
});

test('mixed name and question continues the selected course without a greeting reset', () => {
  const chat = newConversation(), catalog = parseCatalog(fixture);
  rememberUser(chat, 'Farmacología', '1'); rememberCatalogCourse(catalog, chat, 'Farmacología');
  rememberReply(chat, '¿Cuál es tu nombre completo?', 'fullName');
  rememberUser(chat, 'Luis alcides Ramírez, cuales son los horarios?', '2');
  assert.equal(chat.facts.fullName, 'Luis alcides Ramírez');
  const answer = catalogReply(catalog, chat, chat.turns.at(-1)!.text)!;
  assert.match(answer.reply, /Farmacología/); assert.match(answer.reply, /8:00/);
  assert.doesNotMatch(answer.reply, /Hola|nombre completo/);
  assert.doesNotMatch(catalogFallback(chat, 'Hola').reply, /Mi nombre|Soy Mariela/);
});

test('payment instructions use explicit CRM source when TXT has none and never generate accounts', () => {
  const catalog = parseCatalog(fixture), chat = newConversation();
  rememberCatalogCourse(catalog, chat, 'Farmacología');
  assert.match(catalogPaymentReply(catalog, chat, 'Banco TEST-ONLY').reply, /TEST-ONLY/);
  assert.match(catalogPaymentReply(catalog, chat, 'Banco TEST-ONLY').reply, /2,500/);
  assert.match(catalogPaymentReply(catalog, chat, '').reply, /no incluye/);
  const withPayments = parseCatalog(fixture + '\nMétodos de pago\nBanco CAT-ONLY, cuenta de prueba.');
  assert.match(catalogPaymentReply(withPayments, chat, 'TEST-ONLY').reply, /CAT-ONLY/);
  assert.doesNotMatch(catalogPaymentReply(withPayments, chat, 'TEST-ONLY').reply, /TEST-ONLY/);
});

test('refreshes file changes without restart, shares concurrent reads, and fails closed on stale data', async () => {
  let now = 100_000, count = 0, source = fixture, fail = false;
  const store = new CatalogStore(async () => { count++; return new Response(fail ? 'Unavailable' : source, {status: fail ? 503 : 200}); }, () => now);
  const reads = await Promise.all([store.get(), store.get(), store.get()]);
  assert.equal(count, 1); assert.equal(reads[0]!.courses.length, 5);
  now += 61_000; source = source.replaceAll('RD$2,500', 'RD$3,100');
  const updated = await store.get(); assert.equal(count, 2);
  assert.match(updated!.courses[0].investment, /3,100/);
  now += 61_000; fail = true;
  assert.equal(await store.get(), null); assert.equal(store.status().ready, false);
  assert.equal(await store.get(), null); assert.equal(count, 3);
  now += 11_000; fail = false;
  assert.ok(await store.get()); assert.equal(store.status().ready, true);
});

test('rejects non-catalog responses and oversized documents', async () => {
  assert.throws(() => parseCatalog('<html>' + 'error'.repeat(100)), /INVALID/);
  assert.throws(() => parseCatalog('no course'.repeat(100)), /NO_VALID/);
  const store = new CatalogStore(async () => new Response('x'.repeat(180_001)));
  assert.equal(await store.get(), null); assert.equal(store.status().error, 'CATALOG_TOO_LARGE');
});


test('catalog-based selection distinguishes master and preserves the existing CRM payment identifier', () => {
  const catalog = parseCatalog(fixture), chat = newConversation();
  rememberUser(chat, 'Máster en autorizaciones', 'm1', false);
  rememberCatalogCourse(catalog, chat, 'Máster en autorizaciones');
  assert.equal(chat.facts.course, 'Máster en Oficial de Autorizaciones Médicas');
  assert.match(catalogReply(catalog, chat, 'duración')!.reply, /12 meses/);
  rememberUser(chat, 'Quiero el técnico en autorizaciones', 'm2', false);
  rememberCatalogCourse(catalog, chat, 'Quiero el técnico en autorizaciones');
  assert.equal(chat.facts.course, 'Técnico u Oficial de Autorizaciones Médicas');
  assert.match(catalogReply(catalog, chat, 'Qué horarios tienen?')!.reply, /8:00–10:00/);
});


test('a schedule question while awaiting a name is not saved as the name', () => {
  const chat = newConversation(); chat.awaiting = 'fullName';
  rememberUser(chat, 'Cuales son los horarios?', 'q');
  assert.equal(chat.facts.fullName, undefined);
});

test('Todo and natural information requests return the complete remembered course, including old memory aliases', () => {
  const catalog = parseCatalog(fixture), chat = newConversation();
  chat.facts.course = 'Farmacología Aplicada';
  chat.facts.schedule = 'sabado manana';
  for (const request of ['Todo', 'Quiero información completa sobre el curso', 'Cuéntame más', 'De qué se trata?', 'Dame todos los detalles', 'Me puedes orientar sobre ese curso']) {
    const answer = catalogReply(catalog, chat, request)!;
    assert.ok(answer, request);
    assert.match(answer.reply, /Farmacología Aplicada para Visitadores Médicos/);
    assert.match(answer.reply, /4 meses/); assert.match(answer.reply, /10,500/);
    assert.match(answer.reply, /Farmacocinética/); assert.match(answer.reply, /Interpretar información básica/);
    assert.match(answer.reply, /8:00–10:00/);
    assert.doesNotMatch(answer.reply, /No tengo confirmado|¿Qué curso/);
  }
  const fallback = catalogFallback(chat, 'Quiero información completa sobre el curso', catalog);
  assert.match(fallback.reply, /Farmacocinética/);
});

test('detail questions stay focused and follow-ups refer to the course most recently discussed', () => {
  const catalog = parseCatalog(fixture), chat = newConversation();
  chat.facts.course = 'Técnico u Oficial de Autorizaciones Médicas';
  rememberCatalogCourse(catalog, chat, 'Qué enseñan en Farmacología?');
  assert.equal(chat.facts.course, 'Técnico u Oficial de Autorizaciones Médicas');
  assert.match(catalogReply(catalog, chat, 'Todo')!.reply, /Farmacología/);
  assert.match(catalogReply(catalog, chat, 'Qué materias voy a ver?')!.reply, /Farmacocinética/);
  assert.doesNotMatch(catalogReply(catalog, chat, 'Quiero información de los horarios')!.reply, /Farmacocinética/);
  assert.equal(catalogReply(catalog, newConversation(), 'Todo')!.awaiting, 'course');
});
