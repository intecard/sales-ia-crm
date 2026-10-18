-- Receipts are private evidence. A reviewed image never substitutes for bank validation.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('crm-payment-receipts','crm-payment-receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create table public.crm_payment_receipts (
 id uuid primary key default gen_random_uuid(), contact_key text not null references public.crm_sales_opportunities(contact_key),
 storage_path text not null unique, sha256 text not null unique, mime_type text not null,
 source_event_id uuid references public.crm_sales_events(id), uploaded_by text not null, created_at timestamptz not null default now()
);
create index crm_receipt_contact_idx on public.crm_payment_receipts(contact_key);
alter table public.crm_payment_receipts enable row level security;
revoke all on public.crm_payment_receipts from public,anon,authenticated;
grant select,insert on public.crm_payment_receipts to service_role;
alter table public.crm_sales_payments add column receipt_id uuid unique references public.crm_payment_receipts(id);
create table public.crm_campus_course_mapping (
 course_title text primary key, campus_course_id text not null, campus_course_title text not null, verified_by text not null, updated_at timestamptz not null default now()
);
create sequence public.crm_registration_number;
create table public.crm_student_enrollments (
 id uuid primary key default gen_random_uuid(),
 contact_key text not null unique references public.crm_sales_opportunities(contact_key),
 payment_id uuid not null unique references public.crm_sales_payments(id),
 registration_code text not null unique default ('INTECA-'||extract(year from now())::text||'-'||lpad(nextval('public.crm_registration_number')::text,7,'0')),
 full_name text not null, email text not null, course_title text not null, campus_course_id text,
 campus_uid text, campus_status text not null default 'pending' check(campus_status in ('pending','active')),
 email_status text not null default 'pending' check(email_status in ('pending','sending','accepted','review')),
 whatsapp_status text not null default 'pending' check(whatsapp_status in ('pending','sending','accepted','review')),
 email_provider_id text, whatsapp_provider_id text,
 last_error text not null default '', attempts integer not null default 0,
 lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index crm_enrollment_pending_idx on public.crm_student_enrollments(next_attempt_at) where email_status<>'accepted' or whatsapp_status<>'accepted';
alter table public.crm_student_enrollments enable row level security;
alter table public.crm_campus_course_mapping enable row level security;
revoke all on public.crm_student_enrollments,public.crm_campus_course_mapping from public,anon,authenticated;
grant select,insert,update on public.crm_student_enrollments,public.crm_campus_course_mapping to service_role;
grant usage,select on sequence public.crm_registration_number to service_role;

create function public.crm_ensure_student_enrollment(p_key text) returns uuid language plpgsql security invoker set search_path='' as $$
declare sale public.crm_sales_opportunities; payment public.crm_sales_payments; enrollment_id uuid;
begin
 select * into sale from public.crm_sales_opportunities where contact_key=p_key for update;
 select * into payment from public.crm_sales_payments where contact_key=p_key;
 if payment.id is null or payment.receipt_id is null or sale.stage<>'won' then return null; end if;
 if coalesce(sale.profile->>'fullName','')='' or coalesce(sale.profile->>'course','')='' or coalesce(sale.profile->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return null; end if;
 if coalesce(sale.profile->>'phone',sale.profile->>'whatsappUserId','')='' then return null; end if;
 insert into public.crm_student_enrollments(contact_key,payment_id,full_name,email,course_title)
 values(p_key,payment.id,sale.profile->>'fullName',lower(trim(sale.profile->>'email')),sale.profile->>'course')
 on conflict(contact_key) do nothing;
 select id into enrollment_id from public.crm_student_enrollments where contact_key=p_key;
 return enrollment_id;
end $$;
create function public.crm_claim_student_enrollment() returns setof public.crm_student_enrollments language plpgsql security invoker set search_path='' as $$
begin
 return query update public.crm_student_enrollments set lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now()
 where id=(select id from public.crm_student_enrollments where (lease_until is null or lease_until<now()) and next_attempt_at<=now() and attempts<30 and (campus_status<>'active' or email_status<>'accepted' or whatsapp_status<>'accepted') order by next_attempt_at for update skip locked limit 1)
 returning *;
end $$;
revoke all on function public.crm_ensure_student_enrollment(text),public.crm_claim_student_enrollment() from public,anon,authenticated;
grant execute on function public.crm_ensure_student_enrollment(text),public.crm_claim_student_enrollment() to service_role;

create or replace function public.crm_sales_admin_action(p_key text, p_action text, p_actor text, p_data jsonb)
returns public.crm_sales_opportunities language plpgsql security invoker set search_path = '' as $$
declare r public.crm_sales_opportunities; paid numeric; ref text;
begin
  select * into r from public.crm_sales_opportunities where contact_key=p_key for update;
  if not found then raise exception 'UNKNOWN_CONTACT'; end if;
  if p_action='verify_payment' then
    if r.stage='won' then raise exception 'ALREADY_PAID'; end if;
    if p_data->>'receiptReviewed' is distinct from 'true' or not exists(select 1 from public.crm_payment_receipts where id=(p_data->>'receiptId')::uuid and contact_key=p_key) then raise exception 'RECEIPT_REQUIRED'; end if;
    if r.expected_amount is null then raise exception 'QUOTE_REQUIRED'; end if;
    paid := (p_data->>'amount')::numeric;
    ref := upper(regexp_replace(trim(p_data->>'reference'),'\s','','g'));
    if paid is null or paid<>r.expected_amount or coalesce(r.profile->>'fullName','')='' or coalesce(r.profile->>'course','')='' or coalesce(p_data->>'bank','') not in ('Banreservas','Qik','Banco Popular') or coalesce(length(ref),0)<3 or p_data->>'confirmed' is distinct from 'true' then raise exception 'INVALID_PAYMENT'; end if;
    insert into public.crm_sales_payments(contact_key,bank,reference,amount,verified_by,receipt_id) values(p_key,p_data->>'bank',ref,paid,p_actor,(p_data->>'receiptId')::uuid);
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
  if p_action='verify_payment' then perform public.crm_ensure_student_enrollment(p_key); end if;
  return r;
end $$;
