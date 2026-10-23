begin;
create table public.crm_fiscal_companies (
  organization_id text primary key check (organization_id ~ '^[a-zA-Z0-9_-]{3,120}$'),
  profile jsonb not null check (jsonb_typeof(profile)='object' and profile->>'taxId' ~ '^\d{9}(\d{2})?$' and profile->>'country'='DO' and profile->>'environment' in ('precertification','certification','production')),
  profile_hash text not null check (profile_hash ~ '^[a-f0-9]{64}$'),
  created_by text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.crm_fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.crm_fiscal_companies(organization_id),
  environment text not null check (environment in ('precertification','certification','production')),
  idempotency_key uuid not null, request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  profile_hash text not null check (profile_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null, issuer_snapshot jsonb not null, totals jsonb not null,
  rule_version text not null,
  status text not null default 'draft' check (status in ('draft','reviewed','cancelled')),
  fiscal_status text not null default 'not_transmitted' check (fiscal_status='not_transmitted'),
  e_ncf text check (e_ncf is null), track_id text check (track_id is null),
  created_by text not null, reviewed_by text, reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id,environment,idempotency_key),
  unique(organization_id,id),
  check (payload->>'type' in ('31','32','33','34','41','43','44','45','46','47')),
  check (totals->>'route' in ('ECF','RFCE')),
  check ((totals->>'fiscalTotal')::numeric > 0),
  check ((totals->>'amountDue')::numeric >= 0)
);
create index crm_fiscal_documents_company_created on public.crm_fiscal_documents(organization_id,created_at desc,id);
create table public.crm_fiscal_events (
  id uuid primary key default gen_random_uuid(), organization_id text not null references public.crm_fiscal_companies(organization_id),
  document_id uuid, actor text not null, kind text not null, details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key(organization_id,document_id) references public.crm_fiscal_documents(organization_id,id)
);
create index crm_fiscal_events_company_created on public.crm_fiscal_events(organization_id,created_at desc);
create index crm_fiscal_events_document on public.crm_fiscal_events(organization_id,document_id);
alter table public.crm_fiscal_companies enable row level security;
alter table public.crm_fiscal_documents enable row level security;
alter table public.crm_fiscal_events enable row level security;
revoke all on public.crm_fiscal_companies,public.crm_fiscal_documents,public.crm_fiscal_events from public,anon,authenticated;
grant select,insert,update on public.crm_fiscal_companies,public.crm_fiscal_documents to service_role;
grant select,insert on public.crm_fiscal_events to service_role;

create function public.crm_guard_fiscal_document() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'FISCAL_IMMUTABLE'; end if;
  if (to_jsonb(new)-array['status','reviewed_by','reviewed_at']) is distinct from (to_jsonb(old)-array['status','reviewed_by','reviewed_at']) then raise exception 'FISCAL_IMMUTABLE'; end if;
  if new.status=old.status then
    if new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at then raise exception 'FISCAL_IMMUTABLE'; end if;
    return new;
  end if;
  if not ((old.status='draft' and new.status in ('reviewed','cancelled')) or (old.status='reviewed' and new.status='cancelled')) then raise exception 'FISCAL_STATE'; end if;
  return new;
end $$;
create trigger crm_fiscal_document_guard before update or delete on public.crm_fiscal_documents for each row execute function public.crm_guard_fiscal_document();

create function public.crm_save_fiscal_company(p_org text,p_profile jsonb,p_hash text,p_actor text) returns setof public.crm_fiscal_companies language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_row public.crm_fiscal_companies;
begin
  perform pg_advisory_xact_lock(hashtextextended('fiscal:'||p_org,0));
  select * into current_row from public.crm_fiscal_companies where organization_id=p_org for update;
  if found and current_row.profile->>'taxId' is distinct from p_profile->>'taxId' and exists(select 1 from public.crm_fiscal_documents where organization_id=p_org) then raise exception 'FISCAL_ISSUER_LOCKED'; end if;
  insert into public.crm_fiscal_companies(organization_id,profile,profile_hash,created_by) values(p_org,p_profile,p_hash,p_actor)
  on conflict(organization_id) do update set profile=excluded.profile,profile_hash=excluded.profile_hash,updated_at=now();
  insert into public.crm_fiscal_events(organization_id,actor,kind,details) values(p_org,p_actor,'profile_saved',jsonb_build_object('profileHash',p_hash,'environment',p_profile->>'environment'));
  return query select * from public.crm_fiscal_companies where organization_id=p_org;
