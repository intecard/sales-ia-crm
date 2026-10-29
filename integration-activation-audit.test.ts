import test from 'node:test';
import assert from 'node:assert/strict';
import {activationAudit,type ActivationEvidence} from './integration-activation-audit.ts';
const empty:ActivationEvidence={
 flyers:{configured:true,renderTestVerified:false},
 videos:{heygen:{ready:false},runway:{renderReady:false},
  local:{readyForProduction:false,workerConnected:false,referencePresent:false,storageReady:false,autoEnabled:false}},
 payments:{preferredProvider:'unselected',merchantStatus:'contract_pending',
  sandboxCertified:false,productionCertified:false,linkInfrastructureReady:false,checkoutAvailable:false},
 campus:{verified:false,authReady:false,databaseReady:false,courseCount:0,readyForEnrollment:false,
   campusSyncEnabled:false,errorCode:'CAMPUS_NOT_CONFIGURED'},
 counts:{courseMappings:0,enrollments:0,fiscalProfiles:0},
 fiscal:{companyProfilePresent:false,companyAuthorizationVerified:false,emissionAdapterCertified:false},
};
test('five-service audit reports true blockers without revealing credentials',()=>{
 const result=activationAudit(empty,new Date('2026-10-28T21:00:00-04:00'));
 assert.equal(result.checks.length,5);
 assert.equal(result.allOperational,false);
 assert.equal(result.checks.find(x=>x.id==='payments')?.state,'blocked');
 assert.equal(result.checks.find(x=>x.id==='campus')?.state,'blocked');
 assert.equal(result.checks.find(x=>x.id==='dgii')?.state,'blocked');
 assert.equal(result.checks.find(x=>x.id==='flyers')?.state,'partial');
 assert.equal(result.checks.find(x=>x.id==='video')?.state,'blocked');
 assert.ok(!JSON.stringify(result).includes('PRIVATE_KEY'));
});
test('present credentials are not proof of real signed card payments, Firebase provisioning, DGII issuance or MP4',()=>{
 const sample:ActivationEvidence={
 ...empty,
 videos:{...empty.videos,heygen:{ready:true},local:{...empty.videos.local,workerConnected:true,referencePresent:true}},
 payments:{...empty.payments,preferredProvider:'azul',linkInfrastructureReady:true},
 campus:{...empty.campus,verified:true,authReady:true,databaseReady:true,courseCount:3},
 counts:{...empty.counts,courseMappings:0},
 fiscal:{...empty.fiscal,companyProfilePresent:true},
 };
 const result=activationAudit(sample);
 assert.equal(result.allOperational,false);
 for(const id of ['payments','campus','video','dgii'])
   assert.notEqual(result.checks.find(x=>x.id===id)?.state,'ready');
});
test('reached status only for verified components, all-operational requires all five',()=>{
 const input:ActivationEvidence={
 ...empty,
 flyers:{configured:true,renderTestVerified:true},
 videos:{...empty.videos,heygen:{ready:true,verifiedRendering:true},local:{
    readyForProduction:true,workerConnected:true,referencePresent:true,storageReady:true,autoEnabled:true}},
 payments:{preferredProvider:'cardnet',merchantStatus:'production',sandboxCertified:true,
  productionCertified:true,linkInfrastructureReady:true,checkoutAvailable:true},
 campus:{verified:true,authReady:true,databaseReady:true,courseCount:3,
  readyForEnrollment:true,campusSyncEnabled:true,errorCode:null},
 counts:{courseMappings:3,enrollments:2,fiscalProfiles:1},
 fiscal:{companyProfilePresent:true,companyAuthorizationVerified:true,emissionAdapterCertified:true},
 };
 const result=activationAudit(input);
 assert.equal(result.checks.find(x=>x.id==='flyers')?.state,'ready');
 assert.equal(result.checks.find(x=>x.id==='payments')?.state,'ready');
 assert.equal(result.checks.find(x=>x.id==='campus')?.state,'ready');
 assert.equal(result.checks.find(x=>x.id==='dgii')?.state,'ready');
 // video is partial until a complete QA-reviewed MP4 pipeline is integrated.
 assert.equal(result.checks.find(x=>x.id==='video')?.state,'partial');
 assert.equal(result.allOperational,false);
});
