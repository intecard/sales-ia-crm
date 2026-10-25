create table public.crm_accounting_journals (
 id uuid primary key default gen_random_uuid(), organization_id text not null,
 request_id uuid not null, entry_date date not null, period text not null,
 payload jsonb not null, actor text not null, created_at timestamptz not null default now(),
 unique(organization_id,request_id), check(period=to_char(entry_date,'YYYY-MM'))
);
create index on public.crm_accounting_journals(organization_id,period,entry_date);
create unique index crm_accounting_one_reversal on public.crm_accounting_journals(organization_id,(payload->>'reverses')) where payload->>'kind'='reversal';
create unique index crm_accounting_unique_ncf on public.crm_accounting_journals(organization_id,(payload->>'kind'),(payload->>'taxId'),(payload->>'ncf')) where payload->>'kind' in ('purchase','sale') and payload->>'ncf'<>'';
create table public.crm_accounting_periods (
 organization_id text not null, period text not null, payload jsonb not null,
 actor text not null, updated_at timestamptz not null default now(), primary key(organization_id,period)
);
create table public.crm_accounting_events(id uuid primary key default gen_random_uuid(),organization_id text not null,period text not null,action text not null,actor text not null,created_at timestamptz not null default now(),payload jsonb not null);
alter table public.crm_accounting_journals enable row level security;
alter table public.crm_accounting_periods enable row level security;
alter table public.crm_accounting_events enable row level security;
revoke all on public.crm_accounting_journals,public.crm_accounting_periods,public.crm_accounting_events from anon,authenticated,service_role;
grant select,insert on public.crm_accounting_journals,public.crm_accounting_events to service_role;
grant select,insert,update on public.crm_accounting_periods to service_role;
create function public.crm_accounting_post(p_org text,p_payload jsonb,p_actor text) returns setof public.crm_accounting_journals language plpgsql security invoker set search_path=public as $$
declare existing public.crm_accounting_journals; l jsonb; d numeric:=0; c numeric:=0; p text; original jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('accounting:'||p_org,0));
 select * into existing from public.crm_accounting_journals where organization_id=p_org and request_id=(p_payload->>'requestId')::uuid;
 if found then if existing.payload<>p_payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return next existing; return; end if;
 p:=to_char((p_payload->>'date')::date,'YYYY-MM');
 if exists(select 1 from public.crm_accounting_periods where organization_id=p_org and period=p and (payload->>'closed')::boolean) then raise exception 'PERIOD_CLOSED'; end if;
 if jsonb_array_length(p_payload->'lines')<2 or jsonb_array_length(p_payload->'lines')>100 then raise exception 'LINES'; end if;
 for l in select * from jsonb_array_elements(p_payload->'lines') loop
 if l->>'account' not in ('1101','1102','1103','1104','1201','2101','2102','2103','3101','4101','5101','6101') or (l->>'debit')!~'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$' or (l->>'credit')!~'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$' then raise exception 'LINE_INVALID'; end if;
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
create function public.crm_accounting_period_save(p_org text,p_payload jsonb,p_actor text) returns setof public.crm_accounting_periods language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('accounting:'||p_org,0));
 if p_payload->>'period' !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'PERIOD_INVALID'; end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'items') x where x->>'status'='submitted' and coalesce(trim(x->>'receipt'),'')='') then raise exception 'RECEIPT_REQUIRED'; end if;
 insert into public.crm_accounting_events(organization_id,period,action,actor,payload) values(p_org,p_payload->>'period','period_updated',p_actor,p_payload);
 return query insert into public.crm_accounting_periods(organization_id,period,payload,actor) values(p_org,p_payload->>'period',p_payload,p_actor) on conflict(organization_id,period) do update set payload=excluded.payload,actor=excluded.actor,updated_at=now() returning *;
end $$;
revoke all on function public.crm_accounting_post(text,jsonb,text),public.crm_accounting_period_save(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.crm_accounting_post(text,jsonb,text),public.crm_accounting_period_save(text,jsonb,text) to service_role;
