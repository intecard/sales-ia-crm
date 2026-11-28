-- Render is the authenticated CRM backend. Browser roles have no row policies on
-- these historical tables and should not receive table or sequence grants.
set local lock_timeout = '3s';

do $$
declare
  legacy_name text;
  target oid;
begin
  foreach legacy_name in array array[
    'AIAgent','Activity','AuditLog','Automation','Campaign','ChannelEvent',
    'Company','Contact','Conversation','CustomFieldDefinition','Deal',
    'Document','IntegrationConnection','Membership','Message',
    'ModuleInstallation','Organization','Payment','PaymentRequest','Permission',
    'Pipeline','Plan','Product','PromptVersion','Role','RolePermission',
    'Session','Stage','Subscription','UsageRecord','User','wa_inbox'
  ] loop
    target := to_regclass(format('public.%I',legacy_name));
    -- Some of these tables predate the repository migrations.
    if target is null then continue; end if;
    if not exists (select 1 from pg_class where oid=target and relkind='r' and relrowsecurity)
       or exists (select 1 from pg_policy where polrelid=target) then
      raise exception 'Unexpected browser policy or table configuration for %',legacy_name;
    end if;
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',legacy_name
    );
  end loop;
end
$$;

-- Sequences are not protected by row policies. Preserve Render's existing grants.
revoke all privileges on sequence
  public.crm_ad_events_id_seq,
  public.crm_community_events_id_seq,
  public.crm_registration_number,
  public.crm_voice_events_id_seq
from public, anon, authenticated;

-- Opt in to browser access in future migrations only if deliberately required.
-- Leave service_role, Storage, generated auth tables, and function grants as-is.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;

create index if not exists crm_agent_lessons_task_id_idx
  on public.crm_agent_lessons (task_id);
