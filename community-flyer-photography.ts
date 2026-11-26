import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { courseFamily, type CourseFamily } from './community-course-topics.ts';
import type { CommunityPayload } from './community-plan.ts';

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
    `Photorealistic documentary photograph: ${workplaces[courseFamily(p.courseTitle)]}. ${scene}`,
    `Educational context: ${p.courseTitle}, ${p.creative.topic}.`,
    `Art direction for this unique composition: ${palette}. Keep important subjects inside the middle 70 percent so the image can be cropped.`,
    'Show a fictional place and fictional adults if requested. Unbranded. Screens and papers must be blank or softly blurred, with no legible information.',
    'Return just the photograph, no writing, prices, logos, badges, collage, border or graphic overlay. No actual patient information, clinical treatment or claims.',
  ].join('\n');
}

export async function photoFingerprint(photo: Buffer) {
  const pixels = await sharp(photo,{limitInputPixels:10_000_000}).greyscale().resize(9,8,{fit:'fill'}).raw().toBuffer();
  let fingerprint = '';
  for (let i=0;i<8;i++) for (let j=0;j<8;j++)
    fingerprint += pixels[i*9+j] > pixels[i*9+j+1] ? '1' : '0';
  return fingerprint;
}
