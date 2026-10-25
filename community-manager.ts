import type { CatalogStore } from './whatsapp-catalog.ts';
import { hasDiscount, hasUnlistedPrice } from './advertising-agent.ts';
import { planMonth, rdDay, sha, contentHash, SOCIAL_CHANNELS, type SocialChannel, type CommunityPayload } from './community-plan.ts';
import { renderCommunityImage, renderCommunityVideo, storeCommunityAsset } from './community-media.ts';
import type { CommunityPublisher } from './community-publisher.ts';
type Store={request:(r:string,m?:string,b?:unknown)=>Promise<any>};
export type CommunityJob={id:string;slot:string;channel:SocialChannel;state:string;scheduled_at:string;payload:CommunityPayload;content_hash:string;media_url:string|null;result:any;last_error:string|null;updated_at:string};
export class CommunityManager {
  private running=false;
  constructor(private store:Store,private catalog:Pick<CatalogStore,'get'>,private publisher:Pick<CommunityPublisher,'destination'|'verify'|'publish'|'metrics'>){}
  async settings(){return (await this.store.request('crm_community_settings?id=eq.inteca&limit=1'))[0];}
  async snapshot(){return {settings:await this.settings(),jobs:await this.store.request('crm_community_jobs?order=scheduled_at.asc&limit=500'),observations:await this.store.request('crm_community_observations?order=checked_at.desc&limit=100'),scope:'org_inteca_main',capabilities:{flyers:true,verticalVideo:'MP4 de 24 segundos, tres escenas, texto e imágenes; sin narración',stories:'Instagram: tres piezas visuales diarias; sin stickers interactivos',longVideo:'Guion semanal para grabación y revisión humana',communityReplies:'Propuestas en Chat Sales Studio; respuestas públicas y moderación requieren revisión humana',paidPromotion:'Solo propuestas; presupuesto y descuentos requieren aprobación',metrics:'Interacciones de las últimas 20 publicaciones de Meta, cada 12 horas. Alcance, retención y matrículas no se infieren de los me gusta.',continuousOperation:'Mientras Render esté activo; el plan gratuito puede suspenderse'}};}
  async observe(){
    if(this.running)return;
    try{const s=await this.settings();if(!s?.enabled||s.metrics_checked_at&&Date.now()-Date.parse(s.metrics_checked_at)<12*3600000)return;
      const posts:CommunityJob[]=await this.store.request('crm_community_jobs?state=eq.published&order=scheduled_at.desc&limit=20');
      if(!posts.length)return;
      await this.store.request('crm_community_settings?id=eq.inteca','PATCH',{metrics_checked_at:new Date().toISOString()});
      for(const post of posts){if(!post.result.id)continue;try{const metrics=await this.publisher.metrics(post.channel,post.result.id);await this.store.request('crm_community_observations','POST',{job_id:post.id,metrics,recommendation:'Comparar interacciones y consultas verificadas antes de proponer pauta; no aumentar gasto automáticamente.'});}catch{/* Missing metrics stay unavailable; never fabricate zeroes. */}}
    }catch{/* Observation failures cannot trigger external writes. */}
  }
  async setEnabled(enabled:boolean){return this.store.request('crm_community_settings?id=eq.inteca','PATCH',{enabled,updated_at:new Date().toISOString()});}
  async plan(){
    const settings=await this.settings();if(!settings)throw Error('CM_SETTINGS');
    if(settings.plan_started_at)return;
    const catalog=await this.catalog.get();if(!catalog)throw Error('CM_CATALOG');
    const now=new Date(),today=rdDay(now);
    const destinations=Object.fromEntries(SOCIAL_CHANNELS.map(c=>[c,this.publisher.destination(c)]));
    const jobs=planMonth(catalog,today).map(item=>{
      const bootstrap=item.payload.kind==='flyer'&&item.slot.startsWith(today);
      const scheduled_at=bootstrap?now.toISOString():item.scheduled_at;
      return {...item,scheduled_at,state:item.payload.kind==='long_brief'?'brief':new Date(scheduled_at)<now?'missed':'queued',content_hash:contentHash(item.payload)};
    });
    await this.store.request('rpc/crm_community_plan','POST',{p_jobs:jobs,p_destinations:destinations});
  }
  async retry(id:string){
    // Unknown external outcomes must be reconciled manually, never automatically republished.
    const rows=await this.store.request(`crm_community_jobs?id=eq.${id}&state=eq.blocked`);
    if(!rows.length)throw Error('CM_STATE');
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
        // Do not flood a channel with a backlog after a prolonged sleep.
        if(Date.now()-Date.parse(row.scheduled_at)>90*60_000){await this.update(row.id,{state:'missed',last_error:'CM_SLOT_MISSED'});continue;}
        let claimed=false,external=false;
        try{
          if(!SOCIAL_CHANNELS.includes(row.channel))throw Error('CM_CHANNEL');
          if(!settings.destinations?.[row.channel]||settings.destinations[row.channel]!==this.publisher.destination(row.channel))throw Error('CM_DESTINATION_CHANGED');
          const catalog=await this.catalog.get();if(!catalog||catalog.hash!==row.payload.catalogHash)throw Error('CM_CATALOG_CHANGED');
          const course=catalog.courses.find(c=>c.title===row.payload.courseTitle);
          if(!course||contentHash(row.payload)!==row.content_hash||hasDiscount(row.payload)||hasUnlistedPrice(row.payload.caption,course.investment))throw Error('CM_CONTENT_REVIEW');
          // Identity must be valid before generating or sending anything to this channel.
          await this.publisher.verify(row.channel);
          const locks=await this.store.request(`crm_community_jobs?id=eq.${row.id}&state=eq.queued`,'PATCH',{state:'preparing',updated_at:new Date().toISOString()});if(!locks.length)continue;claimed=true;
          let mediaUrl=row.media_url;
          if(!mediaUrl){
            // Reuse already produced media for the same original piece across platforms.
            const siblings=await this.store.request(`crm_community_jobs?payload->>assetKey=eq.${row.payload.assetKey}&media_url=not.is.null&limit=1`);
            mediaUrl=siblings[0]?.media_url||null;
            if(!mediaUrl){const video=row.payload.kind==='short';mediaUrl=await storeCommunityAsset(row.payload.assetKey,video?await renderCommunityVideo(row.payload):await renderCommunityImage(row.payload),video);}
            await this.update(row.id,{media_url:mediaUrl});
          }
          const active=await this.settings();if(!active.enabled||sha(active.destinations)!==sha(settings.destinations))throw Error('CM_PAUSED');
          const fresh=await this.catalog.get();if(fresh?.hash!==row.payload.catalogHash)throw Error('CM_CATALOG_CHANGED');
          await this.update(row.id,{state:'executing'});external=true;
          const result=await this.publisher.publish(row.channel,row.payload,mediaUrl!,async id=>{await this.update(row.id,{result:{containerId:id}});});
          await this.update(row.id,{state:result.state,result,last_error:null});
        }catch(e){const raw=e instanceof Error?e.message:'';const code=/^CM_[A-Z_0-9]+$/.test(raw)?raw:'CM_CONNECTION_OR_STORAGE';await this.store.request(`crm_community_jobs?id=eq.${row.id}&state=in.(${external?'executing':claimed?'preparing':'queued'})`,'PATCH',{state:external?'review_required':'blocked',last_error:code,updated_at:new Date().toISOString()}).catch(()=>{});}
        // At most one externally eligible job per tick; blocked channels do not stop others.
        if(claimed)break;
      }
    }catch{/* Fail closed on unavailable storage; no publication without durable state. */}
    finally{this.running=false;}
  }
  private update(id:string,value:Record<string,unknown>){return this.store.request(`crm_community_jobs?id=eq.${id}`,'PATCH',{...value,updated_at:new Date().toISOString()});}
}
