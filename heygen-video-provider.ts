/**
 * HeyGen Avatar Video v3 integration.
 * Uses INTEQUITO's explicitly configured HeyGen avatar and Spanish voice.
 * Does not create an avatar from a random text prompt or substitute a stock presenter.
 * Calls are paid: only a previously reviewed, explicitly approved production may call createVideo.
 *
 * Documentation: https://developers.heygen.com/reference/create-video
 *                https://developers.heygen.com/reference/get-video
 */
import type { Script } from './intequito-studio.ts';

const BASE='https://api.heygen.com/v3';
const idPattern=/^[A-Za-z0-9_-]{4,128}$/;
const requestPattern=/^[A-Za-z0-9_:.-]{1,255}$/;

export type HeyGenVideoStatus={
  provider:'heygen';
  id:string;
  status:string;
  videoUrl:string|null;
  captionedVideoUrl:string|null;
  subtitleUrl:string|null;
  duration:number|null;
  failure:string|null;
  reviewRequired:boolean;
};

async function safeJson(response:Response){
  if(!response.ok)throw new Error(`HEYGEN_HTTP_${response.status}`);
  const data=await response.json();
  if(!data||typeof data!=='object'||data.error)throw new Error('HEYGEN_PROVIDER_RESPONSE');
  return data;
}

export class HeyGenVideoProvider {
  constructor(private env:NodeJS.ProcessEnv=process.env,private fetcher:typeof fetch=fetch){}
  status(){
    const apiKeyConfigured=Boolean(this.env.HEYGEN_API_KEY?.trim());
    const avatarConfigured=Boolean(this.env.HEYGEN_INTEQUITO_AVATAR_ID?.trim());
    const voiceConfigured=Boolean(this.env.HEYGEN_INTEQUITO_VOICE_ID?.trim());
    return {
      provider:'HeyGen Avatar Video v3',
      apiKeyConfigured,
      avatarConfigured,
      voiceConfigured,
      ready:apiKeyConfigured&&avatarConfigured&&voiceConfigured,
      reason:!apiKeyConfigured?'Falta HEYGEN_API_KEY':!avatarConfigured?'Falta HEYGEN_INTEQUITO_AVATAR_ID (avatar oficial de INTEQUITO)':!voiceConfigured?'Falta HEYGEN_INTEQUITO_VOICE_ID (voz en español)':null,
      automaticSpending:false,
      identity:'Se exige el avatar aprobado de INTEQUITO; no se escoge un avatar genérico.',
    };
  }
  async createVideo(script:Script,approval:{confirmed:boolean;requestId:string}){
    if(approval.confirmed!==true||!requestPattern.test(approval.requestId))throw Error('VIDEO_APPROVAL_REQUIRED');
    if(!this.status().ready)throw Error('HEYGEN_NOT_CONFIGURED');
    if(script.actor!=='INTEQUITO'||!Array.isArray(script.scenes)||!script.scenes.length)throw Error('VIDEO_SCRIPT_INVALID');
    if(!idPattern.test(this.env.HEYGEN_INTEQUITO_AVATAR_ID!)||!idPattern.test(this.env.HEYGEN_INTEQUITO_VOICE_ID!))throw Error('HEYGEN_ID_INVALID');
    const spoken=script.scenes.map(s=>s.dialogue.trim()).filter(Boolean).join(' ');
    if(!spoken||spoken.length>5000)throw Error('VIDEO_SCRIPT_INVALID');
    const payload={
      type:'avatar',
      avatar_id:this.env.HEYGEN_INTEQUITO_AVATAR_ID,
      voice_id:this.env.HEYGEN_INTEQUITO_VOICE_ID,
      title:`INTECA | INTEQUITO | ${script.course}`.slice(0,120),
      script:spoken,
      resolution:'1080p',
      aspect_ratio:'9:16',
      output_format:'mp4',
      caption:{file_format:'srt',style:'default'},
      voice_settings:{locale:'es-DO'},
    };
    const response=await this.fetcher(`${BASE}/videos`,{
      method:'POST',redirect:'error',
      headers:{'x-api-key':this.env.HEYGEN_API_KEY!,'Content-Type':'application/json','Idempotency-Key':approval.requestId},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(30000),
    });
    const data=await safeJson(response);
    const id=String(data.data?.video_id||'');
    if(!idPattern.test(id))throw Error('HEYGEN_VIDEO_ID_MISSING');
    return {provider:'heygen' as const,id,status:String(data.data?.status||'waiting'),reviewRequired:true};
  }
  async getVideo(id:string):Promise<HeyGenVideoStatus>{
    if(!idPattern.test(id))throw Error('HEYGEN_VIDEO_ID_INVALID');
    const key=this.env.HEYGEN_API_KEY;
    if(!key)throw Error('HEYGEN_NOT_CONFIGURED');
    const response=await this.fetcher(`${BASE}/videos/${encodeURIComponent(id)}`,{
      headers:{'x-api-key':key},redirect:'error',signal:AbortSignal.timeout(20000),
    });
    const data=(await safeJson(response)).data;
    if(!data||String(data.id)!==id)throw Error('HEYGEN_VIDEO_ID_MISMATCH');
    const status=String(data.status||'unknown');
    const cleanUrl=(value:unknown)=>typeof value==='string'&&value.startsWith('https://')?value:null;
    return {
      provider:'heygen',id,status,
      videoUrl:status==='completed'?cleanUrl(data.video_url):null,
      captionedVideoUrl:status==='completed'?cleanUrl(data.captioned_video_url):null,
      subtitleUrl:status==='completed'?cleanUrl(data.subtitle_url):null,
      duration:typeof data.duration==='number'?data.duration:null,
      failure:status==='failed'?(String(data.failure_message||data.failure_code||'HeyGen no pudo producir el video.').slice(0,250)):null,
      reviewRequired:true,
    };
  }
}
