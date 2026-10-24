import test from 'node:test';
import assert from 'node:assert/strict';
import { metaOAuthJson, MetaOAuthError, probeMetaClient } from './meta-oauth-diagnostics.ts';
test('Meta diagnostics never disclose provider payloads or credentials', async () => {
  const fetcher: typeof fetch = async () => Response.json({error:{code:101,error_subcode:1,message:'Invalid client secret private-secret',access_token:'private-token'}},{status:400});
  const result = await probeMetaClient({META_APP_ID:'123',DS_META_APP_SECRET:'private-secret'},fetcher);
  assert.equal(result.clientVerified,false);assert.equal(result.code,'OAUTH_META_SECRET');
  assert.equal(JSON.stringify(result).includes('private-'),false);
  await assert.rejects(metaOAuthJson('https://graph.facebook.com/v26.0/oauth/access_token',{},'code_exchange',fetcher), e=>e instanceof MetaOAuthError && e.message==='OAUTH_META_SECRET' && e.providerCode===101);
});
test('client check trims outer whitespace and discards app token', async () => {
  const result=await probeMetaClient({META_APP_ID:' 123 ',DS_META_APP_SECRET:' secret\n'},async (_url,init)=>{
    const form=new URLSearchParams(String(init?.body));assert.equal(form.get('client_id'),'123');assert.equal(form.get('client_secret'),'secret');assert.equal(form.get('grant_type'),'client_credentials');return Response.json({access_token:'discard-this'});
  });
  assert.deepEqual(result,{clientVerified:true});
});
