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
