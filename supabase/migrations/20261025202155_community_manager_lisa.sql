create table public.crm_community_settings (
 id text primary key check(id='inteca'),
 organization_id text not null default 'org_inteca_main' check(organization_id='org_inteca_main'),
 enabled boolean not null default false,
 destinations jsonb,
 plan_started_at timestamptz,
 metrics_checked_at timestamptz,
 authorization_note text not null,
 updated_at timestamptz not null default now()
);
create table public.crm_community_jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null default 'org_inteca_main' check(organization_id='org_inteca_main'),
 slot text not null unique,
 channel text not null check(channel in ('facebook','instagram','youtube')),
 payload jsonb not null check(octet_length(payload::text)<15000),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 scheduled_at timestamptz not null,
 state text not null check(state in ('queued','preparing','executing','published','uploaded_private','blocked','review_required','missed','brief')),
 media_url text,
 result jsonb not null default '{}',
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index crm_community_due on public.crm_community_jobs(scheduled_at) where state='queued';
create index crm_community_assets on public.crm_community_jobs((payload->>'assetKey'));
create table public.crm_community_events (
 id bigint generated always as identity primary key,
 job_id uuid not null references public.crm_community_jobs(id),
 previous_state text,
 state text not null,
 created_at timestamptz not null default now()
);
create index crm_community_events_job on public.crm_community_events(job_id,created_at);
create table public.crm_community_observations (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.crm_community_jobs(id),
 checked_at timestamptz not null default now(),
 metrics jsonb not null,
 recommendation text not null
);
create index crm_community_observations_job on public.crm_community_observations(job_id,checked_at desc);
alter table public.crm_community_observations enable row level security;
revoke all on public.crm_community_observations from public,anon,authenticated;
grant select,insert on public.crm_community_observations to service_role;
alter table public.crm_community_settings enable row level security;
alter table public.crm_community_jobs enable row level security;
alter table public.crm_community_events enable row level security;
revoke all on public.crm_community_settings,public.crm_community_jobs,public.crm_community_events from public,anon,authenticated;
grant select,insert,update on public.crm_community_settings,public.crm_community_jobs to service_role;
grant select,insert on public.crm_community_events to service_role;
grant usage,select on sequence public.crm_community_events_id_seq to service_role;
create function public.crm_community_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.organization_id<>old.organization_id or new.slot<>old.slot or new.channel<>old.channel or new.payload is distinct from old.payload or new.content_hash<>old.content_hash then raise exception 'CM_IMMUTABLE';end if;
  if new.state<>old.state and not ((old.state='queued' and new.state in ('preparing','blocked','missed')) or (old.state='preparing' and new.state in ('executing','blocked','review_required')) or (old.state='executing' and new.state in ('published','uploaded_private','review_required')) or (old.state='blocked' and new.state='queued')) then raise exception 'CM_STATE';end if;
  if old.state in ('published','uploaded_private','brief','missed','review_required') then raise exception 'CM_IMMUTABLE';end if;
 end if;
 return new;
end $$;
create trigger crm_community_guard before update on public.crm_community_jobs for each row execute function public.crm_community_guard();
create function public.crm_community_event() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' or new.state<>old.state then insert into public.crm_community_events(job_id,previous_state,state) values(new.id,case when tg_op='UPDATE' then old.state else null end,new.state);end if;return new;
end $$;
create trigger crm_community_event after insert or update on public.crm_community_jobs for each row execute function public.crm_community_event();
create function public.crm_community_plan(p_jobs jsonb,p_destinations jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare started timestamptz; affected integer;
begin
 select plan_started_at into started from public.crm_community_settings where id='inteca' and enabled for update;
 if not found or started is not null then return 0;end if;
 if jsonb_typeof(p_jobs)<>'array' or jsonb_array_length(p_jobs)>400 then raise exception 'CM_PLAN';end if;
 insert into public.crm_community_jobs(slot,channel,payload,content_hash,scheduled_at,state)
 select slot,channel,payload,content_hash,scheduled_at,state from jsonb_to_recordset(p_jobs) as j(slot text,channel text,payload jsonb,content_hash text,scheduled_at timestamptz,state text)
 on conflict(slot) do nothing;
 get diagnostics affected=row_count;
 update public.crm_community_settings set destinations=p_destinations,plan_started_at=now(),updated_at=now() where id='inteca';
 return affected;
end $$;
revoke all on function public.crm_community_guard(),public.crm_community_event(),public.crm_community_plan(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.crm_community_guard(),public.crm_community_event(),public.crm_community_plan(jsonb,jsonb) to service_role;
-- Organic publishing explicitly requested by the owner in this session; no paid spend or discounts.
insert into public.crm_community_settings(id,enabled,authorization_note) values('inteca',true,'Solicitud expresa del propietario: crear Lisa Parkerd e iniciar contenido y publicación orgánica INTECA; sin gasto ni descuentos. 2026-10-25');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('crm-community','crm-community',true,20971520,array['image/jpeg','video/mp4']) on conflict(id) do nothing;
-- No client upload policies: only the private server service_role can create assets.
