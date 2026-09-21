import {Router} from 'express';
import {prisma} from '../db';
import {getProvider} from './workspace';
import {normalizeEvents,signatureValid,socialProviders} from '../social';
export const channelsRouter=Router();
channelsRouter.get('/:organizationId/:provider',async(req,res,next)=>{try{
 if(!socialProviders.includes(req.params.provider))return res.sendStatus(404);
 const config=await getProvider(req.params.organizationId,req.params.provider);
 if(!config||req.query['hub.mode']!=='subscribe'||req.query['hub.verify_token']!==config.verifyToken)return res.sendStatus(403);
 res.type('text/plain').send(String(req.query['hub.challenge']||''));
}catch(e){next(e);}});
channelsRouter.post('/:organizationId/:provider',async(req,res,next)=>{try{
 const {organizationId,provider}=req.params;
 if(!socialProviders.includes(provider))return res.sendStatus(404);
 const config=await getProvider(organizationId,provider);
 const raw=(req as any).rawBody as Buffer;
 if(!config||!raw||!signatureValid(raw,req.get('x-hub-signature-256')||'',config.appSecret))return res.sendStatus(403);
 for(const payload of normalizeEvents(req.body,provider,config.accountId))await prisma.channelEvent.upsert({where:{organizationId_provider_externalId:{organizationId,provider,externalId:payload.id}},create:{organizationId,provider,externalId:payload.id,payload:{...payload,accountId:config.accountId}},update:{}});
 await prisma.integrationConnection.update({where:{organizationId_provider:{organizationId,provider}},data:{status:'CONNECTED',lastCheckedAt:new Date()}});
 res.sendStatus(200);
}catch(e){next(e);}});
