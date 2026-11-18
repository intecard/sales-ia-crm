-- Private configuration and durable outbox. No financial account data in source control.
create table if not exists public.crm_sales_automation_settings (
 id text primary key check(id='org_inteca_main'), enabled boolean not null default false,
 owner_phone text not null default '', daily_goal integer not null default 5 check(daily_goal between 1 and 1000),
 payment_document text not null default '', payment_instructions text not null default '',
 international_payment_instructions text not null default '',
 followup_template text not null default '', owner_template text not null default '', template_language text not null default 'es',
 owner_last_inbound_at timestamptz, updated_at timestamptz not null default now()
);
insert into public.crm_sales_automation_settings(id) values('org_inteca_main') on conflict do nothing;
create table if not exists public.crm_sales_outbox (
 id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
 contact_key text references public.crm_sales_opportunities(contact_key),
 kind text not null check(kind in ('followup','owner')), strategy text not null default '',
 state text not null default 'pending' check(state in ('pending','sending','sent','delivered','read','failed','blocked','unknown','cancelled')),
 payload jsonb not null, last_error text, provider_id text unique,
 created_at timestamptz not null default now(), available_at timestamptz not null default now(),
 claimed_at timestamptz, sent_at timestamptz
);
create index if not exists crm_sales_outbox_due on public.crm_sales_outbox(available_at) where state in ('pending','blocked');
create index if not exists crm_sales_outbox_contact on public.crm_sales_outbox(contact_key,created_at);
alter table public.crm_sales_automation_settings enable row level security;
alter table public.crm_sales_outbox enable row level security;
revoke all on public.crm_sales_automation_settings,public.crm_sales_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.crm_sales_automation_settings,public.crm_sales_outbox to service_role;

create or replace function public.crm_enqueue_sales_message(p_kind text,p_dedupe text,p_contact text,p_text text,p_strategy text default '')
returns void language sql security invoker set search_path='' as $$
 insert into public.crm_sales_outbox(kind,dedupe_key,contact_key,payload,strategy)
 values(p_kind,p_dedupe,p_contact,jsonb_build_object('text',left(p_text,3500)),p_strategy)
 on conflict(dedupe_key) do nothing;
$$;
create or replace function public.crm_claim_sales_message()
returns setof public.crm_sales_outbox language plpgsql security invoker set search_path='' as $$
begin
 -- A crash after sending must never cause a duplicate financial reminder.
 update public.crm_sales_outbox set state='unknown',last_error='VERIFY_DELIVERY_BEFORE_RETRY'
 where state='sending' and claimed_at < now()-interval '5 minutes';
 return query update public.crm_sales_outbox set state='sending',claimed_at=now() where id in (
 select id from public.crm_sales_outbox where state in ('pending','blocked') and available_at<=now()
 order by case when kind='owner' then 0 else 1 end,available_at for update skip locked limit 1
 ) returning *;
end $$;
create or replace function public.crm_sales_followup_metrics()
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'paid_today',(select count(*) from public.crm_sales_payments where verified_at >= (date_trunc('day',now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo')),
 'payment_pending',(select count(*) from public.crm_sales_opportunities where stage='payment_pending'),
 'payment_review',(select count(*) from public.crm_sales_opportunities where stage='payment_review'),
 'human',(select count(*) from public.crm_sales_opportunities where control='human'),
 'strategies',coalesce((select jsonb_agg(row_to_json(t)) from (
 select strategy,count(distinct contact_key) as sent,
 count(distinct contact_key) filter(where exists(select 1 from public.crm_sales_payments p where p.contact_key=j.contact_key and p.verified_at>j.sent_at and p.verified_at<=j.sent_at+interval '7 days')) as paid,
 count(distinct contact_key) filter(where exists(select 1 from public.crm_sales_events e where e.contact_key=j.contact_key and e.kind='inbound' and e.created_at>j.sent_at and e.created_at<=j.sent_at+interval '7 days')) as replied
 from public.crm_sales_outbox j where kind='followup' and sent_at is not null and created_at>=now()-interval '30 days'
 group by strategy) t),'[]'::jsonb),
 'measurement','Resultados observados a 7 días; no prueban causalidad. Mínimo 20 contactos por estrategia antes de favorecer una.');
$$;
revoke all on function public.crm_enqueue_sales_message(text,text,text,text,text),public.crm_claim_sales_message(),public.crm_sales_followup_metrics() from public,anon,authenticated;
grant execute on function public.crm_enqueue_sales_message(text,text,text,text,text),public.crm_claim_sales_message(),public.crm_sales_followup_metrics() to service_role;
