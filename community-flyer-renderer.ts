import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {CommunityPayload} from './community-plan.ts';
import {isPublishableFlyer} from './community-flyer-offer.ts';

const W=1080, H=1350;
export const FLYER_SIZE={width:W,height:H,ratio:'4:5'};
const palettes=[
  ['#061b37','#09c9cd','#133e5d'],
  ['#0b2443','#ffbf7f','#285579'],
  ['#17314b','#a6efcc','#0b5362'],
  ['#19254a','#91c8ff','#364d85'],
  ['#06354a','#ffc488','#14687a'],
  ['#142944','#a6e5fd','#185e7c'],
  ['#0b2840','#e2d197','#435877'],
  ['#182b40','#9bf1d6','#12615d'],
  ['#1e2449','#ffc4db','#52528e'],
  ['#092c42','#a4d8ff','#275c7f'],
  ['#103143','#b8e398','#33645d'],
  ['#102442','#e0bafe','#544779'],
] as const;
const escape=(s:string)=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]!));
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
function widthUnits(text:string){
 let result=0;
 for(const ch of Array.from(text)){
   if(ch===' ')result+=0.32;
   else if(/[iIl1.,:;!|]/.test(ch))result+=0.27;
   else if(/[WMW@#%]/.test(ch))result+=0.9;
   else if(/[A-ZÁÉÍÓÚÑ0-9]/.test(ch))result+=0.68;
   else result+=0.57;
 }
 return result;
}
function wrapped(s:string,maxWidth:number,font:number):string[]{
 const words=clean(s).split(' ');
 const out:string[]=[];let line='';
 for(const raw of words){
   if(!raw)continue;
   // Never silently truncate a course name or verified amount.
   if(widthUnits(raw)*font>maxWidth)throw Error('CM_FLYER_TEXT_TOO_LONG');
   const next=(line?line+' ':'')+raw;
   if(line&&widthUnits(next)*font>maxWidth){
     out.push(line);line=raw;
   }else line=next;
 }
 if(line)out.push(line);
 return out;
}
export function fitFlyerText(text:string,maxWidth:number,maxRows:number,font=48,minFont=24){
 for(let size=font;size>=minFont;size-=2){
   const lines=wrapped(text,maxWidth,size);
   if(lines.length<=maxRows)return {lines,fontSize:size};
 }
 throw Error('CM_FLYER_TEXT_TOO_LONG');
}
export async function containFlyerPhoto(photo:Buffer,width:number,height:number):Promise<Buffer>{
  // Never crop a head, hands or any part of the uploaded photograph.
  return sharp(photo).rotate().resize(width,height,{
    fit:'contain',background:{r:14,g:35,b:54,alpha:1},
    withoutEnlargement:true,
  }).png().toBuffer();
}
function svgText(text:string,x:number,y:number,size:number,fill:string,weight='normal'){
 return '<text x="'+x+'" y="'+y+'" font-size="'+size+'" font-family="DejaVu Sans,Arial,sans-serif" font-weight="'+weight+'" fill="'+fill+'">'+escape(text)+'</text>';
}
function textLines(lines:string[],x:number,y:number,size:number,lineHeight:number,color:string,weight='normal'){
 return lines.map((line,i)=>svgText(line,x,y+i*lineHeight,size,color,weight)).join('');
}
function backgroundPattern(seed:number,accent:string){
 // Original vector artwork changes by daily issue, not a mere filename/date.
 const nodes:Array<string>=[];
 for(let i=0;i<14;i++){
   const x=35+((seed*47+i*137)%1010);
   const y=32+((seed*93+i*167)%1280);
   const r=9+((seed+i*19)%29);
   nodes.push('<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+accent+'" opacity="'+(i%3===0?'.09':'.045')+'"/>');
 }
 return nodes.join('');
}
function motif(seed:number,color:string){
 // Six medical/learning motifs, with freely generated illustration elements.
 const common=' fill="none" stroke="'+color+'" stroke-linecap="round" stroke-linejoin="round" stroke-width="13"';
 const kind=seed%6;
 if(kind===0)return '<rect x="12" y="20" width="188" height="200" rx="27"'+common+'/>'+
   '<path d="M106 68 V173 M55 120 H158"'+common+'/>';
 if(kind===1)return '<rect x="27" y="22" width="173" height="210" rx="15"'+common+'/>'+
   '<path d="M76 16 H151 M58 92 H166 M58 136 H155 M58 180 H142"'+common+'/>';
 if(kind===2)return '<path d="M8 130 H55 L78 80 L104 180 L132 110 H203"'+common+'/>'+
   '<path d="M40 51 C70 19 90 39 107 63 C126 29 168 19 192 56"'+common+'/>';
 if(kind===3)return '<path d="M106 20 L193 58 V128 C193 175 154 208 106 235 C57 205 19 169 19 128 V58Z"'+common+'/>'+
   '<path d="M107 77 V165 M64 121 H151"'+common+'/>';
 if(kind===4)return '<path d="M16 74 L110 33 L206 74 L110 116 Z"'+common+'/>'+
   '<path d="M44 93 V157 Q110 198 174 157 V93 M206 74 V180"'+common+'/>';
 return '<path d="M20 35 Q73 20 111 58 Q152 20 203 35 V205 Q151 184 111 213 Q71 184 20 205 Z"'+common+'/>'+
   '<path d="M111 58 V210"'+common+'/>';
}
async function fileOrNull(root:string,file:string):Promise<Buffer|null>{
 try{return await readFile(path.join(root,file));}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}
function chooseSourcePhoto(courseTitle:string,root:string){
 const t=courseTitle.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const name=/farmac|farmacia|visitador/.test(t)?'pharmacy':
   /enfermer|promotor.*salud/.test(t)?'nursing':'call-center';
 return fileOrNull(root,'public/creative/'+name+'.webp');
}
export async function renderINTECAFlyer(p:CommunityPayload,assetRoot=process.cwd()):Promise<Buffer>{
 const offer=p.flyerOffer;
 if(!offer||!isPublishableFlyer(offer))throw Error('CM_FLYER_PRICE_OR_CONTENT_MISSING');
 if(offer.course!==p.courseTitle)throw Error('CM_FLYER_CATALOG_MISMATCH');
 const seed=p.designSeed??offer.dailyVariant;
 const [bg,accent,deep]=palettes[((seed%palettes.length)+palettes.length)%palettes.length];
 const [photo,logo,mascot]=await Promise.all([
   chooseSourcePhoto(p.courseTitle,assetRoot),
   fileOrNull(assetRoot,'public/inteca-logo.webp'),
   fileOrNull(assetRoot,'public/intequito-oficial.png'),
 ]);
 const reverse=(seed%2)===1;
 const mediaX=reverse?330:57, mediaWidth=688, mediaY=191, mediaHeight=333;
 const artX=reverse?68:780;
 const photoPng=photo?await containFlyerPhoto(photo,mediaWidth,mediaHeight):null;
 const logoPng=logo?await sharp(logo).resize(125,100,{fit:'contain'}).png().toBuffer():null;
 const mascotPng=mascot?await sharp(mascot).resize(215,275,{fit:'contain'}).png().toBuffer():null;
 const courseTitle=fitFlyerText(offer.course,940,3,54,32);
 const focus=fitFlyerText(offer.focus,910,2,38,26);
 const secondary=offer.benefits[1]?fitFlyerText(offer.benefits[1],900,1,27,22):null;
 const note=offer.modality?'Duración: '+offer.duration+'  ·  Modalidad: '+offer.modality:'Duración: '+offer.duration;
 const timing=fitFlyerText(note,910,1,26,20);
 const month=p.campaignMonth||p.editorialDate?.slice(0,7)||'INTECA';
 const day=p.editorialDate?.slice(-2)||String(offer.dailyVariant);
 const edition='EDICIÓN '+day+' · '+month;
 const heading=reverse?'ORIENTACIÓN ACADÉMICA':'FORMACIÓN EN SALUD';
 const bgSvg='<defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+bg+'"/><stop offset="1" stop-color="'+deep+'"/></linearGradient></defs>';
 const heroPhoto=photoPng
   ? '<image x="'+mediaX+'" y="'+mediaY+'" width="'+mediaWidth+'" height="'+mediaHeight+'" href="data:image/png;base64,'+photoPng.toString('base64')+'"/>'
   : '<rect x="'+mediaX+'" y="'+mediaY+'" width="'+mediaWidth+'" height="'+mediaHeight+'" fill="'+bg+'"/><circle cx="'+(mediaX+mediaWidth/2)+'" cy="'+(mediaY+150)+'" r="112" fill="'+accent+'" opacity=".08"/>';
 const logoSvg=logoPng
   ? '<image x="900" y="31" width="125" height="100" href="data:image/png;base64,'+logoPng.toString('base64')+'"/>'
   : svgText('INTECA',883,88,38,'#ffffff','bold');
 const mascotSvg=mascotPng
   ? '<image x="'+(artX-10)+'" y="222" width="215" height="275" href="data:image/png;base64,'+mascotPng.toString('base64')+'"/>'
   : '<g transform="translate('+artX+' 258)">'+motif(seed,accent)+'</g>';
 const titleSize=courseTitle.fontSize;
 const titleStart=670;
 const titleEnd=titleStart+(courseTitle.lines.length-1)*(titleSize+6);
 const focusLabelY=Math.max(817,titleEnd+43);
 const focusY=focusLabelY+42;
 const focusEnd=focusY+(focus.lines.length-1)*(focus.fontSize+9);
 const secondY=focusEnd+48;
 const detailY=Math.max(secondY+(secondary?43:0),1004);
 if(detailY>1028)throw Error('CM_FLYER_TEXT_TOO_LONG');
 const group=
 '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+
 bgSvg+'<rect width="'+W+'" height="'+H+'" fill="url(#background)"/>'+
 backgroundPattern(seed,accent)+
 '<path d="M0 118 Q540 '+(135+seed%40)+' 1080 113 V155 H0Z" fill="'+accent+'" opacity=".12"/>'+
 logoSvg+
 svgText('INTECA · INSTITUTO TÉCNICO DEL CARIBE',58,72,28,'#ffffff','bold')+
 svgText(edition,58,117,23,accent,'bold')+
 '<rect x="42" y="173" width="996" height="369" rx="28" fill="#ffffff" opacity=".08"/>'+
 '<rect x="'+mediaX+'" y="'+mediaY+'" width="'+mediaWidth+'" height="'+mediaHeight+'" rx="20" fill="#0e2336"/>'+
 heroPhoto+mascotSvg+
 '<rect x="42" y="561" width="996" height="465" rx="30" fill="#ffffff" opacity=".10"/>'+
 '<rect x="61" y="582" width="12" height="85" rx="6" fill="'+accent+'"/>'+
 svgText(heading,96,619,26,accent,'bold')+
 textLines(courseTitle.lines,65,titleStart,titleSize,titleSize+6,'#ffffff','bold')+
 svgText('APRENDE SOBRE',65,focusLabelY,23,accent,'bold')+
 textLines(focus.lines,65,focusY,focus.fontSize,focus.fontSize+9,'#ffffff','bold')+
 (secondary?svgText('✓ '+secondary.lines[0],65,secondY,secondary.fontSize,'#e5f3f9'):'')+
 textLines(timing.lines,65,detailY,timing.fontSize,30,'#d8ecf5')+
 '<rect x="43" y="1047" width="994" height="134" rx="26" fill="#ffffff"/>'+
 svgText('INSCRIPCIÓN',71,1090,22,bg,'bold')+
 svgText(offer.registration!,68,1149,47,bg,'bold')+
 '<path d="M530 1066 V1162" stroke="'+deep+'" opacity=".25" stroke-width="2"/>'+
 svgText('MENSUALIDAD',568,1090,22,bg,'bold')+
 svgText(offer.monthly!,564,1149,47,bg,'bold')+
 '<rect x="43" y="1195" width="994" height="123" rx="23" fill="'+accent+'"/>'+
 svgText(offer.cta,67,1233,24,bg,'bold')+
 svgText('WHATSAPP  809-643-5502',66,1286,45,bg,'bold')+
 '</svg>';
 try{
   const result=await sharp(Buffer.from(group)).jpeg({quality:90,chromaSubsampling:'4:4:4'}).toBuffer();
   const meta=await sharp(result).metadata();
   if(meta.width!==W||meta.height!==H)throw Error('CM_FLYER_DIMENSIONS');
   return result;
 }catch(e){
   if(e instanceof Error&&e.message.startsWith('CM_FLYER_'))throw e;
   throw new Error('CM_IMAGE_RENDER_FAILED',{cause:e});
 }
}
