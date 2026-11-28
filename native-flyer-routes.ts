import path from 'node:path';
import express,{Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {NativeFlyerEngine,workerCredential} from './native-flyer-engine.ts';

const lease = z.object({asset:z.string().regex(/^[a-f0-9]{32}$/),lease:z.string().uuid()}).strict();
const errorList=['RENDER_FAILED','RENDER_TIMEOUT','OUTPUT_INVALID'] as const;
const reply=(res:express.Response,status:number,error:string)=>res.status(status).json({error});

export function nativeFlyerAdminRouter(engine:NativeFlyerEngine){
 const router=Router();
 router.get('/status',async(_req,res)=>{
   try{return res.json(await engine.status());}catch{return reply(res,503,'No se pudo leer el generador de fotos.');}
 });
 router.post('/pair',async(_req,res)=>{
   try{return res.status(201).json(await engine.pair());}catch{return reply(res,503,'No se pudo crear el código de enlace.');}
 });
 router.post('/disconnect',async(_req,res)=>{
   try{await engine.disconnect();return res.json({ok:true});}catch{return reply(res,503,'No se pudo desconectar el equipo.');}
 });
 const studioSpec=z.object({course:z.string().min(4).max(180),format:z.enum(['flyer','story'])}).strict();
 const failStudio=(res:express.Response,e:unknown)=>{
   const code=e instanceof Error?e.message:'';
   const messages:Record<string,string>={
    NATIVE_FLYER_OFFLINE:'El generador de fotos está desconectado. Enlaza la PC desde el Community Manager o usa una foto propia.',
    NATIVE_FLYER_BUSY:'Hay un flyer del estudio en preparación. Espera a que termine.',
    NATIVE_FLYER_LIMIT:'Se alcanzó el límite de piezas del estudio para las últimas 24 horas.',
    NATIVE_FLYER_TOO_SIMILAR:'Esta foto se parece demasiado a otra ya utilizada. Selecciona una distinta.',
    NATIVE_FLYER_INVALID_IMAGE:'Usa una foto horizontal JPG, WebP o PNG nítida, de al menos 640 × 360 y hasta 4 MB.',
    NATIVE_FLYER_COURSE:'Elige un curso con duración y precios verificados en el catálogo.',
    NATIVE_FLYER_NOT_FOUND:'Esta pieza no está disponible.',
   };
   return reply(res,code==='NATIVE_FLYER_NOT_FOUND'?404:409,messages[code]||'No se pudo preparar la fotografía. Revisa la conexión y el almacenamiento.');
 };
 router.post('/studio',async(req,res)=>{
   const spec=studioSpec.safeParse(req.body);
   if(!spec.success)return reply(res,400,'Selecciona el curso y el formato.');
   try{return res.status(202).json(await engine.createStudio(spec.data.course,spec.data.format));}
   catch(e){return failStudio(res,e);}
 });
 router.post('/studio/photo',express.raw({type:['image/png','image/jpeg','image/webp'],limit:'4mb'}),async(req,res)=>{
   const spec=studioSpec.safeParse(req.query);
   if(!spec.success||!Buffer.isBuffer(req.body))return reply(res,400,'Selecciona el curso y adjunta una foto JPG, WebP o PNG.');
   try{return res.status(201).json(await engine.createStudio(spec.data.course,spec.data.format,req.body));}
   catch(e){return failStudio(res,e);}
 });
 router.get('/studio/:asset',async(req,res)=>{
   try{return res.json(await engine.studioStatus(req.params.asset));}
   catch(e){return failStudio(res,e);}
 });
 router.get('/studio/:asset/image',async(req,res)=>{
   try{
    const bytes=await engine.studioImage(req.params.asset);
    res.set('Content-Type','image/jpeg');
    return res.send(bytes);
   }catch(e){return failStudio(res,e);}
 });
 router.get('/download',(_req,res)=>res.download(path.resolve('workers/inteca_flyer_images/inteca_fotos.py'),'inteca_fotos.py'));
 return router;
}
export function nativeFlyerWorkerRouter(engine:NativeFlyerEngine){
 const router=Router();
 router.use(rateLimit({limit:40,windowMs:60_000,standardHeaders:'draft-8',legacyHeaders:false}));
 router.use((req,res,next)=>{
   res.set('Cache-Control','no-store');
   const token=workerCredential(req.get('Authorization'));
   if(!token)return reply(res,401,'NATIVE_FLYER_AUTH');
   res.locals.nativeFlyerToken=token;
   next();
 });
 router.post('/claim',async(_req,res)=>{
   try{return res.json({job:await engine.claim(res.locals.nativeFlyerToken)});}
   catch(e){return e instanceof Error&&e.message==='NATIVE_FLYER_AUTH'?reply(res,401,e.message):reply(res,503,'NATIVE_FLYER_UNAVAILABLE');}
 });
 router.post('/failure',async(req,res)=>{
   const parsed=lease.extend({error:z.enum(errorList)}).safeParse(req.body);
   if(!parsed.success)return reply(res,400,'NATIVE_FLYER_BAD_LEASE');
   const {asset,lease:token,error}=parsed.data;
   try{
     return await engine.finish(res.locals.nativeFlyerToken,{asset,lease:token},null,error)
       ?res.json({ok:true}):reply(res,409,'NATIVE_FLYER_EXPIRED');
   }catch{return reply(res,503,'NATIVE_FLYER_UNAVAILABLE');}
 });
 router.post('/upload',express.raw({type:['image/png','image/jpeg','image/webp'],limit:'4mb'}),async(req,res)=>{
   const parsed=lease.safeParse({asset:req.get('X-INTECA-Asset'),lease:req.get('X-INTECA-Lease')});
   if(!parsed.success||!Buffer.isBuffer(req.body))return reply(res,400,'NATIVE_FLYER_INVALID_IMAGE');
   try{return res.status(201).json(await engine.upload(res.locals.nativeFlyerToken,parsed.data,req.body));}
   catch(e){
     const code=e instanceof Error&&/^NATIVE_FLYER_[A-Z_]+$/.test(e.message)?e.message:'NATIVE_FLYER_UPLOAD_FAILED';
     return reply(res,code==='NATIVE_FLYER_AUTH'?401:409,code);
   }
 });
 return router;
}
