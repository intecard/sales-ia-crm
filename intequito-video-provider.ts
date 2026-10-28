/**
 * Proveedor real Runway + ElevenLabs, sin operaciones pagadas implícitas.
 * Las claves se leen SOLO del servidor. No se realizan llamadas pagadas desde
 * el planificador de comunidad ni desde el endpoint de diagnóstico.
 * Los vídeos resultantes exigen QA y edición antes de publicarse.
 */
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Scene } from './intequito-studio.ts';

const RUNWAY = 'https://api.dev.runwayml.com/v1';
const ELEVEN = 'https://api.elevenlabs.io/v1';
const runwayHeaders=(key:string)=>({
  Authorization:`Bearer ${key}`,
  'X-Runway-Version':'2024-11-06',
  'Content-Type':'application/json',
});
const json=async(r:Response)=>{
  if(!r.ok)throw Error(`VIDEO_PROVIDER_HTTP_${r.status}`);
  return r.json();
};
export class IntequitoVideoProvider {
  constructor(private env:NodeJS.ProcessEnv=process.env,private fetcher:typeof fetch=fetch){}
  async status(){
    const referencePath=path.join(process.cwd(),'public/intequito-oficial.png');
    const referencePresent=await access(referencePath).then(()=>true).catch(()=>false);
    const runwayConfigured=Boolean(this.env.RUNWAYML_API_SECRET?.trim());
    const elevenConfigured=Boolean(this.env.ELEVENLABS_API_KEY?.trim()&&this.env.INTEQUITO_VOICE_ID?.trim());
    return {
      provider:'Runway Gen-4.5',
      voiceProvider:'ElevenLabs multilingual v2',
      referencePresent,runwayConfigured,elevenConfigured,
      renderReady:referencePresent&&runwayConfigured&&elevenConfigured,
      automaticSpending:false,
      reason:!referencePresent?'Falta public/intequito-oficial.png':!runwayConfigured?'Falta RUNWAYML_API_SECRET':!elevenConfigured?'Falta ELEVENLABS_API_KEY o INTEQUITO_VOICE_ID':null,
      policy:'Solo inicia generaciones desde una acción aprobada y con presupuesto; los MP4 deben revisarse y almacenarse antes de publicar.',
    };
  }
  private async referenceData(){
    const file=await readFile(path.join(process.cwd(),'public/intequito-oficial.png'));
    if(file.length>5*1024*1024)throw Error('VIDEO_REFERENCE_TOO_LARGE');
    return `data:image/png;base64,${file.toString('base64')}`;
  }
  async createScene(scene:Scene,approval:{confirmed:boolean;maxCreditsApproved:number}){
    if(!approval.confirmed||!Number.isFinite(approval.maxCreditsApproved)||approval.maxCreditsApproved<=0)throw Error('VIDEO_APPROVAL_REQUIRED');
    const {renderReady}=await this.status();
    if(!renderReady)throw Error('VIDEO_PROVIDER_NOT_READY');
    const prompt=[
      'Professional cinematic 3D animation with INTEQUITO from the supplied reference image as the ONLY lead character.',
      'Maintain exact same friendly brown eyes, brown hairstyle, blue headset and microphone, INTECA white and teal polo with its genuine logo, blue jeans and shoes.',
      'Never change the face, hair, branding or proportions; never invent logos or lettering.',
      `Place: ${scene.location}.`,`Physical acting: ${scene.action}.`,
      `Camera: ${scene.camera}.`,
      'Natural walk cycle, facial expression, professional lighting and fluid movement. No on-screen generated text; captions added in postproduction.',
      'Do not use slideshow, zoomed photograph or static scene.',
    ].join(' ').slice(0,1000);
    // Runway may charge upon starting the task. Only an explicitly approved call reaches here.
    // Budget accounting and actual provider credit quote must be validated by the calling controller.
    const r=await this.fetcher(`${RUNWAY}/image_to_video`,{
      method:'POST',headers:runwayHeaders(this.env.RUNWAYML_API_SECRET!),redirect:'error',
      body:JSON.stringify({model:'gen4.5',promptImage:await this.referenceData(),promptText:prompt,ratio:'720:1280',duration:5}),
      signal:AbortSignal.timeout(30000),
    });
    const result=await json(r);
    if(!/^[a-f0-9-]{36}$/i.test(String(result.id||'')))throw Error('VIDEO_TASK_INVALID');
    return {id:String(result.id),status:'PENDING',estimatedCost:result.estimatedCost??null};
  }
  async sceneStatus(id:string){
    if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('VIDEO_TASK_INVALID');
    if(!this.env.RUNWAYML_API_SECRET)throw Error('VIDEO_PROVIDER_NOT_READY');
    const r=await this.fetcher(`${RUNWAY}/tasks/${id}`,{
      headers:runwayHeaders(this.env.RUNWAYML_API_SECRET),redirect:'error',
      signal:AbortSignal.timeout(20000),
    });
    const d=await json(r);
    // Output URLs are ephemeral. They must be imported into private/object storage.
    return {id,status:d.status,output:d.status==='SUCCEEDED'?d.output??[]:[],failure:d.failure??null};
  }
  async synthesize(text:string,approval:{confirmed:boolean}):Promise<Buffer>{
    if(!approval.confirmed)throw Error('VIDEO_APPROVAL_REQUIRED');
    const key=this.env.ELEVENLABS_API_KEY,voice=this.env.INTEQUITO_VOICE_ID;
    if(!key||!voice||!/^[a-zA-Z0-9_-]{8,64}$/.test(voice))throw Error('VIDEO_VOICE_NOT_READY');
    if(!text.trim()||text.length>2000)throw Error('VIDEO_DIALOGUE_INVALID');
    const r=await this.fetcher(`${ELEVEN}/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,{
      method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},
      body:JSON.stringify({text,model_id:'eleven_multilingual_v2'}),
      redirect:'error',signal:AbortSignal.timeout(60000),
    });
    if(!r.ok)throw Error(`VOICE_PROVIDER_HTTP_${r.status}`);
    if(!r.headers.get('content-type')?.includes('audio/'))throw Error('VOICE_PROVIDER_INVALID_AUDIO');
    const bytes=Buffer.from(await r.arrayBuffer());
    if(bytes.length>12*1024*1024)throw Error('VOICE_AUDIO_TOO_LARGE');
    return bytes;
  }
}
