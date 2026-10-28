import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SalesStore } from './sales-agent.ts';

export type GatewayProvider='unselected'|'azul'|'cardnet';
export type GatewayOrder={
  id:string;contact_key:string;course_title:string;amount_minor:number;
  currency:'DOP';preferred_provider:GatewayProvider;
  state:'awaiting_contract'|'checkout_requested'|'awaiting_provider_confirmation'|'paid_verified'|
        'declined'|'cancelled'|'expired'|'review_required';
  created_at:string;expires_at:string;
};
export type GatewaySettings={
 preferred_provider:GatewayProvider;merchant_status:'contract_pending'|'sandbox'|'production';
 sandbox_certified:boolean;production_certified:boolean;checkout_enabled:boolean;
};
type Store=Pick<SalesStore,'request'>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenMac=(secret:string,id:string)=>createHmac('sha256',secret).update('inteca:payment-link:v1:'+id).digest('base64url');
const dateValid=(s:string)=>Number.isFinite(Date.parse(s));
const validSecret=(secret?:string)=>typeof secret==='string'&&secret.length>=32;
export function paymentLinkToken(id:string,secret:string){
  if(!uuid.test(id)||!validSecret(secret))throw Error('GATEWAY_LINK_NOT_READY');
  return id+'.'+tokenMac(secret,id);
}
export function extractVerifiedOrderId(token:string,secret:string):string|null{
 if(!validSecret(secret)||typeof token!=='string'||token.length>120)return null;
 const match=token.match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i);
 if(!match||!uuid.test(match[1]))return null;
 const expected=Buffer.from(tokenMac(secret,match[1]));
 const provided=Buffer.from(match[2]);
 if(expected.length!==provided.length||!timingSafeEqual(expected,provided))return null;
 return match[1];
}
const publicState=(order:GatewayOrder,now:number)=>{
  if(order.state==='paid_verified')return 'paid_verified';
  if(order.state==='cancelled'||order.state==='declined'||order.state==='expired')return 'unavailable';
  if(!dateValid(order.expires_at)||Date.parse(order.expires_at)<=now)return 'expired';
  return 'awaiting_gateway';
};
export class GatewayPrecontract {
 constructor(private store:Store,private env:NodeJS.ProcessEnv=process.env,private clock:()=>number=Date.now){}
 private secret(){return this.env.PAYMENT_LINK_SECRET||'';}
 private origin(){
   const url=this.env.APP_URL||'';
   try{
     const origin=new URL(url);
     if(origin.protocol==='https:'&&!origin.username&&!origin.password&&origin.pathname==='/'&&!origin.search&&!origin.hash)return origin.origin;
   }catch{/* misconfigured domain */}
   throw Error('GATEWAY_APP_URL');
 }
 async settings():Promise<GatewaySettings>{
   const rows=await this.store.request('crm_gateway_settings?id=eq.inteca&limit=1');
   if(!rows?.length)throw Error('GATEWAY_MIGRATION_REQUIRED');
   return rows[0] as GatewaySettings;
 }
 async status(){
  const settings=await this.settings();
  return {
   preferredProvider:settings.preferred_provider,merchantStatus:settings.merchant_status,
   sandboxCertified:settings.sandbox_certified,productionCertified:settings.production_certified,
   linkInfrastructureReady:validSecret(this.secret())&&Boolean(this.env.APP_URL),
   checkoutAvailable:false as const,
   manualReceiptFlowPreserved:true,
   reason:'No existe contrato ni adaptador de cobro certificado. No aceptar datos de tarjetas ni confirmar pagos.',
   acceptedCurrency:'DOP' as const,
   acceptedProviders:['azul','cardnet'] as const,
   cardDataStored:false as const,
  };
 }
 async eligible(){
   const rows=await this.store.request('crm_sales_opportunities?select=contact_key,profile,expected_amount,stage&expected_amount=not.is.null&stage=neq.won&order=updated_at.desc&limit=100');
   return (rows as Array<{contact_key:string;profile:{fullName?:string;course?:string};expected_amount:string|number;stage:string}>)
    .filter(x=>Number(x.expected_amount)>=1&&Number(x.expected_amount)<=1_000_000&&x.profile?.course)
    .map(x=>({contactKey:x.contact_key,name:String(x.profile?.fullName||'Interesado').slice(0,100),
       course:String(x.profile.course).slice(0,180),amountDop:Number(x.expected_amount),stage:x.stage}));
 }
 async orders(){
  const rows=await this.store.request('crm_gateway_orders?select=id,contact_key,course_title,amount_minor,currency,preferred_provider,state,expires_at,created_at&order=created_at.desc&limit=100');
  return (rows as GatewayOrder[]).map(x=>this.adminView(x));
 }
 private adminView(order:GatewayOrder){
   let link:string|null=null;
   if(validSecret(this.secret())){
     try{link=this.origin()+'/pagar/'+paymentLinkToken(order.id,this.secret());}catch{/* provider not configured */}
   }
   return {id:order.id,contactKey:order.contact_key,course:order.course_title,
     amountMinor:order.amount_minor,currency:order.currency,preferredProvider:order.preferred_provider,
     state:publicState(order,this.clock()),link,createdAt:order.created_at,expiresAt:order.expires_at};
 }
 async prepare(contactKey:string,provider:GatewayProvider){
  if(!validSecret(this.secret()))throw Error('GATEWAY_LINK_NOT_READY');
  this.origin();
  if(typeof contactKey!=='string'||contactKey.length>256||contactKey.length<3)throw Error('GATEWAY_CONTACT_INVALID');
  if(!['unselected','azul','cardnet'].includes(provider))throw Error('GATEWAY_PROVIDER_INVALID');
  // DB RPC locks the genuine opportunity and snapshots its verified quoted amount/course.
  const rows=await this.store.request('rpc/crm_gateway_prepare_order','POST',{
    p_contact_key:contactKey,p_preferred_provider:provider,
  });
  if(!Array.isArray(rows)||!rows[0])throw Error('GATEWAY_PREPARE_FAILED');
  return this.adminView(rows[0] as GatewayOrder);
 }
 async publicOrder(token:string){
  const id=extractVerifiedOrderId(token,this.secret());
  if(!id)throw Error('GATEWAY_LINK_INVALID');
  const rows=await this.store.request('crm_gateway_orders?id=eq.'+id+'&limit=1');
  const order=rows?.[0] as GatewayOrder|undefined;
  if(!order)throw Error('GATEWAY_LINK_INVALID');
  const state=publicState(order,this.clock());
  return {course:order.course_title,amountMinor:order.amount_minor,currency:'DOP' as const,
    state,checkoutAvailable:false as const,provider:order.preferred_provider,
    expiresAt:order.expires_at,
    message:state==='paid_verified'?'Un pago aparece verificado. Contacta con INTECA si necesitas tu comprobante.':
     state==='awaiting_gateway'?'El pago con tarjeta todavía no está disponible; INTECA está preparando la pasarela oficial. No introduzcas datos bancarios aquí.':
     state==='expired'?'Este enlace ha vencido. Solicita uno nuevo a INTECA.':
     'Este enlace no está disponible. Contacta con INTECA.',
    whatsapp:'https://wa.me/18096435502',
  };
 }
 async beginCheckout(token:string){
  // No provider is under contract. This MUST fail closed even if DB settings are edited
  // and even if PAYMENT_PROVIDER/PAYMENT_SECRET_KEY are defined by mistake.
  const order=await this.publicOrder(token);
  if(order.state!=='awaiting_gateway')throw Error('GATEWAY_ORDER_UNAVAILABLE');
  throw Error('GATEWAY_CONTRACT_REQUIRED');
 }
}
