import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {makeContent} from './community-plan.ts';
import {flyerOffer} from './community-flyer-offer.ts';
import {parseCatalog} from './whatsapp-catalog.ts';
import {CommunityPublisher} from './community-publisher.ts';
import {brandedMediaKey,brandedMediaMatches} from './community-publication-assets.ts';

test('publisher rejects pre-update assets, and metadata starts with the exact course and both prices',async()=>{
 const catalog=parseCatalog(readFileSync('test-fixtures/whatsapp-catalog.txt','utf8'));
 const course=catalog.courses.find(c=>c.title.endsWith('Autorizaciones Médicas'))!;
 assert.ok(course);
 const base=makeContent(course,catalog,'2026-11-26','short',1);
 const p={...base,flyerOffer:flyerOffer(course,'2026-11-26')};
 const calls:Array<{url:string,body?:unknown}>=[];
 const fetcher:typeof fetch=async(url,init)=>{
  calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):undefined});
  return calls.length===1?Response.json({id:'123'}):Response.json({permalink_url:'https://facebook.com/123'});
 };
 const env={SUPABASE_URL:'https://test.supabase.co',META_PAGE_ID:'101'};
 const pub=new CommunityPublisher({} as never,env,fetcher);
 const old=env.SUPABASE_URL+'/storage/v1/object/public/crm-community/'+p.assetKey+'.mp4';
 await assert.rejects(()=>pub.publish('facebook',p,old,async()=>{}),/CM_UNBRANDED_MEDIA/);
 assert.equal(calls.length,0);
 const url=env.SUPABASE_URL+'/storage/v1/object/public/crm-community/'+brandedMediaKey(p)+'.mp4';
 assert.equal(brandedMediaMatches({...p,assetKey:'unrelated'},url),false);
 assert.equal(brandedMediaMatches(p,url.replace(/\.mp4$/,'.jpg')),false);
 assert.equal((await pub.publish('facebook',p,url,async()=>{})).state,'published');
 const sent=calls[0].body as {title:string;description:string};
 assert.equal(sent.title,p.courseTitle);
 assert.ok(sent.description.startsWith(`${p.courseTitle}\nInscripción: ${p.flyerOffer.registration} · Mensualidad: ${p.flyerOffer.monthly}`));
});
