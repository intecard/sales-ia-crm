import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CrmLeadRecord {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  company?: string;
  status: string;
  stage_id: string;
  source: string;
  course_of_interest_id?: string;
  assigned_agent_id?: string;
  buy_probability: number;
  current_emotion: string;
  notes?: string;
  custom_fields?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrmConversationRecord {
  id: string;
  organization_id: string;
  lead_id: string;
  channel: string;
  channel_account_id?: string;
  external_contact_id: string;
  status: 'open' | 'closed' | 'pending_human';
  ai_auto_reply_enabled: boolean;
  last_message_text: string;
  last_message_at: string;
  unread_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrmMessageRecord {
  id: string;
  organization_id: string;
  conversation_id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'lead' | 'ai_agent' | 'human_agent' | 'system';
  sender_name: string;
  channel: string;
  content: string;
  message_type: 'text' | 'image' | 'audio' | 'document' | 'interactive' | 'template';
  external_message_id?: string;
  status: 'received' | 'sent' | 'delivered' | 'read' | 'failed';
  error_details?: Record<string, unknown> | null;
  raw_payload?: Record<string, unknown>;
  created_at: string;
}

export interface CrmAuditEventRecord {
  id: string;
  organization_id: string;
  timestamp: string;
  actor_type: string;
  actor_name: string;
  module: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  summary: string;
  details?: string;
  source_channel: string;
  severity: string;
  status: string;
}

// In-Memory Fallback Store (acts as local cache and resilient fallback if Supabase is offline)
const inMemoryLeads = new Map<string, CrmLeadRecord>();
const inMemoryConversations = new Map<string, CrmConversationRecord>();
const inMemoryMessages = new Map<string, CrmMessageRecord>();
const inMemoryAuditLogs: CrmAuditEventRecord[] = [];
const processedExternalMessageIds = new Set<string>();

let supabaseInstance: SupabaseClient | null = null;
let supabaseHealthCache: {
  healthy: boolean;
  checkedAt: number;
  tablesFound: boolean;
  error?: string;
} | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (!url || !key) {
    return null;
  }

  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseInstance;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

export async function checkSupabaseHealth(force = false): Promise<{
  configured: boolean;
  healthy: boolean;
  tablesFound: boolean;
  urlHost?: string;
  error?: string;
}> {
  const client = getSupabaseClient();
  const url = process.env.SUPABASE_URL?.trim();

  if (!client || !url) {
    return {
      configured: false,
      healthy: false,
      tablesFound: false,
      error: 'SUPABASE_URL o credenciales no configuradas',
    };
  }

  let urlHost: string | undefined;
  try {
    urlHost = new URL(url).hostname;
  } catch {
    urlHost = 'invalid-url';
  }

  const now = Date.now();
  if (!force && supabaseHealthCache && now - supabaseHealthCache.checkedAt < 30_000) {
    return {
      configured: true,
      healthy: supabaseHealthCache.healthy,
      tablesFound: supabaseHealthCache.tablesFound,
      urlHost,
      error: supabaseHealthCache.error,
    };
  }

  try {
    // Probar consultar la tabla de leads
    const { data: _data, error } = await client.from('crm_leads').select('id').limit(1);

    if (error) {
      const isMissingTable =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message.includes('relation "public.crm_leads" does not exist') ||
        error.message.includes('Could not find the');

      supabaseHealthCache = {
        healthy: !isMissingTable,
        checkedAt: now,
        tablesFound: !isMissingTable,
        error: isMissingTable
          ? 'Tablas de Sales AI CRM no creadas aún en Supabase. Ejecute la migración SQL en Supabase SQL Editor.'
          : `${error.code || 'ERROR'}: ${error.message}`,
      };
    } else {
      supabaseHealthCache = {
        healthy: true,
        checkedAt: now,
        tablesFound: true,
      };
    }
  } catch (err) {
    supabaseHealthCache = {
      healthy: false,
      checkedAt: now,
      tablesFound: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    configured: true,
    healthy: supabaseHealthCache.healthy,
    tablesFound: supabaseHealthCache.tablesFound,
    urlHost,
    error: supabaseHealthCache.error,
  };
}

export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^\d+]/g, '').trim();
}

