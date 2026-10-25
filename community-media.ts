import sharp from 'sharp';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import type { CommunityPayload } from './community-plan.ts';
const exec = promisify(execFile);
const escape = (s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function lines(s:string, max=34) { const out:string[]=[];for(const paragraph of s.split('\n')) {let line='';for(const word of paragraph.split(/\s+/)){if((line+' '+word).trim().length>max&&line){out.push(line);line=word;}else line=(line+' '+word).trim();}if(line)out.push(line);}return out; }
export async function renderCommunityImage(p:CommunityPayload, slide?:number) {
  const photoName=/farmac|farmacia|visitador/i.test(p.courseTitle)?'pharmacy':/enfermer|promotor.*salud/i.test(p.courseTitle)?'nursing':'call-center';
  const [photo,logo]=await Promise.all([readFile(path.join(process.cwd(),`public/creative/${photoName}.webp`)),readFile(path.join(process.cwd(),'public/inteca-logo.webp'))]);
  const image=await sharp(photo).resize(720,410,{fit:'cover'}).jpeg().toBuffer();
  const logoPng=await sharp(logo).resize(130,130,{fit:'inside'}).png().toBuffer();
  const title=lines(p.courseTitle,30).slice(0,4);
  const body=lines(slide===undefined?p.slides[1]:p.slides[slide],38).slice(0,11);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><rect width="720" height="1280" fill="#07172e"/><image href="data:image/jpeg;base64,${image.toString('base64')}" width="720" height="410"/><rect y="356" width="720" height="82" fill="#07172e" opacity=".92"/><text x="42" y="405" fill="#55e4df" font-size="25" font-weight="700" font-family="DejaVu Sans">INTECA · FORMACIÓN TÉCNICA</text><image href="data:image/png;base64,${logoPng.toString('base64')}" x="560" y="22" width="130" height="130"/><text x="42" y="483" fill="#55e4df" font-size="22" font-family="DejaVu Sans">${escape(slide===undefined?'CONOCE EL PROGRAMA':slide===0?'QUÉ APRENDERÁS':slide===1?'TU RUTA DE FORMACIÓN':'DA EL SIGUIENTE PASO')}</text>${title.map((s,i)=>`<text x="42" y="${540+i*48}" fill="white" font-size="36" font-weight="700" font-family="DejaVu Sans">${escape(s)}</text>`).join('')}${slide===undefined&&title.length<4?lines(p.slides[0],43).slice(0,title.length===3?1:2).map((s,i)=>`<text x="42" y="${540+title.length*48+28+i*30}" fill="#b8f5ed" font-size="23" font-family="DejaVu Sans">${escape(s)}</text>`).join(''):''}${body.map((s,i)=>`<text x="42" y="${750+i*31}" fill="#dbeafe" font-size="25" font-family="DejaVu Sans">${escape(s)}</text>`).join('')}<rect x="34" y="1120" width="652" height="102" rx="20" fill="#1248b8"/><text x="360" y="1158" text-anchor="middle" fill="white" font-size="24" font-weight="700" font-family="DejaVu Sans">CONSULTA TU INSCRIPCIÓN</text><text x="360" y="1196" text-anchor="middle" fill="white" font-size="27" font-family="DejaVu Sans">inteca.com.do</text><text x="42" y="1256" fill="#9fb3cc" font-size="15" font-family="DejaVu Sans">Imagen ilustrativa · Información sujeta al catálogo vigente</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({quality:90}).toBuffer();
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
export async function storeCommunityAsset(key:string,data:Buffer,video:boolean,env=process.env,fetcher=fetch) {
  const base=new URL(env.SUPABASE_URL||'');if(base.protocol!=='https:')throw Error('CM_STORAGE');
  const file=`${key}.${video?'mp4':'jpg'}`,bucket='crm-community';
  const response=await fetcher(`${base.origin}/storage/v1/object/${bucket}/${file}`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY||'',Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY||''}`,'Content-Type':video?'video/mp4':'image/jpeg','x-upsert':'false'},body:new Uint8Array(data),signal:AbortSignal.timeout(30000)});
  // A deterministic asset may already exist after a process restart or for another channel.
  if(!response.ok&&response.status!==409){const body=await response.json().catch(()=>({}));if(body.statusCode!=='409'&&body.error!=='Duplicate')throw Error('CM_STORAGE');}
  return `${base.origin}/storage/v1/object/public/${bucket}/${file}`;
}
