-- User-supplied RNC onboarding record. Never interpreted as DGII verification or e-CF authorization.
create table if not exists public.crm_fiscal_setup_drafts (
  organization_id text primary key references public.crm_organizations(id) on delete cascade,
  tax_id text not null check (tax_id ~ '^[0-9]{9}$'),
  source text not null default 'user_supplied' check (source = 'user_supplied'),
  registration_verification text not null default 'unverified' check (registration_verification = 'unverified'),
  e_cf_authorization text not null default 'unverified' check (e_cf_authorization = 'unverified'),
  environment text not null default 'precertification' check (environment = 'precertification'),
  emission_enabled boolean not null default false check (emission_enabled = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crm_fiscal_setup_drafts enable row level security;
revoke all on public.crm_fiscal_setup_drafts from public, anon, authenticated;
grant select, insert, update on public.crm_fiscal_setup_drafts to service_role;
