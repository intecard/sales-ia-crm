import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { GatewayPrecontract,extractVerifiedOrderId,paymentLinkToken } from './payment-gateway-precontract.ts';

const secret='owner-only-generated-secret-'.padEnd(64,'z');
const url='https://sales.ia.crm.inteca.com.do';
const env={APP_URL:url,PAYMENT_LINK_SECRET:secret,PAYMENT_PROVIDER:'azul',PAYMENT_SECRET_KEY:'SHOULD_NOT_ENABLE_CHECKOUT'} as NodeJS.ProcessEnv;
const sampleId=randomUUID();
const sample={id:sampleId,contact_key:'8096435502',course_title:'Técnico en Autorizaciones Médicas',
 amount_minor:250000,currency:'DOP',preferred_provider:'unselected',
 state:'awaiting_contract',created_at:'2026-10-28T11:00:00Z',expires_at:'2026-11-10T11:00:00Z'};

function fixture(order={...sample},setting:any={
 preferred_provider:'unselected',merchant_status:'contract_pending',sandbox_certified:false,
 production_certified:false,checkout_enabled:false
}){
 let calls:Array<{resource:string;method?:string;body?:any}>=[];
 const store={request:async(resource:string,method?:string,body?:unknown)=>{
   calls.push({resource,method,body});
   if(resource.startsWith('crm_gateway_settings'))return [setting];
   if(resource.startsWith('crm_gateway_orders?id=eq.'))return resource.includes(order.id)?[order]:[];
   if(resource.startsWith('crm_gateway_orders?select='))return [order];
   if(resource.startsWith('crm_sales_opportunities?'))return [{contact_key:sample.contact_key,expected_amount:2500,profile:{fullName:'Cliente de prueba',course:sample.course_title},stage:'interested'}];
   if(resource==='rpc/crm_gateway_prepare_order')return [order];
   throw Error('UNEXPECTED QUERY '+resource);
 }};
 const client=new GatewayPrecontract(store as any,env,()=>Date.parse('2026-10-28T13:00:00Z'));
 return {client,calls,order};
}
test('Payment link uses HMAC and refuses forged/weak links',()=>{
 const token=paymentLinkToken(sampleId,secret);
 assert.equal(extractVerifiedOrderId(token,secret),sampleId);
 assert.equal(extractVerifiedOrderId(token+'x',secret),null);
 assert.equal(extractVerifiedOrderId(token,'wrong'),null);
 assert.equal(extractVerifiedOrderId('non-id.something',secret),null);
 assert.throws(()=>paymentLinkToken(sampleId,'short'),/GATEWAY_LINK_NOT_READY/);
});
test('Admin gets an idempotent bank-quoted payment request URL; never sets price from browser',async()=>{
 const {client,calls}=fixture();
 const response=await client.prepare(sample.contact_key,'unselected');
 assert.equal(response.amountMinor,250000);
 assert.ok(response.link?.startsWith(url+'/pagar/'));
 assert.equal(response.course,sample.course_title);
 assert.equal(calls.at(-1)?.resource,'rpc/crm_gateway_prepare_order');
 assert.deepEqual(calls.at(-1)?.body,{p_contact_key:sample.contact_key,p_preferred_provider:'unselected'});
});
test('Public request does not expose contact identity nor allow card payment without contract',async()=>{
 const {client}=fixture();
 const token=paymentLinkToken(sampleId,secret);
 const result=await client.publicOrder(token);
 assert.equal(result.checkoutAvailable,false);
 assert.equal(result.amountMinor,250000);
 assert.equal(result.state,'awaiting_gateway');
 assert.equal('contact_key' in result,false);
 assert.equal('customerName' in result,false);
 await assert.rejects(client.beginCheckout(token),/GATEWAY_CONTRACT_REQUIRED/);
});
test('Even accidental provider credentials or toggled database flags cannot authorize a card charge',async()=>{
 const {client}=fixture({...sample},{
   preferred_provider:'azul',merchant_status:'production',sandbox_certified:true,production_certified:true,checkout_enabled:true,
 });
 const status=await client.status();
 assert.equal(status.checkoutAvailable,false);
 await assert.rejects(client.beginCheckout(paymentLinkToken(sampleId,secret)),/GATEWAY_CONTRACT_REQUIRED/);
});
test('Expired/invalidated payment links are never payable',async()=>{
 const expired={...sample,expires_at:'2026-10-27T00:00:00Z'};
 const {client}=fixture(expired);
 const p=await client.publicOrder(paymentLinkToken(sampleId,secret));
 assert.equal(p.state,'expired');
 await assert.rejects(client.beginCheckout(paymentLinkToken(sampleId,secret)),/GATEWAY_ORDER_UNAVAILABLE/);
 await assert.rejects(client.publicOrder('fake'),/GATEWAY_LINK_INVALID/);
});
test('Merchant link creation fails securely if no private link secret is set',async()=>{
 const {calls}=fixture();
 const client=new GatewayPrecontract({request:async(resource:string,method?:string,body?:unknown)=>{
   calls.push({resource,method,body});return [];
 }} as any,{APP_URL:url} as NodeJS.ProcessEnv);
 await assert.rejects(client.prepare(sample.contact_key,'azul'),/GATEWAY_LINK_NOT_READY/);
 assert.equal(calls.length,0);
});
