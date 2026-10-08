-- Sales AI CRM - Agent runtime and integration persistence schema
-- Apply from Supabase SQL Editor after creating the project.
-- This schema is additive and does not delete existing data.

create extension if not exists pgcrypto;

create table if not exists public.crm_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'Business',
  license_status text not null default 'Activo',
  is_inteca_forever boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_agent_registry (
  id text primary key,
  name text not null,
  function text not null,
  status text not null default 'Activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_connector_registry (
  id text primary key,
  name text not null,
  category text not null,
  webhook_path text,
  required_env_vars text[] not null default '{}',
  operations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_company_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  connector_id text not null references public.crm_connector_registry(id),
  display_name text not null,
  status text not null default 'No configurado',
  config jsonb not null default '{}',
  secret_reference text,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, connector_id)
);

create table if not exists public.crm_agent_connector_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  agent_id text not null references public.crm_agent_registry(id),
  connector_id text not null references public.crm_connector_registry(id),
  allowed_operations text[] not null default '{}',
  spending_limit numeric(12, 2),
  requires_human_approval boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, agent_id, connector_id)
);

create table if not exists public.crm_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  agent_id text not null references public.crm_agent_registry(id),
  source text not null,
  task_type text not null,
  payload jsonb not null default '{}',
  idempotency_key text,
  priority integer not null default 100,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.crm_agent_executions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.crm_agent_jobs(id) on delete set null,
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  agent_id text not null references public.crm_agent_registry(id),
  connector_id text,
  operation text not null,
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  status text not null,
  external_id text,
  correlation_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create table if not exists public.crm_agent_evidence (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid references public.crm_agent_executions(id) on delete cascade,
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  evidence_type text not null,
  title text not null,
  storage_path text,
  external_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.crm_organizations(id) on delete set null,
  actor_type text not null,
  actor_name text not null,
  module text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  details text,
  source_channel text,
  severity text not null default 'Info',
  status text not null default 'Registrado',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.crm_student_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.crm_organizations(id) on delete cascade,
  lead_id text not null,
  course_id text,
  course_title text not null,
  student_code text not null,
  status text not null default 'Bienvenida enviada',
  campus_url text,
  campus_email text,
  course_access_code text,
  payment_transaction_id text,
  welcome_message text,
  credentials_sent_at timestamptz,
  next_academic_follow_up_at timestamptz,
  campus_sync_status text not null default 'pending_external_campus_api',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, lead_id, payment_transaction_id)
);

create index if not exists idx_crm_agent_jobs_status_run_after
  on public.crm_agent_jobs (status, run_after, priority);

create index if not exists idx_crm_agent_executions_org_agent
  on public.crm_agent_executions (organization_id, agent_id, started_at desc);

create index if not exists idx_crm_audit_events_org_created
  on public.crm_audit_events (organization_id, created_at desc);

create index if not exists idx_crm_student_enrollments_org_lead
  on public.crm_student_enrollments (organization_id, lead_id, created_at desc);

alter table public.crm_organizations enable row level security;
alter table public.crm_agent_registry enable row level security;
alter table public.crm_connector_registry enable row level security;
alter table public.crm_company_integrations enable row level security;
alter table public.crm_agent_connector_permissions enable row level security;
alter table public.crm_agent_jobs enable row level security;
alter table public.crm_agent_executions enable row level security;
alter table public.crm_agent_evidence enable row level security;
alter table public.crm_audit_events enable row level security;
alter table public.crm_student_enrollments enable row level security;

-- Service role bypasses RLS. Application users should receive policies tied to
-- their organization_id before exposing Supabase directly to a browser client.
