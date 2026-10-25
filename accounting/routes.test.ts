import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {createAccountingRouter} from './routes.ts';
test('accounting routes scope reads by company and reject invalid journal before database mutation',async()=>{
 const calls:{path:string;method:string}[]=[];const store={request:async(path:string,method='GET')=>{calls.push({path,method});return [];}};const app=express();app.use(express.json());app.use('/accounting',createAccountingRouter(store,()=> 'test'));const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const a=server.address() as {port:number};const base=`http://127.0.0.1:${a.port}/accounting`;
 try {let r=await fetch(base+'/org_test?period=2026-10');assert.equal(r.status,200);const d=await r.json();assert.equal(d.periodReport.income,'0.00');assert.equal(d.officialEmissionEnabled,false);assert.ok(calls.every(c=>c.path.includes('organization_id=eq.org_test')));
 r=await fetch(base+'/org_test/journals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});assert.equal(r.status,400);assert.ok(calls.every(c=>c.method==='GET'));
 r=await fetch(base+'/org_test/agent-review?period=2026-10');assert.equal(r.status,200);assert.equal((await r.json()).officialSubmission,false);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
