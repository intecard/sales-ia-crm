/**
 * Operational readiness, NOT a card gateway. Meta/Google retain billing credentials
 * in their own payment settings. Never infer card validity from a non-empty env var.
 */
export type AccountEvidence={
 channel:string;state?:string;readVerified?:boolean;
};
export type ProviderVideoEvidence={
 heygen:{ready:boolean;reason?:string|null;automaticSpending?:boolean};
 runway:{renderReady:boolean;reason?:string|null;automaticSpending?:boolean};
 local:{
   serverReady:boolean;databaseReady:boolean;storageReady:boolean;
   referencePresent:boolean;workerConnected:boolean;autoEnabled:boolean;
   readyForProduction:boolean;
 };
};
export const AD_BILLING_LINKS=Object.freeze({
 meta:'https://business.facebook.com/billing_hub/payment_settings',
 google:'https://ads.google.com/',
});
export function integratedReadiness(
  accounts:AccountEvidence[],
  videos:ProviderVideoEvidence,
){
 const channel=(id:string)=>accounts.find(a=>a.channel===id);
 const readVerified=(id:string)=>channel(id)?.state==='verified_read'&&channel(id)?.readVerified===true;
 const meta=readVerified('meta_ads'),google=readVerified('google_ads');
 // Neither read-only identity requests nor API key presence establishes billing.
 const metaBilling={accountReadVerified:meta,billingMethodVerified:false,
   requiresOwnerAction:true,link:AD_BILLING_LINKS.meta,
   instruction:'Selecciona la cuenta publicitaria de INTECA y configura o revisa el método de pago en Facturación y pagos de Meta.'};
 const googleBilling={accountReadVerified:google,billingMethodVerified:false,
   requiresOwnerAction:true,link:AD_BILLING_LINKS.google,
   instruction:'Abre Google Ads > Facturación > Métodos de pago en la cuenta publicitaria de INTECA.'};
 return {
   checkedAt:new Date().toISOString(),
   advertising:{
     mode:'provider_managed' as const,
     meta:metaBilling,google:googleBilling,
     cardDataStoredInCrm:false,
     billingVerified:false,
     campaignSpendingAuthorized:false,
     note:'Meta y Google cobran directamente. Ninguna variable AD_PAYMENT_* ni ID de facturación garantiza una tarjeta activa o permite gastar.',
   },
   creatives:{
     internalFlyers:{configured:true,renderTestVerified:false,note:'Motor local de flyers instalado; usa la prueba sin publicar antes de confirmar almacenamiento y redes.'},
     heygen:{configured:videos.heygen.ready,reason:videos.heygen.reason||null,verifiedRendering:false,requiresExplicitSpendApproval:true},
     runway:{configured:videos.runway.renderReady,reason:videos.runway.reason||null,verifiedRendering:false,requiresExplicitSpendApproval:true},
     localVideo:{
       configured:videos.local.serverReady&&videos.local.databaseReady&&videos.local.storageReady,
       referencePresent:videos.local.referencePresent,workerConnected:videos.local.workerConnected,
       readyForProduction:videos.local.readyForProduction,autoEnabled:videos.local.autoEnabled,
       requiresGpu:!videos.local.workerConnected,requiresVideoReview:true,
     },
     genericImageVideoEnvKeysRequired:false,
   },
   mediaReadVerified:{
     facebook:readVerified('facebook'),
     instagram:readVerified('instagram'),
     youtube:readVerified('youtube'),
   },
 };
}
