// Meta BSUIDs are opaque identities, not telephone numbers. Never strip their prefix.
export type WhatsAppRecipient = { kind: 'phone' | 'bsuid'; id: string };

export function resolveWhatsAppRecipient(message: any): WhatsAppRecipient | undefined {
  if (!message || message.type === 'system' || message.type === 'unknown') return;
  if (typeof message.from === 'string' && /^\+?[1-9]\d{5,14}$/.test(message.from)) {
    return { kind: 'phone', id: message.from.replace(/^\+/, '') };
  }
  for (const id of [message.from_user_id, message.from_parent_user_id]) {
    if (typeof id === 'string' && /^[A-Z]{2}\.(?:ENT\.)?[a-zA-Z0-9]{1,128}$/.test(id)) {
      return { kind: 'bsuid', id };
    }
  }
}

export function buildWhatsAppTextPayload(recipient: WhatsAppRecipient, body: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    ...(recipient.kind === 'phone' ? { to: recipient.id } : { recipient: recipient.id }),
    type: 'text',
    text: { preview_url: false, body },
  };
}

export function extractWhatsAppMessages(event: any, phoneNumberId?: string) {
  const messages: any[] = [];
  if (!Array.isArray(event?.entry)) return messages;
  for (const entry of event.entry) {
    if (!Array.isArray(entry?.changes)) continue;
    for (const change of entry.changes) {
      // Coexistence echoes/history and delivery receipts must never trigger replies.
      if (change?.field !== 'messages') continue;
      const value = change.value;
      if (phoneNumberId && value?.metadata?.phone_number_id !== phoneNumberId) continue;
      if (!Array.isArray(value?.messages)) continue;
      messages.push(...value.messages);
    }
  }
  return messages;
}