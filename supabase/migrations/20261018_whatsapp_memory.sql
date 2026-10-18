-- Server-only conversational memory. Apply to the same Supabase project as the CRM.
-- Does not modify existing CRM tables or expose conversations to browser clients.
create table if not exists public.crm_whatsapp_memory (
  conversation_key text primary key,
  state jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.crm_whatsapp_memory enable row level security;
revoke all on public.crm_whatsapp_memory from anon, authenticated;
grant select, insert, update, delete on public.crm_whatsapp_memory to service_role;
create index if not exists crm_whatsapp_memory_expiry_idx on public.crm_whatsapp_memory (expires_at);
-- Expired state is never loaded by the application. Schedule this SQL daily in
-- your database maintenance job to physically delete expired records:
-- delete from public.crm_whatsapp_memory where expires_at < now();
