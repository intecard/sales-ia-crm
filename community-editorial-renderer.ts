import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {publicationSvg} from './community-publication-art.ts';
import type {CommunityPayload} from './community-plan.ts';

export async function officialPublicationLogo(){
 try{
  const logo=await readFile(path.join(process.cwd(),'public/inteca-logo.webp'));
  // Embed as PNG: librsvg on the deployment must never omit the WebP logo silently.
  return await sharp(logo).resize(256,256,{fit:'inside'}).png().toBuffer();
 }catch(error){throw Error('CM_OFFICIAL_LOGO_MISSING',{cause:error});}
}

export async function renderEditorialImage(p:CommunityPayload,slide=0,photo?:Buffer){
 const logo='data:image/png;base64,'+(await officialPublicationLogo()).toString('base64');
 const hero=photo?'data:image/jpeg;base64,'+photo.toString('base64'):undefined;
 const svg=publicationSvg(p,logo,slide,hero);
 return sharp(Buffer.from(svg)).jpeg({quality:91,chromaSubsampling:'4:4:4'}).toBuffer();
}
