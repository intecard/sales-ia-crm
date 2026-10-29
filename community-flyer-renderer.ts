import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {CommunityPayload} from './community-plan.ts';
import {isPublishableFlyer} from './community-flyer-offer.ts';
import type {CourseFamily} from './community-course-topics.ts';

export const FLYER_SIZE={width:1080,height:1350,ratio:'4:5'};
const W=FLYER_SIZE.width,H=FLYER_SIZE.height;
const palettes=[
 {navy:'#092848',green:'#076a51',accent:'#e9ac38',light:'#edf5f2',muted:'#49766b'},
 {navy:'#0b2c4a',green:'#12634d',accent:'#f1b249',light:'#f1f8f5',muted:'#376f73'},
 {navy:'#11294a',green:'#08705b',accent:'#e5ba56',light:'#eef5f9',muted:'#337c70'},
 {navy:'#09263f',green:'#135c49',accent:'#efb84f',light:'#f5f8f2',muted:'#427e80'},
 {navy:'#0b254a',green:'#0e6d53',accent:'#eec15d',light:'#eef7f4',muted:'#296766'},
] as const;
const xml=(s:string)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
const measure=(s:string)=>{
 let width=0;for(const ch of Array.from(s)){
  width+= ch===' '?0.34:/[iIl1.,:;!|]/.test(ch)?0.28:/[WMW@#%]/.test(ch)?0.92:/[A-ZÁÉÍÓÚÑ0-9]/.test(ch)?0.7:0.56;
 }return width;
};
function splitLines(value:string,maxWidth:number,fontSize:number):string[]{
 const rows:string[]=[];let line='';
 for(const word of clean(value).split(' ')){
  if(measure(word)*fontSize>maxWidth)throw Error('CM_FLYER_TEXT_TOO_LONG');
  const next=line?line+' '+word:word;
  if(line&&measure(next)*fontSize>maxWidth){rows.push(line);line=word;}else line=next;
 }
 if(line)rows.push(line);
 return rows;
}
export function fitFlyerText(value:string,maxWidth:number,maxLines:number,fontSize=48,minSize=24){
 for(let size=fontSize;size>=minSize;size-=2){
  const lines=splitLines(value,maxWidth,size);
  if(lines.length<=maxLines)return {lines,fontSize:size};
 }
 throw Error('CM_FLYER_TEXT_TOO_LONG');
}
export async function containFlyerPhoto(photo:Buffer,width:number,height:number){
 // Contain (never cover): even a very wide photo keeps all 4 corners.
 return sharp(photo).rotate().resize(width,height,{fit:'contain',background:'#f0f5f2'}).png().toBuffer();
}
function txt(s:string,x:number,y:number,size:number,color:string,bold=false,extra=''){
 return '<text x="'+x+'" y="'+y+'" font-family="DejaVu Sans,Arial,sans-serif" font-size="'+size+'" font-weight="'+(bold?'700':'400')+'" fill="'+color+'" '+extra+'>'+xml(s)+'</text>';
}
function lines(values:string[],x:number,y:number,size:number,step:number,color:string,bold=false){
 return values.map((v,i)=>txt(v,x,y+i*step,size,color,bold)).join('');
}
const symbol=(family:CourseFamily,color:string,seed:number)=>{
 const stroke='stroke="'+color+'" stroke-linecap="round" stroke-linejoin="round" stroke-width="9" fill="none"';
 const main=family==='authorizations'||family==='master_authorizations'
  ?'<path d="M58 27 H166 V192 H45 V48 H58 M77 27 V13 H143 V27 M74 91 H141 M74 122 H141 M74 153 H119"/><path d="M166 146 L198 146 M182 130 V162"/>'
  :family==='precertification'||family==='medical_billing'
  ?'<path d="M45 28 H140 L180 69 V197 H45 Z M140 29 V69 H180 M72 98 H148 M72 128 H148 M72 158 H127"/><path d="M134 174 L149 187 L174 158"/>'
  :family==='patient_service'
  ?'<path d="M38 110 V94 A69 69 0 0 1 176 94 V110 M38 96 H62 V154 H38 Z M152 96 H176 V154 H152 Z M176 153 Q173 193 123 193 H103"/>'
  :family==='pharmacology'||family==='pharmacy'
  ?'<rect x="62" y="41" width="121" height="51" rx="25" transform="rotate(45 122 66)"/><path d="M83 45 L150 111 M43 145 H171 M71 117 H143 V190 H71 Z"/>'
  :family==='nursing'
  ?'<path d="M48 28 H169 V182 H48 Z M109 65 V143 M70 104 H148"/>'
  :family==='health_insurance_promoter'
  ?'<path d="M108 16 L187 50 V113 Q187 167 108 206 Q29 167 29 113 V50 Z M71 114 L97 139 L146 82"/>'
  :'<path d="M108 26 C30 -13 5 75 43 129 L108 196 L171 128 C212 75 187 -14 108 26 Z M48 105 H77 L91 73 L109 145 L124 108 H170"/>';
 const offset=(seed%2)*12;
 return '<g transform="translate('+offset+' 0)" '+stroke+' opacity=".82">'+main+'</g>';
};
const files=async(root:string,name:string):Promise<Buffer|null>=>{
 try{return await readFile(path.join(root,name));}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
};
function photoFor(family:CourseFamily){
 if(['authorizations','master_authorizations','precertification','patient_service','medical_billing'].includes(family))return 'call-center';
 if(family==='pharmacology'||family==='pharmacy')return 'pharmacy';
 if(family==='nursing')return 'nursing';
 // An unrelated nursing or call-center photograph must NEVER depict a
 // health promoter or an insurance salesperson.
 return null;
}
/** Art direction follows the owner's premium reference: real relevant workplace
 * photography, large program title, learning outcomes, pricing trio and strong
 * integrated WhatsApp CTA. Never copy the 4-month TYPO from the example.
 */
export async function renderINTECAFlyer(p:CommunityPayload,assetRoot=process.cwd()):Promise<Buffer>{
 const o=p.flyerOffer;
 if(!o||!isPublishableFlyer(o))throw Error('CM_FLYER_PRICE_OR_CONTENT_MISSING');
 if(o.course!==p.courseTitle||o.benefits.indexOf(o.focus)<0)throw Error('CM_FLYER_CATALOG_MISMATCH');
 if(p.editorialSlot==='morning'&&o.family!=='authorizations')throw Error('CM_FLYER_WRONG_MORNING_COURSE');
 const seed=p.designSeed??o.dailyVariant;
 const pal=palettes[((seed%palettes.length)+palettes.length)%palettes.length];
 const photoName=photoFor(o.family);
 const [photo,logo]=await Promise.all([
   photoName?files(assetRoot,'public/creative/'+photoName+'.webp'):Promise.resolve(null),
   files(assetRoot,'public/inteca-logo.webp'),
 ]);
 const title=fitFlyerText(o.course,500,4,53,33);
 const theme=fitFlyerText(o.hook,940,2,30,22);
 const topics=o.benefits.slice(0,3);
 const topicLines=topics.map(t=>fitFlyerText(t,810,1,31,23));
 const cta=fitFlyerText(o.cta,890,1,29,21);
 const note=fitFlyerText(o.context,500,2,24,20);
 const logoPng=logo?await sharp(logo).resize(120,102,{fit:'contain'}).png().toBuffer():null;
 const photoPng=photo?await containFlyerPhoto(photo,470,356):null;
 const issue=p.editorialDate&&/^\d{4}-\d{2}-\d{2}$/.test(p.editorialDate)
  ?new Intl.DateTimeFormat('es-DO',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})
   .format(new Date(p.editorialDate+'T12:00:00Z')):'INTECA';
 const label=p.editorialSlot==='morning'?'PROGRAMA DE LA MAÑANA':
   p.editorialSlot==='afternoon'?'PROGRAMA DESTACADO DE LA TARDE':'FORMACIÓN EN SALUD';
 const photoArt=photoPng && seed%3!==0
   ?'<image x="571" y="169" width="470" height="356" href="data:image/png;base64,'+photoPng.toString('base64')+'"/>'
   :'<g transform="translate(715 242) scale(1.12)">'+symbol(o.family,pal.green,seed)+'</g>'+
    '<circle cx="806" cy="356" r="'+(113+seed%39)+'" fill="'+pal.green+'" opacity=".075"/>';
 const titleY=270;
 const titleEnd=titleY+(title.lines.length-1)*(title.fontSize+6);
 if(titleEnd>495)throw Error('CM_FLYER_TEXT_TOO_LONG');
 const issueTag='INTECA · '+issue.toUpperCase();
 const backgroundDots=Array.from({length:9},(_,i)=>{
   const x=565+((seed*73+i*161)%470),y=188+((seed*37+i*79)%330);
   return '<circle cx="'+x+'" cy="'+y+'" r="'+(6+(i*seed+29)%15)+'" fill="'+pal.green+'" opacity=".035"/>';
 }).join('');
 const outcomeBars=topicLines.map(({lines:topicLines,fontSize},i)=>{
   const y=705+i*78;
   return '<rect x="48" y="'+(y-42)+'" width="984" height="65" rx="13" fill="white" opacity=".08"/>'+
     '<circle cx="83" cy="'+(y-8)+'" r="17" fill="'+pal.accent+'"/>'+
     txt('✓',72,y-1,22,pal.navy,true)+
     txt(topicLines[0],118,y,fontSize,'#ffffff',true);
 }).join('');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+
 '<defs><linearGradient id="hero" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="'+pal.light+'"/></linearGradient></defs>'+
 '<rect width="'+W+'" height="'+H+'" fill="#ffffff"/>'+
 '<rect width="'+W+'" height="550" fill="url(#hero)"/>'+
 '<rect x="0" y="0" width="'+W+'" height="9" fill="'+pal.green+'"/>'+
 (logoPng?'<image x="36" y="24" width="120" height="102" href="data:image/png;base64,'+logoPng.toString('base64')+'"/>'
   :txt('INTECA',42,89,45,pal.navy,true))+
 txt('INTECA',171,73,41,pal.navy,true)+
 txt('INSTITUTO TÉCNICO DEL CARIBE',172,111,20,pal.green,true)+
 txt(issueTag,740,110,17,pal.green,true)+
 '<path d="M53 145 H1028" stroke="'+pal.green+'" stroke-width="2" opacity=".35"/>'+
 '<rect x="47" y="175" width="480" height="48" rx="14" fill="'+pal.green+'"/>'+
 txt(label,63,207,21,'#ffffff',true)+
 lines(title.lines,50,titleY,title.fontSize,title.fontSize+6,pal.navy,true)+
 lines(note.lines,53,Math.max(465,titleEnd+38),note.fontSize,31,pal.green,false)+
 '<rect x="558" y="155" width="487" height="382" rx="19" fill="#f2f7f3" stroke="#d6e8dd" stroke-width="3"/>'+
 backgroundDots+photoArt+
 '<rect x="0" y="551" width="'+W+'" height="420" fill="'+pal.navy+'"/>'+
 '<rect x="43" y="581" width="8" height="58" rx="4" fill="'+pal.accent+'"/>'+
 txt('LO QUE APRENDERÁS',74,622,35,'#ffffff',true)+
 txt('CONTENIDOS DEL PROGRAMA',75,647,18,pal.accent,true)+
 outcomeBars+
 '<rect x="45" y="899" width="990" height="65" rx="12" fill="'+pal.green+'"/>'+
 lines(theme.lines,70,theme.lines.length>1?925:938,theme.fontSize,31,'#ffffff',true)+
 '<rect x="0" y="971" width="'+W+'" height="149" fill="'+pal.light+'"/>'+
 '<path d="M353 986 V1106 M709 986 V1106" stroke="'+pal.navy+'" opacity=".2" stroke-width="2"/>'+
 txt('DURACIÓN',49,1014,23,pal.navy,true)+
 txt(o.duration,48,1079,37,pal.green,true)+
 txt('INSCRIPCIÓN',382,1014,23,pal.navy,true)+
 txt(o.registration!,377,1080,40,pal.green,true)+
 txt('MENSUALIDAD',731,1014,23,pal.navy,true)+
 txt(o.monthly!,731,1080,40,pal.green,true)+
 '<rect x="0" y="1120" width="'+W+'" height="230" fill="'+pal.green+'"/>'+
 '<rect x="0" y="1120" width="'+W+'" height="12" fill="'+pal.accent+'"/>'+
 txt('¡TU FORMACIÓN PUEDE COMENZAR HOY!',49,1174,30,'#ffffff',true)+
 lines(cta.lines,49,1214,cta.fontSize,28,pal.accent,true)+
 txt('WHATSAPP  809-643-5502',48,1272,48,'#ffffff',true)+
 txt('www.inteca.com.do  •  intecaedu@gmail.com',51,1318,22,'#ffffff')+
 '</svg>';
 try{
  const bytes=await sharp(Buffer.from(svg)).jpeg({quality:91,chromaSubsampling:'4:4:4'}).toBuffer();
  const info=await sharp(bytes).metadata();
  if(info.width!==W||info.height!==H)throw Error('CM_FLYER_DIMENSIONS');
  return bytes;
 }catch(error){
  if(error instanceof Error&&error.message.startsWith('CM_FLYER_'))throw error;
  throw new Error('CM_IMAGE_RENDER_FAILED',{cause:error});
 }
}