/**
 * Registra o actualiza un Lead en Supabase (y en memoria como resguardo).
 */
export async function upsertCrmLead(params: {
  organizationId?: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  source?: string;
  courseOfInterestId?: string;
  assignedAgentId?: string;
  currentEmotion?: string;
  buyProbability?: number;
  notes?: string;
}): Promise<CrmLeadRecord> {
  const orgId = params.organizationId || 'org_inteca_main';
  const cleanPhone = normalizePhoneNumber(params.phone);
  const cleanWhatsapp = normalizePhoneNumber(params.whatsapp || params.phone);

  const nameParts = (params.name || 'Prospecto WhatsApp').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Prospecto';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Buscar si ya existe en memoria por teléfono
  let existingLead: CrmLeadRecord | undefined;
  for (const lead of inMemoryLeads.values()) {
    if (
      (cleanPhone && (lead.phone === cleanPhone || lead.whatsapp === cleanPhone)) ||
      (cleanWhatsapp && (lead.phone === cleanWhatsapp || lead.whatsapp === cleanWhatsapp))
    ) {
      existingLead = lead;
      break;
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client
        .from('crm_leads')
        .select('*')
        .or(`phone.eq.${cleanPhone},whatsapp.eq.${cleanWhatsapp}`)
        .limit(1)
        .maybeSingle();

      if (data) {
        existingLead = data as CrmLeadRecord;
      }
    } catch (err) {
      console.warn('Supabase find lead error, falling back to memory:', err);
    }
  }

  const now = new Date().toISOString();

  if (existingLead) {
    // Actualizar lead existente
    const updated: CrmLeadRecord = {
      ...existingLead,
      first_name: firstName || existingLead.first_name,
      last_name: lastName || existingLead.last_name,
      email: params.email || existingLead.email,
      phone: cleanPhone || existingLead.phone,
      whatsapp: cleanWhatsapp || existingLead.whatsapp,
      source: existingLead.source || params.source || 'WhatsApp',
      course_of_interest_id: params.courseOfInterestId || existingLead.course_of_interest_id,
      assigned_agent_id: params.assignedAgentId || existingLead.assigned_agent_id,
      current_emotion: params.currentEmotion || existingLead.current_emotion,
      buy_probability: params.buyProbability ?? existingLead.buy_probability,
      notes: params.notes ? `${existingLead.notes || ''}\n${params.notes}`.trim() : existingLead.notes,
      updated_at: now,
    };

    inMemoryLeads.set(updated.id, updated);

    if (client) {
      try {
        await client.from('crm_leads').update(updated).eq('id', updated.id);
      } catch (err) {
        console.warn('Supabase update lead failed:', err);
      }
    }

    return updated;
  }

  // Crear nuevo lead
  const newLead: CrmLeadRecord = {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    organization_id: orgId,
    first_name: firstName,
    last_name: lastName,
    email: params.email || '',
    phone: cleanPhone,
    whatsapp: cleanWhatsapp,
    company: '',
    status: 'Nuevo',
    stage_id: 'stage_discovery',
    source: params.source || 'WhatsApp',
    course_of_interest_id: params.courseOfInterestId || '',
    assigned_agent_id: params.assignedAgentId || 'agent_whatsapp',
    buy_probability: params.buyProbability ?? 50,
    current_emotion: params.currentEmotion || 'Interesado',
    notes: params.notes || '',
    custom_fields: {},
    created_at: now,
    updated_at: now,
  };

  inMemoryLeads.set(newLead.id, newLead);

  if (client) {
    try {
      await client.from('crm_leads').insert(newLead);
    } catch (err) {
      console.warn('Supabase insert lead failed:', err);
    }
  }

  return newLead;
}

/**
 * Obtiene o crea la conversación para un Lead y Canal específico.
 */
