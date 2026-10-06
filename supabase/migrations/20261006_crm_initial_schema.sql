-- ==============================================================================
-- Sales AI CRM - Migración Inicial de Base de Datos para Supabase
-- Empresa: INTECA (Instituto Técnico del Caribe)
-- Fecha: 2026-10-06
-- ==============================================================================

-- 1. Tabla de Organizaciones / Empresas
CREATE TABLE IF NOT EXISTS public.crm_organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo TEXT DEFAULT '🎓',
    plan TEXT DEFAULT 'Enterprise Autonomous AI',
    active_users INTEGER DEFAULT 1,
    whatsapp_status TEXT DEFAULT 'Conectado',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar INTECA como organización por defecto si no existe
INSERT INTO public.crm_organizations (id, name, slug, logo, plan, active_users, whatsapp_status)
VALUES ('org_inteca_main', 'INTECA SRL', 'inteca-main', '🎓', 'Enterprise Autonomous AI', 8, 'Conectado')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla de Leads / Prospectos
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.crm_organizations(id) ON DELETE CASCADE DEFAULT 'org_inteca_main',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    company TEXT DEFAULT '',
    status TEXT DEFAULT 'Nuevo',
    stage_id TEXT DEFAULT 'stage_discovery',
    source TEXT DEFAULT 'WhatsApp',
    course_of_interest_id TEXT DEFAULT '',
    assigned_agent_id TEXT DEFAULT 'agent_whatsapp',
    buy_probability INTEGER DEFAULT 50,
    current_emotion TEXT DEFAULT 'Interesado',
    notes TEXT DEFAULT '',
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_org ON public.crm_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON public.crm_leads(phone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_whatsapp ON public.crm_leads(whatsapp);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON public.crm_leads(created_at DESC);

-- 3. Tabla de Conversaciones
CREATE TABLE IF NOT EXISTS public.crm_conversations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.crm_organizations(id) ON DELETE CASCADE DEFAULT 'org_inteca_main',
    lead_id TEXT NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    channel_account_id TEXT DEFAULT '',
    external_contact_id TEXT NOT NULL, -- Número de WhatsApp (wa_id) o ID de red social
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'pending_human'
    ai_auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
    last_message_text TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    unread_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_conv_org ON public.crm_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_conv_lead ON public.crm_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_conv_external_contact ON public.crm_conversations(channel, external_contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_conv_last_msg_at ON public.crm_conversations(last_message_at DESC);

-- 4. Tabla de Mensajes
CREATE TABLE IF NOT EXISTS public.crm_messages (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.crm_organizations(id) ON DELETE CASCADE DEFAULT 'org_inteca_main',
    conversation_id TEXT NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
    lead_id TEXT NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('lead', 'ai_agent', 'human_agent', 'system')),
    sender_name TEXT DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'audio', 'document', 'interactive', 'template'
    external_message_id TEXT, -- Meta wamid.HBg...
    status TEXT NOT NULL DEFAULT 'received', -- 'received', 'sent', 'delivered', 'read', 'failed'
    error_details JSONB,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_msg_conv ON public.crm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_msg_lead ON public.crm_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_msg_external_id ON public.crm_messages(external_message_id);
CREATE INDEX IF NOT EXISTS idx_crm_msg_created_at ON public.crm_messages(created_at ASC);

-- 5. Tabla de Auditoría del Servidor y Agentes
CREATE TABLE IF NOT EXISTS public.crm_audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.crm_organizations(id) ON DELETE CASCADE DEFAULT 'org_inteca_main',
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    actor_type TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT NOT NULL,
    details TEXT,
    source_channel TEXT DEFAULT 'WhatsApp',
    severity TEXT NOT NULL DEFAULT 'Info',
    status TEXT NOT NULL DEFAULT 'Registrado'
);

CREATE INDEX IF NOT EXISTS idx_crm_audit_org ON public.crm_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_timestamp ON public.crm_audit_logs(timestamp DESC);

-- 6. Configuración de Políticas de Seguridad (Row Level Security - RLS)
ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para el rol de servicio del backend (service_role): acceso total sin restricciones
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_organizations') THEN
        CREATE POLICY service_role_all_organizations ON public.crm_organizations FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_leads') THEN
        CREATE POLICY service_role_all_leads ON public.crm_leads FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_conversations') THEN
        CREATE POLICY service_role_all_conversations ON public.crm_conversations FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_messages') THEN
        CREATE POLICY service_role_all_messages ON public.crm_messages FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_audit_logs') THEN
        CREATE POLICY service_role_all_audit_logs ON public.crm_audit_logs FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Política para usuarios autenticados o acceso anónimo controlado (lectura de datos en el CRM)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_leads') THEN
        CREATE POLICY authenticated_read_leads ON public.crm_leads FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_conversations') THEN
        CREATE POLICY authenticated_read_conversations ON public.crm_conversations FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_messages') THEN
        CREATE POLICY authenticated_read_messages ON public.crm_messages FOR SELECT USING (true);
    END IF;
END $$;

-- 7. Habilitar Supabase Realtime si la publicación existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads, public.crm_conversations, public.crm_messages;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Si ya estaban agregadas o no hay permisos de publicación, continuar sin error
        NULL;
END $$;
