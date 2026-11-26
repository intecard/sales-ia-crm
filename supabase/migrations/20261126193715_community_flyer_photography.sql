-- One paid provider attempt per approved flyer slot in Santo Domingo.
create table public.crm_community_flyer_photos (
  asset_key text primary key check (asset_key ~ '^[a-f0-9]{32}$'),
  local_day date not null,
  day_slot text not null check (day_slot in ('morning','afternoon')),
  state text not null default 'reserved' check (state in ('reserved','ready','failed')),
  fingerprint bit(64),
  last_error text,
  reserved_at timestamptz not null default now(),
  unique (local_day,day_slot),
  check (state <> 'ready' or fingerprint is not null)
);
alter table public.crm_community_flyer_photos enable row level security;
revoke all on table public.crm_community_flyer_photos from public, anon, authenticated, service_role;
grant select, insert, update on table public.crm_community_flyer_photos to service_role;

create function public.crm_reserve_flyer_photo(p_asset text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_day date := timezone('America/Santo_Domingo',now())::date;
  claimed_slot text;
  prior text;
  inserted integer;
begin
  if p_asset is null or p_asset !~ '^[a-f0-9]{32}$' then return 'invalid'; end if;
  if not exists (select 1 from public.crm_community_settings where id='inteca' and enabled)
    then return 'paused'; end if;
  select j.payload->>'editorialSlot' into claimed_slot
    from public.crm_community_jobs j
   where j.organization_id='org_inteca_main'
     and j.channel in ('facebook','instagram')
     and j.state='preparing'
     and j.slot like 'v6:%:flyer:%:editorial-v8'
     and j.payload->'creative'->>'version'='v8'
     and j.payload->>'kind'='flyer'
     and j.payload->>'assetKey'=p_asset
     and j.payload->>'editorialDate'=to_char(current_day,'YYYY-MM-DD')
     and j.scheduled_at between now()-interval '2 hours' and now()
     and timezone('America/Santo_Domingo',j.scheduled_at)::date=current_day
     and ((j.payload->>'editorialSlot'='morning'
           and timezone('America/Santo_Domingo',j.scheduled_at)::time = time '09:00')
       or (j.payload->>'editorialSlot'='afternoon'
           and timezone('America/Santo_Domingo',j.scheduled_at)::time = time '17:00'))
   limit 1;
  if not found then return 'ineligible'; end if;
  insert into public.crm_community_flyer_photos(asset_key,local_day,day_slot)
    values(p_asset,current_day,claimed_slot) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then return 'reserved'; end if;
  select f.state into prior from public.crm_community_flyer_photos f where f.asset_key=p_asset;
  return case prior when 'ready' then 'ready' when 'reserved' then 'in_progress'
                when 'failed' then 'failed' else 'used' end;
end;
$$;

create function public.crm_record_flyer_photo(p_asset text,p_hash text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  photo_hash bit(64);
  updated integer;
begin
  if p_hash is null or p_hash !~ '^[01]{64}$' then return 'invalid'; end if;
  photo_hash := p_hash::bit(64);
  -- Serialize similarity decisions even if separate Render instances are processing jobs.
  perform pg_advisory_xact_lock(20726019);
  if exists (
    select 1 from public.crm_community_flyer_photos p
    where p.asset_key<>p_asset and p.fingerprint is not null
      and bit_count(p.fingerprint # photo_hash)<=4
  ) then return 'similar'; end if;
  update public.crm_community_flyer_photos
     set fingerprint=photo_hash
   where asset_key=p_asset and state='reserved' and fingerprint is null;
  get diagnostics updated=row_count;
  return case when updated=1 then 'unique' else 'invalid' end;
end;
$$;
revoke all on function public.crm_reserve_flyer_photo(text), public.crm_record_flyer_photo(text,text)
  from public, anon, authenticated;
grant execute on function public.crm_reserve_flyer_photo(text), public.crm_record_flyer_photo(text,text)
  to service_role;
