-- Generation requests are explicitly approved and persisted before any paid API call.
-- This is intentionally separate from the organic community publication queue.
create table if not exists public.crm_community_video_generations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.crm_community_jobs(id) on delete restrict,
  organization_id text not null default 'org_inteca_main' check (organization_id = 'org_inteca_main'),
  provider text not null check(provider in ('heygen','runway')),
  request_id uuid not null unique,
  state text not null check(state in ('starting','submitted','review_required','failed')),
  provider_job_id text,
  approved_runway_credits integer check(approved_runway_credits is null or approved_runway_credits between 60 and 240),
  consent_recorded_at timestamptz not null default now(),
  result jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(job_id,provider)
);
create index if not exists crm_community_video_generations_due on public.crm_community_video_generations(updated_at desc);

alter table public.crm_community_video_generations enable row level security;
revoke all on public.crm_community_video_generations from public,anon,authenticated;
grant select,insert,update on public.crm_community_video_generations to service_role;

create or replace function public.crm_community_video_generations_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.job_id<>old.job_id or new.provider<>old.provider or new.organization_id<>old.organization_id
       or new.request_id<>old.request_id or new.approved_runway_credits is distinct from old.approved_runway_credits
       or new.consent_recorded_at<>old.consent_recorded_at
    then raise exception 'CM_VIDEO_IMMUTABLE'; end if;
    if old.state in ('review_required','failed') then raise exception 'CM_VIDEO_TERMINAL'; end if;
    if old.state='starting' and new.state not in ('starting','submitted','review_required','failed')
      then raise exception 'CM_VIDEO_STATE'; end if;
    if old.state='submitted' and new.state not in ('submitted','review_required','failed')
      then raise exception 'CM_VIDEO_STATE'; end if;
    if old.provider_job_id is not null and old.provider_job_id<>new.provider_job_id then
      raise exception 'CM_VIDEO_PROVIDER_IMMUTABLE'; end if;
  end if;
  return new;
end $$;
drop trigger if exists crm_community_video_generations_guard on public.crm_community_video_generations;
create trigger crm_community_video_generations_guard before update
on public.crm_community_video_generations for each row execute function public.crm_community_video_generations_guard();
revoke all on function public.crm_community_video_generations_guard() from public,anon,authenticated;
grant execute on function public.crm_community_video_generations_guard() to service_role;
