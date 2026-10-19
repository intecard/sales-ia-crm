import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { newConversation } from './whatsapp-conversation.ts';
import { parseWhatsAppAnswer, whatsAppGenerationConfig, splitWhatsAppText } from './whatsapp-ai.ts';

test('uses a supported low thinking level and sufficient output room for the configured Gemini 3 models', () => {
  for (const model of ['gemini-3.8-flash', 'gemini-3.5-flash-lite']) {
    const config = whatsAppGenerationConfig(model, { responseMimeType: 'application/json', maxOutputTokens: 1800 });
    assert.deepEqual(config.thinkingConfig, { thinkingLevel: 'LOW' });
    assert.equal(config.maxOutputTokens, 4096);
  }
  assert.deepEqual(whatsAppGenerationConfig('gemini-2.5-flash').thinkingConfig, { thinkingBudget: 0 });
  assert.equal(whatsAppGenerationConfig('test-model').thinkingConfig, undefined);
});

test('keeps the useful answer when a model repeats a known final question', () => {
  const chat = newConversation(); chat.facts.course = 'Farmacología Aplicada';
  const answer = parseWhatsAppAnswer(JSON.stringify({ reply: 'El curso incluye farmacocinética y farmacodinamia. ¿Qué curso te interesa?', awaiting: 'course' }), 'STOP', chat);
  assert.equal(answer.reply, 'El curso incluye farmacocinética y farmacodinamia.');
  assert.equal(answer.awaiting, '');
  assert.throws(() => parseWhatsAppAnswer('{', 'STOP', chat), /INVALID_JSON/);
  assert.throws(() => parseWhatsAppAnswer('{}', 'MAX_TOKENS', chat), /OUTPUT_LIMIT/);
  assert.throws(() => parseWhatsAppAnswer('{"reply":"¿Qué curso?","awaiting":"course"}', 'STOP', chat), /REPEATED_QUESTION/);
});

test('long complete replies are delivered in ordered chunks without losing text', () => {
  const original = Array.from({length: 80}, (_, i) => `Sección ${i}: ${'Contenido académico. '.repeat(8).trim()}`).join('\n\n');
  const parts = splitWhatsAppText(original);
  assert.ok(parts.length > 1); assert.ok(parts.every(part => part.length <= 3500));
  assert.equal(parts.join('\n\n'), original);
});
