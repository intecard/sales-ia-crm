/** Topic illustrations built from original vector objects. No third-party photos or raster data. */
export const ILLUSTRATION_MOTIFS=['expediente','lupa','conversacion','escudo','cuaderno','inventario','red','grafico','ruta','equipo'] as const;
export type IllustrationMotif=typeof ILLUSTRATION_MOTIFS[number];
export type EditorialArt={motif:IllustrationMotif;seed:number;frame:number};
export function illustrationMotif(topic:string,seed:number):IllustrationMotif{
 const t=topic.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const match:Array<[RegExp,IllustrationMotif[]]>=[[/farmac|inventar|dispens/,[ 'inventario','lupa','cuaderno']], [/comuni|atencion|empatia/,[ 'conversacion','equipo','red']], [/cobertura|seguro|biosegur/,[ 'escudo','lupa','ruta']], [/ley|cie|factur|auditor/,[ 'expediente','lupa','grafico']], [/comunida|promocio|prevencio/,[ 'red','equipo','ruta']], [/solicit|autoriza|proced|document|expediente/,[ 'expediente','ruta','cuaderno']]];
 const group=match.find(([p])=>p.test(t))?.[1]||ILLUSTRATION_MOTIFS;
 return group[seed%group.length];
}
export function editorialIllustration(a:EditorialArt,p:{bg:string;ink:string;accent:string;soft:string},x:number,y:number,size:number){
 let state=a.seed>>>0;const rnd=(max:number)=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%max;};
 const frame=[`<circle cx="130" cy="126" r="121" fill="${p.soft}"/>`,`<rect x="8" y="8" width="244" height="237" rx="42" fill="${p.soft}" transform="rotate(-7 130 128)"/>`,`<path d="M14 167 Q-31 50 110 11 Q233 -21 251 101 Q284 223 167 237 Q62 271 14 167Z" fill="${p.soft}"/>`,`<path d="M130 2 L254 71 L254 187 L130 253 L6 187 L6 71Z" fill="${p.soft}"/>`][a.frame%4];
 const shapes:Record<IllustrationMotif,string>={
  expediente:'<rect x="53" y="27" width="145" height="187" rx="18"/><path d="M96 28 V14 H155 V28 M82 69 H170 M82 101 H159 M82 133 H136 M119 170 L136 187 L170 149"/>',
  lupa:'<rect x="43" y="24" width="123" height="166" rx="14"/><path d="M66 60 H138 M66 91 H122"/><circle cx="148" cy="135" r="49"/><path d="M184 174 L223 219"/>',
  conversacion:'<path d="M27 40 H173 Q188 40 188 59 V117 Q188 133 170 133 H79 L50 157 V133 H33 Q16 133 16 115 V59 Q16 40 27 40Z M84 155 V177 Q84 194 100 194 H177 L211 219 V194 H224 Q241 194 241 175 V116 Q241 98 221 98 H210 M52 82 H150 M52 107 H115"/>',
  escudo:'<path d="M130 21 L220 56 V115 Q216 182 130 226 Q44 182 40 115 V56 Z M85 116 L116 147 L177 84"/>',
  cuaderno:'<rect x="53" y="32" width="152" height="187" rx="14"/><path d="M80 34 V218 M40 63 H66 M40 103 H66 M40 143 H66 M40 183 H66 M101 67 H175 M101 101 H169 M101 135 H149 M124 189 L150 166 L190 203"/>',
  inventario:'<path d="M32 99 L103 66 L177 99 V192 L103 225 L32 192 Z M32 99 L103 136 L177 99 M103 136 V225 M103 66 L159 40 L230 72 V165 L177 192 M177 99 L230 72 M69 82 L140 116"/>',
  red:'<path d="M128 128 L59 53 M128 128 L200 53 M128 128 L51 202 M128 128 L208 198"/><circle cx="128" cy="128" r="35"/><circle cx="59" cy="53" r="27"/><circle cx="200" cy="53" r="27"/><circle cx="51" cy="202" r="27"/><circle cx="208" cy="198" r="27"/>',
  grafico:'<path d="M32 35 V213 H227 M54 167 L105 118 L141 137 L211 67 M173 67 H211 V105 M76 193 V176 M119 193 V158 M160 193 V160 M202 193 V128"/>',
  ruta:'<path d="M64 200 H165 Q203 200 203 163 Q203 128 165 128 H89 Q50 128 50 91 Q50 52 92 52 H194 M163 26 L194 52 L163 76"/><circle cx="54" cy="200" r="25"/><circle cx="208" cy="51" r="22"/>',
  equipo:'<circle cx="130" cy="68" r="31"/><circle cx="53" cy="107" r="22"/><circle cx="207" cy="107" r="22"/><path d="M70 214 V173 Q70 139 109 130 H151 Q190 139 190 173 V214 Z M60 158 Q23 161 19 188 V205 H53 M200 158 Q237 161 241 188 V205 H207"/>',
 };
 let detail='';for(let i=0;i<6;i++)detail+=`<circle cx="${13+rnd(234)}" cy="${8+rnd(232)}" r="${3+rnd(6)}" fill="${p.accent}" opacity=".28"/>`;
 return `<g transform="translate(${x} ${y}) scale(${size/260})">${frame}${detail}<g fill="none" stroke="${p.accent}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${rnd(15)-7} 130 126)">${shapes[a.motif]}</g></g>`;
}
