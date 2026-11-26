// Produce a transaction-only database verification script. It never commits or publishes.
// Usage: node --import tsx scripts/verify-operations-calendar.ts /path/to/catalog.txt > /tmp/verify.sql
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
declare before_hash text; after_hash text; inserted integer; destinations jsonb; test_case_id uuid:=gen_random_uuid(); journal_id uuid:=gen_random_uuid();
 plan jsonb := $plan$${JSON.stringify(jobs)}$plan$::jsonb;
begin
 select md5(string_agg(to_jsonb(j)::text,'|' order by id)) into before_hash from public.crm_community_jobs j where state in('published','uploaded_private','review_required');
 select s.destinations into destinations from public.crm_community_settings s where id='inteca';
 inserted:=public.crm_community_roll_plan_v8(plan,destinations,'${day}','${catalog.hash}');
 if inserted<>22 then raise exception 'TEST_INSERT_COUNT_%',inserted;end if;
 if public.crm_community_roll_plan_v8(plan,destinations,'${day}','${catalog.hash}')<>0 then raise exception 'TEST_NOT_IDEMPOTENT';end if;
 if exists(select 1 from public.crm_community_jobs where state='queued' and slot not like '%:editorial-v8') then raise exception 'TEST_OLD_QUEUED';end if;
 if exists(select 1 from public.crm_community_jobs n join public.crm_community_jobs old on old.channel=n.channel and old.scheduled_at=n.scheduled_at and old.payload->>'kind'=n.payload->>'kind' where n.slot like '%:editorial-v8' and old.slot not like '%:editorial-v8' and old.state in('published','uploaded_private','preparing','executing','review_required') and n.state<>'missed') then raise exception 'TEST_DUPLICATE_EXTERNAL_SLOT';end if;
 select md5(string_agg(to_jsonb(j)::text,'|' order by id)) into after_hash from public.crm_community_jobs j where state in('published','uploaded_private','review_required');
 if before_hash is distinct from after_hash then raise exception 'TEST_HISTORY_CHANGED';end if;
 if public.crm_community_roll_plan_v7(plan,destinations,'${day}','${catalog.hash}')<>0 then raise exception 'TEST_LEGACY_DOWNGRADE';end if;
 if not exists(select 1 from public.crm_community_calendar_state where id='inteca' and creative_version='v8') then raise exception 'TEST_VERSION_DOWNGRADE';end if;
 if not exists(select 1 from public.crm_save_commercial_case('org_qa_transaction',test_case_id,0,'{"stage":"prospect"}'::jsonb,'test',false)) then raise exception 'TEST_PORTFOLIO_CREATE';end if;
 if exists(select 1 from public.crm_save_commercial_case('org_qa_other',test_case_id,1,'{"stage":"qualified"}'::jsonb,'test',false)) then raise exception 'TEST_COMPANY_SCOPE';end if;
 if exists(select 1 from public.crm_save_commercial_case('org_qa_transaction',test_case_id,1,'{"stage":"won"}'::jsonb,'test',false)) then raise exception 'TEST_UNAUTHORIZED_CLOSE';end if;
 if not exists(select 1 from public.crm_save_commercial_case('org_qa_transaction',test_case_id,1,'{"stage":"won"}'::jsonb,'test',true) where closed_at is not null) then raise exception 'TEST_CLOSE_EVIDENCE';end if;
 if exists(select 1 from public.crm_save_commercial_case('org_qa_transaction',test_case_id,1,'{"stage":"lost"}'::jsonb,'test',true)) then raise exception 'TEST_STALE_WRITE';end if;
 if (select count(*) from public.crm_commercial_portfolio_events where organization_id='org_qa_transaction' and crm_commercial_portfolio_events.case_id=test_case_id)<>2 then raise exception 'TEST_AUDIT';end if;
 perform public.crm_set_commercial_goal('org_qa_transaction','2026-11',13,'test');
 if not exists(select 1 from public.crm_commercial_goals where organization_id='org_qa_transaction' and target=13) then raise exception 'TEST_GOAL';end if;
 if not exists(select 1 from public.crm_accounting_post('org_qa_transaction',jsonb_build_object('requestId',journal_id,'date','${day}','kind','journal','description','Nómina de prueba','evidence','QA-1','lines','[{"account":"6102","debit":"100","credit":"0"},{"account":"2104","debit":"0","credit":"100"}]'::jsonb),'test')) then raise exception 'TEST_PAYROLL';end if;
end $verify$;
rollback;
select 'rollback_verified_calendar_portfolio_and_payroll' as result;`);
