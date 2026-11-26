import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { courseFamily, type CourseFamily } from './community-course-topics.ts';
import { renderINTECAFlyer } from './community-flyer-renderer.ts';
import { storeCommunityAsset } from './community-media.ts';
import type { CommunityPayload } from './community-plan.ts';

const model = 'gemini-3.1-flash-lite-image';
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const settings = (env: NodeJS.ProcessEnv) => ({
  enabled: env.CM_FLYER_PHOTOGRAPHY_ENABLED === 'true',
  // A separate restricted key is optional; the existing Gemini key can be used if image billing is active.
  key: env.CM_FLYER_IMAGE_API_KEY?.trim() || env.GEMINI_API_KEY?.trim(),
});
export function flyerPhotoStatus(env = process.env) {
  const config = settings(env);
  return {
    enabled: config.enabled,
    credentialConfigured: Boolean(config.key),
    model,
    requestsPerDay: 2,
  };
}

const workplaces: Record<CourseFamily, string> = {
  authorizations: 'a healthcare authorizations call center in Santo Domingo, with headsets, workstation rows and anonymous eligibility screens',
  master_authorizations: 'a healthcare authorization escalation team operations room with a case planning board without writing',
  precertification: 'a healthcare precertification administrative desk with blank document trays, a scanner and a practice workstation',
  patient_service: 'an accessible clinic reception and patient services desk, with an appointment counter',
  pharmacology: 'an educational medical representative training room with molecule models, unbranded boxes and blank reference cards',
  nursing: 'a nursing simulation classroom with a medical training mannequin on a simulation bed, no real patients and no active procedure',
  health_insurance_promoter: 'a health insurance orientation office with consultation desks and anonymous coverage diagrams',
  health_promoter: 'a community health education workshop in a Dominican neighborhood center with unlabelled educational props',
  medical_billing: 'a medical billing back office with anonymous practice forms and computer workstations',
  pharmacy: 'a pharmacy training lab with shelves of plain medicine boxes and an unbranded learning counter',
  unknown: 'a practical vocational training room with equipment visibly relevant to the course',
};
const scenes = [
  'A candid eye-level view of two Dominican professionals actively working, taking calls or preparing the room. Soft morning light.',
  'An architecture photograph of the empty workplace with no people, silhouettes, portraits or faces. Wide shot from the entrance.',
  'A completely different group of Dominican adults actively collaborating; vary ages, hair, clothes and where they sit. Three-quarter angle and bright side lighting.',
  'Tight documentary detail of the tools of the trade laid out before a shift. No visible writing or people. Clean side light and texture.',
  'Over-the-shoulder candid view of one Dominican professional and a colleague with different ages, hair and wardrobe, focusing on workspace and task. Diffuse window light.',
  'Wide composition from the opposite end: a different floor plan and furniture, empty workplace under warm end-of-day light; no people or faces.',
  'Foreground instruments with a small team at work in the midground, visually distinct clothing and no poses. Natural overhead light.',
  'Unoccupied workplace seen obliquely from a high corner, visually distinct color scheme and window placement. No people.',
];
const views = ['clean neutral tones', 'muted teal and natural wood', 'warm clay and white', 'cool slate and cream', 'soft ocean blue and amber', 'linen tones and forest green', 'pale gray and mint', 'soft violet and white'];
export function flyerPhotoPrompt(p: CommunityPayload) {
  const date = p.editorialDate || '';
  const day = Date.parse(date + 'T00:00:00Z') / 86_400_000 - Date.UTC(2026,0,1)/86_400_000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(day) || !p.creative || !p.editorialSlot)
    throw Error('CM_FLYER_PHOTO_INVALID_PAYLOAD');
  const offset = day + (p.editorialSlot === 'afternoon' ? 3 : 0);
  const scene = scenes[((offset % scenes.length) + scenes.length) % scenes.length];
  const palette = views[(createHash('sha256').update(p.assetKey).digest()[0]) % views.length];
  return [
    'Create one original photorealistic landscape editorial photograph for a Dominican vocational education flyer.',
    `Course: ${p.courseTitle}. Approved editorial topic: ${p.creative.topic}.`,
    `Setting: ${workplaces[courseFamily(p.courseTitle)]}. ${scene}`,
    `Art direction for this unique composition: ${palette}. Keep important subjects inside the middle 70 percent so the image can be cropped.`,
    'Show a fictional place and fictional adults if requested. Unbranded. Screens and papers must be blank or softly blurred, with no legible information.',
    'Return just the photograph, no writing, prices, logos, badges, collage, border or graphic overlay. No actual patient information, clinical treatment or claims.',
  ].join('\n');
}

