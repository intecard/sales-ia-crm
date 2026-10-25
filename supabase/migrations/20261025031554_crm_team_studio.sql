create table public.crm_team_members (
 id uuid primary key default gen_random_uuid(), organization_id text not null, organization_name text not null,
 name text not null, email text not null unique check(email=lower(email)), area text not null check(area in ('Ventas','Marketing','Call Center','Docentes','Caja','Contabilidad','Compras','Inventario','KPIs','Soporte')),
 password_hash text not null, salt text not null, active boolean not null default true, created_at timestamptz not null default now()
);
create index crm_team_members_org on public.crm_team_members(organization_id);
create table public.crm_team_sessions (token_hash text primary key,member_id uuid not null references public.crm_team_members(id),expires_at timestamptz not null);
create index crm_team_sessions_member on public.crm_team_sessions(member_id);
create table public.crm_team_messages (
 id uuid primary key default gen_random_uuid(), organization_id text not null,agent_id text not null,request_id uuid not null,
 sender text not null check(sender in ('human','agent')),author text not null,author_id text not null,content text not null check(length(content) between 1 and 20000),created_at timestamptz not null default now(), unique(organization_id,request_id,sender)
);
create index crm_team_messages_thread on public.crm_team_messages(organization_id,agent_id,created_at desc,id desc);
create table public.crm_team_notes (
 id uuid primary key default gen_random_uuid(),organization_id text not null,kind text not null check(kind in ('course','metric','brief')),course text not null default '',date text not null default '',content text not null,author text not null,created_at timestamptz not null default now()
);
create index crm_team_notes_org on public.crm_team_notes(organization_id,created_at desc);
create table public.crm_team_tasks (
 id uuid primary key default gen_random_uuid(),organization_id text not null,agent_id text not null,content text not null,author text not null,status text not null default 'requested' check(status in ('requested','in_progress','completed')),evidence text not null default '',updated_by text not null default '',created_at timestamptz not null default now()
);
create index crm_team_tasks_org on public.crm_team_tasks(organization_id,agent_id,created_at desc);
alter table public.crm_team_members enable row level security;
alter table public.crm_team_sessions enable row level security;
alter table public.crm_team_messages enable row level security;
alter table public.crm_team_notes enable row level security;
alter table public.crm_team_tasks enable row level security;
revoke all on public.crm_team_members,public.crm_team_sessions,public.crm_team_messages,public.crm_team_notes,public.crm_team_tasks from anon,authenticated,service_role;
grant select,insert,update on public.crm_team_members,public.crm_team_tasks to service_role;
grant select,insert on public.crm_team_sessions,public.crm_team_messages,public.crm_team_notes to service_role;