export async function getOrCreateCrmConversation(params: {
  organizationId?: string;
  leadId: string;
  channel: string;
  externalContactId: string;
  channelAccountId?: string;
}): Promise<CrmConversationRecord> {
  const orgId = params.organizationId || 'org_inteca_main';
  const channel = params.channel.toLowerCase();
  const externalContactId = normalizePhoneNumber(params.externalContactId);

  // Buscar en memoria
  let existingConv: CrmConversationRecord | undefined;
  for (const conv of inMemoryConversations.values()) {
    if (conv.lead_id === params.leadId && conv.channel === channel) {
      existingConv = conv;
      break;
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client
        .from('crm_conversations')
        .select('*')
        .eq('lead_id', params.leadId)
        .eq('channel', channel)
        .limit(1)
        .maybeSingle();

      if (data) {
        existingConv = data as CrmConversationRecord;
      }
    } catch (err) {
      console.warn('Supabase find conversation error:', err);
    }
  }

  if (existingConv) {
    inMemoryConversations.set(existingConv.id, existingConv);
    return existingConv;
  }

  const now = new Date().toISOString();
  const newConv: CrmConversationRecord = {
    id: `conv_${channel}_${params.leadId}`,
    organization_id: orgId,
    lead_id: params.leadId,
    channel,
    channel_account_id: params.channelAccountId || '',
    external_contact_id: externalContactId,
    status: 'open',
    ai_auto_reply_enabled: true,
    last_message_text: '',
    last_message_at: now,
    unread_count: 0,
    metadata: {},
    created_at: now,
    updated_at: now,
  };

  inMemoryConversations.set(newConv.id, newConv);

  if (client) {
    try {
      await client.from('crm_conversations').insert(newConv);
    } catch (err) {
      console.warn('Supabase insert conversation failed:', err);
    }
  }

  return newConv;
}

/**
 * Guarda un mensaje entrante (ej. WhatsApp webhook), deduplicándolo de forma duradera.
 */
export async function saveInboundCrmMessage(params: {
  organizationId?: string;
  conversationId: string;
  leadId: string;
  content: string;
  senderName: string;
  channel?: string;
  messageType?: CrmMessageRecord['message_type'];
  externalMessageId?: string;
  rawPayload?: Record<string, unknown>;
}): Promise<{ message: CrmMessageRecord; isDuplicate: boolean }> {
  const orgId = params.organizationId || 'org_inteca_main';
  const externalId = params.externalMessageId;

  // Deduplicación en memoria
  if (externalId && processedExternalMessageIds.has(externalId)) {
    const existing = Array.from(inMemoryMessages.values()).find(
      (m) => m.external_message_id === externalId,
    );
    if (existing) {
      return { message: existing, isDuplicate: true };
    }
  }

  const client = getSupabaseClient();
  if (client && externalId) {
    try {
      const { data } = await client
        .from('crm_messages')
        .select('*')
        .eq('external_message_id', externalId)
        .limit(1)
        .maybeSingle();

      if (data) {
        processedExternalMessageIds.add(externalId);
        return { message: data as CrmMessageRecord, isDuplicate: true };
      }
    } catch (err) {
      console.warn('Supabase duplicate check failed:', err);
    }
  }

  const now = new Date().toISOString();
  const messageRecord: CrmMessageRecord = {
    id: `msg_in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    organization_id: orgId,
    conversation_id: params.conversationId,
    lead_id: params.leadId,
    direction: 'inbound',
    sender_type: 'lead',
    sender_name: params.senderName,
    channel: params.channel || 'whatsapp',
    content: params.content,
    message_type: params.messageType || 'text',
    external_message_id: externalId,
    status: 'received',
    raw_payload: params.rawPayload || {},
    created_at: now,
  };

  inMemoryMessages.set(messageRecord.id, messageRecord);
  if (externalId) {
    processedExternalMessageIds.add(externalId);
    if (processedExternalMessageIds.size > 2_000) {
      const first = processedExternalMessageIds.values().next().value;
      if (typeof first === 'string') processedExternalMessageIds.delete(first);
    }
  }

  // Actualizar conversación
  const conv = inMemoryConversations.get(params.conversationId);
  if (conv) {
    conv.last_message_text = params.content;
    conv.last_message_at = now;
    conv.unread_count = (conv.unread_count || 0) + 1;
    conv.updated_at = now;
  }

  if (client) {
    try {
      await client.from('crm_messages').insert(messageRecord);
      await client
        .from('crm_conversations')
        .update({
          last_message_text: params.content,
          last_message_at: now,
          unread_count: conv?.unread_count || 1,
          updated_at: now,
        })
        .eq('id', params.conversationId);
    } catch (err) {
      console.warn('Supabase save inbound message failed:', err);
    }
  }

  return { message: messageRecord, isDuplicate: false };
}

/**
 * Guarda un mensaje saliente (generado por Agente IA o Asesor Humano).
 */
export async function saveOutboundCrmMessage(params: {
  organizationId?: string;
  conversationId: string;
  leadId: string;
  content: string;
  senderType: 'ai_agent' | 'human_agent' | 'system';
  senderName: string;
  channel?: string;
  messageType?: CrmMessageRecord['message_type'];
  externalMessageId?: string;
  status?: CrmMessageRecord['status'];
  errorDetails?: Record<string, unknown> | null;
  rawPayload?: Record<string, unknown>;
}): Promise<CrmMessageRecord> {
  const orgId = params.organizationId || 'org_inteca_main';
  const now = new Date().toISOString();

  const messageRecord: CrmMessageRecord = {
    id: `msg_out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    organization_id: orgId,
    conversation_id: params.conversationId,
    lead_id: params.leadId,
    direction: 'outbound',
    sender_type: params.senderType,
    sender_name: params.senderName,
    channel: params.channel || 'whatsapp',
    content: params.content,
    message_type: params.messageType || 'text',
    external_message_id: params.externalMessageId,
    status: params.status || 'sent',
    error_details: params.errorDetails || null,
    raw_payload: params.rawPayload || {},
    created_at: now,
  };

  inMemoryMessages.set(messageRecord.id, messageRecord);
  if (params.externalMessageId) {
    processedExternalMessageIds.add(params.externalMessageId);
  }

  // Actualizar conversación
  const conv = inMemoryConversations.get(params.conversationId);
  if (conv) {
    conv.last_message_text = params.content;
    conv.last_message_at = now;
    conv.updated_at = now;
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('crm_messages').insert(messageRecord);
      await client
        .from('crm_conversations')
        .update({
          last_message_text: params.content,
          last_message_at: now,
          updated_at: now,
        })
        .eq('id', params.conversationId);
    } catch (err) {
      console.warn('Supabase save outbound message failed:', err);
    }
  }

  return messageRecord;
}

