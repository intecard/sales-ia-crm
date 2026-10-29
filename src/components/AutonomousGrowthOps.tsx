import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Plug,
  ShieldCheck,
  Sparkles,
  Target,
  Video,
  Workflow,
  Zap,
} from 'lucide-react';
import {
  AIAgentSpec,
  Course,
  CreativeAsset,
  ExternalIntegration,
  LaunchCampaignPlan,
  OwnerActionNotification,
} from '../types';

type OperationalReadiness={
 checkedAt:string;
 advertising:{
  mode:'provider_managed';
  meta:{accountReadVerified:boolean;billingMethodVerified:boolean;link:string;instruction:string};
  google:{accountReadVerified:boolean;billingMethodVerified:boolean;link:string;instruction:string};
  cardDataStoredInCrm:boolean;billingVerified:boolean;campaignSpendingAuthorized:boolean;note:string;
 };
 creatives:{
  internalFlyers:{configured:boolean;renderTestVerified:boolean;note:string};
  heygen:{configured:boolean;reason:string|null;verifiedRendering:boolean;requiresExplicitSpendApproval:boolean};
  runway:{configured:boolean;reason:string|null;verifiedRendering:boolean;requiresExplicitSpendApproval:boolean};
  localVideo:{configured:boolean;referencePresent:boolean;workerConnected:boolean;readyForProduction:boolean;autoEnabled:boolean;requiresGpu:boolean;requiresVideoReview:boolean};
  genericImageVideoEnvKeysRequired:boolean;
 };
 mediaReadVerified:{facebook:boolean;instagram:boolean;youtube:boolean};
};
type ActivationAudit={checkedAt:string;allOperational:boolean;checks:Array<{id:string;name:string;state:'ready'|'partial'|'blocked'|'unverified';reason:string;facts:string[];nextActions:string[];verifiedAt:string}>;};
interface AutonomousGrowthOpsProps {
 organization:{id:string;name:string};
  integrations: ExternalIntegration[];
  creativeAssets: CreativeAsset[];
  launchPlans: LaunchCampaignPlan[];
  ownerActions: OwnerActionNotification[];
  agents: AIAgentSpec[];
  courses: Course[];
}

const statusTone = (status: string) => {
  if (status === 'Conectado') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (status === 'Webhook preparado')
    return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  if (status === 'Modo demo') return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  if (status === 'Producción pendiente')
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (status === 'Listo para conectar')
    return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
};

const priorityTone = (priority: OwnerActionNotification['priority']) => {
  if (priority === 'Alta') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  if (priority === 'Media') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-slate-700/50 text-slate-300 border-slate-600';
};

