-- CM v3: 1 distinct flyer/day, 7 reel briefs and 1 promotional video brief/day.
-- One featured academic program per calendar month, rotating across all catalog programs.
-- This migration alone DOES NOT change/retire any live posts or settings.
-- The first successful v3 plan atomically inserts its jobs then retires old QUEUED slots.
create table if not exists public.crm_community_calendar_state (
  id text primary key check (id='inteca'),
  organization_id text not null default 'org_inteca_main' check(organization_id='org_inteca_main'),
  last_planned_day date,
  catalog_hash text,
  last_generated_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.crm_community_calendar_state(id) values('inteca') on conflict do nothing;
alter table public.crm_community_calendar_state enable row level security;
revoke all on public.crm_community_calendar_state from public,anon,authenticated;
grant select,insert,update on public.crm_community_calendar_state to service_role;

create or replace function public.crm_community_roll_plan(
  p_jobs jsonb,
  p_destinations jsonb,
  p_day text,
  p_catalog_hash text
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  last_day date;
  stored_hash text;
  inserted int := 0;
  request_date date;
begin
  if p_day is null or p_day !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'CM_DAY_INVALID';
  end if;
  request_date := to_date(p_day, 'YYYY-MM-DD');
  if request_date <> timezone('America/Santo_Domingo',now())::date then
    raise exception 'CM_DAY_MISMATCH';
  end if;
  if p_catalog_hash !~ '^[a-f0-9]{64}$' or
     jsonb_typeof(p_jobs) <> 'array' or jsonb_array_length(p_jobs) > 850 or
     jsonb_array_length(p_jobs) < 20 or
     jsonb_typeof(p_destinations) <> 'object' then
    raise exception 'CM_PLAN_INVALID';
  end if;
  if not exists(select 1 from public.crm_community_settings where id='inteca' and enabled) then
    raise exception 'CM_PAUSED';
  end if;

  select last_planned_day,catalog_hash into last_day,stored_hash
  from public.crm_community_calendar_state where id='inteca' for update;
  if not found then raise exception 'CM_MISSING_STATE'; end if;
  if last_day=request_date and stored_hash=p_catalog_hash then return 0; end if;

  -- Fail closed if the caller accidentally submits legacy, foreign or stale jobs.
  if exists (
    select 1 from jsonb_to_recordset(p_jobs) as j(
      slot text,channel text,payload jsonb,content_hash text,scheduled_at timestamptz,state text
    )
    where j.slot not like 'v3:%'
       or j.channel not in('facebook','instagram','youtube')
       or j.payload->>'catalogHash' is distinct from p_catalog_hash
       or j.content_hash !~ '^[a-f0-9]{64}$'
       or j.state not in ('queued','missed','brief')
       or j.scheduled_at > now() + interval '32 days'
  ) then raise exception 'CM_PAYLOAD_INVALID'; end if;

  insert into public.crm_community_jobs(slot,channel,payload,content_hash,scheduled_at,state)
  select slot,channel,payload,content_hash,scheduled_at,state
  from jsonb_to_recordset(p_jobs) as j(
    slot text,channel text,payload jsonb,content_hash text,scheduled_at timestamptz,state text
  ) on conflict(slot) do nothing;
  get diagnostics inserted = row_count;

  -- Preserve historical published/uploaded/review_required/blocked rows forever.
  -- Only unsent old slots are retired, and only after a valid new calendar has been inserted.
  update public.crm_community_jobs
  set state='missed',last_error='CM_CALENDAR_SUPERSEDED',updated_at=now()
  where state='queued' and (slot not like 'v3:%'
       or payload->>'catalogHash' is distinct from p_catalog_hash);

  update public.crm_community_calendar_state
  set last_planned_day=request_date,catalog_hash=p_catalog_hash,
      last_generated_at=now(),updated_at=now()
  where id='inteca';

  update public.crm_community_settings
  set destinations=p_destinations,updated_at=now()
  where id='inteca';

  return inserted;
end $$;

revoke all on function public.crm_community_roll_plan(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.crm_community_roll_plan(jsonb,jsonb,text,text) to service_role;
