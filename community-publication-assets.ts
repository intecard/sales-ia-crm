import {sha, type CommunityPayload} from './community-plan.ts';

export const publicationVideo = (p: CommunityPayload) => ['short','promo_video'].includes(p.kind);
const brandedStem = (p: CommunityPayload) => 'b1' + sha(['visible-brand-v1',p.assetKey]).slice(0,16);
export const brandedMediaKey = (p: CommunityPayload, version = 'standard') =>
  brandedStem(p) + sha(version).slice(0,14);

export function brandedMediaMatches(p: CommunityPayload, url: string | null | undefined) {
 const extension=publicationVideo(p)?'mp4':'jpg';
 if(!url)return false;
 try{
  const parsed=new URL(url);
  return parsed.protocol==='https:' &&
   new RegExp(`^/storage/v1/object/public/crm-community/${brandedStem(p)}[a-f0-9]{14}\\.${extension}$`).test(parsed.pathname) &&
   !parsed.search&&!parsed.hash;
 }catch{return false;}
}
