-- Server-only sales state. All mutations are atomic and audit logged.
create table public.crm_sales_settings (
  id text primary key check (id = 'org_inteca_main'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.crm_sales_settings(id) values ('org_inteca_main');
create table public.crm_sales_opportunities (
  contact_key text primary key,
  profile jsonb not null default '{}',
  stage text not null default 'new' check (stage in ('new','interested','enrollment','payment_pending','payment_review','won')),
  control text not null default 'auto' check (control in ('auto','human','opted_out')),
  objection text not null default '',
  expected_amount numeric(12,2) check (expected_amount > 0),
  paid_amount numeric(12,2) check (paid_amount > 0),
  next_action text not null default 'Conocer el curso de interés',
  follow_up_at timestamptz,
  last_inbound_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_sales_updated_idx on public.crm_sales_opportunities(updated_at desc);
create index crm_sales_followup_idx on public.crm_sales_opportunities(follow_up_at) where follow_up_at is not null;
create table public.crm_sales_events (
  id uuid primary key default gen_random_uuid(),
  contact_key text not null references public.crm_sales_opportunities(contact_key),
  external_id text,
  kind text not null,
  actor text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(contact_key, external_id)
);
create index crm_sales_events_contact_idx on public.crm_sales_events(contact_key, created_at desc);
create table public.crm_sales_payments (
  id uuid primary key default gen_random_uuid(),
  contact_key text not null unique references public.crm_sales_opportunities(contact_key),
  bank text not null check(bank in ('Banreservas','Qik','Banco Popular')),
  reference text not null check(length(reference) between 3 and 100),
  amount numeric(12,2) not null check(amount > 0),
  currency text not null default 'DOP' check(currency='DOP'),
  verified_by text not null,
  verified_at timestamptz not null default now(),
  unique(bank, reference)
);
alter table public.crm_sales_settings enable row level security;
alter table public.crm_sales_opportunities enable row level security;
alter table public.crm_sales_events enable row level security;
alter table public.crm_sales_payments enable row level security;
revoke all on public.crm_sales_settings, public.crm_sales_opportunities, public.crm_sales_events, public.crm_sales_payments from public, anon, authenticated;
grant select, insert, update, delete on public.crm_sales_settings, public.crm_sales_opportunities, public.crm_sales_events, public.crm_sales_payments to service_role;

create function public.crm_record_sales_inbound(p_key text, p_event text, p_text text, p_profile jsonb, p_signal text, p_objection text, p_media_type text, p_media_id text)
returns public.crm_sales_opportunities language plpgsql security invoker set search_path = '' as $$
declare r public.crm_sales_opportunities; inserted_id uuid; new_stage text; merged jsonb;
begin
  insert into public.crm_sales_opportunities(contact_key) values(p_key) on conflict do nothing;
  select * into r from public.crm_sales_opportunities where contact_key=p_key for update;
  insert into public.crm_sales_events(contact_key,external_id,kind,actor,details)
    values(p_key,p_event,'inbound','customer',jsonb_build_object('text',left(p_text,4096),'signal',p_signal,'mediaType',p_media_type,'mediaId',p_media_id))
    on conflict (contact_key,external_id) do nothing returning id into inserted_id;
  if inserted_id is null then return r; end if;
  merged := r.profile || jsonb_strip_nulls(p_profile);
  new_stage := case
    when r.stage='won' then 'won'
    when p_signal='payment_review' or r.stage='payment_review' then 'payment_review'
    when p_signal='payment_pending' or r.stage='payment_pending' then 'payment_pending'
    when p_signal='enrollment' or r.stage='enrollment' then 'enrollment'
    when p_signal='interested' or r.stage='interested' then 'interested'
    else 'new' end;
  -- A change of course starts a new quote before payment, never reuses another course's price.
  if r.stage not in ('won','payment_review') and coalesce(r.profile->>'course','') <> coalesce(merged->>'course','') then
    r.expected_amount := case when merged->>'course'='Técnico u Oficial de Autorizaciones Médicas' then 2500 else null end;
  end if;
  if r.stage='won' then merged := merged || jsonb_build_object('course',r.profile->>'course'); end if;
  r.control := case when p_signal='opted_out' or r.control='opted_out' then 'opted_out' when p_signal='human' or r.control='human' then 'human' else 'auto' end;
  update public.crm_sales_opportunities set profile=merged, stage=new_stage, control=r.control,
    expected_amount=r.expected_amount,
    objection=case when p_objection<>'' then p_objection else objection end,
    last_inbound_at=now(), updated_at=now(),
    next_action=case when r.control='opted_out' then 'No contactar: baja solicitada' when r.control='human' then 'Atención humana solicitada' when new_stage='won' then 'Confirmar grupo y acceso al campus' when new_stage='payment_review' then 'Verificar transferencia en el banco' when new_stage='payment_pending' then 'Revisar si el cliente necesita ayuda con el pago' when new_stage='enrollment' then 'Completar datos y orientar la inscripción' else 'Responder la consulta del cliente' end,
    follow_up_at=case when r.control='opted_out' then null when r.control='human' or new_stage in ('payment_review','won') then now() else now()+interval '20 hours' end
  where contact_key=p_key returning * into r;
  return r;
end $$;

create function public.crm_sales_admin_action(p_key text, p_action text, p_actor text, p_data jsonb)
returns public.crm_sales_opportunities language plpgsql security invoker set search_path = '' as $$
declare r public.crm_sales_opportunities; paid numeric; ref text;
begin
  select * into r from public.crm_sales_opportunities where contact_key=p_key for update;
  if not found then raise exception 'UNKNOWN_CONTACT'; end if;
  if p_action='verify_payment' then
    if r.stage='won' then raise exception 'ALREADY_PAID'; end if;
    if r.expected_amount is null then raise exception 'QUOTE_REQUIRED'; end if;
    paid := (p_data->>'amount')::numeric;
    ref := upper(regexp_replace(trim(p_data->>'reference'),'\s','','g'));
    if paid is null or paid<>r.expected_amount or coalesce(r.profile->>'fullName','')='' or coalesce(r.profile->>'course','')='' or coalesce(p_data->>'bank','') not in ('Banreservas','Qik','Banco Popular') or coalesce(length(ref),0)<3 or p_data->>'confirmed' is distinct from 'true' then raise exception 'INVALID_PAYMENT'; end if;
    insert into public.crm_sales_payments(contact_key,bank,reference,amount,verified_by) values(p_key,p_data->>'bank',ref,paid,p_actor);
    update public.crm_sales_opportunities set stage='won',paid_amount=paid,next_action='Pago validado: confirmar grupo y acceso al campus',follow_up_at=now(),updated_at=now() where contact_key=p_key;
  elsif p_action='quote' then
    if r.stage='won' then raise exception 'ALREADY_PAID'; end if;
    if (p_data->>'amount')::numeric is null or (p_data->>'amount')::numeric<=0 then raise exception 'INVALID_PAYMENT'; end if;
    update public.crm_sales_opportunities set expected_amount=(p_data->>'amount')::numeric,updated_at=now() where contact_key=p_key;
  elsif p_action='pause' then
    update public.crm_sales_opportunities set control=case when control='opted_out' then control else 'human' end,updated_at=now() where contact_key=p_key;
  elsif p_action='resume' then
    if r.control='opted_out' then raise exception 'INVALID_ACTION'; end if;
    update public.crm_sales_opportunities set control='auto',updated_at=now() where contact_key=p_key;
  elsif p_action='follow_up' then
    update public.crm_sales_opportunities set next_action=left(p_data->>'note',1000),follow_up_at=(p_data->>'at')::timestamptz,updated_at=now() where contact_key=p_key;
  elsif p_action='complete_task' then
    update public.crm_sales_opportunities set next_action='Seguimiento completado',follow_up_at=null,updated_at=now() where contact_key=p_key;
  else raise exception 'INVALID_ACTION'; end if;
  insert into public.crm_sales_events(contact_key,kind,actor,details) values(p_key,p_action,p_actor,p_data);
  select * into r from public.crm_sales_opportunities where contact_key=p_key;
  return r;
end $$;
revoke all on function public.crm_record_sales_inbound(text,text,text,jsonb,text,text,text,text), public.crm_sales_admin_action(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_record_sales_inbound(text,text,text,jsonb,text,text,text,text), public.crm_sales_admin_action(text,text,text,jsonb) to service_role;

-- Recover confirmed conversation facts without sending any messages or assuming payment.
insert into public.crm_sales_opportunities(contact_key,profile,stage,expected_amount,last_inbound_at,updated_at,next_action,follow_up_at)
select conversation_key,coalesce(state->'facts','{}'),
 case when state->'facts'->>'paymentRequested'='true' then 'payment_pending' when state->'facts'->>'wantsEnrollment'='true' then 'enrollment' when state->'facts'->>'course' is not null then 'interested' else 'new' end,
 case when state->'facts'->>'course'='Técnico u Oficial de Autorizaciones Médicas' then 2500 else null end,
 updated_at,updated_at,'Revisar conversación previa y continuar desde el último paso',now()
from public.crm_whatsapp_memory where expires_at > now() on conflict do nothing;
