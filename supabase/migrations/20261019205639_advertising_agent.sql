create table public.crm_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null default 'org_inteca_main' check (organization_id = 'org_inteca_main'),
  payload jsonb not null,
  catalog_hash text not null,
  content_hash text not null,
  discount_required boolean not null default false,
  discount_approved boolean not null default false,
  approved_hash text,
  approved_by text,
  approved_destination text,
  approved_at timestamptz,
  scheduled_at timestamptz,
  state text not null default 'draft' check (state in ('draft','approved','executing','published','prepared','uploaded_private','review_required','blocked','rejected')),
  result jsonb not null default '{}',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state not in ('approved','executing','published','prepared','uploaded_private') or
    (approved_hash = content_hash and approved_hash is not null and approved_by is not null and approved_destination is not null and approved_at is not null and (not discount_required or discount_approved)))
);
create index crm_ad_campaigns_schedule on public.crm_ad_campaigns(scheduled_at) where state = 'approved';
create index crm_ad_campaigns_created on public.crm_ad_campaigns(created_at desc);
create table public.crm_ad_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.crm_ad_campaigns(id),
  previous_state text,
  state text not null,
  actor text,
  discount_approved boolean not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);
create index crm_ad_events_campaign on public.crm_ad_events(campaign_id, created_at desc);
alter table public.crm_ad_campaigns enable row level security;
alter table public.crm_ad_events enable row level security;
revoke all on public.crm_ad_campaigns, public.crm_ad_events from public, anon, authenticated;
grant select, insert, update on public.crm_ad_campaigns to service_role;
grant select, insert on public.crm_ad_events to service_role;
grant usage, select on sequence public.crm_ad_events_id_seq to service_role;
create function public.crm_ad_audit_guard() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.payload is distinct from old.payload or new.content_hash <> old.content_hash or new.catalog_hash <> old.catalog_hash or new.discount_required <> old.discount_required or new.scheduled_at is distinct from old.scheduled_at then
      raise exception 'IMMUTABLE_AD_DRAFT';
    end if;
    if old.state <> 'draft' and (new.approved_destination is distinct from old.approved_destination or new.approved_hash is distinct from old.approved_hash or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at or new.discount_approved <> old.discount_approved) then
      raise exception 'IMMUTABLE_AD_APPROVAL';
    end if;
    if not ((old.state = 'draft' and new.state in ('approved','rejected')) or (old.state = 'approved' and new.state in ('executing','blocked','rejected')) or (old.state = 'executing' and new.state in ('published','prepared','uploaded_private','review_required'))) then
      raise exception 'INVALID_AD_TRANSITION';
    end if;
    new.updated_at := now();
  elsif new.state <> 'draft' or new.approved_by is not null or new.discount_approved then
    raise exception 'AD_MUST_START_DRAFT';
  end if;
  return new;
end $$;
create trigger crm_ad_guard before insert or update on public.crm_ad_campaigns for each row execute function public.crm_ad_audit_guard();
create function public.crm_ad_audit_event() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.crm_ad_events(campaign_id, previous_state, state, actor, discount_approved, content_hash)
  values (new.id, case when TG_OP = 'UPDATE' then old.state else null end, new.state, new.approved_by, new.discount_approved, new.content_hash);
  return new;
end $$;
create trigger crm_ad_audit after insert or update on public.crm_ad_campaigns for each row execute function public.crm_ad_audit_event();
revoke all on function public.crm_ad_audit_guard(), public.crm_ad_audit_event() from public, anon, authenticated;
grant execute on function public.crm_ad_audit_guard(), public.crm_ad_audit_event() to service_role;
