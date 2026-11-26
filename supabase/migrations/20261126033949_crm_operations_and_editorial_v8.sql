-- New editorial calendar; activate only when the v8 server calls it.
-- Repair daily rolling renewal when a legacy v6 plan exists but does not
-- include the 21:00 INTEQUITO avatar slot. Re-run remains atomic/idempotent.
-- Based on the protected rolling-calendar contract from 2026-10-30.
CREATE OR REPLACE FUNCTION public.crm_community_roll_plan_v8(p_jobs jsonb, p_destinations jsonb, p_day text, p_catalog_hash text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 request_date date;
 inserted integer:=0;
 last_day date;
 last_hash text;
 last_version text;
begin
 if p_day is null or p_day !~ '^\d{4}-\d{2}-\d{2}$' then
   raise exception 'CM_DAY_INVALID';
 end if;
 request_date:=to_date(p_day,'YYYY-MM-DD');
 if request_date<>timezone('America/Santo_Domingo',now())::date then
   raise exception 'CM_DAY_MISMATCH';
 end if;
 if p_catalog_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_jobs)<>'array'
    or jsonb_array_length(p_jobs) not between 20 and 950
    or jsonb_typeof(p_destinations)<>'object'
 then raise exception 'CM_PLAN_INVALID'; end if;
 if not exists(select 1 from public.crm_community_settings where id='inteca' and enabled)
 then raise exception 'CM_PAUSED'; end if;
 select last_planned_day,catalog_hash,creative_version
   into last_day,last_hash,last_version
 from public.crm_community_calendar_state where id='inteca' for update;
 if not found then raise exception 'CM_MISSING_STATE'; end if;
 if last_day=request_date and last_hash=p_catalog_hash and last_version='v8'
    and exists (
      select 1 from public.crm_community_jobs j
      where j.slot like ('v6:' || p_day || ':avatar_video:%:editorial-v8')
        and j.channel='youtube' and j.state='brief'
    )
 then return 0; end if;

 if exists(
   select 1 from jsonb_to_recordset(p_jobs) as j(
     slot text,channel text,payload jsonb,content_hash text,
     scheduled_at timestamptz,state text,last_error text
   )
   where j.slot not like 'v6:%:editorial-v8'
     or j.payload->'creative'->>'version' is distinct from 'v8'
     or j.channel not in('facebook','instagram','youtube')
     or j.payload->>'catalogHash' is distinct from p_catalog_hash
     or j.content_hash !~ '^[a-f0-9]{64}$'
     or j.state not in('queued','missed','brief','blocked')
     or j.scheduled_at>now()+interval '32 days'
     or (
       j.payload->>'kind'='flyer'
       and (j.channel='youtube'
         or j.payload->>'editorialSlot' not in ('morning','afternoon')
         or (j.payload->>'editorialSlot'='morning'
             and j.slot not like '%:flyer:0:%')
         or (j.payload->>'editorialSlot'='afternoon'
             and j.slot not like '%:flyer:1:%')
         or (j.payload->>'editorialSlot'='morning'
             and j.scheduled_at at time zone 'America/Santo_Domingo'
                 <> date_trunc('day',j.scheduled_at at time zone 'America/Santo_Domingo')+interval '9 hours')
         or (j.payload->>'editorialSlot'='afternoon'
             and j.scheduled_at at time zone 'America/Santo_Domingo'
                 <> date_trunc('day',j.scheduled_at at time zone 'America/Santo_Domingo')+interval '17 hours'))
     )
     or (
        j.payload->>'kind'='flyer' and
        (j.payload->'flyerOffer' is null
         or j.payload->'flyerOffer'->>'registration' is null
         or j.payload->'flyerOffer'->>'monthly' is null
         or j.payload->'flyerOffer'->'benefits' is null)
        and j.state<>'blocked'
     )
 ) then
   -- Prevent rows with unfinished prices from reaching published state.
   -- The operator must correct the source catalog before trying again.
   raise exception 'CM_CONTENT_REVIEW';
 end if;

 -- Serialize conditional claims while retiring queued jobs. This prevents a
 -- concurrent old worker from claiming a replacement's predecessor mid-roll.
 perform 1 from public.crm_community_jobs where state in('queued','preparing','executing') for update;
 insert into public.crm_community_jobs(
   slot,channel,payload,content_hash,scheduled_at,state,last_error
 )
 select j.slot,j.channel,j.payload,j.content_hash,j.scheduled_at,
   case when exists(
     select 1 from public.crm_community_jobs old
     where old.channel=j.channel
       and old.payload->>'kind'=j.payload->>'kind'
       and old.state in('published','uploaded_private','preparing','executing','review_required')
       and (old.scheduled_at=j.scheduled_at or (
         j.payload->>'kind'='flyer'
         and (old.scheduled_at at time zone 'America/Santo_Domingo')::date =
             (j.scheduled_at at time zone 'America/Santo_Domingo')::date
         and coalesce(old.payload->>'editorialSlot','morning')=j.payload->>'editorialSlot'
       ))
   ) then 'missed'
   else j.state end,
   case when j.state='blocked' then coalesce(j.last_error,'CM_CONTENT_REVIEW') else null end
 from jsonb_to_recordset(p_jobs) as j(
   slot text,channel text,payload jsonb,content_hash text,
   scheduled_at timestamptz,state text,last_error text
 )
 on conflict(slot) do nothing;
 get diagnostics inserted=row_count;

 -- Replace only QUEUED old jobs; the immutable guard also protects brief, missed and blocked rows.
 -- Published and uncertain external results must NEVER be altered.
 update public.crm_community_jobs
 set state='missed',last_error='CM_CALENDAR_SUPERSEDED',updated_at=now()
 where state='queued'
   and (slot not like 'v6:%:editorial-v8'
        or payload->>'catalogHash' is distinct from p_catalog_hash);

 update public.crm_community_calendar_state
 set last_planned_day=request_date,catalog_hash=p_catalog_hash,
     creative_version='v8',last_generated_at=now(),updated_at=now()
 where id='inteca';

 update public.crm_community_settings
 set destinations=p_destinations,updated_at=now() where id='inteca';

 return inserted;
