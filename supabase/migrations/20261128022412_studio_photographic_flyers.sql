set local lock_timeout='3s';

-- Reuse the existing workstation protocol and its global photo uniqueness check.
alter table public.crm_flyer_engine_jobs
  add column studio_payload jsonb,
  drop constraint crm_flyer_engine_jobs_state_check,
  drop constraint crm_flyer_engine_jobs_attempts_check,
  add constraint crm_flyer_engine_jobs_state_check check(state in ('queued','rendering','uploading','ready','failed')),
  add constraint crm_flyer_engine_jobs_attempts_check check(attempts between 0 and 2);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('crm-studio-flyers','crm-studio-flyers',false,4194304,array['image/jpeg'])
on conflict (id) do nothing;

create function public.crm_create_studio_flyer(p_asset text,p_payload jsonb,p_fingerprint text)
returns text language plpgsql security invoker set search_path='' as $$
declare
  photo_hash bit(64);
begin
  if p_asset !~ '^[a-f0-9]{32}$' or p_payload->>'assetKey' is distinct from p_asset or
     coalesce(p_payload->>'kind','') not in ('flyer','story') or
     p_payload->'creative'->>'version' is distinct from 'v8' then return 'invalid'; end if;
  perform 1 from public.crm_flyer_engine_settings where id='inteca' for update;
  if not found then return 'invalid'; end if;
  if (select count(*) from public.crm_flyer_engine_jobs where studio_payload is not null and scheduled_at>now()-interval '22 hours')>=10
    then return 'limit'; end if;
  if p_fingerprint is null then
    if not exists (select 1 from public.crm_flyer_engine_settings where id='inteca' and enabled and token_hash is not null
      and (last_seen>now()-interval '5 minutes' or exists(select 1 from public.crm_flyer_engine_jobs
        where state in ('rendering','uploading') and expires_at>now()))) then return 'offline'; end if;
    if exists (select 1 from public.crm_flyer_engine_jobs where studio_payload is not null and
       scheduled_at>now()+interval '10 minutes' and (state in ('queued','rendering','uploading') or (state='failed' and attempts<2)))
       then return 'busy'; end if;
    insert into public.crm_flyer_engine_jobs(asset_key,scheduled_at,state,claim_token,expires_at,attempts,studio_payload)
      values (p_asset,now()+interval '2 hours','queued',gen_random_uuid(),now(),0,p_payload);
  else
    if p_fingerprint !~ '^[01]{64}$' then return 'invalid'; end if;
    photo_hash:=p_fingerprint::bit(64);
    if exists (select 1 from public.crm_flyer_engine_jobs where (state='ready' or (state='uploading' and expires_at>now())) and fingerprint is not null
      and bit_count(fingerprint # photo_hash)<=4) then return 'similar'; end if;
    insert into public.crm_flyer_engine_jobs(asset_key,scheduled_at,state,claim_token,expires_at,attempts,studio_payload,fingerprint)
      values (p_asset,now()+interval '2 hours','uploading',gen_random_uuid(),now()+interval '2 minutes',2,p_payload,photo_hash);
  end if;
  return 'created';
end;
$$;
revoke all on function public.crm_create_studio_flyer(text,jsonb,text) from public, anon, authenticated;
grant execute on function public.crm_create_studio_flyer(text,jsonb,text) to service_role;

create or replace function public.crm_claim_native_flyer(p_hash text)
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
  if exists(select 1 from public.crm_flyer_engine_jobs
       where state in ('rendering','uploading') and expires_at>now())
  then return '{"authorized":true}'::jsonb; end if;

  select j.payload,j.scheduled_at,j.payload->>'assetKey' asset_key into target
  from public.crm_community_jobs j
  left join public.crm_flyer_engine_jobs f on f.asset_key=j.payload->>'assetKey'
  where exists(select 1 from public.crm_community_settings where id='inteca' and enabled)
    and j.state='queued' and j.organization_id='org_inteca_main'
    and j.channel in ('facebook','instagram') and j.slot like 'v6:%:flyer:%:editorial-v8'
    and j.payload->>'kind'='flyer' and j.payload->'creative'->>'version'='v8'
    and j.payload->>'assetKey' ~ '^[a-f0-9]{32}$'
    and (j.media_url is null or j.media_url !~ '/f2[a-f0-9]{30}[.]jpg$')
    and j.scheduled_at between now()-interval '85 minutes' and now()+interval '42 hours'
    and (f.asset_key is null or (f.attempts<2 and (f.state='failed' or (f.state<>'ready' and f.expires_at<=now()))))
    and not exists (select 1 from public.crm_community_jobs other
      where other.payload->>'assetKey'=j.payload->>'assetKey' and other.media_url ~ '/f2[a-f0-9]{30}[.]jpg$')
  order by j.scheduled_at,j.id limit 1;
  if not found or target.scheduled_at>now()+interval '45 minutes' then
    update public.crm_flyer_engine_jobs set
      state='rendering', attempts=attempts+1, claim_token=gen_random_uuid(),
      expires_at=least(now()+interval '30 minutes',scheduled_at),
      fingerprint=null, error_code=null
    where asset_key=(
      select asset_key from public.crm_flyer_engine_jobs where studio_payload is not null
        and scheduled_at>now()+interval '10 minutes' and attempts<2
        and (state='queued' or state='failed' or (state='rendering' and expires_at<=now()))
      order by scheduled_at limit 1
    ) returning * into lease;
    if found then return jsonb_build_object('authorized',true,'payload',lease.studio_payload,
      'lease',lease.claim_token,'assetKey',lease.asset_key,'attempt',lease.attempts,'expiresAt',lease.expires_at,'studio',true);
    end if;
  end if;
  if target.asset_key is null then return '{"authorized":true}'::jsonb; end if;

  insert into public.crm_flyer_engine_jobs as f (asset_key,scheduled_at,state,claim_token,expires_at,attempts)
  values(target.asset_key,target.scheduled_at,'rendering',gen_random_uuid(),least(target.scheduled_at+interval '2 hours',now()+interval '30 minutes'),1)
  on conflict (asset_key) do update set state='rendering',claim_token=excluded.claim_token,
     expires_at=excluded.expires_at,attempts=f.attempts+1, error_code=null, fingerprint=null,media_key=null,completed_at=null
  returning * into lease;
  return jsonb_build_object('authorized',true,'payload',target.payload,'lease',lease.claim_token,
    'assetKey',lease.asset_key,'attempt',lease.attempts,'expiresAt',lease.expires_at);
end;
$$;
