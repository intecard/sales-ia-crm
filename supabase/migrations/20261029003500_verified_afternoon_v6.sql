-- v6 course-safe rolling planner: new slots supersede only queued old versions.
-- Protect published, externally uncertain, brief, blocked and missed records.
create or replace function public.crm_community_roll_plan(
 p_jobs jsonb,p_destinations jsonb,p_day text,p_catalog_hash text
) returns integer language plpgsql security invoker set search_path=''
as $$
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
 if last_day=request_date and last_hash=p_catalog_hash and last_version='v6'
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
end $$;
revoke all on function public.crm_community_roll_plan(jsonb,jsonb,text,text)
 from public,anon,authenticated;
grant execute on function public.crm_community_roll_plan(jsonb,jsonb,text,text) to service_role;