export const AutonomousGrowthOps: React.FC<AutonomousGrowthOpsProps> = ({
  organization,
  integrations,
  creativeAssets,
  launchPlans,
  ownerActions,
  agents,
  courses,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [launchDate, setLaunchDate] = useState('2026-10-15');
  const [relaunchDate, setRelaunchDate] = useState('2026-10-28');
  const [budgetDop, setBudgetDop] = useState(1000);
  const [dailyGoal, setDailyGoal] = useState(5);
  const [preparedPlan, setPreparedPlan] = useState<string[] | null>(null);

  const [runtimeStatus,setRuntimeStatus]=useState<{groups:Array<{id:string;configured:boolean;missingEnvVars:string[]}>;checkedAt:string}|null>(null);
  const [readStates,setReadStates]=useState<Record<string,string>>({});
  const [checkError,setCheckError]=useState('');
  const [operational,setOperational]=useState<OperationalReadiness|null>(null);
 const [activation,setActivation]=useState<ActivationAudit|null>(null);
 const [activationError,setActivationError]=useState('');
 const [flyerTest,setFlyerTest]=useState<{ok:boolean;message:string}|null>(null);
 const [flyerTesting,setFlyerTesting]=useState(false);
 const tryFlyer=async()=>{
   setFlyerTesting(true);setFlyerTest(null);
   try{
     const r=await fetch('/api/advertising/community/diagnostics/test',{
       method:'POST',headers:{'X-CRM-Action':'advertising'},cache:'no-store'});
     const d=await r.json();
     if(!r.ok)throw Error(d.error||'CM_DIAGNOSTIC_FAILED');
     if(!d.media?.stored||!(d.media?.imageBytes>1000))
       throw Error('El servidor no confirmó render y almacenamiento.');
     const verified=Object.entries(d.channels||{}).map(([k,v]:any)=>
       k+': '+(v?.ok?'cuenta verificada':v?.code||'sin verificar')).join(' · ');
     setFlyerTest({ok:true,message:'JPEG creado y guardado sin publicar. '+verified});
   }catch(e){setFlyerTest({ok:false,message:(e as Error).message+'. No se realizó publicación.'});}
   finally{setFlyerTesting(false);}
 };
  const refresh=async(signal?:AbortSignal)=>{
    const r=await fetch('/api/integrations/status',{cache:'no-store',signal});
    if(!r.ok)throw Error('No se pudo consultar la configuración real del CRM.');
    const data=await r.json();
    if(!Array.isArray(data.groups))throw Error('Diagnóstico no disponible.');
    if(!signal?.aborted){setRuntimeStatus(data);setCheckError('');}
    try{
      const readiness=await fetch('/api/advertising/operational-readiness',{cache:'no-store',signal});
      if(readiness.ok){
        const evidence:OperationalReadiness=await readiness.json();
        if(!signal?.aborted)setOperational(evidence);
      }else if(!signal?.aborted)setOperational(null);
    }catch{if(!signal?.aborted)setOperational(null);}
    try{
      const response=await fetch('/api/advertising/activation-audit?org='+encodeURIComponent(organization.id),{cache:'no-store',signal});
      if(!response.ok)throw Error('No se pudo verificar el estado operativo de las integraciones.');
      const detail=await response.json();
      if(!Array.isArray(detail.checks)||detail.checks.length!==5)throw Error('Diagnóstico de integraciones incompleto.');
      if(!signal?.aborted){setActivation(detail);setActivationError('');}
    }catch(e){if(!signal?.aborted){setActivation(null);setActivationError((e as Error).message);}}
    try{
      const a=await fetch('/api/advertising/shared-connections',{cache:'no-store',signal});
      if(a.ok){
        const state=await a.json();
        if(!signal?.aborted)setReadStates(Object.fromEntries((state.connections||[]).map((x:{channel:string;state:string})=>[x.channel,x.state])));
      }
    }catch{/* Las lecturas requieren sesión: nunca declarar acceso verificado sin respuesta. */}
  };
  useEffect(()=>{
    const controller=new AbortController();
    void refresh(controller.signal).catch(e=>{if(!controller.signal.aborted)setCheckError(e.message);});
    return ()=>controller.abort();
  },[organization.id]);
  const runtimeFor=(id:string)=>runtimeStatus?.groups.find(x=>x.id===id);
  const dynamicStatus=(item:ExternalIntegration)=>{
    const env=runtimeFor(item.id);
    if(item.id==='int_ad_payment_wallet')return 'Facturación externa sin verificar';
    if(item.id==='int_creative_ai'){
      if(!operational)return 'Verificación pendiente';
      if(operational.creatives.localVideo.readyForProduction)return 'Motor local preparado, sin prueba MP4';
      if(operational.creatives.heygen.configured||operational.creatives.runway.configured)
        return 'Proveedor presente, sin prueba de video';
      return 'Flyers locales; video pendiente';
    }
    if(!env)return 'Pendiente de consulta';
    const readChannels:Record<string,string[]>={int_meta_social:['facebook','instagram'],int_google_ads:['google_ads'],int_youtube:['youtube']};
    const verified=readChannels[item.id]?.every(k=>readStates[k]==='verified_read')===true;
    if(verified)return 'Lectura verificada';
    return env.configured?'Variables presentes':'Faltan parámetros';
  };


  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || courses[0];
  const agentById = useMemo(
    () => Object.fromEntries(agents.map((agent) => [agent.id, agent])),
    [agents],
  );
  const courseById = useMemo(
    () => Object.fromEntries(courses.map((course) => [course.id, course])),
    [courses],
  );

  const connectedLikeCount = runtimeStatus?.groups.filter(x=>x.configured).length??0;
  const pendingCredentialCount = runtimeStatus?.groups.filter(x=>!x.configured).length??0;

  const prepareLaunchPlan = () => {
    const title = selectedCourse?.title || 'Curso seleccionado';
    setPreparedPlan([
      `Campaña de adquisición para ${title}: Meta Ads, Google Ads y video corto hacia WhatsApp.`,
      `Fecha de lanzamiento: ${launchDate}. Relanzamiento: ${relaunchDate || 'sin definir'}.`,
      `Presupuesto de prueba: RD$${budgetDop.toLocaleString()} con meta mínima de ${dailyGoal} ventas diarias.`,
      'Agentes asignados: Lanzamientos planifica, Publicidad pauta, Creativos diseña flyers, Video Ads prepara guiones y Ventas cierra.',
      'Avisos al dueño: pagos confirmados, llamadas de alta probabilidad, bloqueos fiscales y campañas listas.',
    ]);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Workflow className="w-3.5 h-3.5" />
            <span>Operación Autónoma Omnicanal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Conexiones y operación autónoma · Estado real
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Consulta la configuración real del servidor. Tener variables no implica permisos para publicar, cobrar o emitir comprobantes fiscales.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs w-full lg:w-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-500 uppercase font-black text-[10px]">Variables presentes</span>
            <p className="text-xl font-black text-emerald-400 mt-1">{runtimeStatus?connectedLikeCount:'—'}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <span className="text-slate-500 uppercase font-black text-[10px]">
              Por credenciales
            </span>
            <p className="text-xl font-black text-amber-300 mt-1">{runtimeStatus?pendingCredentialCount:'—'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-800 bg-slate-900 p-4 space-y-2 text-sm text-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong>Estado de credenciales del CRM, sin mostrar valores secretos</strong>
          <button type="button" className="rounded border border-cyan-600 px-3 py-2 text-cyan-200" onClick={()=>void refresh().catch(e=>setCheckError(e.message))}>Actualizar</button>
        </div>
        {runtimeStatus?.checkedAt&&<p className="text-xs text-slate-400">Consultado: {new Date(runtimeStatus.checkedAt).toLocaleString('es-DO')}</p>}
        {checkError&&<p className="text-amber-300">{checkError}</p>}
        <p className="text-xs text-slate-400">Esta vista no valida cobros, facturación electrónica ni publicación; las integraciones que requieren tarjetas, certificados o proveedores deben conectarse y probarse en sus plataformas correspondientes.</p>
      </div>
      <section className="rounded-xl border border-cyan-800 bg-slate-900 p-4 space-y-3 text-sm text-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base text-white">Activación real de servicios · Verificación segura</h2>
            <p className="text-xs text-slate-300 mt-1">Distingue código instalado, autenticación real, contratación externa y operaciones probadas. Ninguna comprobación crea cargos, matrículas ni facturas fiscales.</p>
          </div>
          <button type="button" className="rounded border border-cyan-500 px-3 py-2 text-cyan-200" onClick={()=>void refresh().catch(e=>setCheckError(e.message))}>Comprobar las 5 integraciones</button>
          <button type="button" disabled={flyerTesting} className="rounded border border-emerald-700 px-3 py-2 text-emerald-200 disabled:opacity-50" onClick={()=>void tryFlyer()}>{flyerTesting?'Ejecutando prueba sin publicar...':'Probar flyer y almacenamiento'}</button>
        </div>
        {flyerTest&&<p role="status" className={flyerTest.ok?'rounded bg-emerald-950 text-emerald-200 p-3 text-xs':'rounded bg-rose-950 text-rose-200 p-3 text-xs'}>{flyerTest.message}</p>}
        {activationError&&<p role="alert" className="rounded bg-amber-950 p-3 text-amber-200 text-xs">{activationError} No se declara ninguna conexión como lista sin evidencia.</p>}
        {activation?.checkedAt&&<p className="text-xs text-slate-400">Verificación: {new Date(activation.checkedAt).toLocaleString('es-DO')} · {activation.allOperational?'Las cinco comprobaciones operativas están listas':'Hay servicios pendientes; abre cada diagnóstico'}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activation?.checks.map(check=><article key={check.id} className="rounded-lg bg-slate-950 border border-slate-700 p-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 items-start">
              <h3 className="font-bold text-white">{check.name}</h3>
              <span className={check.state==='ready'?'text-emerald-300':check.state==='partial'?'text-amber-300':'text-rose-300'}>
                {check.state==='ready'?'Prueba verificada':check.state==='partial'?'Preparación parcial':check.state==='blocked'?'Bloqueado':'Sin comprobar'}
              </span>
            </div>
            <p className="text-xs text-slate-300">{check.reason}</p>
            <ul className="text-xs text-slate-400 list-disc pl-4 space-y-1">{check.facts.map(f=><li key={f}>{f}</li>)}</ul>
            <details>
              <summary className="cursor-pointer text-cyan-300 text-xs font-semibold">Acciones para habilitarlo</summary>
              <ol className="list-decimal pl-4 mt-2 text-xs text-slate-200 space-y-1">{check.nextActions.map((action,i)=><li key={i}>{action}</li>)}</ol>
            </details>
          </article>)}
        </div>
        {!activation&&!activationError&&<p className="text-xs text-slate-400">Consultando Firebase, Supabase, almacenamiento y estado de pasarelas.</p>}
        <p className="text-xs text-slate-400">«Variables presentes» en la lista inferior confirma únicamente configuración, no permisos de API ni transacciones reales.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Canales sociales',
            value: 'Meta, WhatsApp, Google, YouTube',
            icon: MessageSquare,
            tone: 'text-cyan-300',
          },
          {
            label: 'Fábrica creativa',
            value: 'Flyers + videos 30-60s',
            icon: Sparkles,
            tone: 'text-purple-300',
          },
          {
            label: 'Cobros y e-CF',
            value: 'Pagos + facturación',
            icon: CreditCard,
            tone: 'text-emerald-400',
          },
          {
            label: 'Dueño informado',
            value: 'Pagos, llamadas y bloqueos',
            icon: PhoneCall,
            tone: 'text-amber-300',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-500 font-black tracking-wider">
                  {item.label}
                </span>
                <Icon className={`w-5 h-5 ${item.tone}`} />
              </div>
              <p className={`text-sm font-black mt-3 ${item.tone}`}>{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plug className="w-4 h-4 text-cyan-300" />
                Conectores externos preparados
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Cuando tengamos credenciales, estas rutas y variables son las que se conectan.
              </p>
            </div>
            <span className="text-xs text-slate-400">{integrations.length} integraciones</span>
          </div>

          <div className="divide-y divide-slate-800">
            {integrations.map((integration) => {
              const ownerAgent = agentById[integration.ownerAgentId];
              return (
                <div key={integration.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{integration.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dynamicStatus(integration)==='Lectura verificada'?'bg-cyan-500/20 border-cyan-500/30 text-cyan-300':dynamicStatus(integration)==='Variables presentes'?'bg-blue-500/20 border-blue-500/30 text-blue-300':'bg-amber-500/20 border-amber-500/30 text-amber-300'}`}>
                          {dynamicStatus(integration)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {integration.outboundCapability}
                      </p>
                      {runtimeFor(integration.id)?.missingEnvVars?.length? <p className="text-[11px] text-amber-200 mt-2">Faltan: {runtimeFor(integration.id)?.missingEnvVars.join(', ')}</p>:null}
                      <p className="text-[11px] text-slate-400 mt-1">{integration.id==='int_ad_payment_wallet'
 ?'Meta y Google administran sus propias tarjetas; no existe una pasarela de anuncios que se active completando esas seis variables ficticias.'
 :integration.id==='int_creative_ai'
 ?'Los flyers usan el motor integrado. HeyGen, Runway y el motor GPU tienen configuraciones independientes: una clave presente no acredita producción real.'
 :dynamicStatus(integration)==='Lectura verificada'
 ?'Lectura autorizada: no confirma permiso para publicar.'
 :dynamicStatus(integration)==='Variables presentes'
 ?'Variables presentes; falta verificar funcionamiento operativo.'
 :'La etiqueta anterior era descriptiva; verifica el servicio real.'}</p>
                      {integration.inboundWebhookPath && (
                        <p className="text-[11px] text-cyan-300 font-mono mt-2">
                          {integration.inboundWebhookPath}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 lg:text-right">
                      <span className="block text-slate-500 uppercase font-black text-[10px]">
                        Responsable
                      </span>
                      <strong className="text-indigo-300">{ownerAgent?.name || 'Agente IA'}</strong>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(integration.id==='int_ad_payment_wallet'||integration.id==='int_creative_ai' ? []:integration.requiredEnvVars).map((envVar) => (
                      <span
                        key={envVar}
                        className="text-[10px] bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded font-mono"
                      >
                        {envVar}
                      </span>
                    ))}
                  {integration.id==='int_ad_payment_wallet'&&(
                    <div className="mt-3 space-y-2 rounded-lg border border-amber-700 bg-slate-950 p-3 text-xs text-slate-200">
                      <p><strong>Meta Ads:</strong> {operational?.advertising.meta.accountReadVerified?'Identidad de cuenta verificada (solo lectura)':'Verifica los permisos de la cuenta de anuncios'} · <span className="text-amber-200">Tarjeta no verificada desde CRM</span></p>
                      <p><strong>Google Ads:</strong> {operational?.advertising.google.accountReadVerified?'Identidad de cuenta verificada (solo lectura)':'Verifica los permisos de la cuenta de anuncios'} · <span className="text-amber-200">Tarjeta no verificada desde CRM</span></p>
                      <p>Introduce cualquier tarjeta, CVC y datos bancarios <strong>solamente</strong> en la plataforma elegida. La tarjeta de publicidad es distinta de la pasarela de cobros de estudiantes.</p>
                      <div className="flex flex-wrap gap-2">
                        <a href="https://business.facebook.com/billing_hub/payment_settings" target="_blank" rel="noopener noreferrer"
                          className="rounded border border-cyan-600 px-3 py-2 text-cyan-200">Configurar pago en Meta</a>
                        <a href="https://ads.google.com/" target="_blank" rel="noopener noreferrer"
                          className="rounded border border-cyan-600 px-3 py-2 text-cyan-200">Configurar pago en Google Ads</a>
                      </div>
                      <p>El CRM conserva sus límites de presupuesto y autorización expresa; no cobra ni activa anuncios desde esta comprobación.</p>
                    </div>
                  )}
                  {integration.id==='int_creative_ai'&&(
                    <div className="mt-3 space-y-1 rounded-lg border border-cyan-800 bg-slate-950 p-3 text-xs text-slate-200">
                      <p>Flyers INTECA: <strong>{operational?.creatives.internalFlyers.configured?'Motor interno instalado':'Comprobación pendiente'}</strong> · publicación no confirmada por esta pantalla.</p>
                      <p>HeyGen + INTEQUITO: <strong>{operational?.creatives.heygen.configured?'Configurado, pendiente de prueba':'Sin configurar'}</strong>.</p>
                      <p>Runway: <strong>{operational?.creatives.runway.configured?'Configurado, pendiente de prueba':'Sin configurar'}</strong>.</p>
                      <p>Motor propio 3D: <strong>{operational?.creatives.localVideo.workerConnected?'Trabajador detectado':'GPU desconectada'}</strong>. {operational?.creatives.localVideo.referencePresent?'Imagen de INTEQUITO detectada.':'Instala la imagen oficial de INTEQUITO en Community Manager.'}</p>
                      <p>La generación paga requiere aprobación. Ningún video experimental se publica automáticamente.</p>
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-300" />
              Programar lanzamiento
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Define fechas y el CRM prepara cadencia, creativos, pauta, cierre y relanzamiento.
            </p>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Curso</label>
                <select
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Lanzamiento</label>
                  <input
                    type="date"
                    value={launchDate}
                    onChange={(event) => setLaunchDate(event.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Relanzamiento</label>
                  <input
                    type="date"
                    value={relaunchDate}
                    onChange={(event) => setRelaunchDate(event.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Pauta RD$</label>
                  <input
                    type="number"
                    value={budgetDop}
                    onChange={(event) => setBudgetDop(Number(event.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Ventas/día</label>
                  <input
                    type="number"
                    value={dailyGoal}
                    onChange={(event) => setDailyGoal(Number(event.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={prepareLaunchPlan}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                Preparar plan con agentes IA
              </button>
            </div>

            {preparedPlan && (
              <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                {preparedPlan.map((step) => (
                  <div key={step} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-300" />
              Reglas para no saturarte
            </h2>
            <div className="space-y-2 mt-3 text-xs">
              {[
                'Notificar pago confirmado con cliente, curso, monto y factura.',
                'Notificar llamada solo si el lead está caliente o bloqueado por confianza.',
                'Escalar descuentos fuera de política y facturas fiscales rechazadas.',
                'Ocultar ruido operativo: dudas simples, seguimientos y leads fríos los manejan agentes.',
              ].map((rule) => (
                <div key={rule} className="flex items-start gap-2 text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-300" />
              Flyers, imágenes y videos listos para generar
            </h2>
            <span className="text-xs text-slate-400">{creativeAssets.length} briefs</span>
          </div>

          <div className="space-y-4">
            {creativeAssets.map((asset) => {
              const course = courseById[asset.courseId];
              const ownerAgent = agentById[asset.assignedAgentId];
              return (
                <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {asset.type.includes('Video') ? (
                          <Video className="w-4 h-4 text-rose-300" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-purple-300" />
                        )}
                        <h3 className="text-sm font-bold text-white">{asset.title}</h3>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{course?.title}</p>
                    </div>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                      {asset.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-3">{asset.campaignObjective}</p>
                  <div className="mt-3 space-y-2">
                    {asset.copyBlocks.map((copy) => (
                      <div key={copy} className="flex items-start gap-2 text-xs text-slate-300">
                        <Megaphone className="w-3.5 h-3.5 text-amber-300 mt-0.5 flex-shrink-0" />
                        <span>{copy}</span>
                      </div>
                    ))}
                  </div>

                  {asset.imagePrompt && (
                    <div className="mt-3 bg-slate-900 border border-slate-800 rounded-lg p-3">
                      <span className="text-[10px] text-cyan-300 font-bold uppercase">
                        Prompt de imagen
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        {asset.imagePrompt}
                      </p>
                    </div>
                  )}

                  {asset.videoScript && (
                    <div className="mt-3 bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] text-rose-300 font-bold uppercase">
                        Guion de video
                      </span>
                      {asset.videoScript.map((line) => (
                        <p key={line} className="text-[11px] text-slate-300">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 mt-3">
                    Responsable: <strong className="text-indigo-300">{ownerAgent?.name}</strong>
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-emerald-400" />
              Planes de lanzamiento activos
            </h2>
            <div className="space-y-4">
              {launchPlans.map((plan) => {
                const course = courseById[plan.courseId];
                return (
                  <div key={plan.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">{plan.launchName}</h3>
                        <p className="text-[11px] text-slate-400 mt-1">{course?.title}</p>
                      </div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                        {plan.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                        <Clock className="w-3.5 h-3.5 text-amber-300 mb-1" />
                        <span className="text-slate-500 uppercase font-bold text-[10px]">
                          Lanzamiento
                        </span>
                        <p className="text-white font-black">{plan.launchDate}</p>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                        <Zap className="w-3.5 h-3.5 text-cyan-300 mb-1" />
                        <span className="text-slate-500 uppercase font-bold text-[10px]">
                          Meta
                        </span>
                        <p className="text-white font-black">
                          {plan.dailySalesGoal}/día · RD${plan.budgetDop.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {plan.channels.map((channel) => (
                        <span
                          key={channel}
                          className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-1 rounded"
                        >
                          {channel}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 space-y-1">
                      {plan.automationCadence.map((step) => (
                        <p key={step} className="text-[11px] text-slate-400">
                          {step}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <PhoneCall className="w-4 h-4 text-amber-300" />
              Notificaciones para el dueño
            </h2>
            <div className="space-y-3">
              {ownerActions.map((action) => {
                const ownerAgent = agentById[action.assignedAgentId];
                return (
                  <div key={action.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityTone(
                              action.priority,
                            )}`}
                          >
                            {action.priority}
                          </span>
                          <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded">
                            {action.type}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white mt-2">{action.title}</h3>
                      </div>
                      {action.type === 'Pago recibido' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : action.type === 'Factura pendiente' ? (
                        <FileText className="w-5 h-5 text-cyan-300" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-300" />
                      )}
                    </div>

                    {(action.leadName || action.leadPhone || action.leadEmail) && (
                      <div className="mt-3 bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
                        <p className="text-white font-bold">{action.leadName || 'Cliente pendiente'}</p>
                        <p className="text-slate-400">{action.leadPhone || 'Sin teléfono'}</p>
                        <p className="text-slate-500">{action.leadEmail || 'Sin correo'}</p>
                      </div>
                    )}

                    <p className="text-xs text-slate-300 mt-3">{action.recommendedAction}</p>
                    <p className="text-[11px] text-slate-500 mt-2">
                      {action.dueAt} · Responsable:{' '}
                      <strong className="text-indigo-300">{ownerAgent?.name}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
