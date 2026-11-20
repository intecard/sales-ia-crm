-- Private instruction ledger. Only the signed Meta webhook's authenticated owner path calls it.
create table public.crm_owner_commands (
  message_id text primary key,
  owner_phone text not null,
  action text not null,
  contact_key text not null references public.crm_sales_opportunities(contact_key),
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index crm_owner_commands_contact_idx on public.crm_owner_commands(contact_key,created_at desc);
alter table public.crm_owner_commands enable row level security;
revoke all on public.crm_owner_commands from public, anon, authenticated;
grant select,insert on public.crm_owner_commands to service_role;
create policy owner_commands_service on public.crm_owner_commands for all to service_role using(true) with check(true);

create function public.crm_owner_command(p_owner text,p_message text,p_key text,p_action text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.crm_sales_opportunities; previous jsonb; result jsonb; enrollment_id uuid; instruction text;
begin
  if not exists(select 1 from public.crm_sales_automation_settings where id='org_inteca_main' and owner_phone=p_owner)
    or length(coalesce(p_message,'')) not between 1 and 256 then raise exception 'OWNER_UNAUTHORIZED'; end if;
  if p_action not in ('pausar','reanudar','seguimiento','matricular') then raise exception 'INVALID_ACTION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_message,0));
  select c.result into previous from public.crm_owner_commands c where c.message_id=p_message;
  if found then return previous; end if;
  select * into s from public.crm_sales_opportunities where contact_key=p_key for update;
  if not found then raise exception 'UNKNOWN_CONTACT'; end if;
  if p_action='pausar' then
    perform public.crm_sales_admin_action(p_key,'pause','Director por WhatsApp',jsonb_build_object('messageId',p_message));
    instruction:='Caso pausado para atención humana. Una baja previa se conserva.';
  elsif p_action='reanudar' then
    if s.control='opted_out' then instruction:='No se reanudó: el contacto pidió la baja.';
    else
      perform public.crm_sales_admin_action(p_key,'resume','Director por WhatsApp',jsonb_build_object('messageId',p_message));
      instruction:='Atención automática reanudada. Esto no confirma ningún envío.';
    end if;
  elsif p_action='seguimiento' then
    if s.control<>'auto' or s.stage in ('won','payment_review') or coalesce(s.profile->>'followUpConsent','')='no' then
      instruction:='No se programó: el caso está pausado, pidió baja, tiene pago validado o está en revisión. Consulta su ficha.';
    else
      perform public.crm_sales_admin_action(p_key,'follow_up','Director por WhatsApp',jsonb_build_object('note','Orientar al interesado por instrucción del director','at',now(),'messageId',p_message));
      instruction:='Seguimiento programado. Se enviará solo si cumple consentimiento, ventana o plantilla, horario y límites. Aún no es un envío confirmado.';
    end if;
  else
    if s.stage<>'won' then instruction:='No se creó matrícula: primero valida comprobante y abono bancario en Ventas y Cierre.';
    else
      enrollment_id:=public.crm_ensure_student_enrollment(p_key);
      instruction:=case when enrollment_id is null then 'No se pudo preparar la matrícula: revisa nombre, correo, curso y pago.' else 'Matrícula preparada o recuperada sin duplicarla. La activación del campus y los envíos dependen de sus conexiones; consulta estudiantes.' end;
    end if;
  end if;
  result:=jsonb_build_object('applied',instruction not like 'No %','message',instruction||' Caso '||left(p_key,12)||'.');
  insert into public.crm_owner_commands(message_id,owner_phone,action,contact_key,result) values(p_message,p_owner,p_action,p_key,result);
  return result;
end $$;
revoke all on function public.crm_owner_command(text,text,text,text) from public,anon,authenticated;
grant execute on function public.crm_owner_command(text,text,text,text) to service_role;
