import {renderEditorialImage} from './community-editorial-renderer.ts';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import type { CommunityPayload } from './community-plan.ts';
import { renderINTECAFlyer } from './community-flyer-renderer.ts';
const exec = promisify(execFile);
export const editorialVisualSignature=(p:CommunityPayload)=>`${p.editorialDate||'legacy'}:${p.designSeed??0}:${p.assetKey}`;
export async function renderCommunityImage(p:CommunityPayload,slide=0,assetRoot=process.cwd()) {
 if(p.kind==='flyer')return renderINTECAFlyer(p,assetRoot);
 return renderEditorialImage(p,slide);
}
export async function renderCommunityVideo(p:CommunityPayload) {
  const dir=await mkdtemp(path.join(tmpdir(),'crm-lisa-'));
  try {
    for(let i=0;i<3;i++)await writeFile(path.join(dir,`${i}.jpg`),await renderCommunityImage(p,i));
    const output=path.join(dir,'short.mp4');
    await exec(ffmpeg.path,['-y','-framerate','1/8','-i',path.join(dir,'%d.jpg'),'-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100','-t','24','-c:v','libx264','-preset','veryfast','-threads','1','-r','30','-pix_fmt','yuv420p','-c:a','aac','-max_muxing_queue_size','4096','-shortest','-movflags','+faststart',output],{timeout:120000,maxBuffer:1024*1024});
    return await readFile(output);
  } finally {await rm(dir,{recursive:true,force:true});}
}
export function communityAssetUrl(key:string,video:boolean,env=process.env) {
  const base=new URL(env.SUPABASE_URL||'');if(base.protocol!=='https:')throw Error('CM_STORAGE');
  return `${base.origin}/storage/v1/object/public/crm-community/${key}.${video?'mp4':'jpg'}`;
}
export async function storeCommunityAsset(key:string,data:Buffer,video:boolean,env=process.env,fetcher=fetch) {
  const base=new URL(env.SUPABASE_URL||'');if(base.protocol!=='https:')throw Error('CM_STORAGE');
  const file=`${key}.${video?'mp4':'jpg'}`,bucket='crm-community';
  const response=await fetcher(`${base.origin}/storage/v1/object/${bucket}/${file}`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY||'',Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY||''}`,'Content-Type':video?'video/mp4':'image/jpeg','x-upsert':'false'},body:new Uint8Array(data),signal:AbortSignal.timeout(30000)});
  // A deterministic asset may already exist after a process restart or for another channel.
  if(!response.ok&&response.status!==409){const body=await response.json().catch(()=>({}));if(body.statusCode!=='409'&&body.error!=='Duplicate')throw Error(`CM_STORAGE_HTTP_${response.status}`);}
  return communityAssetUrl(key,video,env);
}
