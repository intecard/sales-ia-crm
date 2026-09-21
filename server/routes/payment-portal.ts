import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
import {prisma} from '../db';
import {licenceStatus} from '../licence';
export const paymentPortalRouter=Router();
paymentPortalRouter.use(rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-7',legacyHeaders:false}));
paymentPortalRouter.get('/:token',async(req,res,next)=>{try{
 const item=await prisma.paymentRequest.findUnique({where:{token:req.params.token},include:{organization:{select:{name:true}}}});
 if(!item||item.expiresAt<new Date())return res.status(404).json({error:'Enlace inválido o vencido. Solicita uno nuevo a la empresa.'});
 const methods=await prisma.moduleInstallation.findUnique({where:{organizationId_moduleCode:{organizationId:item.organizationId,moduleCode:'PAYMENT_METHODS'}}});
 res.set('Cache-Control','no-store');res.json({company:item.organization.name,amount:item.amount,currency:item.currency,description:item.description,status:item.status,expiresAt:item.expiresAt,methods:methods?.settings||{instructions:'Contacta a la empresa para coordinar tu pago.',banks:[],gateways:[]},reviewNote:(item.proofMeta as any)?.reviewNote||''});
 }catch(e){next(e);}});
paymentPortalRouter.post('/:token/proof',async(req,res,next)=>{try{
 const d=z.object({payerName:z.string().trim().min(2).max(150),reference:z.string().trim().min(1).max(200),name:z.string().min(1).max(200),mimeType:z.enum(['application/pdf','image/png','image/jpeg']),base64:z.string().min(1).max(7000000).regex(/^[A-Za-z0-9+/]*={0,2}$/)}).parse(req.body);
 const content=Buffer.from(d.base64,'base64');const valid=d.mimeType==='application/pdf'?content.subarray(0,5).toString()==='%PDF-':d.mimeType==='image/png'?content.subarray(0,8).toString('hex')==='89504e470d0a1a0a':content.subarray(0,3).toString('hex')==='ffd8ff';
 if(!valid||content.length>5*1024*1024)return res.status(400).json({error:'Selecciona un PDF, PNG o JPG válido de hasta 5 MB.'});
 const found=await prisma.paymentRequest.findUnique({where:{token:req.params.token}});
 if(!found||!await licenceStatus(found.organizationId))return res.status(404).json({error:'Solicitud no disponible.'});
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "PaymentRequest" WHERE id=${found.id} FOR UPDATE`;
  const item=await tx.paymentRequest.findUniqueOrThrow({where:{id:found.id}});
  if(item.expiresAt<new Date()||!['PENDING','REJECTED'].includes(item.status))return false;
  const count=await tx.document.count({where:{organizationId:item.organizationId,ownerEntity:'PaymentRequest',ownerEntityId:item.id}});if(count>=3)return false;
  await tx.document.create({data:{organizationId:item.organizationId,ownerEntity:'PaymentRequest',ownerEntityId:item.id,name:d.name.replace(/[\r\n\\/]/g,'_'),mimeType:d.mimeType,sizeBytes:content.length,content,storageKey:randomUUID(),checksum:createHash('sha256').update(content).digest('hex'),status:'STORED_UNSCANNED'}});
  await tx.paymentRequest.update({where:{id:item.id},data:{status:'PROOF_RECEIVED',proofMeta:{payerName:d.payerName,reference:d.reference,receivedAt:new Date().toISOString()}}});return true;
 });
 if(!result)return res.status(409).json({error:'Ya hay un comprobante en revisión, el enlace venció o la solicitud está cerrada. Contacta a la empresa.'});
 res.status(201).json({notice:'Comprobante recibido. La empresa verificará el abono; todavía no se ha confirmado el pago.'});
 }catch(e){next(e);}});
