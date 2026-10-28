-- Self-hosted video production. No paid external video provider or automatic publication.
-- Applied only after a separate operator review on the correct Supabase project.
create table if not exists public.crm_local_video_settings (
 id text primary key default 'inteca' check(id='inteca'),
 organization_id text not null default 'org_inteca_main' check(organization_id='org_inteca_main'),
 auto_enabled boolean not null default false,
 max_daily_creatives integer not null default 8 check(max_daily_creatives between 1 and 8),
 last_worker_seen_at timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.crm_local_video_settings(id) values('inteca') on conflict do nothing;

create table if not exists public.crm_local_video_jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null default 'org_inteca_main' check(organization_id='org_inteca_main'),
 community_job_id uuid not null references public.crm_community_jobs(id),
 asset_key text not null unique check(asset_key ~ '^[a-f0-9]{64}$'),
 script jsonb not null check(jsonb_typeof(script)='object' and octet_length(script::text)<16000),
 catalog_hash text not null,
 state text not null default 'queued'
   check(state in ('queued','rendering','ready_for_review','failed','needs_reconciliation')),
 progress smallint not null default 0 check(progress between 0 and 100),
 worker_id text,
 claim_token uuid,
 error_code text,
 file_path text,
 sha256 text,
 created_at timestamptz not null default now(),
 started_at timestamptz,
 finished_at timestamptz,
 updated_at timestamptz not null default now()
);
create index if not exists crm_local_video_jobs_queue
 on public.crm_local_video_jobs(created_at,id) where state='queued';
create index if not exists crm_local_video_jobs_date
 on public.crm_local_video_jobs(created_at desc);

alter table public.crm_local_video_settings enable row level security;
alter table public.crm_local_video_jobs enable row level security;
revoke all on public.crm_local_video_settings,public.crm_local_video_jobs from public,anon,authenticated;
grant select,insert,update on public.crm_local_video_settings,public.crm_local_video_jobs to service_role;

create function public.crm_local_video_claim(p_worker_id text)
returns setof public.crm_local_video_jobs
language plpgsql security invoker set search_path='' as $$
begin
 if p_worker_id is null or p_worker_id !~ '^[a-zA-Z0-9_-]{1,64}$' then
   raise exception 'LOCAL_WORKER_ID';
 end if;
 update public.crm_local_video_settings set last_worker_seen_at=now()
 where id='inteca';
 return query
 update public.crm_local_video_jobs j
 set state='rendering',worker_id=p_worker_id,claim_token=gen_random_uuid(),
     started_at=now(),updated_at=now(),progress=0
 where j.id=(
   select id from public.crm_local_video_jobs
   where state='queued' order by created_at,id
   for update skip locked limit 1
 )
 returning j.*;
end $$;
revoke all on function public.crm_local_video_claim(text) from public,anon,authenticated;
grant execute on function public.crm_local_video_claim(text) to service_role;

create function public.crm_local_video_job_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if new.organization_id<>old.organization_id or new.community_job_id<>old.community_job_id
      or new.asset_key<>old.asset_key or new.script is distinct from old.script
      or new.catalog_hash<>old.catalog_hash or new.created_at<>old.created_at
   then raise exception 'LOCAL_IMMUTABLE'; end if;
   if old.state='queued' and new.state not in ('queued','rendering','failed') then raise exception 'LOCAL_STATE'; end if;
   if old.state='rendering' and new.state not in ('rendering','ready_for_review','failed','needs_reconciliation') then raise exception 'LOCAL_STATE'; end if;
   if old.state in ('ready_for_review','failed','needs_reconciliation') then raise exception 'LOCAL_TERMINAL'; end if;
   if new.progress<old.progress then raise exception 'LOCAL_PROGRESS'; end if;
 end if;
 return new;
end $$;
create trigger crm_local_video_job_guard before update on public.crm_local_video_jobs
for each row execute function public.crm_local_video_job_guard();
revoke all on function public.crm_local_video_job_guard() from public,anon,authenticated;
grant execute on function public.crm_local_video_job_guard() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('crm-local-videos','crm-local-videos',false,73400320,array['video/mp4'])
on conflict(id) do nothing;
-- No public object policies: only the server-side service_role can write/read these videos.
