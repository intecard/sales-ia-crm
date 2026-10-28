/**
 * INTEQUITO / INTECA self-hosted video queue.
 * Render runs control plane only. A self-owned GPU worker polls the CRM over HTTPS;
 * no external video API is required. Never mark self-hosted output as published.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { IntequitoReferenceStore } from './intequito-reference-store.ts';
import { contentHash, communityPublicCopy, sha, type CommunityPayload } from './community-plan.ts';
import { hasDiscount, hasUnlistedPrice } from './advertising-agent.ts';
import type { CatalogStore } from './whatsapp-catalog.ts';

type Store={request:(resource:string,method?:string,body?:unknown)=>Promise<any>};
export type LocalVideoJob={
  id:string;community_job_id:string;asset_key:string;script:CommunityPayload['script'];
  catalog_hash:string;state:string;progress:number;worker_id:string|null;
  claim_token:string|null;file_path:string|null;sha256:string|null;
  error_code:string|null;created_at:string;updated_at:string;
};
export const localWorkerTokenValid=(provided:string|undefined,expected:string|undefined)=>{
  if(!expected||expected.length<32||!provided?.startsWith('Bearer '))return false;
  const candidate=provided.slice(7);
  if(candidate.length!==expected.length)return false;
  return timingSafeEqual(Buffer.from(candidate),Buffer.from(expected));
};
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeUuid=(value:string)=>uuidPattern.test(value);
const safeEnv=(env:NodeJS.ProcessEnv)=>Boolean(env.SUPABASE_URL?.startsWith('https://')&&env.SUPABASE_SERVICE_ROLE_KEY&&env.INTECA_LOCAL_VIDEO_WORKER_TOKEN&&env.INTECA_LOCAL_VIDEO_WORKER_TOKEN.length>=32);
const bucket='crm-local-videos';
export class LocalVideoEngine {
  private reference:IntequitoReferenceStore;
  constructor(private store:Store,private catalog:Pick<CatalogStore,'get'>,private env:NodeJS.ProcessEnv=process.env,private fetcher:typeof fetch=fetch){
    this.reference=new IntequitoReferenceStore(store,env,fetcher);
  }
  isConfigured(){return safeEnv(this.env);}
  async status(){
    const configured=this.isConfigured();
    const [reference,storage]=await Promise.all([
      this.reference.referenceStatus(),
      this.reference.storageStatus(),
    ]);
    let settings:any=null;
    let queued=0,rendering=0,ready=0;
    try{
      const [s,jobs]=await Promise.all([
        this.store.request('crm_local_video_settings?id=eq.inteca&limit=1'),
        this.store.request('crm_local_video_jobs?select=state&order=created_at.desc&limit=1000'),
      ]);
      settings=s[0]||null;
      for(const j of jobs){if(j.state==='queued')queued++;if(j.state==='rendering')rendering++;if(j.state==='ready_for_review')ready++;}
    }catch{/* A disconnected database is never presented as available. */}
    const databaseReady=Boolean(settings);
    const storageReady=databaseReady&&storage.videoBucketReady&&storage.referenceBucketReady;
    const seen=settings?.last_worker_seen_at;
    const workerConnected=Boolean(seen&&Date.now()-Date.parse(seen)<5*60_000);
    const referencePresent=reference.referencePresent;
    return {
      provider:'inteca-local',engine:'Wan 2.2 / ComfyUI + Piper + FFmpeg',
      serverReady:configured,referencePresent,referenceSource:reference.source,
      databaseReady,videoBucketReady:storage.videoBucketReady,
      referenceBucketReady:storage.referenceBucketReady,storageReady,
      workerConnected,workerLastSeen:seen||null,
      autoEnabled:settings?.auto_enabled===true,maxDailyCreatives:settings?.max_daily_creatives||8,
      queued,rendering,readyForReview:ready,externalGenerationFees:false,
      readyForProduction:configured&&referencePresent&&storageReady&&workerConnected,
      message:!configured?'Configurar el token privado de la GPU y la conexión de Supabase.':
        !databaseReady?'Verificar migración de la cola local en Supabase.':
        !storageReady?'Comprobar los buckets privados de almacenamiento de referencias y videos.':
        !referencePresent?'Cargar la imagen PNG oficial de INTEQUITO desde este panel.':
        !workerConnected?'El CRM está preparado. Falta conectar una GPU real con ComfyUI, Wan 2.2, Piper y FFmpeg.':
        null,
    };
  }
  async uploadReference(bytes:Buffer){return this.reference.save(bytes);}
  async readReference(){return this.reference.read();}
  async jobs(){
    if(!this.isConfigured())return [];
    return this.store.request('crm_local_video_jobs?order=created_at.desc&limit=100');
  }
  async settings(){return (await this.store.request('crm_local_video_settings?id=eq.inteca&limit=1'))?.[0];}
  async setAutoEnabled(enabled:boolean){
    if(!this.isConfigured())throw Error('LOCAL_NOT_CONFIGURED');
    const s=await this.status();
    if(enabled&&!s.readyForProduction)throw Error('LOCAL_WORKER_NOT_READY');
    const rows=await this.store.request('crm_local_video_settings?id=eq.inteca','PATCH',{auto_enabled:enabled,updated_at:new Date().toISOString()});
    return rows?.[0]||null;
  }
  async enqueue(communityJobId:string):Promise<LocalVideoJob>{
    if(!this.isConfigured())throw Error('LOCAL_NOT_CONFIGURED');
    if(!safeUuid(communityJobId))throw Error('LOCAL_JOB_ID');
    const rows=await this.store.request(`crm_community_jobs?id=eq.${communityJobId}&limit=1`);
    const row=rows?.[0] as {id:string;payload:CommunityPayload;state:string;content_hash:string}|undefined;
    if(!row||row.state!=='brief'||!row.payload?.script||
       row.payload.script.actor!=='INTEQUITO'||!['short','promo_video'].includes(row.payload.kind))throw Error('LOCAL_UNAPPROVED_SCRIPT');
    if(contentHash(row.payload)!==row.content_hash)throw Error('LOCAL_SCRIPT_CHANGED');
    const catalog=await this.catalog.get();
    const course=catalog?.courses.find(c=>c.title===row.payload.courseTitle);
    if(!catalog||catalog.hash!==row.payload.catalogHash||!course||
      hasDiscount(communityPublicCopy(row.payload))||
      hasUnlistedPrice(communityPublicCopy(row.payload),course.investment))throw Error('LOCAL_CATALOG_CHANGED');
    const assetKey=sha(['inteca-selfhosted-v1',row.payload.assetKey]);
    const existing=await this.store.request(`crm_local_video_jobs?asset_key=eq.${assetKey}&limit=1`);
    if(existing?.[0])return existing[0] as LocalVideoJob;
    const inserted=await this.store.request('crm_local_video_jobs','POST',{
      community_job_id:communityJobId,
      asset_key:assetKey,
      script:row.payload.script,
      catalog_hash:catalog.hash,
      state:'queued',progress:0,
    });
    if(!inserted?.[0])throw Error('LOCAL_QUEUE_FAILED');
    return inserted[0] as LocalVideoJob;
  }
  async autoTick(){
    // Do not queue work when disconnected or paused; never backfill old slots after downtime.
    const health=await this.status();
    if(!health.readyForProduction||!health.autoEnabled)return 0;
    const now=new Date();
    const start=new Date(now.getTime()-20*60_000).toISOString();
    const end=new Date(now.getTime()+60*60_000).toISOString();
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const [current,candidates]=await Promise.all([
      this.store.request(`crm_local_video_jobs?created_at=gte.${day}T00:00:00-04:00&select=id&limit=9`),
      this.store.request(`crm_community_jobs?state=eq.brief&scheduled_at=gte.${encodeURIComponent(start)}&scheduled_at=lte.${encodeURIComponent(end)}&order=scheduled_at.asc&limit=60`),
    ]);
    let remaining=Math.max(0,health.maxDailyCreatives-(current?.length||0));
    let queued=0; const seen=new Set<string>();
    for(const candidate of candidates){
      if(!remaining)break;
      const p=candidate.payload as CommunityPayload;
      if(!p?.script||seen.has(p.assetKey))continue;seen.add(p.assetKey);
      try{
        const key=sha(['inteca-selfhosted-v1',p.assetKey]);
        const exists=await this.store.request(`crm_local_video_jobs?asset_key=eq.${key}&limit=1`);
        if(exists?.length)continue;
        await this.enqueue(candidate.id);
        queued++;remaining--;
      }catch{/* Invalid/stale catalog and unique races never cause external publication. */}
    }
    return queued;
  }
  async claim(workerId:string){
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(workerId))throw Error('LOCAL_WORKER_ID');
    const rows=await this.store.request('rpc/crm_local_video_claim','POST',{p_worker_id:workerId});
    const job=rows?.[0] as LocalVideoJob|undefined;
    return job?{id:job.id,script:job.script,claimToken:job.claim_token,engine:'wan2.2-comfyui',output:'mp4'}:null;
  }
  async update(workerJobId:string,claimToken:string,progress:number,errorCode?:string){
    if(!safeUuid(workerJobId)||!safeUuid(claimToken)||!Number.isInteger(progress)||progress<0||progress>99)throw Error('LOCAL_INVALID_PROGRESS');
    const terminal=Boolean(errorCode);
    if(errorCode&&!/^LOCAL_[A-Z0-9_]{2,70}$/.test(errorCode))throw Error('LOCAL_INVALID_ERROR');
    const rows=await this.store.request(`crm_local_video_jobs?id=eq.${workerJobId}&claim_token=eq.${claimToken}&state=eq.rendering`,'PATCH',{
      progress,
      ...(terminal?{state:'failed',error_code:errorCode}:{ }),
      updated_at:new Date().toISOString(),
    });
    if(!rows?.length)throw Error('LOCAL_CLAIM_INVALID');
    return rows[0] as LocalVideoJob;
  }
  async upload(workerJobId:string,claimToken:string,bytes:Buffer){
    if(!safeUuid(workerJobId)||!safeUuid(claimToken))throw Error('LOCAL_CLAIM_INVALID');
    if(bytes.length<1024||bytes.length>70*1024*1024||
       bytes.toString('ascii',4,8)!=='ftyp')throw Error('LOCAL_MP4_INVALID');
    const before=await this.store.request(`crm_local_video_jobs?id=eq.${workerJobId}&claim_token=eq.${claimToken}&state=eq.rendering&limit=1`);
    if(!before?.length)throw Error('LOCAL_CLAIM_INVALID');
    if(!safeEnv(this.env))throw Error('LOCAL_NOT_CONFIGURED');
    const filePath=`rendered/${workerJobId}.mp4`;
    const r=await this.fetcher(`${this.env.SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`,{
      method:'POST',redirect:'error',headers:{
        apikey:this.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization:`Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':'video/mp4','x-upsert':'false',
      },
      body:new Uint8Array(bytes),signal:AbortSignal.timeout(90_000),
    });
    if(!r.ok)throw Error('LOCAL_STORAGE_UPLOAD_UNCERTAIN');
    const digest=createHash('sha256').update(bytes).digest('hex');
    const after=await this.store.request(`crm_local_video_jobs?id=eq.${workerJobId}&claim_token=eq.${claimToken}&state=eq.rendering`,'PATCH',{
      state:'ready_for_review',progress:100,file_path:filePath,sha256:digest,finished_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    });
    if(!after?.length)throw Error('LOCAL_RECORD_FINALIZATION_UNCERTAIN');
    return {id:workerJobId,state:'ready_for_review',sha256:digest};
  }
  async mediaStream(jobId:string){
    if(!safeUuid(jobId)||!safeEnv(this.env))throw Error('LOCAL_JOB_ID');
    const rows=await this.store.request(`crm_local_video_jobs?id=eq.${jobId}&state=eq.ready_for_review&limit=1`);
    if(!rows?.[0]||rows[0].file_path!==`rendered/${jobId}.mp4`)throw Error('LOCAL_NOT_READY');
    const r=await this.fetcher(`${this.env.SUPABASE_URL}/storage/v1/object/${bucket}/rendered/${jobId}.mp4`,{
      headers:{apikey:this.env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`},
      redirect:'error',signal:AbortSignal.timeout(30_000),
    });
    if(!r.ok||!r.body)throw Error('LOCAL_STORAGE_UNAVAILABLE');
    return r;
  }
}
