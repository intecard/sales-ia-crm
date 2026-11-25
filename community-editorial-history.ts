import type {Catalog} from './whatsapp-catalog.ts';
import {makeContent,type CommunityPayload,type SocialChannel} from './community-plan.ts';
import {repeatedEditorial,type EditorialCreative} from './community-editorial.ts';
type Piece={slot:string;channel:SocialChannel;scheduled_at:string;payload:CommunityPayload;state?:string};
const active=(p:Piece)=>!['missed','blocked'].includes(p.state||'');
/** Preserve persisted payloads across rolling renewals. Cross-platform copies intentionally share one asset.
 * Novelty uses actual teaching copy, never filenames, dates, prices or brand boilerplate. */
export function diversifyPlan<T extends Piece>(plan:T[],existing:Piece[],catalog:Catalog):Array<T&{repetitionBlocked?:boolean}>{
 const saved=new Map(existing.map(p=>[p.slot,p]));
 const history=existing.filter(p=>active(p)&&p.payload.creative);
 const chosen=new Map<string,CommunityPayload>();
 return [...plan].sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.channel.localeCompare(b.channel)).map(item=>{
  const old=saved.get(item.slot);
  if(old)return {...item,payload:old.payload};
  const at=Date.parse(item.scheduled_at),asset=item.payload.assetKey;
  const recent=history.filter(p=>p.channel===item.channel&&Date.parse(p.scheduled_at)<at&&Date.parse(p.scheduled_at)>=at-7*86400000)
    .sort((a,b)=>b.scheduled_at.localeCompare(a.scheduled_at)).map(p=>p.payload.creative!).filter(Boolean);
  const acceptable=(c:EditorialCreative)=>!repeatedEditorial(c,recent)&&(!recent[0]||c.layout!==recent[0].layout);
  let payload=chosen.get(asset)||item.payload;
  const course=catalog.courses.find(c=>c.title===payload.courseTitle)!;
  for(let revision=1;!acceptable(payload.creative!)&&revision<=240;revision++)
   payload=makeContent(course,catalog,item.payload.editorialDate!,item.payload.kind,Number(item.slot.split(':')[3]),revision);
  const repetitionBlocked=!acceptable(payload.creative!);
  if(!repetitionBlocked){chosen.set(asset,payload);history.push({...item,payload});}
  return {...item,payload,...(repetitionBlocked?{repetitionBlocked:true}:{})};
 });
}
