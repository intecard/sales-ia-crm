-- INTECA checkout staging. No contract or merchant credentials yet: cannot collect card data.
-- This is an independent payment-request ledger; existing bank receipt and enrollment verification are unchanged.
create table if not exists public.crm_gateway_settings (
 id text primary key default 'inteca' check (id='inteca'),
 organization_id text not null default 'org_inteca_main' check (organization_id='org_inteca_main'),
 preferred_provider text not null default 'unselected' check (preferred_provider in ('unselected','azul','cardnet')),
 merchant_status text not null default 'contract_pending'
   check (merchant_status in ('contract_pending','sandbox','production')),
 sandbox_certified boolean not null default false,
 production_certified boolean not null default false,
 checkout_enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 constraint crm_gateway_activation_consistency check (
   not checkout_enabled or
   (merchant_status='production' and production_certified and sandbox_certified and preferred_provider<>'unselected')
 )
);
insert into public.crm_gateway_settings(id) values ('inteca') on conflict(id) do nothing;

create table if not exists public.crm_gateway_orders (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null default 'org_inteca_main' check(organization_id='org_inteca_main'),
 contact_key text not null references public.crm_sales_opportunities(contact_key),
 course_title text not null check(length(trim(course_title)) between 3 and 180),
 amount_minor bigint not null check(amount_minor between 100 and 100000000),
 currency text not null default 'DOP' check(currency='DOP'),
 preferred_provider text not null default 'unselected'
    check(preferred_provider in ('unselected','azul','cardnet')),
 state text not null default 'awaiting_contract'
    check(state in ('awaiting_contract','checkout_requested','awaiting_provider_confirmation',
                    'paid_verified','declined','cancelled','expired','review_required')),
 provider_session_id text unique,
 provider_transaction_id text unique,
 verified_at timestamptz,
 verified_amount_minor bigint,
 verification_method text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '14 days'),
 constraint crm_gateway_paid_evidence check(
  state<>'paid_verified' or (
    provider_transaction_id is not null and verified_at is not null
    and verified_amount_minor=amount_minor
    and verification_method in ('verified_server_callback','provider_reconciliation')
  )
 )
);
create unique index if not exists crm_gateway_one_active_quote
 on public.crm_gateway_orders(contact_key)
 where state in ('awaiting_contract','checkout_requested','awaiting_provider_confirmation','review_required');
create index if not exists crm_gateway_orders_created on public.crm_gateway_orders(created_at desc);
create index if not exists crm_gateway_orders_state on public.crm_gateway_orders(state,expires_at);

-- Future certified adapters may write only signed/idempotent provider evidence.
create table if not exists public.crm_gateway_provider_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid references public.crm_gateway_orders(id),
 provider text not null check(provider in ('azul','cardnet')),
 provider_event_id text not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),
 signature_verified boolean not null default false,
 processed boolean not null default false,
 created_at timestamptz not null default now(),
 unique(provider,provider_event_id)
);

alter table public.crm_gateway_settings enable row level security;
alter table public.crm_gateway_orders enable row level security;
alter table public.crm_gateway_provider_events enable row level security;
revoke all on public.crm_gateway_settings,public.crm_gateway_orders,public.crm_gateway_provider_events from public,anon,authenticated;
grant select,update on public.crm_gateway_settings to service_role;
grant select,insert,update on public.crm_gateway_orders to service_role;
grant select,insert,update on public.crm_gateway_provider_events to service_role;

-- The only way to stage a link for an enrollment is to use the server-side quoted amount
-- under a row lock. Never accept amounts/prices/course descriptions from browsers.
create or replace function public.crm_gateway_prepare_order(p_contact_key text, p_preferred_provider text default 'unselected')
returns setof public.crm_gateway_orders
language plpgsql security invoker set search_path='' as $$
declare
  opportunity public.crm_sales_opportunities%rowtype;
  old_order public.crm_gateway_orders%rowtype;
  new_amount_minor bigint;
  course_name text;
  chosen_provider text;
begin
  if p_contact_key is null or length(trim(p_contact_key))<3 or length(p_contact_key)>256 then
    raise exception 'GATEWAY_CONTACT_INVALID';
  end if;
  if p_preferred_provider not in ('unselected','azul','cardnet') then
    raise exception 'GATEWAY_PROVIDER_INVALID';
  end if;
  select * into opportunity from public.crm_sales_opportunities
    where contact_key=p_contact_key for update;
  if not found or opportunity.stage='won' then raise exception 'GATEWAY_OPPORTUNITY_UNAVAILABLE'; end if;
  if opportunity.expected_amount is null or opportunity.expected_amount<1
     or opportunity.expected_amount>1000000 then
    raise exception 'GATEWAY_QUOTE_REQUIRED';
  end if;
  course_name := trim(coalesce(opportunity.profile->>'course',''));
  if length(course_name) not between 3 and 180 then raise exception 'GATEWAY_COURSE_REQUIRED'; end if;
  new_amount_minor := round(opportunity.expected_amount*100)::bigint;
  if new_amount_minor < 100 then raise exception 'GATEWAY_AMOUNT_INVALID'; end if;

  select * into old_order from public.crm_gateway_orders
  where contact_key=p_contact_key
    and state in ('awaiting_contract','checkout_requested','awaiting_provider_confirmation','review_required')
  for update;
  if found and old_order.amount_minor=new_amount_minor
     and old_order.course_title=course_name
     and old_order.preferred_provider=p_preferred_provider
     and old_order.expires_at>now() then
       return query select * from public.crm_gateway_orders where id=old_order.id;
       return;
  end if;
  if found then
    -- Invalidate old payment link if the underlying quote or provider changed.
    update public.crm_gateway_orders set state='cancelled',updated_at=now()
    where id=old_order.id;
  end if;
  chosen_provider := p_preferred_provider;
  return query insert into public.crm_gateway_orders
     (contact_key,course_title,amount_minor,preferred_provider)
    values (p_contact_key,course_name,new_amount_minor,chosen_provider)
    returning *;
end $$;
revoke all on function public.crm_gateway_prepare_order(text,text) from public,anon,authenticated;
grant execute on function public.crm_gateway_prepare_order(text,text) to service_role;

create or replace function public.crm_gateway_orders_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if new.contact_key<>old.contact_key or new.amount_minor<>old.amount_minor
     or new.currency<>old.currency or new.course_title<>old.course_title
     or new.organization_id<>old.organization_id or new.id<>old.id
     or new.created_at<>old.created_at or new.preferred_provider<>old.preferred_provider
   then raise exception 'GATEWAY_QUOTE_IMMUTABLE'; end if;
   if old.state in ('paid_verified','cancelled','declined','expired')
     and new.state is distinct from old.state then raise exception 'GATEWAY_TERMINAL'; end if;
   if new.state='paid_verified' and old.state not in ('awaiting_provider_confirmation','review_required')
     then raise exception 'GATEWAY_VERIFICATION_REQUIRED'; end if;
   if old.state='awaiting_contract' and new.state not in ('awaiting_contract','cancelled','expired','checkout_requested')
     then raise exception 'GATEWAY_STATE_INVALID'; end if;
 end if;
 return new;
end $$;
drop trigger if exists crm_gateway_orders_guard_trigger on public.crm_gateway_orders;
create trigger crm_gateway_orders_guard_trigger before update on public.crm_gateway_orders
 for each row execute function public.crm_gateway_orders_guard();
revoke all on function public.crm_gateway_orders_guard() from public,anon,authenticated;
grant execute on function public.crm_gateway_orders_guard() to service_role;