/**
 * Actualiza el estado de entrega de un mensaje por su external_message_id (wamid de Meta).
 */
export async function updateMessageDeliveryStatus(params: {
  externalMessageId: string;
  status: CrmMessageRecord['status'];
  errorDetails?: Record<string, unknown>;
}): Promise<boolean> {
  const { externalMessageId, status, errorDetails } = params;

  // Actualizar en memoria
  let foundInMemory = false;
  for (const msg of inMemoryMessages.values()) {
    if (msg.external_message_id === externalMessageId) {
      msg.status = status;
      if (errorDetails) msg.error_details = errorDetails;
      foundInMemory = true;
      break;
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const updateData: Record<string, unknown> = { status };
      if (errorDetails) updateData.error_details = errorDetails;
      await client
        .from('crm_messages')
        .update(updateData)
        .eq('external_message_id', externalMessageId);
      return true;
    } catch (err) {
      console.warn('Supabase update status failed:', err);
    }
  }

  return foundInMemory;
}

/**
 * Obtiene el historial de conversación en orden cronológico (para dar memoria contextual a la IA).
 */
export async function getConversationHistoryForPrompt(
  conversationId: string,
  limit = 8,
): Promise<Array<{ role: string; name: string; content: string }>> {
  const client = getSupabaseClient();
  let records: CrmMessageRecord[] = [];

  if (client) {
    try {
      const { data } = await client
        .from('crm_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (data && data.length > 0) {
        records = (data as CrmMessageRecord[]).reverse();
      }
    } catch (err) {
      console.warn('Supabase history fetch failed:', err);
    }
  }

  if (records.length === 0) {
    const memList: CrmMessageRecord[] = [];
    for (const msg of inMemoryMessages.values()) {
      if (msg.conversation_id === conversationId) {
        memList.push(msg);
      }
    }
    records = memList
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-limit);
  }

  return records.map((m) => ({
    role: m.sender_type === 'lead' ? 'Cliente' : m.sender_name || 'Agente INTECA',
    name: m.sender_name || (m.sender_type === 'lead' ? 'Cliente' : 'Agente INTECA'),
    content: m.content,
  }));
}

