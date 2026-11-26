import {editorialIllustration} from './community-illustration.ts';
import type {EditorialCreative} from './community-editorial.ts';
export const EDITORIAL_PALETTES=[
 {bg:'#f5f1e8',ink:'#142c35',accent:'#007f72',soft:'#d7ece6'},
 {bg:'#172a46',ink:'#ffffff',accent:'#ffcc69',soft:'#294460'},
 {bg:'#f5effa',ink:'#33264c',accent:'#7155ac',soft:'#e4daf1'},
 {bg:'#eaf5fa',ink:'#123b56',accent:'#037eac',soft:'#cbe5ef'},
 {bg:'#172e29',ink:'#ffffff',accent:'#a8e499',soft:'#294a40'},
 {bg:'#fff3ed',ink:'#4b2931',accent:'#b34460',soft:'#f2dbe0'},
];
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function wrap(s:string,width:number,size:number){
 const rows:string[]=[];let line='';
 const measure=(v:string)=>Array.from(v).reduce((sum,c)=>sum+(/[MW@%]/.test(c)?1:/[il.,:! ]/.test(c)?.36:/[A-ZÁÉÍÓÚÑ]/.test(c)?.84:.74),0)*size;
 for(const word of s.split(/\s+/)){const next=line?line+' '+word:word;if(line&&measure(next)>width){rows.push(line);line=word;}else line=next;}
 if(line)rows.push(line);return rows;
}
export function editorialText(s:string,x:number,y:number,w:number,h:number,color:string,size=44,bold=false){
 let rows:string[]=[];
 for(;size>=20;size-=2){rows=wrap(s,w,size);if(rows.length*size*1.28<=h)break;}
 if(size<20)throw Error('CM_EDITORIAL_TEXT_OVERFLOW');
 return rows.map((r,i)=>`<text x="${x}" y="${y+size+i*size*1.28}" fill="${color}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="${bold?700:400}">${esc(r)}</text>`).join('');
}
export function editorialSvg(input:{creative:EditorialCreative;course:string;facts:string;vertical?:boolean;logo?:string;slide?:number}){
 const {creative:c,course,facts,logo,slide}=input;
 const H=input.vertical?1920:1350,bodyTop=input.vertical?510:385,bottom=H-310,bodyH=bottom-bodyTop;
 const p=EDITORIAL_PALETTES[c.palette%EDITORIAL_PALETTES.length];
 const dark=c.palette===1||c.palette===4,accentInk=dark?p.bg:'#ffffff';
 const rect=(x:number,y:number,w:number,h:number,fill:string,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
 const tx=(s:string,x:number,y:number,w:number,h:number,size=42,color=p.ink,bold=false)=>editorialText(s,x,y,w,h,color,size,bold);
 const points=slide===0?[c.points[0],c.takeaway]:slide===2?[c.takeaway,c.question]:c.points;
 const headline=slide===1?c.topic:slide===2?'Ahora te toca a ti':c.headline;
 let art='';
 if(c.layout==='editorial'){
  art+=rect(0,0,35,H,p.accent)+rect(60,bodyTop,960,bodyH,p.soft,20);
  art+=tx('APRENDE',95,bodyTop+24,850,80,64,p.accent,true);
  points.forEach((v,i)=>{const y=bodyTop+125+i*(bodyH-145)/points.length;art+=tx(String(i+1).padStart(2,'0'),90,y,100,80,60,p.accent,true)+tx(v,215,y,750,(bodyH-150)/points.length-8,42);});
 }else if(c.layout==='checklist'){
  art+=rect(680,0,400,H,p.soft);
  points.forEach((v,i)=>{const h=(bodyH-40)/points.length,y=bodyTop+i*(h+18);art+=rect(60,y,960,h,p.accent,22)+tx('✓',85,y+24,65,65,48,accentInk,true)+tx(v,175,y+25,795,h-45,44,accentInk);});
 }else if(c.layout==='split'){
  const h=(bodyH-25)/2;
  art+=rect(0,bodyTop,1080,h,p.accent)+rect(0,bodyTop+h+22,1080,h,p.soft);
  art+=tx('OBSERVA',60,bodyTop+15,960,50,30,accentInk,true)+tx(points[0],60,bodyTop+80,950,h-95,48,accentInk,true);
  art+=tx('APLICA',60,bodyTop+h+38,960,50,30,p.accent,true)+tx(points.slice(1).join(' '),60,bodyTop+h+100,950,h-80,44);
 }else if(c.layout==='path'){
  art+=`<path d="M120 ${bodyTop+50} V${bottom-30}" stroke="${p.accent}" stroke-width="12" stroke-dasharray="10 12"/>`;
  points.forEach((v,i)=>{const h=(bodyH-35)/points.length,y=bodyTop+i*h;art+=`<circle cx="120" cy="${y+55}" r="46" fill="${p.accent}"/>`+tx(String(i+1),105,y+20,55,70,48,accentInk,true)+rect(205,y,815,h-22,p.soft,24)+tx(v,235,y+24,750,h-60,44);});
 }else if(c.layout==='cards'){
  const w=455;
  points.forEach((v,i)=>{const x=i%2?565:60,y=bodyTop+(i>1?bodyH*.52:0),h=points.length>2?bodyH*.47:bodyH;art+=rect(x,y,w,h,i%2?p.accent:p.soft,30)+tx(i===0?'IDEA':i===1?'PRÁCTICA':'RECUERDA',x+28,y+28,w-56,60,29,i%2?accentInk:p.accent,true)+tx(v,x+28,y+120,w-56,h-145,45,i%2?accentInk:p.ink);});
 }else if(c.layout==='spotlight'){
  art+=`<circle cx="930" cy="200" r="250" fill="${p.soft}"/>`+rect(60,bodyTop,960,bodyH*.52,p.accent,48)+tx(points[0],100,bodyTop+45,880,bodyH*.52-75,54,accentInk,true);
  art+=tx(points.slice(1).join(' '),80,bodyTop+bodyH*.57,920,bodyH*.4,45);
 }else if(c.layout==='notebook'){
  art+=rect(45,bodyTop,990,bodyH,p.soft,12)+`<path d="M140 ${bodyTop} V${bottom}" stroke="${p.accent}" stroke-width="3"/>`;
  for(let y=bodyTop+45;y<bottom;y+=55)art+=`<path d="M160 ${y} H1000" stroke="${p.accent}" opacity=".12"/>`;
  points.forEach((v,i)=>{const h=(bodyH-40)/points.length,y=bodyTop+18+i*h;art+=tx('•',82,y,45,80,58,p.accent)+tx(v,175,y,815,h-20,44);});
 }else if(c.layout==='question'){
  art+=rect(0,bodyTop,1080,bodyH,p.accent)+tx('?',820,bodyTop-25,200,220,170,accentInk,true);
  art+=tx(points[0],65,bodyTop+40,740,bodyH*.45,48,accentInk,true)+rect(55,bodyTop+bodyH*.52,970,bodyH*.44,p.bg,24)+tx(points.slice(1).join(' '),85,bodyTop+bodyH*.52+20,910,bodyH*.44-40,42);
 }
 // Illustrated layouts change the geometry, spacing and hierarchy, not just the colors.
 if(['columns','dispatch','briefing','diagram','index','steps','postcard','flashcard'].includes(c.layout)){
  const mode=['columns','dispatch','briefing','diagram','index','steps','postcard','flashcard'].indexOf(c.layout);
  const cellHeight=(bodyH-42)/points.length;
  points.forEach((v,i)=>{
   const y=bodyTop+i*cellHeight;
   const x=[62,70+i*90,mode%2?80:115,i%2?245:55,74,95+i*80,100,70][mode];
   const w=[950,930-i*90,830,i%2?775:780,930,875-i*80,880,940][mode];
   const fill=[p.soft,i%2?p.bg:p.soft,p.bg,i%2?p.accent:p.soft,i%2?p.bg:p.soft,p.soft,p.accent,i===0?p.accent:p.soft][mode];
   const color=fill===p.accent?accentInk:p.ink;
   art+=rect(x,y,w,cellHeight-13,fill,[1,30,8,65,0,20,30,40][mode]);
   const tag=[`0${i+1}`,`IDEA ${i+1}`,i===0?'ABRE':'APLICA',`${i+1}`,`CLAVE ${i+1}`,`PASO ${i+1}`,'NOTA',i===0?'PREGUNTA':'RESPUESTA'][mode];
   art+=tx(tag,x+25,y+12,w-50,44,26,fill===p.accent?color:p.accent,true)+tx(v,x+25,y+63,w-50,cellHeight-83,41,color,mode===7&&i===0);
  });
 }
 const image=c.illustration?editorialIllustration(c.illustration,p,785,63,234):'';
 const headingWidth=c.illustration?710:960;
 const cta=c.illustration?c.cta+' · WhatsApp 809-643-5502':'ORIENTACIÓN · WHATSAPP 809-643-5502';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${H}" viewBox="0 0 1080 ${H}">
 ${rect(0,0,1080,H,p.bg)}${art}${image}
 ${logo?`<image href="${esc(logo)}" x="60" y="35" width="85" height="85"/>`:''}
 ${tx('INTECA',logo?165:60,36,570,62,42,p.ink,true)}
 ${tx('APRENDE · PRACTICA · CRECE',logo?165:60,94,760,40,23,p.accent,true)}
 ${tx(c.angle.toLocaleUpperCase('es'),60,156,960,50,28,p.accent,true)}
 ${tx(headline,60,218,headingWidth,bodyTop-240,input.vertical?68:54,p.ink,true)}
 ${tx(course,60,H-278,960,92,34,p.ink,true)}
 ${tx(facts,60,H-180,960,65,26)}
 ${rect(55,H-96,970,65,p.accent,14)}${tx(cta,80,H-87,925,52,28,accentInk,true)}
 </svg>`;
 return svg;
}
