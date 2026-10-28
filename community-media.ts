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
export const editorialVisualSignature=(p:CommunityPayload)=>`${p.editorialDate||'legacy'}:${p.designSeed??0}:${p.assetKey}`;
const colors=[
 ['#06223f','#01c4c9','#053e5a'],
 ['#131e47','#62cfee','#243a7e'],
 ['#052b38','#37d6a4','#12615d'],
 ['#2a1e4b','#9fb3ff','#453375'],
 ['#0a2a45','#ffbc74','#16486a'],
 ['#172c3f','#87e0cf','#205769'],
 ['#062e50','#61c4ff','#145b86'],
 ['#152d46','#b2e889','#44604a'],
 ['#161d44','#f1c2ff','#4a336f'],
 ['#002d3d','#60e0e3','#125363'],
 ['#151f3a','#b4d2ff','#2b4871'],
 ['#133143','#ebc89e','#326675'],
] as const;
/** Deterministic visual variety: every day produces a different actual JPEG,
 * not merely a different filename for the same pixels.
 * If INTEQUITO's official PNG is not installed, render the branded flyer without
 * inventing or replacing the character; report missing reference separately.
 */
export async function renderCommunityImage(p:CommunityPayload,slide?:number) {
 const photoName=/farmac|farmacia|visitador/i.test(p.courseTitle)?'pharmacy':/enfermer|promotor.*salud/i.test(p.courseTitle)?'nursing':'call-center';
 const [photo,logo,intequito]=await Promise.all([
   readFile(path.join(process.cwd(),`public/creative/${photoName}.webp`)),
   readFile(path.join(process.cwd(),'public/inteca-logo.webp')),
   readFile(path.join(process.cwd(),'public/intequito-oficial.png')).catch((error:NodeJS.ErrnoException)=>{
     if(error.code==='ENOENT')return null;throw error;
   }),
 ]);
 const seed=p.designSeed??(Number.parseInt(p.assetKey.slice(0,5),16)||0);
 const [bg,accent,deep]=colors[((seed%colors.length)+colors.length)%colors.length];
 const hero=await sharp(photo).resize(760,480,{fit:'cover',position:(seed%2?'attention':'centre')}).jpeg({quality:83}).toBuffer();
 const logoPng=await sharp(logo).resize(115,115,{fit:'inside'}).png().toBuffer();
 const mascotPng=intequito?await sharp(intequito).resize(230,350,{fit:'inside'}).png().toBuffer():null;
 const date=p.editorialDate||'';
 const displayDate=/^\\d{4}-\\d{2}-\\d{2}$/.test(date)?new Intl.DateTimeFormat('es-DO',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)):`Serie ${p.assetKey.slice(0,8)}`;
 const topic=slide===undefined?p.slides[0]:(p.slides[slide]||p.slides[0]);
 const details=slide===undefined?p.slides[1]:(p.slides[slide]||p.slides[1]);
 const headline=lines(topic,32).slice(0,3);
 const course=lines(p.courseTitle,29).slice(0,3);
 const content=lines(details,37).slice(0,9);
 const layout=(seed%3);
 const photoX=layout===1?35:0,photoY=layout===2?140:0;
 const signature=editorialVisualSignature(p);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">
 <defs><linearGradient id="bg" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="${deep}"/></linearGradient></defs>
 <rect width="720" height="1280" fill="url(#bg)"/>
 <path d="M-65 500 Q300 ${480+(seed%5)*17} 810 350 L810 555 Q220 650 -80 585Z" fill="${accent}" opacity=".16"/>
 <image href="data:image/jpeg;base64,${hero.toString('base64')}" x="${photoX}" y="${photoY}" width="760" height="480" opacity=".8"/>
 <rect x="0" y="0" width="720" height="480" fill="${bg}" opacity=".24"/>
 <rect x="0" y="345" width="720" height="180" fill="${bg}" opacity=".93"/>
 <image href="data:image/png;base64,${logoPng.toString('base64')}" x="572" y="22" width="115" height="115"/>
 ${mascotPng?`<image href="data:image/png;base64,${mascotPng.toString('base64')}" x="475" y="120" width="230" height="350"/>`:''}
 <rect x="30" y="25" width="335" height="45" rx="12" fill="${accent}"/>
 <text x="45" y="55" fill="${bg}" font-size="23" font-family="DejaVu Sans" font-weight="bold">INTECA · FORMACIÓN</text>
 <text x="35" y="400" fill="${accent}" font-size="24" font-family="DejaVu Sans" font-weight="bold">PROGRAMA DEL MES · ${escape((p.campaignMonth||date.slice(0,7)||'INTECA').toUpperCase())}</text>
 ${headline.map((s,i)=>`<text x="35" y="${455+i*34}" fill="#ffffff" font-size="26" font-family="DejaVu Sans" font-weight="bold">${escape(s)}</text>`).join('')}
 <rect x="26" y="575" width="668" height="500" rx="25" fill="#ffffff" opacity=".09"/>
 <rect x="34" y="592" width="10" height="150" rx="5" fill="${accent}"/>
 <text x="58" y="622" fill="${accent}" font-size="22" font-family="DejaVu Sans">TU FORMACIÓN EN INTECA</text>
 ${course.map((s,i)=>`<text x="58" y="${670+i*42}" fill="white" font-size="30" font-weight="bold" font-family="DejaVu Sans">${escape(s)}</text>`).join('')}
 ${content.map((s,i)=>`<text x="58" y="${805+i*26}" fill="#e7f6ff" font-size="21" font-family="DejaVu Sans">${escape(s)}</text>`).join('')}
 <rect x="29" y="1093" width="662" height="126" rx="20" fill="${accent}"/>
 <text x="360" y="1136" text-anchor="middle" fill="${bg}" font-size="23" font-weight="bold" font-family="DejaVu Sans">SOLICITA INFORMACIÓN POR WHATSAPP</text>
 <text x="360" y="1183" text-anchor="middle" fill="${bg}" font-size="37" font-weight="bold" font-family="DejaVu Sans">809-643-5502</text>
 <text x="36" y="1250" fill="#dce9f3" font-size="17" font-family="DejaVu Sans">${escape(displayDate)} · ${escape(signature.slice(-8))}</text>
 </svg>`;
 try{return await sharp(Buffer.from(svg)).jpeg({quality:89}).toBuffer();}
 catch(e){throw new Error('CM_IMAGE_RENDER_FAILED',{cause:e});}
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
  if(!response.ok&&response.status!==409){const body=await response.json().catch(()=>({}));if(body.statusCode!=='409'&&body.error!=='Duplicate')throw Error(`CM_STORAGE_HTTP_${response.status}`);}
  return `${base.origin}/storage/v1/object/public/${bucket}/${file}`;
}
