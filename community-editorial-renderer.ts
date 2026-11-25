import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {editorialSvg} from './community-editorial-svg.ts';
import type {CommunityPayload} from './community-plan.ts';
export async function renderEditorialImage(p:CommunityPayload,slide?:number,assetRoot=process.cwd()){
 if(!p.creative)throw Error('CM_CREATIVE_MISSING');
 const logo=await readFile(path.join(assetRoot,'public/inteca-logo.webp')).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});
 const offer=p.flyerOffer;
 const facts=offer?`${offer.duration} · Inscripción ${offer.registration} · Mensualidad ${offer.monthly}`:'Guía educativa · Conoce el programa en inteca.com.do';
 return sharp(Buffer.from(editorialSvg({creative:p.creative,course:p.courseTitle,facts,vertical:p.kind!=='flyer',slide,
  ...(logo?{logo:'data:image/webp;base64,'+logo.toString('base64')}:{})}))).jpeg({quality:91,chromaSubsampling:'4:4:4'}).toBuffer();
}
