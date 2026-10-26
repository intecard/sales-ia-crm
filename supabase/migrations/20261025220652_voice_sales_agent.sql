create table public.crm_voice_settings (
 organization_id text primary key,
 company_name text not null,
 enabled boolean not null default false,
 auto_queue boolean not null default false,
 from_number text not null default '',
 transfer_number text not null default '',
 timezone text not null default 'America/Santo_Domingo',
 start_hour integer not null default 9 check(start_hour between 8 and 19),
 end_hour integer not null default 18 check(end_hour between 9 and 20 and end_hour>start_hour),
 max_calls_day integer not null default 3 check(max_calls_day between 1 and 20),
 max_seconds integer not null default 180 check(max_seconds between 60 and 300),
 daily_reserve_usd numeric(10,2) not null default 0 check(daily_reserve_usd between 0 and 500),
 per_call_reserve_usd numeric(10,2) not null default 0 check(per_call_reserve_usd between 0 and 100),
 costs_authorized boolean not null default false,
 relay_terms_confirmed boolean not null default false,
 catalog text not null default '' check(length(catalog)<=40000),
 updated_at timestamptz not null default now()
);
create table public.crm_voice_contacts (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null references public.crm_voice_settings(organization_id),
 name text not null check(length(name) between 1 and 150),
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
 course text not null default '' check(length(course)<=250),
 consent boolean not null default false,
 consent_note text not null check(length(consent_note) between 3 and 1000),
 do_not_call boolean not null default false,
 source_contact_key text,
 updated_at timestamptz not null default now(),
 unique(organization_id,phone)
);
create table public.crm_voice_calls (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null references public.crm_voice_settings(organization_id),
 contact_id uuid not null references public.crm_voice_contacts(id),
 slot text not null unique,
 scheduled_at timestamptz not null,
 state text not null default 'queued' check(state in ('queued','starting','active','completed','busy','no-answer','failed','canceled','blocked','review_required')),
 provider_sid text unique,
 destination_from text,
 session_id text,
 status_seq integer not null default -1,
 outcome text not null default 'pending',
 next_action text not null default '',
 transcript jsonb not null default '[]' check(octet_length(transcript::text)<=50000),
 reserved_usd numeric(10,2) not null default 0,
 budget_day date,
 duration_seconds integer,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index crm_voice_calls_due on public.crm_voice_calls(scheduled_at) where state='queued';
create index crm_voice_calls_org_day on public.crm_voice_calls(organization_id,budget_day);
create index crm_voice_calls_contact on public.crm_voice_calls(contact_id,created_at);
create table public.crm_voice_events (
 id bigint generated always as identity primary key,
 call_id uuid not null references public.crm_voice_calls(id),
 event text not null,
 created_at timestamptz not null default now()
);
create index crm_voice_events_call on public.crm_voice_events(call_id,created_at);
create function public.crm_voice_event() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' or new.state<>old.state or new.outcome<>old.outcome then
 insert into public.crm_voice_events(call_id,event) values(new.id,new.state||':'||new.outcome);
 end if;return new;
end $$;
create trigger crm_voice_event after insert or update on public.crm_voice_calls for each row execute function public.crm_voice_event();
create function public.crm_voice_reserve(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.crm_voice_calls; s public.crm_voice_settings; c public.crm_voice_contacts; local_day date; local_hour integer; n integer; reserved numeric;
begin
 select * into j from public.crm_voice_calls where id=p_id;
 if not found then raise exception 'VOICE_NOT_FOUND';end if;
 select * into s from public.crm_voice_settings where organization_id=j.organization_id for update;
 select * into j from public.crm_voice_calls where id=p_id for update;
 select * into c from public.crm_voice_contacts where id=j.contact_id for update;
 if j.state<>'queued' or j.scheduled_at>now() then raise exception 'VOICE_STATE';end if;
 if c.organization_id<>j.organization_id or not c.consent or c.do_not_call then raise exception 'VOICE_CONSENT';end if;
 if not s.enabled or not s.costs_authorized or not s.relay_terms_confirmed then raise exception 'VOICE_DISABLED';end if;
 local_day=(now() at time zone s.timezone)::date;local_hour=extract(hour from now() at time zone s.timezone);
 if local_hour<s.start_hour or local_hour>=s.end_hour then raise exception 'VOICE_HOURS';end if;
 if exists(select 1 from public.crm_voice_calls where organization_id=j.organization_id and state in ('starting','active','review_required')) then raise exception 'VOICE_ACTIVE';end if;
 select count(*),coalesce(sum(reserved_usd),0) into n,reserved from public.crm_voice_calls where organization_id=j.organization_id and budget_day=local_day;
 if n>=s.max_calls_day or s.per_call_reserve_usd<0.5 or reserved+s.per_call_reserve_usd>s.daily_reserve_usd then raise exception 'VOICE_BUDGET';end if;
 if exists(select 1 from public.crm_voice_calls where contact_id=c.id and budget_day=local_day) then raise exception 'VOICE_FREQUENCY';end if;
 update public.crm_voice_calls set state='starting',budget_day=local_day,reserved_usd=s.per_call_reserve_usd,updated_at=now() where id=p_id returning * into j;
 return to_jsonb(j);
end $$;
alter table public.crm_voice_settings enable row level security;
alter table public.crm_voice_contacts enable row level security;
alter table public.crm_voice_calls enable row level security;
alter table public.crm_voice_events enable row level security;
revoke all on public.crm_voice_settings,public.crm_voice_contacts,public.crm_voice_calls,public.crm_voice_events from public,anon,authenticated;
grant select,insert,update on public.crm_voice_settings,public.crm_voice_contacts,public.crm_voice_calls to service_role;
grant select,insert on public.crm_voice_events to service_role;
grant usage,select on sequence public.crm_voice_events_id_seq to service_role;
revoke all on function public.crm_voice_reserve(uuid),public.crm_voice_event() from public,anon,authenticated;
grant execute on function public.crm_voice_reserve(uuid),public.crm_voice_event() to service_role;
insert into public.crm_voice_settings(organization_id,company_name) values('org_inteca_main','INTECA');
