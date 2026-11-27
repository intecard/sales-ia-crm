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
