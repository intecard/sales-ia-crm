/**
 * INTECA connection audit. Safe data only: no tokens, service-account JSON,
 * raw tax IDs, paid API requests or financial transactions.
 * A configured ENV is not proof of a functioning provider.
 */
export type CheckState='ready'|'partial'|'blocked'|'unverified';
export type Check={
 id:'flyers'|'video'|'payments'|'campus'|'dgii';
 name:string;state:CheckState;reason:string;facts:string[];
 nextActions:string[];verifiedAt:string;
};
export type ActivationEvidence={
 flyers:{configured:boolean;renderTestVerified:boolean};
 videos:{
  heygen:{ready:boolean;verifiedRendering?:boolean};
  runway:{renderReady:boolean;verifiedRendering?:boolean};
  local:{readyForProduction:boolean;workerConnected:boolean;referencePresent:boolean;storageReady:boolean;autoEnabled:boolean};
 };
 payments:{preferredProvider:string;merchantStatus:string;productionCertified:boolean;
    sandboxCertified:boolean;linkInfrastructureReady:boolean;checkoutAvailable:boolean};
 campus:{verified:boolean;authReady:boolean;databaseReady:boolean;courseCount:number;
    readyForEnrollment:boolean;campusSyncEnabled:boolean;errorCode:string|null};
 counts:{courseMappings:number;enrollments:number;fiscalProfiles:number};
 fiscal:{emissionAdapterCertified:boolean;companyProfilePresent:boolean;companyAuthorizationVerified:boolean};
};
export function activationAudit(input:ActivationEvidence,now=new Date()):{checkedAt:string;allOperational:boolean;checks:Check[]}{
 const checkedAt=now.toISOString();
 const {flyers,videos,payments,campus,counts,fiscal}=input;
 const checks:Check[]=[
  {
   id:'flyers',name:'Flyers e imágenes',
   state:flyers.renderTestVerified?'ready':flyers.configured?'partial':'blocked',
   reason:flyers.renderTestVerified?'El motor renderizó un archivo en prueba. Publicar en cada red requiere un permiso aparte.':
    flyers.configured?'Motor instalado. Falta ejecutar y validar la prueba de imagen/almacenamiento sin publicar.':'Motor de flyers no disponible.',
   facts:['Motor presente: '+(flyers.configured?'sí':'no'),'Prueba de render validada: '+(flyers.renderTestVerified?'sí':'no')],
   nextActions:flyers.renderTestVerified?['Revisar una publicación real con URL por plataforma.']:
     ['Abrir Community Manager y usar «Probar flyer y almacenamiento (sin publicar)».'],
   verifiedAt:checkedAt,
  },
  {
   id:'video',name:'Videos INTEQUITO',
   state:videos.local.readyForProduction&&videos.local.autoEnabled?'partial':
     videos.heygen.ready||videos.runway.renderReady||videos.local.readyForProduction?'partial':'blocked',
   reason:'Una clave o un guion no comprueba que exista un MP4 final. La producción pagada necesita aprobación y la local necesita GPU.',
   facts:['HeyGen configurado: '+(videos.heygen.ready?'sí':'no'),
    'Runway configurado: '+(videos.runway.renderReady?'sí':'no'),
    'GPU conectada: '+(videos.local.workerConnected?'sí':'no'),
    'INTEQUITO oficial en almacenamiento: '+(videos.local.referencePresent?'sí':'no'),
    'Video MP4 real verificado: '+(videos.heygen.verifiedRendering||videos.runway.verifiedRendering?'sí':'no')],
   nextActions:[
     ...(!videos.local.referencePresent?['Cargar referencia oficial PNG de INTEQUITO desde Community Manager.']:[]),
     ...(!videos.local.workerConnected?['Configurar GPU propia y su token de trabajo, o conectar HeyGen/Runway.']:[]),
     'Validar MP4, voz, subtítulos, derechos y aprobación antes de publicar.',
   ],verifiedAt:checkedAt,
  },
  {
   id:'payments',name:'Cobros con tarjeta',
   state:payments.checkoutAvailable&&payments.merchantStatus==='production'&&payments.productionCertified?'ready':
    payments.linkInfrastructureReady?'partial':'blocked',
   reason:payments.checkoutAvailable&&payments.productionCertified?'Pasarela operativa con contrato, adapter y certificación.':
     'No hay pasarela cobrando hasta contratar proveedor, aprobar sandbox y verificar webhooks firmados.',
   facts:['Proveedor: '+payments.preferredProvider,
     'Contrato: '+payments.merchantStatus,
     'Enlaces informativos firmados: '+(payments.linkInfrastructureReady?'sí':'no'),
     'Producción certificada: '+(payments.productionCertified?'sí':'no'),
     'Cobro real habilitado: '+(payments.checkoutAvailable?'sí':'no')],
   nextActions:payments.checkoutAvailable?['Validar conciliación de transacciones reales.']:
     ['Contratar AZUL o CardNET; solicitar credenciales merchant y webhooks.','Superar pruebas sandbox y habilitar cobro solo tras validación real.'],
   verifiedAt:checkedAt,
  },
  {
   id:'campus',name:'Campus y matrículas',
   state:campus.readyForEnrollment&&counts.courseMappings>0?'ready':
     campus.verified?'partial':'blocked',
   reason:campus.verified?'Firebase es accesible; todavía deben existir equivalencias oficiales de cursos y sincronización aprobada.':
     'La presencia de credenciales no verifica el acceso real a Firebase.',
   facts:['Autenticación Firebase: '+(campus.authReady?'comprobada':'no comprobada'),
     'Firestore: '+(campus.databaseReady?'comprobado':'no comprobado'),
     'Cursos en Firestore: '+campus.courseCount,
     'Equivalencias aprobadas: '+counts.courseMappings,
     'Matrículas CRM registradas: '+counts.enrollments,
     'Sincronización activada: '+(campus.campusSyncEnabled?'sí':'no'),
     ...(campus.errorCode?['Error: '+campus.errorCode]:[])],
   nextActions:campus.readyForEnrollment&&counts.courseMappings>0?['Ensayar matrícula con pago realmente validado.']:
     ['Verificar respaldo y protección de cursos existentes en Firebase.',
      'Asociar cada curso CRM a su ID exacto del campus, sin crear duplicados.',
      'Activar sincronización solamente después de validar la protección y autorizaciones.'],
   verifiedAt:checkedAt,
  },
  {
   id:'dgii',name:'Facturación electrónica DGII',
   state:fiscal.companyProfilePresent&&fiscal.companyAuthorizationVerified&&fiscal.emissionAdapterCertified?'ready':
     fiscal.companyProfilePresent?'partial':'blocked',
   reason:'Los borradores comerciales no son facturas e-CF válidas. La emisión requiere emisor certificado, secuencias y firma digital.',
   facts:['Perfil fiscal guardado: '+(fiscal.companyProfilePresent?'sí':'no'),
     'Autorización y certificado verificados: '+(fiscal.companyAuthorizationVerified?'sí':'no'),
     'Adaptador de emisión certificado: '+(fiscal.emissionAdapterCertified?'sí':'no')],
   nextActions:['Registrar RNC, razón social y obligaciones reales de INTECA.',
    'Completar autorización de emisor e-CF, firma digital y secuencias oficiales.',
    'Certificar proveedor o sistema propio DGII y verificar acuses antes de activar emisión.'],
   verifiedAt:checkedAt,
  },
 ];
 return {checkedAt,allOperational:checks.every(c=>c.state==='ready'),checks};
}
