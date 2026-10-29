-- Tax workpapers are always internal proposals, not official DGII declarations.
-- Organization-scoped, content-addressed and immutable; service_role only.
create table if not exists public.crm_tax_workpapers (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null check(organization_id ~ '^[a-zA-Z0-9_-]{3,120}$'),
 form text not null check(form in ('606','607','608','609','IT-1','IR-2','ACT')),
 fiscal_period text not null check(fiscal_period ~ '^[0-9]{4}(-[0-9]{2})?$'),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb not null check(payload->>'classification'='BORRADOR_INTERNO_NO_APTO_PARA_DGII'
   and payload->>'submittedToDGII'='false' and payload->>'officialFileGenerated'='false'),
 created_by text not null,created_at timestamptz not null default now(),
 unique(organization_id,form,fiscal_period,source_hash)
);
create index if not exists crm_tax_workpapers_per_org on public.crm_tax_workpapers(organization_id,created_at desc);
alter table public.crm_tax_workpapers enable row level security;
revoke all on public.crm_tax_workpapers from public,anon,authenticated,service_role;
grant select,insert on public.crm_tax_workpapers to service_role;
create or replace function public.crm_tax_workpaper_immutable()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin raise exception 'TAX_WORKPAPER_IMMUTABLE'; end $$;
drop trigger if exists crm_tax_workpaper_guard on public.crm_tax_workpapers;
create trigger crm_tax_workpaper_guard before update or delete on public.crm_tax_workpapers
for each row execute function public.crm_tax_workpaper_immutable();
revoke all on function public.crm_tax_workpaper_immutable() from public,anon,authenticated;
-- No automatic filing, DGII login, zero submission, or fiscal amount calculation.