end $$;
create function public.crm_create_fiscal_draft(p_org text,p_key uuid,p_request_hash text,p_profile_hash text,p_payload jsonb,p_totals jsonb,p_issuer jsonb,p_rules text,p_actor text) returns setof public.crm_fiscal_documents language plpgsql security invoker set search_path=public,pg_temp as $$
declare company public.crm_fiscal_companies; document public.crm_fiscal_documents;
begin
  select * into company from public.crm_fiscal_companies where organization_id=p_org for update;
  if not found then raise exception 'FISCAL_PROFILE_REQUIRED'; end if;
  select * into document from public.crm_fiscal_documents where organization_id=p_org and environment=company.profile->>'environment' and idempotency_key=p_key;
  if found then
    if document.request_hash<>p_request_hash then raise exception 'FISCAL_IDEMPOTENCY'; end if;
    return next document; return;
  end if;
  if company.profile_hash<>p_profile_hash or p_issuer is distinct from company.profile then raise exception 'FISCAL_PROFILE_CHANGED'; end if;
  if not (company.profile->'enabledTypes' ? (p_payload->>'type')) then raise exception 'FISCAL_TYPE'; end if;
  insert into public.crm_fiscal_documents(organization_id,environment,idempotency_key,request_hash,profile_hash,payload,issuer_snapshot,totals,rule_version,created_by)
  values(p_org,company.profile->>'environment',p_key,p_request_hash,p_profile_hash,p_payload,p_issuer,p_totals,p_rules,p_actor) returning * into document;
  insert into public.crm_fiscal_events(organization_id,document_id,actor,kind,details) values(p_org,document.id,p_actor,'draft_created',jsonb_build_object('requestHash',p_request_hash,'rules',p_rules));
  return next document;
end $$;
create function public.crm_review_fiscal_draft(p_org text,p_id uuid,p_actor text) returns setof public.crm_fiscal_documents language plpgsql security invoker set search_path=public,pg_temp as $$
declare document public.crm_fiscal_documents; company public.crm_fiscal_companies;
begin
  select * into company from public.crm_fiscal_companies where organization_id=p_org for update;
  select * into document from public.crm_fiscal_documents where organization_id=p_org and id=p_id for update;
  if not found then raise exception 'FISCAL_NOT_FOUND'; end if;
  if document.status='reviewed' then return next document; return; end if;
  if document.status<>'draft' then raise exception 'FISCAL_STATE'; end if;
  if document.profile_hash<>company.profile_hash then raise exception 'FISCAL_PROFILE_CHANGED'; end if;
  update public.crm_fiscal_documents set status='reviewed',reviewed_by=p_actor,reviewed_at=now() where organization_id=p_org and id=p_id returning * into document;
  insert into public.crm_fiscal_events(organization_id,document_id,actor,kind) values(p_org,p_id,p_actor,'commercial_reviewed');
  return next document;
end $$;
create function public.crm_cancel_fiscal_draft(p_org text,p_id uuid,p_actor text) returns setof public.crm_fiscal_documents language plpgsql security invoker set search_path=public,pg_temp as $$
declare document public.crm_fiscal_documents;
begin
  select * into document from public.crm_fiscal_documents where organization_id=p_org and id=p_id for update;
  if not found then raise exception 'FISCAL_NOT_FOUND'; end if;
  if document.status='cancelled' then return next document; return; end if;
  update public.crm_fiscal_documents set status='cancelled' where organization_id=p_org and id=p_id returning * into document;
  insert into public.crm_fiscal_events(organization_id,document_id,actor,kind) values(p_org,p_id,p_actor,'draft_cancelled');
  return next document;
end $$;
revoke all on function public.crm_guard_fiscal_document(),public.crm_save_fiscal_company(text,jsonb,text,text),public.crm_create_fiscal_draft(text,uuid,text,text,jsonb,jsonb,jsonb,text,text),public.crm_review_fiscal_draft(text,uuid,text),public.crm_cancel_fiscal_draft(text,uuid,text) from public,anon,authenticated;
grant execute on function public.crm_guard_fiscal_document(),public.crm_save_fiscal_company(text,jsonb,text,text),public.crm_create_fiscal_draft(text,uuid,text,text,jsonb,jsonb,jsonb,text,text),public.crm_review_fiscal_draft(text,uuid,text),public.crm_cancel_fiscal_draft(text,uuid,text) to service_role;
commit;
