import test from 'node:test';
import assert from 'node:assert/strict';
import {AD_BILLING_LINKS,integratedReadiness} from './advertising-operational-readiness.ts';
const local={serverReady:true,databaseReady:true,storageReady:true,referencePresent:true,workerConnected:false,autoEnabled:false,readyForProduction:false};
const videos={heygen:{ready:false,reason:'Falta HEYGEN_API_KEY'},runway:{renderReady:false,reason:'Falta RUNWAYML_API_SECRET'},local};
test('Read-verified Meta and Google do not prove cards, billing or authorize spending',()=>{
 const r=integratedReadiness([
  {channel:'meta_ads',state:'verified_read',readVerified:true},
  {channel:'google_ads',state:'verified_read',readVerified:true},
  {channel:'facebook',state:'verified_read',readVerified:true},
 ],videos);
 assert.equal(r.advertising.meta.accountReadVerified,true);
 assert.equal(r.advertising.google.accountReadVerified,true);
 assert.equal(r.advertising.billingVerified,false);
 assert.equal(r.advertising.cardDataStoredInCrm,false);
 assert.equal(r.advertising.campaignSpendingAuthorized,false);
 assert.equal(r.advertising.meta.billingMethodVerified,false);
 assert.equal(r.advertising.google.billingMethodVerified,false);
 assert.equal(r.creatives.localVideo.readyForProduction,false);
 assert.equal(r.creatives.genericImageVideoEnvKeysRequired,false);
 assert.equal(r.mediaReadVerified.youtube,false);
});
test('Stale/expired/missing access cannot be portrayed as read-verified',()=>{
 for(const state of ['expired','not_checked','missing_credentials','provider_rejected']){
  const r=integratedReadiness([{channel:'meta_ads',state,readVerified:true}],videos);
  assert.equal(r.advertising.meta.accountReadVerified,false);
 }
});
test('Even a configured GPU or paid providers do not trigger spending or completed video assertions',()=>{
 const ready=integratedReadiness([],{heygen:{ready:true},runway:{renderReady:true},
  local:{...local,workerConnected:true,autoEnabled:true,readyForProduction:true}});
 assert.equal(ready.creatives.heygen.configured,true);
 assert.equal(ready.creatives.heygen.verifiedRendering,false);
 assert.equal(ready.creatives.runway.verifiedRendering,false);
 assert.equal(ready.creatives.localVideo.readyForProduction,true);
 assert.equal(ready.advertising.campaignSpendingAuthorized,false);
 assert.equal(ready.advertising.billingVerified,false);
});
test('Billing links target official account systems rather than a CRM payment form',()=>{
 assert.match(AD_BILLING_LINKS.meta,/^https:\/\/business\.facebook\.com\//);
 assert.match(AD_BILLING_LINKS.google,/^https:\/\/ads\.google\.com\/$/);
});
