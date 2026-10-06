-- ==============================================================================
-- Sales AI CRM - Reversión de Migración Inicial para Supabase
-- ==============================================================================

-- Remover tablas de la publicación Realtime si existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.crm_messages, public.crm_conversations, public.crm_leads;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Eliminar tablas en orden inverso de dependencias
DROP TABLE IF EXISTS public.crm_audit_logs;
DROP TABLE IF EXISTS public.crm_messages;
DROP TABLE IF EXISTS public.crm_conversations;
DROP TABLE IF EXISTS public.crm_leads;
DROP TABLE IF EXISTS public.crm_organizations;