/**
 * Obtiene la lista completa de leads con su información para el CRM frontend.
 */
export async function getCrmLeadsList(organizationId = 'org_inteca_main'): Promise<CrmLeadRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client
        .from('crm_leads')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (data && Array.isArray(data)) {
        // Sincronizar en memoria
        for (const lead of data as CrmLeadRecord[]) {
          inMemoryLeads.set(lead.id, lead);
        }
        return data as CrmLeadRecord[];
      }
    } catch (err) {
      console.warn('Supabase get leads failed:', err);
    }
  }

  return Array.from(inMemoryLeads.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Obtiene todas las conversaciones con su último mensaje.
 */
export async function getCrmConversationsList(
  organizationId = 'org_inteca_main',
): Promise<Array<CrmConversationRecord & { lead?: CrmLeadRecord }>> {
  const leads = await getCrmLeadsList(organizationId);
  const leadsMap = new Map(leads.map((l) => [l.id, l]));

  const client = getSupabaseClient();
  let convs: CrmConversationRecord[] = [];

  if (client) {
    try {
      const { data } = await client
        .from('crm_conversations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('last_message_at', { ascending: false });

      if (data && Array.isArray(data)) {
        convs = data as CrmConversationRecord[];
        for (const c of convs) {
          inMemoryConversations.set(c.id, c);
        }
      }
    } catch (err) {
      console.warn('Supabase get conversations failed:', err);
    }
  }

  if (convs.length === 0) {
    convs = Array.from(inMemoryConversations.values()).sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
    );
  }

  return convs.map((c) => ({
    ...c,
    lead: leadsMap.get(c.lead_id),
  }));
}

/**
 * Obtiene los mensajes de una conversación.
 */
export async function getCrmMessagesByConversation(
  conversationId: string,
): Promise<CrmMessageRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client
        .from('crm_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (data && Array.isArray(data)) {
        return data as CrmMessageRecord[];
      }
    } catch (err) {
      console.warn('Supabase get messages failed:', err);
    }
  }

  const list: CrmMessageRecord[] = [];
  for (const msg of inMemoryMessages.values()) {
    if (msg.conversation_id === conversationId) {
      list.push(msg);
    }
  }
  return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/**
 * Conmuta el estado de respuesta autónoma del Agente IA para una conversación.
 */
export async function setConversationAiStatus(
  conversationId: string,
  enabled: boolean,
): Promise<boolean> {
  const conv = inMemoryConversations.get(conversationId);
  if (conv) {
    conv.ai_auto_reply_enabled = enabled;
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('crm_conversations')
        .update({ ai_auto_reply_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      return true;
    } catch (err) {
      console.warn('Supabase set AI status failed:', err);
    }
  }

  return Boolean(conv);
}

/**
 * Registra evento de auditoría en Supabase y en memoria.
 */
export async function recordPersistentAuditEvent(
  event: Omit<CrmAuditEventRecord, 'id' | 'timestamp' | 'organization_id'> & {
    organizationId?: string;
  },
): Promise<CrmAuditEventRecord> {
  const record: CrmAuditEventRecord = {
    id: `srv_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    organization_id: event.organizationId || 'org_inteca_main',
    timestamp: new Date().toISOString(),
    ...event,
  };

  inMemoryAuditLogs.unshift(record);
  if (inMemoryAuditLogs.length > 500) {
    inMemoryAuditLogs.splice(500);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('crm_audit_logs').insert(record);
    } catch (err) {
      // Ignorar fallo de inserción de auditoría para no bloquear la operación principal
    }
  }

  return record;
}

export function getMemoryAuditLogs(): CrmAuditEventRecord[] {
  return inMemoryAuditLogs;
}