end $function$;


revoke all on function public.crm_community_roll_plan_v8(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.crm_community_roll_plan_v8(jsonb,jsonb,text,text) to service_role;


-- New editorial calendar; activate only when the v7 server calls it.
-- Repair daily rolling renewal when a legacy v6 plan exists but does not
-- include the 21:00 INTEQUITO avatar slot. Re-run remains atomic/idempotent.
-- Based on the protected rolling-calendar contract from 2026-10-30.
CREATE OR REPLACE FUNCTION public.crm_community_roll_plan_v7(p_jobs jsonb, p_destinations jsonb, p_day text, p_catalog_hash text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 request_date date;
 inserted integer:=0;
 last_day date;
 last_hash text;
 last_version text;
begin
 if p_day is null or p_day !~ '^\d{4}-\d{2}-\d{2}$' then
   raise exception 'CM_DAY_INVALID';
 end if;
 request_date:=to_date(p_day,'YYYY-MM-DD');
 if request_date<>timezone('America/Santo_Domingo',now())::date then
   raise exception 'CM_DAY_MISMATCH';
 end if;
 if p_catalog_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_jobs)<>'array'
    or jsonb_array_length(p_jobs) not between 20 and 950
    or jsonb_typeof(p_destinations)<>'object'
 then raise exception 'CM_PLAN_INVALID'; end if;
 if not exists(select 1 from public.crm_community_settings where id='inteca' and enabled)
 then raise exception 'CM_PAUSED'; end if;
 select last_planned_day,catalog_hash,creative_version
   into last_day,last_hash,last_version
 from public.crm_community_calendar_state where id='inteca' for update;
 if not found then raise exception 'CM_MISSING_STATE'; end if;
 if last_version='v8' then return 0; end if;
 if last_day=request_date and last_hash=p_catalog_hash and last_version='v7'
    and exists (
      select 1 from public.crm_community_jobs j
      where j.slot like ('v6:' || p_day || ':avatar_video:%:editorial-v7')
        and j.channel='youtube' and j.state='brief'
    )
 then return 0; end if;

 if exists(
   select 1 from jsonb_to_recordset(p_jobs) as j(
     slot text,channel text,payload jsonb,content_hash text,
     scheduled_at timestamptz,state text,last_error text
   )
   where j.slot not like 'v6:%:editorial-v7'
     or j.payload->'creative'->>'version' is distinct from 'v7'
     or j.channel not in('facebook','instagram','youtube')
     or j.payload->>'catalogHash' is distinct from p_catalog_hash
     or j.content_hash !~ '^[a-f0-9]{64}$'
     or j.state not in('queued','missed','brief','blocked')
     or j.scheduled_at>now()+interval '32 days'
     or (
       j.payload->>'kind'='flyer'
       and (j.channel='youtube'
         or j.payload->>'editorialSlot' not in ('morning','afternoon')
         or (j.payload->>'editorialSlot'='morning'
             and j.slot not like '%:flyer:0:%')
         or (j.payload->>'editorialSlot'='afternoon'
             and j.slot not like '%:flyer:1:%')
         or (j.payload->>'editorialSlot'='morning'
             and j.scheduled_at at time zone 'America/Santo_Domingo'
                 <> date_trunc('day',j.scheduled_at at time zone 'America/Santo_Domingo')+interval '9 hours')
         or (j.payload->>'editorialSlot'='afternoon'
             and j.scheduled_at at time zone 'America/Santo_Domingo'
                 <> date_trunc('day',j.scheduled_at at time zone 'America/Santo_Domingo')+interval '17 hours'))
     )
     or (
        j.payload->>'kind'='flyer' and
        (j.payload->'flyerOffer' is null
         or j.payload->'flyerOffer'->>'registration' is null
         or j.payload->'flyerOffer'->>'monthly' is null
         or j.payload->'flyerOffer'->'benefits' is null)
        and j.state<>'blocked'
     )
 ) then
   -- Prevent rows with unfinished prices from reaching published state.
   -- The operator must correct the source catalog before trying again.
   raise exception 'CM_CONTENT_REVIEW';
 end if;

 -- Serialize conditional claims while retiring queued jobs. This prevents a
 -- concurrent old worker from claiming a replacement's predecessor mid-roll.
 perform 1 from public.crm_community_jobs where state in('queued','preparing','executing') for update;
 insert into public.crm_community_jobs(
   slot,channel,payload,content_hash,scheduled_at,state,last_error
 )
 select j.slot,j.channel,j.payload,j.content_hash,j.scheduled_at,
   case when exists(
     select 1 from public.crm_community_jobs old
     where old.channel=j.channel
       and old.payload->>'kind'=j.payload->>'kind'
       and old.state in('published','uploaded_private','preparing','executing','review_required')
       and (old.scheduled_at=j.scheduled_at or (
         j.payload->>'kind'='flyer'
         and (old.scheduled_at at time zone 'America/Santo_Domingo')::date =
             (j.scheduled_at at time zone 'America/Santo_Domingo')::date
         and coalesce(old.payload->>'editorialSlot','morning')=j.payload->>'editorialSlot'
       ))
   ) then 'missed'
   else j.state end,
   case when j.state='blocked' then coalesce(j.last_error,'CM_CONTENT_REVIEW') else null end
 from jsonb_to_recordset(p_jobs) as j(
   slot text,channel text,payload jsonb,content_hash text,
   scheduled_at timestamptz,state text,last_error text
 )
 on conflict(slot) do nothing;
 get diagnostics inserted=row_count;

 -- Replace only QUEUED old jobs; the immutable guard also protects brief, missed and blocked rows.
 -- Published and uncertain external results must NEVER be altered.
 update public.crm_community_jobs
 set state='missed',last_error='CM_CALENDAR_SUPERSEDED',updated_at=now()
 where state='queued'
   and (slot not like 'v6:%:editorial-v7'
        or payload->>'catalogHash' is distinct from p_catalog_hash);

 update public.crm_community_calendar_state
 set last_planned_day=request_date,catalog_hash=p_catalog_hash,
     creative_version='v7',last_generated_at=now(),updated_at=now()
 where id='inteca';

 update public.crm_community_settings
 set destinations=p_destinations,updated_at=now() where id='inteca';

 return inserted;
end $function$;


revoke all on function public.crm_community_roll_plan_v7(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.crm_community_roll_plan_v7(jsonb,jsonb,text,text) to service_role;


-- Compatibility guard for a draining v6 runtime.
-- Repair daily rolling renewal when a legacy v6 plan exists but does not
-- include the 21:00 INTEQUITO avatar slot. Re-run remains atomic/idempotent.
-- Based on the protected rolling-calendar contract from 2026-10-30.
CREATE OR REPLACE FUNCTION public.crm_community_roll_plan(p_jobs jsonb, p_destinations jsonb, p_day text, p_catalog_hash text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 request_date date;
 inserted integer:=0;
 last_day date;
 last_hash text;
 last_version text;
begin
 if p_day is null or p_day !~ '^\d{4}-\d{2}-\d{2}$' then
   raise exception 'CM_DAY_INVALID';
 end if;
 request_date:=to_date(p_day,'YYYY-MM-DD');
 if request_date<>timezone('America/Santo_Domingo',now())::date then
   raise exception 'CM_DAY_MISMATCH';
 end if;
 if p_catalog_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_jobs)<>'array'
    or jsonb_array_length(p_jobs) not between 20 and 950
    or jsonb_typeof(p_destinations)<>'object'
 then raise exception 'CM_PLAN_INVALID'; end if;
 if not exists(select 1 from public.crm_community_settings where id='inteca' and enabled)
 then raise exception 'CM_PAUSED'; end if;
 select last_planned_day,catalog_hash,creative_version
   into last_day,last_hash,last_version
 from public.crm_community_calendar_state where id='inteca' for update;
 if not found then raise exception 'CM_MISSING_STATE'; end if;
 if last_version in ('v7','v8') then return 0; end if;
 if last_day=request_date and last_hash=p_catalog_hash and last_version='v6'
    and exists (
      select 1 from public.crm_community_jobs j
      where j.slot like ('v6:' || p_day || ':avatar_video:%')
        and j.channel='youtube' and j.state='brief'
    )
 then return 0; end if;

 if exists(
   select 1 from jsonb_to_recordset(p_jobs) as j(
     slot text,channel text,payload jsonb,content_hash text,
     scheduled_at timestamptz,state text,last_error text
   )
   where j.slot not like 'v6:%'
     or j.channel not in('facebook','instagram','youtube')
     or j.payload->>'catalogHash' is distinct from p_catalog_hash
     or j.content_hash !~ '^[a-f0-9]{64}$'
     or j.state not in('queued','missed','brief','blocked')
     or j.scheduled_at>now()+interval '32 days'
     or (
       j.payload->>'kind'='flyer'
       and (j.channel='youtube'
         or j.payload->>'editorialSlot' not in ('morning','afternoon')
         or (j.payload->>'editorialSlot'='morning'
             and j.slot not like '%:flyer:0:%')
         or (j.payload->>'editorialSlot'='afternoon'
             and j.slot not like '%:flyer:1:%')
         or (j.payload->>'editorialSlot'='morning'
             and j.scheduled_at at time zone 'America/Santo_Domingo'
                 <> date_trunc('day',j.scheduled_at at time zone 'America/Santo_Domingo')+interval '9 hours')
         or (j.payload->>'editorialSlot'='afternoon'
             and j.scheduled_at at time zone 'America/Santo_Domingo'
                 <> date_trunc('day',j.scheduled_at at time zone 'America/Santo_Domingo')+interval '17 hours'))
     )
     or (
        j.payload->>'kind'='flyer' and
        (j.payload->'flyerOffer' is null
         or j.payload->'flyerOffer'->>'registration' is null
         or j.payload->'flyerOffer'->>'monthly' is null
         or j.payload->'flyerOffer'->'benefits' is null)
        and j.state<>'blocked'
     )
 ) then
   -- Prevent rows with unfinished prices from reaching published state.
   -- The operator must correct the source catalog before trying again.
   raise exception 'CM_CONTENT_REVIEW';
 end if;

 insert into public.crm_community_jobs(
   slot,channel,payload,content_hash,scheduled_at,state,last_error
 )
 select j.slot,j.channel,j.payload,j.content_hash,j.scheduled_at,
   case when j.payload->>'kind'='flyer' and exists(
     select 1 from public.crm_community_jobs old
     where old.channel=j.channel
       and old.payload->>'kind'='flyer'
       and (old.scheduled_at at time zone 'America/Santo_Domingo')::date =
           (j.scheduled_at at time zone 'America/Santo_Domingo')::date
       and old.state in('published','preparing','executing','review_required')
       and coalesce(old.payload->>'editorialSlot','morning') =
           coalesce(j.payload->>'editorialSlot','morning')
   ) then 'missed'
   else j.state end,
   case when j.state='blocked' then 'CM_FLYER_PRICE_OR_CONTENT_MISSING' else null end
 from jsonb_to_recordset(p_jobs) as j(
   slot text,channel text,payload jsonb,content_hash text,
   scheduled_at timestamptz,state text,last_error text
 )
 on conflict(slot) do nothing;
 get diagnostics inserted=row_count;

 -- Replace only QUEUED old jobs; the immutable guard also protects brief, missed and blocked rows.
 -- Published and uncertain external results must NEVER be altered.
 update public.crm_community_jobs
 set state='missed',last_error='CM_CALENDAR_SUPERSEDED',updated_at=now()
 where state='queued'
   and (slot not like 'v6:%'
        or payload->>'catalogHash' is distinct from p_catalog_hash);

 update public.crm_community_calendar_state
 set last_planned_day=request_date,catalog_hash=p_catalog_hash,
     creative_version='v6',last_generated_at=now(),updated_at=now()
 where id='inteca';

 update public.crm_community_settings
 set destinations=p_destinations,updated_at=now() where id='inteca';

 return inserted;
end $function$;


revoke all on function public.crm_community_roll_plan(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.crm_community_roll_plan(jsonb,jsonb,text,text) to service_role;

-- Company-scoped commercial records. Only the authenticated backend may call the RPC.
create table public.crm_commercial_portfolio (
 organization_id text not null check(organization_id ~ '^org_[a-zA-Z0-9_-]{1,100}$'),
 id uuid not null, revision integer not null default 1 check(revision>0),
 stage text not null check(stage in ('prospect','qualified','quoted','negotiation','won','lost')),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 closed_at timestamptz,
 primary key(organization_id,id)
);
create index crm_commercial_portfolio_updated on public.crm_commercial_portfolio(organization_id,updated_at desc,id);
create table public.crm_commercial_portfolio_events (
 organization_id text not null,case_id uuid not null,revision integer not null,actor text not null,
 previous_stage text,stage text not null,occurred_at timestamptz not null default now(),
 primary key(organization_id,case_id,revision),
 foreign key(organization_id,case_id) references public.crm_commercial_portfolio(organization_id,id)
);
alter table public.crm_commercial_portfolio enable row level security;
alter table public.crm_commercial_portfolio_events enable row level security;
revoke all on public.crm_commercial_portfolio,public.crm_commercial_portfolio_events from public,anon,authenticated,service_role;
grant select,insert,update on public.crm_commercial_portfolio to service_role;
grant select,insert on public.crm_commercial_portfolio_events to service_role;
create function public.crm_save_commercial_case(p_org text,p_id uuid,p_revision integer,p_payload jsonb,p_actor text,p_can_close boolean)
returns setof public.crm_commercial_portfolio language plpgsql security invoker set search_path='' as $$
declare prior text; row_saved public.crm_commercial_portfolio; next_stage text:=p_payload->>'stage';
begin
 if next_stage='won' and p_can_close is not true then return; end if;
 if p_revision=0 then
  insert into public.crm_commercial_portfolio(organization_id,id,stage,payload,closed_at)
  values(p_org,p_id,next_stage,p_payload,case when next_stage='won' then now() end) on conflict do nothing returning * into row_saved;
 else
  select stage into prior from public.crm_commercial_portfolio where organization_id=p_org and id=p_id and revision=p_revision for update;
  if not found or (prior in ('won','lost') and p_can_close is not true) then return; end if;
  update public.crm_commercial_portfolio set stage=next_stage,payload=p_payload,revision=revision+1,updated_at=now(),closed_at=case when next_stage='won' then coalesce(closed_at,now()) end
  where organization_id=p_org and id=p_id and revision=p_revision returning * into row_saved;
 end if;
 if row_saved.id is null then return; end if;
 insert into public.crm_commercial_portfolio_events(organization_id,case_id,revision,actor,previous_stage,stage)
 values(p_org,p_id,row_saved.revision,p_actor,prior,next_stage);
 return next row_saved;
end $$;
revoke all on function public.crm_save_commercial_case(text,uuid,integer,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.crm_save_commercial_case(text,uuid,integer,jsonb,text,boolean) to service_role;

-- Add payroll accounts without changing accounting controls or existing records.
create or replace function public.crm_accounting_post(p_org text,p_payload jsonb,p_actor text) returns setof public.crm_accounting_journals language plpgsql security invoker set search_path=public as $$
declare existing public.crm_accounting_journals; l jsonb; d numeric:=0; c numeric:=0; p text; original jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('accounting:'||p_org,0));
 select * into existing from public.crm_accounting_journals where organization_id=p_org and request_id=(p_payload->>'requestId')::uuid;
 if found then if existing.payload<>p_payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return next existing; return; end if;
 p:=to_char((p_payload->>'date')::date,'YYYY-MM');
 if exists(select 1 from public.crm_accounting_periods where organization_id=p_org and period=p and (payload->>'closed')::boolean) then raise exception 'PERIOD_CLOSED'; end if;
 if jsonb_array_length(p_payload->'lines')<2 or jsonb_array_length(p_payload->'lines')>100 then raise exception 'LINES'; end if;
 for l in select * from jsonb_array_elements(p_payload->'lines') loop
 if l->>'account' not in ('1101','1102','1103','1104','1201','2101','2102','2103','2104','3101','4101','5101','6101','6102') or (l->>'debit')!~'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$' or (l->>'credit')!~'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$' then raise exception 'LINE_INVALID'; end if;
 if ((l->>'debit')::numeric>0)=((l->>'credit')::numeric>0) then raise exception 'LINE_INVALID'; end if;
 d:=d+(l->>'debit')::numeric;c:=c+(l->>'credit')::numeric;
 end loop;
 if d<>c or d=0 then raise exception 'UNBALANCED'; end if;
 if p_payload->>'kind'='reversal' then
 select payload into original from public.crm_accounting_journals where organization_id=p_org and id=(p_payload->>'reverses')::uuid;
 if not found or original->>'kind'='reversal' then raise exception 'REVERSAL_INVALID'; end if;
 if (select jsonb_agg(jsonb_build_object('account',x->>'account','debit',x->>'credit','credit',x->>'debit')) from jsonb_array_elements(original->'lines') x)<>p_payload->'lines' then raise exception 'REVERSAL_MISMATCH'; end if;
 end if;
 insert into public.crm_accounting_journals(organization_id,request_id,entry_date,period,payload,actor) values(p_org,(p_payload->>'requestId')::uuid,(p_payload->>'date')::date,p,p_payload,p_actor) returning * into existing;
 insert into public.crm_accounting_events(organization_id,period,action,actor,payload) values(p_org,p,'posted',p_actor,jsonb_build_object('journalId',existing.id));
 return next existing;
end $$;

-- Approved agent lessons belong to one organization, one task and one agent.
create table public.crm_agent_lessons (
 id uuid primary key default gen_random_uuid(),organization_id text not null,agent_id text not null,
 task_id uuid not null references public.crm_team_tasks(id),
 result text not null check(result in ('worked','failed','inconclusive')),
 evidence text not null check(length(evidence) between 8 and 400),
 lesson text not null check(length(lesson) between 8 and 500),
 reviewer text not null,created_at timestamptz not null default now()
);
create index crm_agent_lessons_recent on public.crm_agent_lessons(organization_id,agent_id,created_at desc);
alter table public.crm_agent_lessons enable row level security;
revoke all on public.crm_agent_lessons from public,anon,authenticated,service_role;
grant select,insert on public.crm_agent_lessons to service_role;

-- Outside customer contact hours, claim only the director's targeted payment alerts.
create function public.crm_claim_director_payment_message()
returns setof public.crm_sales_outbox language plpgsql security invoker set search_path='' as $$
begin
 update public.crm_sales_outbox set state='unknown',last_error='VERIFY_DELIVERY_BEFORE_RETRY'
 where state='sending' and kind='owner' and strategy='owner_payment' and claimed_at<now()-interval '5 minutes';
 return query update public.crm_sales_outbox set state='sending',claimed_at=now() where id in (
  select id from public.crm_sales_outbox where kind='owner' and strategy='owner_payment'
  and state in('pending','blocked') and available_at<=now()
  order by available_at,id for update skip locked limit 1
 ) returning *;
end $$;
revoke all on function public.crm_claim_director_payment_message() from public,anon,authenticated;
grant execute on function public.crm_claim_director_payment_message() to service_role;

create table public.crm_commercial_goals (
 organization_id text not null check(organization_id ~ '^org_[a-zA-Z0-9_-]{1,100}$'),
 period text not null check(period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 target int not null check(target between 1 and 999),actor text not null,updated_at timestamptz not null default now(),
 primary key(organization_id,period)
);
alter table public.crm_commercial_goals enable row level security;
revoke all on public.crm_commercial_goals from public,anon,authenticated,service_role;
grant select,insert,update on public.crm_commercial_goals to service_role;
create function public.crm_set_commercial_goal(p_org text,p_period text,p_target int,p_actor text)
returns void language sql security invoker set search_path='' as $$
 insert into public.crm_commercial_goals(organization_id,period,target,actor)
 values(p_org,p_period,p_target,p_actor) on conflict(organization_id,period) do update
 set target=excluded.target,actor=excluded.actor,updated_at=now();
$$;
revoke all on function public.crm_set_commercial_goal(text,text,int,text) from public,anon,authenticated;
grant execute on function public.crm_set_commercial_goal(text,text,int,text) to service_role;
