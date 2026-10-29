import { growthSummary } from './community-growth.ts';
import type { CatalogStore } from './whatsapp-catalog.ts';
import { hasDiscount, hasUnlistedPrice } from './advertising-agent.ts';
import { makeContent, planMonth, rdDay, sha, contentHash, communityPublicCopy, SOCIAL_CHANNELS, type SocialChannel, type CommunityPayload } from './community-plan.ts';
import { renderCommunityImage, renderCommunityVideo, storeCommunityAsset } from './community-media.ts';
import { isPublishableFlyer, flyerOffer } from './community-flyer-offer.ts';
import {courseFamily} from './community-course-topics.ts';
import type { CommunityPublisher } from './community-publisher.ts';
type Store={request:(r:string,m?:string,b?:unknown)=>Promise<any>};
export type CommunityJob={id:string;slot:string;channel:SocialChannel;state:string;scheduled_at:string;payload:CommunityPayload;content_hash:string;media_url:string|null;result:any;last_error:string|null;updated_at:string};
/** Allow a modest 2-hour delivery window for each of the 9am and 5pm
 * flyers when Render Free is waking. NEVER mass-post the morning job at night
 * or replay flyers from previous local dates.
 */
export function shouldMissCampaignSlot(row:Pick<CommunityJob,'scheduled_at'|'payload'>,now:Date):boolean{
  const at=Date.parse(row.scheduled_at);
  if(!Number.isFinite(at))return true;
  if(row.payload.kind==='flyer')return rdDay(new Date(at))!==rdDay(now)||now.getTime()-at>2*60*60_000;
  return now.getTime()-at>90*60_000;
}
export class CommunityManager {
  private running=false;
  constructor(private store:Store,private catalog:Pick<CatalogStore,'get'>,private publisher:Pick<CommunityPublisher,'destination'|'verify'|'publish'|'metrics'>){}
  async settings(){return (await this.store.request('crm_community_settings?id=eq.inteca&limit=1'))[0];}
  async snapshot(){
    // Display due/next works first instead of hiding them behind years of old archived jobs.
    const since=new Date(Date.now()-24*60*60*1000).toISOString();
    const [upcoming,recent,settings,observations,catalog]=await Promise.all([
      this.store.request(`crm_community_jobs?scheduled_at=gte.${encodeURIComponent(since)}&order=scheduled_at.asc&limit=550`),
      this.store.request('crm_community_jobs?state=in.(published,blocked,review_required,missed)&order=updated_at.desc&limit=120'),
      this.settings(),
      this.store.request('crm_community_observations?order=checked_at.desc&limit=100'),
      this.catalog.get(),
    ]);
    const jobs:Array<CommunityJob>=[...new Map(([] as CommunityJob[]).concat(upcoming,recent).map(j=>[j.id,j])).values()]
      .sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at));
    const day=rdDay(new Date());
    return {
      settings,jobs,observations,growth:growthSummary(jobs,observations),
      featuredCourse:catalog?catalog.courses.find(c=>courseFamily(c.title)==='authorizations')?.title||null:null,
      campaignMonth:day.slice(0,7),
      totalCatalogCourses:catalog?.courses.length||0,
      scope:'org_inteca_main',
      capabilities:{
        flyers:'Dos flyers premium por día: Autorizaciones Médicas a las 09:00 y otro curso del catálogo a las 17:00, ambos con contenido y arte diferentes',
        verticalVideo:'7 guiones diarios de reels con INTEQUITO; solo publicar videos cuando exista un MP4 revisado',
        stories:'Calendario vigente: 2 flyers + 7 guiones de reels + 1 guion de video. Solo se publican videos MP4 realmente producidos y revisados',
        longVideo:'1 guion diario informativo/promocional, sujeto a producción y aprobación',
        communityReplies:'Ganchos y CTA al 809-643-5502; moderación y respuestas públicas requieren permisos',
        paidPromotion:'Solo propuestas; presupuesto y descuentos requieren aprobación',
        monthlyRotation:'Curso fijo de Autorizaciones Médicas por la mañana y alternancia sin repeticiones consecutivas de los otros programas por la tarde',
        growth:'Ganchos educativos, preguntas, seguidores y conversaciones reales, sin interacciones artificiales',
        metrics:'Métricas disponibles de Facebook, Instagram y YouTube, sin estimar valores inexistentes',
        continuousOperation:'Sujeto a disponibilidad de Render, red social y almacenamiento; no garantiza 24/7 con infraestructura Free',
        diagnostics:'Registrar el paso de fallo (cuenta, render, storage o API) en lugar de error genérico',
      }
    };
  }
  async observe(){
    if(this.running)return;
    try{const s=await this.settings();if(!s?.enabled||s.metrics_checked_at&&Date.now()-Date.parse(s.metrics_checked_at)<12*3600000)return;
      const posts:CommunityJob[]=await this.store.request('crm_community_jobs?state=eq.published&order=scheduled_at.desc&limit=20');
      if(!posts.length)return;
      await this.store.request('crm_community_settings?id=eq.inteca','PATCH',{metrics_checked_at:new Date().toISOString()});
      for(const post of posts){if(!post.result.id)continue;try{const metrics=await this.publisher.metrics(post.channel,post.result.id);await this.store.request('crm_community_observations','POST',{job_id:post.id,metrics,recommendation:post.payload.caption.includes('Sigue a INTECA')?'Medir la evolución de seguidores sin atribuirla automáticamente a esta publicación.':'Comparar vistas e interacciones con otras piezas del mismo formato y tiempo publicado; probar otro gancho antes de proponer pauta.'});}catch{/* Missing metrics stay unavailable; never fabricate zeroes. */}}
    }catch{/* Observation failures cannot trigger external writes. */}
  }
  async setEnabled(enabled:boolean){return this.store.request('crm_community_settings?id=eq.inteca','PATCH',{enabled,updated_at:new Date().toISOString()});}
  async plan(){
    const settings=await this.settings();if(!settings)throw Error('CM_SETTINGS');
    const catalog=await this.catalog.get();if(!catalog)throw Error('CM_CATALOG');
    const now=new Date(),today=rdDay(now);
    // Calendar v5 migration must land before the 9am/5pm plan supersedes unposted v4 tasks.
    let record:any;
    try{record=(await this.store.request('crm_community_calendar_state?id=eq.inteca&limit=1'))?.[0];}
    catch{if(settings.plan_started_at)return;throw Error('CM_CALENDAR_MIGRATION_MISSING');}
    if(!record)throw Error('CM_CALENDAR_MIGRATION_MISSING');
    if(record.last_planned_day===today&&record.catalog_hash===catalog.hash&&record.creative_version==='v5')return;
    const destinations=Object.fromEntries(SOCIAL_CHANNELS.map(c=>[c,this.publisher.destination(c)]));
    const jobs=planMonth(catalog,today).map(item=>{
      const incomplete=item.payload.kind==='flyer'&&
        (!item.payload.flyerOffer||!isPublishableFlyer(item.payload.flyerOffer));
      return {
        ...item,
        state:incomplete?'blocked':
          ['short','promo_video','long_brief'].includes(item.payload.kind)?'brief':
          item.payload.kind==='flyer'?
            (shouldMissCampaignSlot(item,new Date())?'missed':'queued'):
          new Date(item.scheduled_at)<now?'missed':'queued',
        ...(incomplete?{last_error:'CM_FLYER_PRICE_OR_CONTENT_MISSING'}:{}),
        content_hash:contentHash(item.payload),
      };
    });
    await this.store.request('rpc/crm_community_roll_plan','POST',{
      p_jobs:jobs,p_destinations:destinations,p_day:today,p_catalog_hash:catalog.hash,
    });
  }
  async retry(id:string){
    // Unknown external outcomes must be reconciled manually, never automatically republished.
    const rows=await this.store.request(`crm_community_jobs?id=eq.${id}&state=eq.blocked`);
    if(!rows.length)throw Error('CM_STATE');
    const candidate=rows[0] as CommunityJob;
    if(!candidate.slot.startsWith('v5:')||candidate.result?.id||candidate.result?.containerId)
      throw Error('CM_LEGACY_OR_UNCERTAIN');
    if(shouldMissCampaignSlot(candidate,new Date()))
      throw Error('CM_SLOT_MISSED');
    const settings=await this.settings();if(!settings.enabled)throw Error('CM_PAUSED');
    await this.store.request(`crm_community_jobs?id=eq.${id}&state=eq.blocked`,'PATCH',{state:'queued',last_error:null,scheduled_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  }
  async tick(){
    if(this.running)return;this.running=true;
    try{
      let settings=await this.settings();if(!settings?.enabled)return;
      await this.plan();settings=await this.settings();
      // Crash recovery retains an uncertain outcome for human reconciliation.
      await this.store.request(`crm_community_jobs?state=in.(preparing,executing)&updated_at=lt.${encodeURIComponent(new Date(Date.now()-10*60_000).toISOString())}`,'PATCH',{state:'review_required',last_error:'CM_INTERRUPTED_REVIEW',updated_at:new Date().toISOString()});
      const now=new Date().toISOString();
      const rows:CommunityJob[]=await this.store.request(`crm_community_jobs?state=eq.queued&scheduled_at=lte.${encodeURIComponent(now)}&order=scheduled_at.asc&limit=12`);
      for(const row of rows){
        let phase='validate';
        // For a daily flyer, preserve the opportunity to publish later on the SAME
        // Dominican calendar day after Render Free wakes up. Never flood past days.
        if(shouldMissCampaignSlot(row,new Date())){
          await this.update(row.id,{state:'missed',last_error:'CM_SLOT_MISSED'});
          continue;
        }
        let claimed=false,external=false;
        try{
          if(!SOCIAL_CHANNELS.includes(row.channel))throw Error('CM_CHANNEL');
          if(!settings.destinations?.[row.channel]||settings.destinations[row.channel]!==this.publisher.destination(row.channel))throw Error('CM_DESTINATION_CHANGED');
          const catalog=await this.catalog.get();if(!catalog||catalog.hash!==row.payload.catalogHash)throw Error('CM_CATALOG_CHANGED');
          const course=catalog.courses.find(c=>c.title===row.payload.courseTitle);
          if(!course||contentHash(row.payload)!==row.content_hash||hasDiscount(communityPublicCopy(row.payload))||hasUnlistedPrice(communityPublicCopy(row.payload),course.investment))throw Error('CM_CONTENT_REVIEW');
          if(row.payload.kind==='flyer'){
            const slot=row.payload.editorialSlot;
            const type=courseFamily(course.title);
            if(!row.slot.startsWith('v5:')||!slot||
               (slot==='morning'&&type!=='authorizations')||
               (slot==='afternoon'&&type==='authorizations')||
               !row.payload.flyerOffer||!isPublishableFlyer(row.payload.flyerOffer))
               throw Error('CM_FLYER_COURSE_MISMATCH');
            const expected=flyerOffer(course,row.payload.editorialDate||rdDay(new Date(row.scheduled_at)),
              slot==='afternoon'?1:0);
            const actual=row.payload.flyerOffer;
            if(actual.course!==course.title||actual.family!==expected.family||
               actual.focus!==expected.focus||actual.hook!==expected.hook||
               actual.registration!==expected.registration||actual.monthly!==expected.monthly||
               actual.duration!==expected.duration||
               JSON.stringify(actual.benefits)!==JSON.stringify(expected.benefits))
               throw Error('CM_FLYER_COURSE_MISMATCH');
          }
          // Identity must be valid before generating or sending anything to this channel.
          phase='verify';
          await this.publisher.verify(row.channel);
          const locks=await this.store.request(`crm_community_jobs?id=eq.${row.id}&state=eq.queued`,'PATCH',{state:'preparing',updated_at:new Date().toISOString()});if(!locks.length)continue;claimed=true;
          // Upgrade only a claimed, unproduced piece. Published, uncertain and rendered jobs remain unchanged.
          if(!row.media_url&&!row.result?.id&&!row.result?.containerId&&!row.payload.caption.includes('utm_campaign=lisa_crecimiento')){
            const date=rdDay(new Date(row.scheduled_at));const variant=Number(row.slot.split(':')[2])||0;
            row.payload=makeContent(course,catalog,date,row.payload.kind,variant);
            row.content_hash=contentHash(row.payload);
            await this.update(row.id,{payload:row.payload,content_hash:row.content_hash});
          }
          phase='render';
          let mediaUrl=row.media_url;
          if(!mediaUrl){
            // Reuse already produced media for the same original piece across platforms.
            const siblings=await this.store.request(`crm_community_jobs?payload->>assetKey=eq.${row.payload.assetKey}&media_url=not.is.null&limit=1`);
            mediaUrl=siblings[0]?.media_url||null;
            if(!mediaUrl){const video=row.payload.kind==='short';const bytes=video?await renderCommunityVideo(row.payload):await renderCommunityImage(row.payload);phase='storage';mediaUrl=await storeCommunityAsset(row.payload.assetKey,bytes,video);}
            await this.update(row.id,{media_url:mediaUrl});
          }
          const active=await this.settings();if(!active.enabled||sha(active.destinations)!==sha(settings.destinations))throw Error('CM_PAUSED');
          const fresh=await this.catalog.get();if(fresh?.hash!==row.payload.catalogHash)throw Error('CM_CATALOG_CHANGED');
          phase='publish';
          await this.update(row.id,{state:'executing'});external=true;
          const result=await this.publisher.publish(row.channel,row.payload,mediaUrl!,async id=>{await this.update(row.id,{result:{containerId:id}});});
          await this.update(row.id,{state:result.state,result,last_error:null});
        }catch(e){
          const raw=e instanceof Error?e.message:'';
          const reason=/^CM_[A-Z_0-9]+$/.test(raw)?raw:
            (e&&typeof e==='object'&&'code' in e&&(e as any).code==='ENOENT')?'CM_MEDIA_ASSET_MISSING':
            phase==='verify'?'CM_ACCOUNT_VERIFY_FAILED':
            phase==='render'?'CM_RENDER_FAILED':
            phase==='storage'?'CM_STORAGE_FAILED':
            phase==='publish'?'CM_PUBLISH_UNCERTAIN':'CM_VALIDATION_FAILED';
          // Safe diagnostic codes/phase only; never log tokens or arbitrary upstream error bodies.
          console.warn('community_manager_job_failed',JSON.stringify({jobId:row.id,channel:row.channel,phase,reason,uncertainExternalOutcome:external}));
          await this.store.request(`crm_community_jobs?id=eq.${row.id}&state=in.(${external?'executing':claimed?'preparing':'queued'})`,'PATCH',{
            state:external?'review_required':'blocked',last_error:reason,updated_at:new Date().toISOString(),
          }).catch(()=>{});
        }
        // At most one externally eligible job per tick; blocked channels do not stop others.
        if(claimed)break;
      }
    }catch{/* Fail closed on unavailable storage; no publication without durable state. */}
    finally{this.running=false;}
  }
  private update(id:string,value:Record<string,unknown>){return this.store.request(`crm_community_jobs?id=eq.${id}`,'PATCH',{...value,updated_at:new Date().toISOString()});}
}
