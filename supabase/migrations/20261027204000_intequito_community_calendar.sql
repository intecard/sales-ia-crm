-- INTEQUITO / Lisa: preserva historial publicado y cambia únicamente pendientes del calendario anterior.
-- No ejecuta gasto ni publica guiones que todavía no tienen render audiovisual 3D.
begin;
-- No retire aquí publicaciones pendientes. El nuevo RPC mensual v3 retirará
-- las anteriores atómicamente tras crear un calendario sustituto válido.

-- El plan nuevo puede tener hasta 30*(2 posts canales + 7*3 reels canales + 1*3 vídeo canales) = 780 filas.
create or replace function public.crm_community_plan(p_jobs jsonb,p_destinations jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare started timestamptz; affected integer;
begin
 select plan_started_at into started from public.crm_community_settings where id='inteca' and enabled for update;
 if not found or started is not null then return 0;end if;
 if jsonb_typeof(p_jobs)<>'array' or jsonb_array_length(p_jobs)>1000 then raise exception 'CM_PLAN';end if;
 insert into public.crm_community_jobs(slot,channel,payload,content_hash,scheduled_at,state)
 select slot,channel,payload,content_hash,scheduled_at,state
 from jsonb_to_recordset(p_jobs) as j(slot text,channel text,payload jsonb,content_hash text,scheduled_at timestamptz,state text)
 on conflict(slot) do nothing;
 get diagnostics affected=row_count;
 update public.crm_community_settings
 set destinations=p_destinations,plan_started_at=now(),updated_at=now()
 where id='inteca';
 return affected;
end $$;
revoke all on function public.crm_community_plan(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.crm_community_plan(jsonb,jsonb) to service_role;
update public.crm_community_settings
set updated_at=now(),
 authorization_note=authorization_note||' | Nueva solicitud 2026-10-27: 1 post, 7 reels y 1 guion de video diario; INTEQUITO; 809-643-5502. Video sin render no se publica.'
where id='inteca';
commit;
