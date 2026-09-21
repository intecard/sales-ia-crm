// Owner-only input is received on stdin, never stored in the application image.
import {sign,verify} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PrismaClient} from '@prisma/client';
let key='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>key+=c);process.stdin.on('end',async()=>{
 const db=new PrismaClient();try{
 const mode=process.argv[2];let organizationId=process.argv[3],tier='COMMERCIAL',expiresAt=process.argv[4];
 if(mode==='inteca'){
 const items=await db.organization.findMany({where:{name:{equals:'INTECA SRL',mode:'insensitive'}}});
 if(items.length!==1)throw Error('Se requiere exactamente una empresa INTECA SRL. No se modificó ninguna licencia.');
 organizationId=items[0].id;tier='INTECA_LIFETIME';expiresAt=null;
 }else if(!organizationId||!expiresAt||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now())throw Error('Indique ID de empresa y vencimiento futuro YYYY-MM-DD.');
 const body=Buffer.from(JSON.stringify({organizationId,tier,expiresAt,issuedAt:new Date().toISOString()})).toString('base64url');
 const token=body+'.'+sign(null,Buffer.from(body),key).toString('base64url');
 if(!verify(null,Buffer.from(body),readFileSync(new URL('./licence-public.pem',import.meta.url)),Buffer.from(token.split('.')[1],'base64url')))throw Error('La clave privada no corresponde a esta versión del CRM.');
 if(mode==='inteca'){
 await db.moduleInstallation.upsert({where:{organizationId_moduleCode:{organizationId,moduleCode:'LICENSE'}},create:{organizationId,moduleCode:'LICENSE',enabled:true,settings:{token}},update:{settings:{token}}});
 console.log('Licencia gratuita permanente de INTECA activada. No incluye cargos de proveedores externos.');
 }else console.log(token);
 }catch(e){console.error(e.message);process.exitCode=1;}finally{await db.$disconnect();}
});
