// The institutional lockup is drawn into every still and every frame of a video.
import { EDITORIAL_PALETTES, editorialText } from './community-editorial-svg.ts';
import { editorialIllustration, illustrationMotif } from './community-illustration.ts';
import { EDITORIAL_LAYOUTS } from './community-editorial.ts';
import { isPublishableFlyer } from './community-flyer-offer.ts';
import type {CommunityPayload} from './community-plan.ts';

const xml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));

export function publicationSvg(p:Pick<CommunityPayload,'kind'|'courseTitle'|'creative'|'flyerOffer'|'designSeed'>,logo:string,slide=0,photoJpeg?:string){
 const c=p.creative,o=p.flyerOffer;
 if(!c)throw Error('CM_CREATIVE_MISSING');
 if(!o||!isPublishableFlyer(o)||o.course!==p.courseTitle)throw Error('CM_PUBLICATION_PRICE_MISSING');
 if(!logo)throw Error('CM_OFFICIAL_LOGO_MISSING');
 const portrait=p.kind!=='flyer', h=portrait?1920:1350;
 const position=Math.max(0,EDITORIAL_LAYOUTS.indexOf(c.layout)), mode=position%4;
 const pal=EDITORIAL_PALETTES[c.palette%EDITORIAL_PALETTES.length];
 const rect=(x:number,y:number,w:number,height:number,fill:string,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${height}" rx="${r}" fill="${fill}"/>`;
 const tx=(s:string,x:number,y:number,w:number,height:number,size:number,color=pal.ink,bold=false)=>
  editorialText(s,x,y,w,height,color,size,bold);
 // Keep critical material in the centre, above social app controls and left of action icons.
 const x=portrait?64:62, width=portrait?880:956;
 const start=portrait?300:60, logoSize=portrait?108:94;
 const titleY=start+logoSize+27;
 const imageY=titleY+153, imageH=portrait?420:388;
 const lessonY=imageY+imageH+31;
 const factsY=portrait?1266:1000;
 const details=o.modality?`Duración: ${o.duration} · Modalidad: ${o.modality}`:`Duración: ${o.duration}`;
 const headline=slide===1?c.topic:slide===2?'Ponlo en práctica':c.headline;
 const body=slide===1?(c.points[1]||c.points[0]):slide===2?c.takeaway:c.points[0];
 const inset=Math.floor(position/4)*13;
 const ax=x+(mode%2?26+inset:0), aw=width-(26+inset)+(mode%2?0:26);
 const image=photoJpeg?
  `<image x="${ax}" y="${imageY}" width="${aw}" height="${imageH}" href="${xml(photoJpeg)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#course-image)"/>`:
  rect(ax,imageY,aw,imageH,pal.soft,mode===0?8:28)+
  `<path d="M${ax} ${imageY+imageH-22} L${ax+aw} ${imageY+76}" stroke="${pal.accent}" stroke-width="2" opacity=".22"/>`+
  editorialIllustration(c.illustration??{motif:illustrationMotif(c.topic,p.designSeed??0),seed:p.designSeed??0,frame:mode},
    pal,ax+(aw-imageH+28)/2,imageY+14,imageH-28);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}">
 ${rect(0,0,1080,h,pal.bg)}
 ${rect(mode<2?0:1056,0,24,h,pal.accent)}
 <defs><clipPath id="course-image">${rect(ax,imageY,aw,imageH,'white',mode===0?8:28)}</clipPath></defs>
 <g id="institutional-logo">
 ${rect(x,start,logoSize,logoSize,'#ffffff',14)}
 <image x="${x+3}" y="${start+3}" width="${logoSize-6}" height="${logoSize-6}" href="${xml(logo)}" preserveAspectRatio="xMidYMid meet"/>
 ${tx('INTECA',x+logoSize+23,start+4,width-logoSize-23,62,48,pal.ink,true)}
 ${tx('INSTITUTO TÉCNICO DEL CARIBE',x+logoSize+23,start+62,width-logoSize-23,35,24,pal.ink,true)}
 </g>
 <g id="course-title">${tx(p.courseTitle,x,titleY,width,138,56,pal.ink,true)}</g>
 <g id="course-image-content">${image}</g>
 <g id="course-lesson">
 ${tx(headline,x,lessonY,width,80,34,pal.ink,true)}
 ${tx(body,x,lessonY+79,width,factsY-lessonY-87,28)}
 </g>
 ${tx(details,x,factsY,width,56,26,pal.ink,true)}
 <g id="course-prices">
 ${rect(x,factsY+65,width,125,pal.soft,16)}
 <path d="M${x+width/2} ${factsY+80} v93" stroke="${pal.ink}" stroke-opacity=".3" stroke-width="2"/>
 ${tx('INSCRIPCIÓN',x+22,factsY+75,width/2-42,40,23,pal.ink,true)}
 ${tx(o.registration!,x+22,factsY+114,width/2-42,67,46,pal.ink,true)}
 ${tx('MENSUALIDAD',x+width/2+22,factsY+75,width/2-42,40,23,pal.ink,true)}
 ${tx(o.monthly!,x+width/2+22,factsY+114,width/2-42,67,46,pal.ink,true)}
 </g>
 ${rect(x,factsY+209,width,70,pal.ink,14)}
 ${tx('INFORMACIÓN · WHATSAPP 809-643-5502',x+18,factsY+225,width-36,44,29,pal.bg,true)}
 </svg>`;
}
