create table public.crm_flyer_engine_settings (
  id text primary key check (id='inteca'),
  token_hash text unique check (token_hash ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default true,
  last_seen timestamptz
);
insert into public.crm_flyer_engine_settings(id) values ('inteca');

create table public.crm_flyer_engine_jobs (
  asset_key text primary key check (asset_key ~ '^[a-f0-9]{32}$'),
  scheduled_at timestamptz not null,
  state text not null check (state in ('rendering','uploading','ready','failed')),
  claim_token uuid not null,
  expires_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 2),
  fingerprint bit(64),
  media_key text check (media_key ~ '^[a-f0-9]{32}$'),
  completed_at timestamptz,
  error_code text,
  check (state<>'ready' or (fingerprint is not null and completed_at is not null and media_key is not null))
);
alter table public.crm_flyer_engine_settings enable row level security;
alter table public.crm_flyer_engine_jobs enable row level security;
revoke all on public.crm_flyer_engine_settings, public.crm_flyer_engine_jobs from public, anon, authenticated, service_role;
grant select, update on public.crm_flyer_engine_settings to service_role;
grant select, insert, update on public.crm_flyer_engine_jobs to service_role;

-- Only upcoming organic flyers are exposed. One workstation, one active image lease.
create function public.crm_claim_native_flyer(p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  target record;
  lease public.crm_flyer_engine_jobs;
begin
  perform 1 from public.crm_flyer_engine_settings
    where id='inteca' and enabled and token_hash=p_hash for update;
  if not found then return '{"authorized":false}'::jsonb; end if;
  update public.crm_flyer_engine_settings set last_seen=now()
    where id='inteca' and (last_seen is null or last_seen<now()-interval '2 minutes');
  if not exists(select 1 from public.crm_community_settings where id='inteca' and enabled)
     or exists(select 1 from public.crm_flyer_engine_jobs
       where state in ('rendering','uploading') and expires_at>now())
  then return '{"authorized":true}'::jsonb; end if;

  select j.payload,j.scheduled_at,j.payload->>'assetKey' asset_key into target
  from public.crm_community_jobs j
  left join public.crm_flyer_engine_jobs f on f.asset_key=j.payload->>'assetKey'
  where j.state='queued' and j.organization_id='org_inteca_main'
    and j.channel in ('facebook','instagram') and j.slot like 'v6:%:flyer:%:editorial-v8'
    and j.payload->>'kind'='flyer' and j.payload->'creative'->>'version'='v8'
    and j.payload->>'assetKey' ~ '^[a-f0-9]{32}$' and j.media_url is null
    and j.scheduled_at between now()+interval '2 minutes' and now()+interval '42 hours'
    and (f.asset_key is null or (f.attempts<2 and (f.state='failed' or (f.state<>'ready' and f.expires_at<=now()))))
    and not exists (select 1 from public.crm_community_jobs other
      where other.payload->>'assetKey'=j.payload->>'assetKey' and other.media_url is not null)
  order by j.scheduled_at,j.id limit 1;
  if not found then return '{"authorized":true}'::jsonb; end if;

  insert into public.crm_flyer_engine_jobs as f (asset_key,scheduled_at,state,claim_token,expires_at,attempts)
  values(target.asset_key,target.scheduled_at,'rendering',gen_random_uuid(),least(target.scheduled_at,now()+interval '30 minutes'),1)
  on conflict (asset_key) do update set state='rendering',claim_token=excluded.claim_token,
     expires_at=excluded.expires_at,attempts=f.attempts+1, error_code=null, fingerprint=null,media_key=null,completed_at=null
  returning * into lease;
  return jsonb_build_object('authorized',true,'payload',target.payload,'lease',lease.claim_token,
    'assetKey',lease.asset_key,'attempt',lease.attempts,'expiresAt',lease.expires_at);
end;
$$;

create function public.crm_lock_native_flyer_upload(p_hash text,p_asset text,p_lease uuid,p_fingerprint text)
returns text language plpgsql security invoker set search_path='' as $$
declare
  photo_hash bit(64);
begin
  perform 1 from public.crm_flyer_engine_settings
    where id='inteca' and enabled and token_hash=p_hash for update;
  if not found then return 'unauthorized'; end if;
  if p_fingerprint is null or p_fingerprint !~ '^[01]{64}$' then return 'invalid'; end if;
  photo_hash:=p_fingerprint::bit(64);
  perform 1 from public.crm_flyer_engine_jobs where asset_key=p_asset and claim_token=p_lease
    and state='rendering' and expires_at>now() for update;
  if not found then return 'expired'; end if;
  if exists(select 1 from public.crm_flyer_engine_jobs
    where asset_key<>p_asset and state in ('uploading','ready') and fingerprint is not null
      and bit_count(fingerprint # photo_hash)<=4) then
    update public.crm_flyer_engine_jobs set state='failed',error_code='IMAGE_TOO_SIMILAR'
      where asset_key=p_asset and claim_token=p_lease;
    return 'similar';
  end if;
  update public.crm_flyer_engine_jobs set state='uploading',fingerprint=photo_hash
    where asset_key=p_asset and claim_token=p_lease;
  return 'locked';
end;
$$;

create function public.crm_finish_native_flyer(p_hash text,p_asset text,p_lease uuid,p_media text,p_error text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare
  affected integer;
begin
  perform 1 from public.crm_flyer_engine_settings
    where id='inteca' and enabled and token_hash=p_hash for update;
  if not found then return false; end if;
  if p_media is not null and p_media !~ '^[a-f0-9]{32}$' then return false; end if;
  update public.crm_flyer_engine_jobs set state=case when p_media is null then 'failed' else 'ready' end,
      media_key=p_media,completed_at=now(),error_code=p_error
    where asset_key=p_asset and claim_token=p_lease and expires_at>now() and
      (state='uploading' or (p_media is null and state='rendering'));
  get diagnostics affected=row_count;
  return affected=1;
end;
$$;
revoke all on function public.crm_claim_native_flyer(text),public.crm_lock_native_flyer_upload(text,text,uuid,text),
  public.crm_finish_native_flyer(text,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.crm_claim_native_flyer(text),public.crm_lock_native_flyer_upload(text,text,uuid,text),
  public.crm_finish_native_flyer(text,text,uuid,text,text) to service_role;
