// Produce a transaction-only database verification script. It never commits or publishes.
// Usage: node --import tsx scripts/verify-editorial-calendar.ts /path/to/catalog.txt > /tmp/verify.sql
import {readFile} from 'node:fs/promises';
import {parseCatalog} from '../whatsapp-catalog.ts';
import {planMonth,contentHash,rdDay} from '../community-plan.ts';
import {diversifyPlan} from '../community-editorial-history.ts';
const catalog=parseCatalog(await readFile(process.argv[2],'utf8'));
const day=rdDay(new Date());
const jobs=diversifyPlan(planMonth(catalog,day),[],catalog).slice(0,22).map(j=>({slot:j.slot,channel:j.channel,scheduled_at:j.scheduled_at,payload:j.payload,content_hash:contentHash(j.payload),state:j.payload.kind==='avatar_video'?'brief':'queued'}));
console.log(`begin;
set local lock_timeout='5s';
set local statement_timeout='15s';
do $verify$
declare before_hash text; after_hash text; inserted integer; destinations jsonb;
 plan jsonb := $plan$${JSON.stringify(jobs)}$plan$::jsonb;
begin
 select md5(string_agg(to_jsonb(j)::text,'|' order by id)) into before_hash from public.crm_community_jobs j where state in('published','uploaded_private','review_required');
 select s.destinations into destinations from public.crm_community_settings s where id='inteca';
 inserted:=public.crm_community_roll_plan_v7(plan,destinations,'${day}','${catalog.hash}');
 if inserted<>22 then raise exception 'TEST_INSERT_COUNT_%',inserted;end if;
 if public.crm_community_roll_plan_v7(plan,destinations,'${day}','${catalog.hash}')<>0 then raise exception 'TEST_NOT_IDEMPOTENT';end if;
 if exists(select 1 from public.crm_community_jobs where state='queued' and slot not like '%:editorial-v7') then raise exception 'TEST_OLD_QUEUED';end if;
 if exists(select 1 from public.crm_community_jobs n join public.crm_community_jobs old on old.channel=n.channel and old.scheduled_at=n.scheduled_at and old.payload->>'kind'=n.payload->>'kind' where n.slot like '%:editorial-v7' and old.slot not like '%:editorial-v7' and old.state in('published','uploaded_private','preparing','executing','review_required') and n.state<>'missed') then raise exception 'TEST_DUPLICATE_EXTERNAL_SLOT';end if;
 select md5(string_agg(to_jsonb(j)::text,'|' order by id)) into after_hash from public.crm_community_jobs j where state in('published','uploaded_private','review_required');
 if before_hash is distinct from after_hash then raise exception 'TEST_HISTORY_CHANGED';end if;
 if public.crm_community_roll_plan(plan,destinations,'${day}','${catalog.hash}')<>0 then raise exception 'TEST_LEGACY_DOWNGRADE';end if;
 if not exists(select 1 from public.crm_community_calendar_state where id='inteca' and creative_version='v7') then raise exception 'TEST_VERSION_DOWNGRADE';end if;
end $verify$;
rollback;
select 'rollback_verified_no_publications_sent' as result;`);
