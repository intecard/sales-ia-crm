import {verify} from 'node:crypto';
import {prisma} from './db';
import {LICENCE_PUBLIC_KEY} from './licence-key';
import type {AuthenticatedRequest} from './security';
import type {Response,NextFunction} from 'express';
export function verifyLicence(token:string,organizationId:string){
 try{const [body,signature,...extra]=token.trim().split('.');if(extra.length||!body||!signature)return null;
 if(!verify(null,Buffer.from(body),LICENCE_PUBLIC_KEY,Buffer.from(signature,'base64url')))return null;
 const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
 if(payload.organizationId!==organizationId||!['INTECA_LIFETIME','COMMERCIAL'].includes(payload.tier))return null;
 if(payload.tier==='COMMERCIAL'&&(!payload.expiresAt||!Number.isFinite(Date.parse(payload.expiresAt))))return null;
 if(payload.expiresAt&&Date.parse(payload.expiresAt)<=Date.now())return null;
 return payload;
 }catch{return null;}
}
export async function licenceStatus(organizationId:string){
 const organization=await prisma.organization.findUnique({where:{id:organizationId},select:{name:true}});
 // INTECA is the owner's installation and has the promised permanent local licence.
 // Commercial tenants continue to require a signed licence token.
 if(organization?.name.trim().toLocaleUpperCase('es')==='INTECA SRL')return {organizationId,tier:'INTECA_LIFETIME',expiresAt:null};
 const row=await prisma.moduleInstallation.findUnique({where:{organizationId_moduleCode:{organizationId,moduleCode:'LICENSE'}}});
 const token=(row?.settings as {token?:string}|null)?.token;
 return token?verifyLicence(token,organizationId):null;
}
export async function licenseGuard(req:AuthenticatedRequest,res:Response,next:NextFunction){
 try{
 if(['GET','HEAD','OPTIONS'].includes(req.method)||req.path==='/license/activate'||req.path==='/password')return next();
 if(!await licenceStatus(req.auth!.organizationId))return res.status(402).json({error:'Activa la licencia en Licencia & Plan. Tus datos siguen disponibles para consulta y exportación.'});
 next();
 }catch(e){next(e);}
}
