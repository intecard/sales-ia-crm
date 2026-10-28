import express,{Router} from 'express';
import {z} from 'zod';
import {rateLimit} from 'express-rate-limit';
import {GatewayPrecontract} from './payment-gateway-precontract.ts';

const prepareSchema=z.object({
  contactKey:z.string().min(3).max(256),
  provider:z.enum(['unselected','azul','cardnet']).default('unselected'),
}).strict();
const paramSchema=z.string().regex(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i);
const textError=(res:express.Response,code:string,status=409)=>res.status(status).json({error:code});
const cacheControl=(_req:express.Request,res:express.Response,next:express.NextFunction)=>{
  res.set('Cache-Control','private, no-store');next();
};
export function gatewayAdminRouter(engine:GatewayPrecontract){
 const router=Router();
 router.use(cacheControl);
 router.get('/status',async(_req,res)=>{
   try{return res.json(await engine.status());}
   catch{return textError(res,'GATEWAY_MIGRATION_REQUIRED',503);}
 });
 router.get('/eligible',async(_req,res)=>{
  try{return res.json({opportunities:await engine.eligible()});}
  catch{return textError(res,'GATEWAY_DATABASE_UNAVAILABLE',503);}
 });
 router.get('/orders',async(_req,res)=>{
   try{return res.json({orders:await engine.orders()});}
   catch{return textError(res,'GATEWAY_DATABASE_UNAVAILABLE',503);}
 });
 router.post('/orders',async(req,res)=>{
   const body=prepareSchema.safeParse(req.body);
   if(!body.success)return textError(res,'GATEWAY_INVALID_REQUEST',400);
   try{return res.status(201).json({order:await engine.prepare(body.data.contactKey,body.data.provider)});}
   catch(error){
     const reason=error instanceof Error?error.message:'';
     const code=/^GATEWAY_[A-Z_]+$/.test(reason)?reason:'GATEWAY_PREPARE_FAILED';
     return textError(res,code,code==='GATEWAY_APP_URL'||code==='GATEWAY_LINK_NOT_READY'?503:409);
   }
 });
 return router;
}

export function gatewayPublicRouter(engine:GatewayPrecontract){
 const router=Router();
 router.use(cacheControl);
 router.use(rateLimit({windowMs:60_000,limit:30,standardHeaders:'draft-7',legacyHeaders:false}));
 router.get('/:token',async(req,res)=>{
   if(!paramSchema.safeParse(req.params.token).success)return textError(res,'GATEWAY_LINK_INVALID',404);
   try{return res.json(await engine.publicOrder(req.params.token));}
   catch{return textError(res,'GATEWAY_LINK_INVALID',404);}
 });
 router.post('/:token/start',async(req,res)=>{
   if(!paramSchema.safeParse(req.params.token).success)return textError(res,'GATEWAY_LINK_INVALID',404);
   try{
     await engine.beginCheckout(req.params.token);
     // No adapter exists yet; never fabricate a checkout URL.
     return textError(res,'GATEWAY_CONTRACT_REQUIRED',503);
   }catch{return textError(res,'GATEWAY_CONTRACT_REQUIRED',503);}
 });
 router.post('/callbacks/azul',(_req,res)=>textError(res,'GATEWAY_NOT_CONTRACTED',503));
 router.post('/callbacks/cardnet',(_req,res)=>textError(res,'GATEWAY_NOT_CONTRACTED',503));
 return router;
}
