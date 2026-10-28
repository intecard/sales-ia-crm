import { access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { makeContent, rdDay } from './community-plan.ts';
import { renderCommunityImage, storeCommunityAsset } from './community-media.ts';
import type { CatalogStore } from './whatsapp-catalog.ts';
import type { CommunityPublisher } from './community-publisher.ts';

const asset=async(file:string)=>access(path.join(process.cwd(),file)).then(()=>true).catch(()=>false);
const safe=(e:unknown)=>e instanceof Error&&/^CM_[A-Z_0-9]+$/.test(e.message)?e.message:
  (e&&typeof e==='object'&&'code' in e&&(e as any).code==='ENOENT')?'CM_ASSET_MISSING':'CM_DIAGNOSTIC_FAILED';
export class CommunityDiagnostics {
 constructor(private catalog:Pick<CatalogStore,'get'>,private publisher:Pick<CommunityPublisher,'destination'|'verify'>,private env:NodeJS.ProcessEnv=process.env,private fetcher:typeof fetch=fetch){}
 async config(){
  const urls=this.env.SUPABASE_URL;
  const assets=await Promise.all([
    asset('public/inteca-logo.webp'),
    asset('public/creative/call-center.webp'),
    asset('public/creative/nursing.webp'),
    asset('public/creative/pharmacy.webp'),
    asset('public/intequito-oficial.png'),
    access(ffmpeg.path).then(()=>true).catch(()=>false),
  ]);
  const channels=Object.fromEntries(['facebook','instagram','youtube'].map(k=>[k,Boolean(this.publisher.destination(k as any))]));
  let storageStatus:'configured'|'missing_credentials'|'unreachable'|'available'|'unauthorized'|'bucket_missing'='missing_credentials';
  if(urls?.startsWith('https://')&&this.env.SUPABASE_SERVICE_ROLE_KEY){
    storageStatus='configured';
    try{
      const base=new URL(urls);
      const r=await this.fetcher(`${base.origin}/storage/v1/bucket/crm-community`,{
        method:'GET',headers:{
          apikey:this.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization:`Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },redirect:'error',signal:AbortSignal.timeout(8000),
      });
      storageStatus=r.ok?'available':r.status===401||r.status===403?'unauthorized':r.status===404?'bucket_missing':'unreachable';
    }catch{storageStatus='unreachable';}
  }
  return {
    storageStatus,
    assets:{logo:assets[0],callCenter:assets[1],nursing:assets[2],pharmacy:assets[3],intequitoOfficial:assets[4],ffmpeg:assets[5]},
    channelsConfigured:channels,
    reasons:{
      CM_CONNECTION_OR_STORAGE:'Error antiguo genérico; no permite distinguir renderizado, storage o conexión.',
      CM_MEDIA_ASSET_MISSING:'Falta un archivo en el despliegue de Render.',
      CM_IMAGE_RENDER_FAILED:'Fallo al crear el JPEG del flyer.',
      CM_RENDER_FAILED:'Fallo de composición multimedia o FFmpeg.',
      CM_STORAGE_FAILED:'No se pudo guardar el archivo generado.',
      CM_ACCOUNT_VERIFY_FAILED:'La conexión con la red social no pasó la verificación.',
      CM_PUBLISH_UNCERTAIN:'Se llamó a la red social; verificar publicación antes de volver a intentar.',
      CM_SLOT_MISSED:'El servidor estuvo suspendido o fuera de la ventana de publicación (90 minutos).',
      CM_CALENDAR_SUPERSEDED:'Trabajo anterior sustituido por el nuevo calendario mensual.',
    },
  };
 }
 async verifyChannels(){
  const channels=['facebook','instagram','youtube'] as const;
  const result:Record<string,{ok:boolean;code?:string}>={};
  for(const channel of channels){
    try{await this.publisher.verify(channel);result[channel]={ok:true};}
    catch(e){result[channel]={ok:false,code:safe(e)};}
  }
  return result;
 }
 async testRenderAndStorage(){
  const catalog=await this.catalog.get();
  if(!catalog?.courses?.length)throw Error('CM_CATALOG');
  const today=rdDay(new Date());
  const payload=makeContent(catalog.courses[0],catalog,today,'flyer',77);
  const bytes=await renderCommunityImage(payload);
  const sha=createHash('sha256').update(bytes).digest('hex');
  // A diagnostic image is never published to Meta or YouTube.
  // Deliberately use a new deterministic key for each day to avoid accidental overwrites.
  const key=createHash('sha256').update('CM_DIAGNOSTIC_V3_'+today).digest('hex').slice(0,32);
  const url=await storeCommunityAsset(key,bytes,false,this.env,this.fetcher);
  return {imageBytes:bytes.length,sha256:sha,stored:true,publicAssetUrl:url,
          message:'Imagen creada y almacenada; NO enviada a ninguna red social.'};
 }
}