async function requestPhoto(p: CommunityPayload, key: string, fetcher: typeof fetch) {
  const response = await fetcher(endpoint, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{role:'user', parts:[{text:flyerPhotoPrompt(p)}]}],
      generationConfig: { responseModalities:['IMAGE'], candidateCount: 1, imageConfig: {aspectRatio:'16:9',imageSize:'1K'} },
    }),
    signal: AbortSignal.timeout(65_000),
  }).catch(() => { throw Error('CM_FLYER_PHOTO_REQUEST_UNCERTAIN'); });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw Error('CM_FLYER_PHOTO_ACCESS_REQUIRED');
    if (response.status === 429) throw Error('CM_FLYER_PHOTO_QUOTA');
    throw Error('CM_FLYER_PHOTO_PROVIDER_ERROR');
  }
  const result = await response.json().catch(() => null);
  const images = result?.candidates?.flatMap((c: {content?:{parts?:Array<{inlineData?:{mimeType?:string;data?:string}}>}}) =>
    (c.content?.parts ?? []).map(part => part.inlineData).filter(x => typeof x?.data === 'string')) ?? [];
  const image = images[0];
  if (images.length !== 1 || !['image/png','image/jpeg','image/webp'].includes(image?.mimeType) ||
    image.data.length > 10_000_000) throw Error('CM_FLYER_PHOTO_INVALID_RESPONSE');
  try {
    const input = sharp(Buffer.from(image.data,'base64'), {limitInputPixels:10_000_000});
    const metadata = await input.metadata();
    if (!['jpeg','png','webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1 ||
      (metadata.width ?? 0) < 640 || (metadata.height ?? 0) < 360) throw Error('Invalid image dimensions');
    const photo = await input.rotate().flatten({background:'#ffffff'}).toColourspace('srgb').jpeg({quality:90}).toBuffer();
    return {photo, fingerprint:await photoFingerprint(photo)};
  } catch { throw Error('CM_FLYER_PHOTO_INVALID_RESPONSE'); }
}

export async function photoFingerprint(photo: Buffer) {
  const pixels = await sharp(photo,{limitInputPixels:10_000_000}).greyscale().resize(9,8,{fit:'fill'}).raw().toBuffer();
  let fingerprint = '';
  for (let i=0;i<8;i++) for (let j=0;j<8;j++)
    fingerprint += pixels[i*9+j] > pixels[i*9+j+1] ? '1' : '0';
  return fingerprint;
}

type Store = {request:(route:string,method:string,body:unknown)=>Promise<any>};
export async function prepareFlyerPhoto(
  p: CommunityPayload, store: Store, env = process.env, fetcher: typeof fetch = fetch,
) {
  const {enabled,key} = settings(env);
  if (!enabled || !key) throw Error('CM_FLYER_PHOTO_CREDENTIAL_REQUIRED');
  if (p.kind !== 'flyer' || p.creative?.version !== 'v8' || !p.editorialDate || !p.editorialSlot || !/^[a-f0-9]{32}$/.test(p.assetKey))
    throw Error('CM_FLYER_PHOTO_INVALID_PAYLOAD');
  const filename = createHash('sha256').update('flyer-photography-v1:'+p.assetKey).digest('hex').slice(0,32);
  const url = () => `${new URL(env.SUPABASE_URL || '').origin}/storage/v1/object/public/crm-community/${filename}.jpg`;
  const reservation = await store.request('rpc/crm_reserve_flyer_photo','POST',{p_asset:p.assetKey});
  if (reservation === 'ready') return url();
  if (reservation !== 'reserved')
    throw Error(reservation === 'in_progress' ? 'CM_FLYER_PHOTO_IN_PROGRESS' : 'CM_FLYER_PHOTO_REVIEW_REQUIRED');
  try {
    const {photo,fingerprint} = await requestPhoto(p,key,fetcher);
    // Claim the photo's perceptual hash before publishing and disallow near repeats.
    const decision = await store.request('rpc/crm_record_flyer_photo','POST',{p_asset:p.assetKey,p_hash:fingerprint});
    if (decision !== 'unique') throw Error('CM_FLYER_PHOTO_TOO_SIMILAR');
    const bytes = await renderINTECAFlyer(p,process.cwd(),photo);
    const asset = await storeCommunityAsset(filename,bytes,false,env,fetcher);
    const updated = await store.request(`crm_community_flyer_photos?asset_key=eq.${p.assetKey}&state=eq.reserved`,'PATCH',{state:'ready'});
    if (!Array.isArray(updated) || updated.length !== 1) throw Error('CM_FLYER_PHOTO_PREPARATION_FAILED');
    return asset;
  } catch (error) {
    const code = error instanceof Error && /^CM_FLYER_PHOTO_[A-Z_]+$/.test(error.message)
      ? error.message : 'CM_FLYER_PHOTO_PREPARATION_FAILED';
    await store.request(`crm_community_flyer_photos?asset_key=eq.${p.assetKey}&state=eq.reserved`,'PATCH',
      {state:'failed',last_error:code}).catch(()=>{});
    throw Error(code,{cause:error});
  }
}
