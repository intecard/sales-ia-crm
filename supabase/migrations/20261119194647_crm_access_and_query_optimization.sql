-- The CRM authenticates through its server, not Supabase browser sessions.
-- Preserve postgres/service_role access while removing legacy public access.
alter table public."CreativeContent" enable row level security;
alter table public._prisma_migrations enable row level security;
revoke all on table public."CreativeContent", public._prisma_migrations from public, anon, authenticated;

drop policy if exists authenticated_read_leads on public.crm_leads;
drop policy if exists authenticated_read_conversations on public.crm_conversations;
drop policy if exists authenticated_read_messages on public.crm_messages;
alter policy service_role_all_organizations on public.crm_organizations to service_role using (true) with check (true);
alter policy service_role_all_leads on public.crm_leads to service_role using (true) with check (true);
alter policy service_role_all_conversations on public.crm_conversations to service_role using (true) with check (true);
alter policy service_role_all_messages on public.crm_messages to service_role using (true) with check (true);
alter policy service_role_all_audit_logs on public.crm_audit_logs to service_role using (true) with check (true);
revoke all on table public.crm_organizations, public.crm_leads, public.crm_conversations, public.crm_messages, public.crm_audit_logs from public, anon, authenticated;

-- Tables were inspected before migration; these foreign keys lacked covering indexes.
create index if not exists crm_gateway_provider_events_order_idx on public.crm_gateway_provider_events(order_id);
create index if not exists crm_local_video_jobs_community_idx on public.crm_local_video_jobs(community_job_id);
create index if not exists crm_messages_org_idx on public.crm_messages(organization_id);
create index if not exists crm_payment_receipts_event_idx on public.crm_payment_receipts(source_event_id);
create index if not exists crm_video_projects_parent_idx on public.crm_video_projects(parent_id);
