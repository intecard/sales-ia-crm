import express,{Router} from 'express';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { LocalVideoEngine, localWorkerTokenValid } from './local-video-engine.ts';

const uuid=z.string().uuid();
const settingsSchema=z.object({enabled:z.boolean()}).strict();
const queueSchema=z.object({communityJobId:uuid}).strict();
const claimSchema=z.object({workerId:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)}).strict();
const progressSchema=z.object({
  claimToken:uuid,progress:z.number().int().min(0).max(99),
  errorCode:z.string().regex(/^LOCAL_[A-Z0-9_]{2,70}$/).optional(),
}).strict();
const fail=(res:express.Response,code:string,status=409)=>res.status(status).json({error:code});

export function localVideoAdminRouter(engine:LocalVideoEngine){
  const router=Router();
  router.get('/status',async(_req,res)=>{
    try{return res.json(await engine.status());}catch{return fail(res,'No se pudo consultar el motor local.',503);}
  });
  router.post('/reference',express.raw({type:'image/png',limit:'6mb'}),async(req,res)=>{
    if(!Buffer.isBuffer(req.body))return fail(res,'Sube el archivo PNG oficial de INTEQUITO.',400);
    try{
      const result=await engine.uploadReference(req.body);
      return res.status(201).json(result);
    }catch(error){
      const code=error instanceof Error?error.message:'LOCAL_REFERENCE_UPLOAD_FAILED';
      const message:Record<string,string>={
        LOCAL_REFERENCE_INVALID:'El archivo no es un PNG válido o supera el tamaño permitido.',
        LOCAL_REFERENCE_DIMENSIONS:'Imagen PNG inválida: usa la referencia oficial con al menos 400 píxeles por lado.',
        LOCAL_REFERENCE_STORAGE_NOT_CONFIGURED:'Faltan las credenciales de almacenamiento del servidor.',
        LOCAL_REFERENCE_UPLOAD_FAILED:'No se pudo almacenar la imagen privada en Supabase.',
        LOCAL_REFERENCE_RECORD_FAILED:'Se guardó el archivo, pero no pudo registrarse. No se activó la producción.',
      };
      return fail(res,message[code]||'No se pudo registrar la referencia oficial.',409);
    }
  });
  router.get('/reference',async(_req,res)=>{
    try{
      const bytes=await engine.readReference();
      res.set('Content-Type','image/png');
      res.set('Cache-Control','private, no-store');
      return res.send(bytes);
    }catch{return fail(res,'No se ha instalado una imagen oficial verificada.',404);}
  });
  router.get('/jobs',async(_req,res)=>{
    try{
      const jobs=await engine.jobs();
      // The worker lease token is private even from the admin dashboard.
      return res.json(jobs.map((j:any)=>({
        id:j.id,community_job_id:j.community_job_id,asset_key:j.asset_key,
        state:j.state,progress:j.progress,created_at:j.created_at,
        updated_at:j.updated_at,error_code:j.error_code,
        readyForReview:j.state==='ready_for_review',
      })));
    }catch{return fail(res,'No se pudo leer la cola de videos.',503);}
  });
  router.post('/settings',async(req,res)=>{
    const b=settingsSchema.safeParse(req.body);
    if(!b.success)return fail(res,'Configuración inválida.',400);
    try{return res.json({settings:await engine.setAutoEnabled(b.data.enabled)});}
    catch{return fail(res,'Conecta la GPU, el token privado y el almacenamiento antes de activar la producción automática.');}
  });
  router.post('/queue',async(req,res)=>{
    const b=queueSchema.safeParse(req.body);
    if(!b.success)return fail(res,'Selecciona un guion válido.',400);
    try{
      const job=await engine.enqueue(b.data.communityJobId);
      return res.status(202).json({id:job.id,state:job.state,progress:job.progress,note:'Trabajo en cola de la GPU propia. No incurre en cargos por generación externos.'});
    }catch{return fail(res,'No se pudo programar el video. Revisa el catálogo, el guion, la instalación y la cola.');}
  });
  router.get('/jobs/:id/file',async(req,res)=>{
    if(!uuid.safeParse(req.params.id).success)return fail(res,'ID inválido.',400);
    try{
      const upstream=await engine.mediaStream(req.params.id);
      res.setHeader('Content-Type','video/mp4');
      res.setHeader('Cache-Control','private, no-store');
      res.setHeader('Content-Disposition',`inline; filename="intequito-${req.params.id}.mp4"`);
      // A byte-stream does not force loading an entire multi-MB MP4 into Render memory.
      Readable.fromWeb(upstream.body as any).pipe(res);
    }catch{return fail(res,'El video no está disponible para revisión.',404);}
  });
  return router;
}

export function localVideoWorkerRouter(engine:LocalVideoEngine,env:NodeJS.ProcessEnv=process.env){
  const router=Router();
  router.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    if(!localWorkerTokenValid(req.get('Authorization'),env.INTECA_LOCAL_VIDEO_WORKER_TOKEN))return fail(res,'Acceso de trabajador no autorizado.',401);
    next();
  });
  router.get('/reference',async(_req,res)=>{
    try{
      const bytes=await engine.readReference();
      res.set('Content-Type','image/png');
      res.set('Cache-Control','private, no-store');
      return res.send(bytes);
    }catch{return fail(res,'Falta la referencia oficial de INTEQUITO.',404);}
  });
  router.post('/claim',async(req,res)=>{
    const b=claimSchema.safeParse(req.body);
    if(!b.success)return fail(res,'Identificador de trabajador inválido.',400);
    try{return res.json({job:await engine.claim(b.data.workerId)});}
    catch{return fail(res,'No se pudo leer la cola de trabajo.',503);}
  });
  router.post('/jobs/:id/progress',async(req,res)=>{
    const b=progressSchema.safeParse(req.body);
    if(!uuid.safeParse(req.params.id).success||!b.success)return fail(res,'Actualización inválida.',400);
    try{
      const updated=await engine.update(req.params.id,b.data.claimToken,b.data.progress,b.data.errorCode);
      return res.json({id:updated.id,state:updated.state,progress:updated.progress});
    }catch{return fail(res,'Reclamo expirado o trabajo no disponible. No se reintentará automáticamente.');}
  });
  router.post('/jobs/:id/upload',express.raw({type:'video/mp4',limit:'70mb'}),async(req,res)=>{
    const claimToken=req.get('X-INTECA-Claim-Token')||'';
    if(!uuid.safeParse(req.params.id).success||!uuid.safeParse(claimToken).success||!Buffer.isBuffer(req.body))return fail(res,'Subida inválida.',400);
    try{
      return res.status(201).json(await engine.upload(req.params.id,claimToken,req.body));
    }catch{return fail(res,'No se pudo confirmar el video. Revisa el registro y el almacenamiento antes de reintentar.');}
  });
  return router;
}
