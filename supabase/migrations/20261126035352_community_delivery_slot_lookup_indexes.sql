-- Support both branches of the slot protection check used by the rolling planner.
-- Partial indexes cover only delivery states that can prevent a replacement.
create index if not exists crm_community_occupied_delivery_slot
 on public.crm_community_jobs(channel, (payload->>'kind'), scheduled_at)
 where state in('published','uploaded_private','preparing','executing','review_required');
create index if not exists crm_community_occupied_flyer_day
 on public.crm_community_jobs(channel, (payload->>'kind'), ((scheduled_at at time zone 'America/Santo_Domingo')::date), (coalesce(payload->>'editorialSlot','morning')))
 where state in('published','uploaded_private','preparing','executing','review_required');
