import { growthSummary } from './community-growth.ts';
import type { CatalogStore } from './whatsapp-catalog.ts';
import { hasDiscount, hasUnlistedPrice } from './advertising-agent.ts';
import { makeContent, planMonth, featuredCourseForDate, rdDay, sha, contentHash, communityPublicCopy, SOCIAL_CHANNELS, type SocialChannel, type CommunityPayload } from './community-plan.ts';
import { renderCommunityImage, renderCommunityVideo, storeCommunityAsset } from './community-media.ts';
import type { CommunityPublisher } from './community-publisher.ts';
type Store={request:(r:string,m?:string,b?:unknown)=>Promise<any>};
export type CommunityJob={id:string;slot:string;channel:SocialChannel;state:string;scheduled_at:string;payload:CommunityPayload;content_hash:string;media_url:string|null;result:any;last_error:string|null;updated_at:string};
export class CommunityManager {
  private running=false;
  constructor(private store:Store,private catalog:Pick<CatalogStore,'get'>,private publisher:Pick<CommunityPublisher,'destination'|'verify'|'publish'|'metrics'>){}
  async settings(){return (await this.store.request('crm_community_settings?id=eq.inteca&limit=1'))[0];}
  async snapshot(){const jobs=await this.store.request('crm_community_jobs?order=scheduled_at.asc&limit=1000'),observations=await this.store.request('crm_community_observations?order=checked_at.desc&limit=100');return {settings:await this.settings(),jobs,observations,growth:growthSummary(jobs,observations),scope:'org_inteca_main',capabilities:{flyers:'Flyer diario distinto por diseño, fecha y mensaje. Imagen oficial INTEQUITO si se instala en public/intequito-oficial.png; si falta no se inventa una mascota',verticalVideo:'7 guiones diarios de reels protagonizados por INTEQUITO; sin motor 3D/lip-sync conectado, quedan pendientes de renderizar, no publicados',stories:'La cuota nueva prioriza reels; los formatos existentes se conservan en historial',longVideo:'Un guion diario promocional/informativo, pendiente de animación 3D, voz y revisión',communityReplies:'Optimización de ganchos, preguntas y CTA al 809-643-5502; respuestas públicas requieren integración y permisos',paidPromotion:'Solo propuestas; presupuesto y descuentos requieren aprobación',monthlyRotation:'Un solo curso protagonista por mes, rotación continua de todo el catálogo, una creatividad diaria distinta por fecha',growth:'Ganchos educativos, series, preguntas relevantes y CTA alternados para seguir, guardar, compartir, comentar y visitar el sitio. Se aplican a piezas futuras todavía sin producir.',metrics:'Últimas 20 publicaciones cada 12 horas: interacciones Meta, estadísticas YouTube y seguidores cuando los permisos lo permitan. Visitas web, alcance y retención no se infieren.',continuousOperation:'Mientras Render esté activo; el plan gratuito puede suspenderse'}};}
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
    // Migration is deployed separately. Never destroy legacy plans if calendar v3 is unavailable.
    let record:any;
    try{record=(await this.store.request('crm_community_calendar_state?id=eq.inteca&limit=1'))?.[0];}
    catch{if(settings.plan_started_at)return;throw Error('CM_CALENDAR_MIGRATION_MISSING');}
    if(!record)throw Error('CM_CALENDAR_MIGRATION_MISSING');
    if(record.last_planned_day===today&&record.catalog_hash===catalog.hash)return;
    const destinations=Object.fromEntries(SOCIAL_CHANNELS.map(c=>[c,this.publisher.destination(c)]));
    const jobs=planMonth(catalog,today).map(item=>({
      ...item,
      state:['short','promo_video','long_brief'].includes(item.payload.kind)?'brief':
        new Date(item.scheduled_at)<now?'missed':'queued',
      content_hash:contentHash(item.payload),
    }));
    await this.store.request('rpc/crm_community_roll_plan','POST',{
      p_jobs:jobs,p_destinations:destinations,p_day:today,p_catalog_hash:catalog.hash,
    });
  }
  async retry(id:string){
    // Unknown external outcomes must be reconciled manually, never automatically republished.
    const rows=await this.store.request(`crm_community_jobs?id=eq.${id}&state=eq.blocked`);
    if(!rows.length)throw Error('CM_STATE');
    const candidate=rows[0] as CommunityJob;
    if(!candidate.slot.startsWith('v3:')||candidate.result?.id||candidate.result?.containerId)
      throw Error('CM_LEGACY_OR_UNCERTAIN');
    if(Date.now()-Date.parse(candidate.scheduled_at)>90*60_000)
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
        // Do not flood a channel with a backlog after a prolonged sleep.
        if(Date.now()-Date.parse(row.scheduled_at)>90*60_000){await this.update(row.id,{state:'missed',last_error:'CM_SLOT_MISSED'});continue;}
        let claimed=false,external=false;
        try{
          if(!SOCIAL_CHANNELS.includes(row.channel))throw Error('CM_CHANNEL');
          if(!settings.destinations?.[row.channel]||settings.destinations[row.channel]!==this.publisher.destination(row.channel))throw Error('CM_DESTINATION_CHANGED');
          const catalog=await this.catalog.get();if(!catalog||catalog.hash!==row.payload.catalogHash)throw Error('CM_CATALOG_CHANGED');
          const course=catalog.courses.find(c=>c.title===row.payload.courseTitle);
          if(!course||contentHash(row.payload)!==row.content_hash||hasDiscount(communityPublicCopy(row.payload))||hasUnlistedPrice(communityPublicCopy(row.payload),course.investment))throw Error('CM_CONTENT_REVIEW');
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
