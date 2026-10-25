import type { AdvertisingAgent } from './advertising-agent.ts';
import type { SocialChannel, CommunityPayload } from './community-plan.ts';
export class CommunityPublisher {
  constructor(private ads:AdvertisingAgent,private env=process.env,private fetcher:typeof fetch=fetch){}
  destination(channel:SocialChannel){return this.env[channel==='facebook'?'META_PAGE_ID':channel==='instagram'?'INSTAGRAM_BUSINESS_ACCOUNT_ID':'YOUTUBE_CHANNEL_ID']?.trim()||'';}
  async verify(channel:SocialChannel){return this.ads.verify(channel);}
  async metrics(channel:SocialChannel,id:string){
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('CM_ID');
    if(channel==='instagram'){const d=await this.graph(`${id}?fields=like_count,comments_count`);return {likes:typeof d.like_count==='number'?d.like_count:null,comments:typeof d.comments_count==='number'?d.comments_count:null,reach:null,conversions:null};}
    if(channel==='facebook'){const d=await this.graph(`${id}?fields=shares,reactions.limit(0).summary(true),comments.limit(0).summary(true)`);return {shares:typeof d.shares?.count==='number'?d.shares.count:null,reactions:typeof d.reactions?.summary?.total_count==='number'?d.reactions.summary.total_count:null,comments:typeof d.comments?.summary?.total_count==='number'?d.comments.summary.total_count:null,reach:null,conversions:null};}
    return {views:null,reach:null,conversions:null,note:'Consulta Analytics de YouTube; este módulo no tiene un lector de retención conectado.'};
  }
  private async json(url:string,init:RequestInit={}){
    const r=await this.fetcher(url,{...init,redirect:'error',signal:AbortSignal.timeout(60000)});
    if(!r.ok)throw Error(`CM_PROVIDER_${r.status}`);return r.json();
  }
  private graph(resource:string,body?:unknown){
    const version=/^v\d+\.0$/.test(this.env.META_GRAPH_API_VERSION||'')?this.env.META_GRAPH_API_VERSION:'v26.0';
    return this.json(`https://graph.facebook.com/${version}/${resource}`,{headers:{Authorization:`Bearer ${this.env.META_PAGE_ACCESS_TOKEN||''}`,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  }
  async publish(channel:SocialChannel,p:CommunityPayload,url:string,saveContainer:(id:string)=>Promise<void>){
    const media=new URL(url);if(media.origin!==new URL(this.env.SUPABASE_URL||'').origin||!media.pathname.startsWith('/storage/v1/object/public/crm-community/'))throw Error('CM_MEDIA');
    if(channel==='facebook') {
      const video=p.kind==='short';
      const result=await this.graph(`${this.destination(channel)}/${video?'videos':'photos'}`,video?{file_url:url,title:p.title,description:p.caption}:{url,caption:`${p.title}\n\n${p.caption}`,published:true});
      const id=String(result.post_id||result.id||'');if(!/^\d+(?:_\d+)?$/.test(id))throw Error('CM_EXTERNAL_UNKNOWN');
      const link=await this.graph(`${id}?fields=permalink_url`).catch(()=>({}));
      return {id,url:typeof link.permalink_url==='string'?link.permalink_url:null,state:'published'};
    }
    if(channel==='instagram') {
      const video=p.kind==='short';
      const container=await this.graph(`${this.destination(channel)}/media`,{...(video?{media_type:'REELS',video_url:url,share_to_feed:true}:p.kind==='story'?{media_type:'STORIES',image_url:url}:{image_url:url}),...(p.kind!=='story'?{caption:`${p.title}\n\n${p.caption}`.slice(0,2200)}:{})});
      if(!/^\d+$/.test(String(container.id||'')))throw Error('CM_EXTERNAL_UNKNOWN');await saveContainer(String(container.id));
      let ready=false;
      for(let n=0;n<12;n++){
        const status=await this.graph(`${container.id}?fields=status_code`);
        if(status.status_code==='FINISHED'){ready=true;break;}
        if(['ERROR','EXPIRED'].includes(status.status_code))throw Error('CM_PROCESSING_FAILED');
        await new Promise(resolve=>setTimeout(resolve,4000));
      }
      if(!ready)throw Error('CM_PROCESSING_REVIEW');
      const result=await this.graph(`${this.destination(channel)}/media_publish`,{creation_id:container.id});
      if(!result.id)throw Error('CM_EXTERNAL_UNKNOWN');
      const link=await this.graph(`${result.id}?fields=permalink`).catch(()=>({}));
      return {id:String(result.id),url:typeof link.permalink==='string'?link.permalink:null,state:'published'};
    }
    const t=await this.json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:this.env.YOUTUBE_CLIENT_ID||'',client_secret:this.env.YOUTUBE_CLIENT_SECRET||'',refresh_token:this.env.YOUTUBE_REFRESH_TOKEN||''}).toString()});
    if(!t.access_token)throw Error('CM_YOUTUBE_AUTH');
    const r=await this.fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('video/mp4'))throw Error('CM_MEDIA');
    const reader=r.body?.getReader();if(!reader)throw Error('CM_MEDIA');const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20*1024*1024){await reader.cancel();throw Error('CM_MEDIA');}chunks.push(value);}
    const boundary='crm_lisa_video';const metadata={snippet:{title:p.title,description:p.caption,categoryId:'27'},status:{privacyStatus:'public',selfDeclaredMadeForKids:false}};
    const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`),...chunks,Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const result=await this.json('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status&notifySubscribers=false',{method:'POST',headers:{Authorization:`Bearer ${t.access_token}`,'Content-Type':`multipart/related; boundary=${boundary}`},body});
    if(!result.id)throw Error('CM_EXTERNAL_UNKNOWN');
    return {id:String(result.id),state:result.status?.privacyStatus==='public'?'published':'uploaded_private',url:null};
  }
}
