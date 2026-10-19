import { ThinkingLevel } from '@google/genai';
import type { AwaitingField, Conversation } from './whatsapp-conversation.ts';

// Gemini 3 output limits include reasoning. Keep enough output room and use low thinking.
export function whatsAppGenerationConfig(model: string, config: Record<string, unknown> = {}) {
  const thinkingConfig = /^gemini-[34]/.test(model) ? { thinkingLevel: ThinkingLevel.LOW }
    : /^gemini-2\.5-flash/.test(model) ? { thinkingBudget: 0 } : undefined;
  return { ...config, maxOutputTokens: 4096, ...(thinkingConfig ? { thinkingConfig } : {}) };
}

export function parseWhatsAppAnswer(raw: string, finishReason: string | undefined, conversation: Conversation): { reply: string; awaiting: AwaitingField } {
  if (finishReason === 'MAX_TOKENS') throw new Error('WHATSAPP_AI_OUTPUT_LIMIT');
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { throw new Error('WHATSAPP_AI_INVALID_JSON'); }
  const fields = ['', 'course', 'fullName', 'schedule', 'email', 'payment'];
  const awaiting = parsed?.awaiting === 'none' ? '' : parsed?.awaiting;
  if (typeof parsed?.reply !== 'string' || !parsed.reply.trim() || !fields.includes(awaiting)) throw new Error('WHATSAPP_AI_INVALID_RESPONSE');
  let reply = parsed.reply.trim().replace(/\*\*([^*]+)\*\*/g, '*$1*');
  if (reply.length > 12000) throw new Error('WHATSAPP_AI_REPLY_TOO_LONG');
  if (awaiting && conversation.facts[awaiting as keyof typeof conversation.facts]) {
    // A repeated final question must not discard the useful answer before it.
    const questionStart = reply.lastIndexOf('¿');
    if (questionStart > 0 && /\?\s*$/.test(reply)) reply = reply.slice(0, questionStart).trim();
    else throw new Error('WHATSAPP_AI_REPEATED_QUESTION');
    if (!reply) throw new Error('WHATSAPP_AI_REPEATED_QUESTION');
    return { reply, awaiting: '' };
  }
  return { reply, awaiting: awaiting as AwaitingField };
}

export function splitWhatsAppText(text: string, limit = 3500): string[] {
  const parts: string[] = [];
  let remaining = text.trim();
  while (remaining.length > limit) {
    let end = remaining.lastIndexOf('\n\n', limit);
    if (end < limit / 3) end = remaining.lastIndexOf('\n', limit);
    if (end < limit / 3) end = remaining.lastIndexOf(' ', limit);
    if (end <= 0) end = limit;
    // Avoid cutting a UTF-16 surrogate pair.
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
    parts.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}
