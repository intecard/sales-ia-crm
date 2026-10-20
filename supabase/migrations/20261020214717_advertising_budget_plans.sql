-- Compatibility verified: crm_ad_campaigns currently has no rows. Abort safely
-- if a paid draft is created between inspection and this migration.
lock table public.crm_ad_campaigns in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.crm_ad_campaigns where payload->>'channel' in ('meta_ads','google_ads')) then
  raise exception 'Migration stopped: existing paid campaigns require compatibility review';
 end if;
end $$;
create table public.crm_ad_plans (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null default 'org_inteca_main' check (organization_id='org_inteca_main'),
 payload jsonb not null,
 strategy jsonb not null,
 catalog_hash text not null,
 content_hash text not null,
 state text not null default 'draft' check(state in ('draft','approved','cancelled')),
 approved_by text, approved_at timestamptz,
 created_at timestamptz not null default now(),
 check ((payload->>'totalBudgetDop')::numeric >= 1000 and (payload->>'totalBudgetDop')::numeric <= 1000000),
 check ((payload->>'dailyLimitDop')::numeric > 0 and (payload->>'dailyLimitDop')::numeric <= (payload->>'totalBudgetDop')::numeric),
 check (payload ?& array['courseTitle','totalBudgetDop','dailyLimitDop','durationDays','targetCacDop','channels']),
 check ((payload->>'durationDays')::integer between 3 and 30),
 check ((payload->>'targetCacDop')::numeric > 0),
 check (state <> 'approved' or (approved_by is not null and approved_at is not null))
);
create index crm_ad_plans_created on public.crm_ad_plans(created_at desc);
alter table public.crm_ad_plans enable row level security;
revoke all on public.crm_ad_plans from public,anon,authenticated;
grant select,insert,update on public.crm_ad_plans to service_role;
alter table public.crm_ad_campaigns add column plan_id uuid references public.crm_ad_plans(id);
create index crm_ad_campaigns_plan on public.crm_ad_campaigns(plan_id);
create function public.crm_ad_plan_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if new.state <> 'draft' or new.approved_by is not null or new.approved_at is not null then raise exception 'AD_APPROVAL'; end if;
 else
  if new.payload is distinct from old.payload or new.strategy is distinct from old.strategy or new.content_hash <> old.content_hash or new.catalog_hash <> old.catalog_hash then raise exception 'AD_PLAN_IMMUTABLE'; end if;
  if not ((old.state='draft' and new.state in ('approved','cancelled')) or (old.state='approved' and new.state='cancelled')) then raise exception 'AD_STATE'; end if;
  if old.state='approved' and (new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at) then raise exception 'AD_APPROVAL'; end if;
 end if;
 return new;
end $$;
create trigger crm_ad_plan_guard before insert or update on public.crm_ad_plans for each row execute function public.crm_ad_plan_guard();
create function public.crm_ad_budget_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.crm_ad_plans; allocated numeric; daily_allocated numeric; total numeric; daily numeric;
begin
 if TG_OP='UPDATE' and new.plan_id is distinct from old.plan_id then raise exception 'AD_PLAN_IMMUTABLE'; end if;
 if new.payload->>'channel' not in ('meta_ads','google_ads') then return new; end if;
 if TG_OP='UPDATE' and new.state not in ('approved','executing') then return new; end if;
 if new.plan_id is null then raise exception 'AD_PLAN'; end if;
 -- Serialize allocations across all processes and channels, not only this server.
 select * into p from public.crm_ad_plans where id=new.plan_id for update;
 if not found or p.state <> 'approved' or p.approved_by is null or p.payload->>'courseTitle' <> new.payload->>'courseTitle' or not ((p.payload->'channels') ? (new.payload->>'channel')) or p.catalog_hash <> new.catalog_hash then raise exception 'AD_PLAN'; end if;
 total := (new.payload->>'totalBudgetDop')::numeric; daily := (new.payload->>'dailyBudget')::numeric;
 if total is null or daily is null or total <= 0 or daily <= 0 or daily > total then raise exception 'AD_BUDGET'; end if;
 if TG_OP='INSERT' then
  select coalesce(sum((payload->>'totalBudgetDop')::numeric),0), coalesce(sum((payload->>'dailyBudget')::numeric),0)
  into allocated,daily_allocated from public.crm_ad_campaigns where plan_id=new.plan_id and state <> 'rejected';
  if allocated + total > (p.payload->>'totalBudgetDop')::numeric or daily_allocated + daily > (p.payload->>'dailyLimitDop')::numeric then raise exception 'AD_BUDGET'; end if;
 end if;
 return new;
end $$;
create trigger crm_ad_budget_guard before insert or update on public.crm_ad_campaigns for each row execute function public.crm_ad_budget_guard();
revoke all on function public.crm_ad_plan_guard(),public.crm_ad_budget_guard() from public,anon,authenticated;
grant execute on function public.crm_ad_plan_guard(),public.crm_ad_budget_guard() to service_role;
