import type { SalesStore, SalesOpportunity } from './sales-agent.ts';
import type { SalesFollowupAgent } from './sales-followup.ts';
import type { EnrollmentAgent, Enrollment } from './enrollment-agent.ts';
import type { WhatsAppRecipient } from './whatsapp-routing.ts';

export const INTECA_CEO_WHATSAPP = '18097065502';
export const isDirectorNumber = (recipient: WhatsAppRecipient) =>
  recipient.kind === 'phone' && recipient.id === INTECA_CEO_WHATSAPP;

const clean = (value: unknown, max = 180) => String(value ?? '').replace(/[\r\n\t]/g, ' ').slice(0, max);
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const HELP = `Sr. Luis Ramírez, soy su asistente de Dirección General de INTECA. Consulto registros reales del CRM.
Escribe: resumen · estudiantes · pendientes · revisión · atención · fiscal.
Para ver más: pendientes 2 (página 2), estudiantes 2, etc.
Para un caso: ficha ID o cliente 809XXXXXXX. Para pagos validados: pagos validados.
Instrucciones: pausar ID · reanudar ID · seguimiento ID · matricular ID.
Usa el ID que aparece en cada caso. Seguimiento programa la tarea respetando consentimiento y horario; matricular exige pago ya validado. Los pagos se validan en Ventas y Cierre tras revisar comprobante y banco. No comparto contraseñas ni envío enlaces de acceso al director.`;
const labels: Record<string,string> = {new:'Consulta',interested:'Interesado',enrollment:'Datos de inscripción',payment_pending:'Pago pendiente',payment_review:'Revisión bancaria',won:'Pago validado'};
export function customerWhatsApp(sale: SalesOpportunity) {
  const phone = sale.profile.phone?.replace(/^\+/, '');
  return phone && /^[1-9]\d{6,14}$/.test(phone) ? phone : null;
}
export function ownerCase(sale: SalesOpportunity) {
  const amount = sale.stage === 'won' ? sale.paid_amount : sale.expected_amount;
  // A quote without a currency is not a verified debt or a balance of installments.
  const currency = sale.profile.paymentCurrency;
  return `ID ${sale.contact_key.slice(0,12)} — ${clean(sale.profile.fullName || sale.profile.profileName || 'Nombre pendiente',80)}\n${clean(sale.profile.course || 'Curso por confirmar',90)} · ${labels[sale.stage]} · ${sale.control}\nWhatsApp del cliente: ${customerWhatsApp(sale) ? `+${customerWhatsApp(sale)}` : 'número no disponible'}\nImporte de inscripción registrado: ${amount == null ? 'sin cotización' : `${amount}${currency ? ' '+clean(currency,5) : ' (moneda por confirmar)'}`}\nSiguiente: ${clean(sale.next_action || 'Revisar ficha')}\n${sale.objection ? `Objeción: ${clean(sale.objection)}\n` : ''}Consulta: ficha ${sale.contact_key.slice(0,12)}`;
}
export function ownerCommand(text: string) {
  const value = normalize(text);
  const phoneLookup = /^(?:cliente|telefono|whatsapp|ficha de)\s+(\+?[\d ()-]{7,22})$/.exec(value);
  if (phoneLookup) {
    const digits = phoneLookup[1].replace(/\D/g,'');
    if (/^[1-9]\d{6,14}$/.test(digits)) return {action:'cliente',key:/^(809|829|849)\d{7}$/.test(digits)?'1'+digits:digits,page:1};
  }
  const listing = /^(estudiantes|pendientes|revision|atencion|pagos validados)(?:\s+([1-9]\d{0,3}))?$/.exec(value);
  if (listing) return {action:listing[1],page:Number(listing[2] || 1),key:''};
  const command = /^(ficha|pausar|reanudar|seguimiento|matricular)\s+([a-f0-9]{8,64})$/.exec(value);
  if (command) return {action:command[1],key:command[2],page:1};
  if (/^(resumen|reporte|informe)( de hoy)?$/.test(value)) return {action:'resumen',key:'',page:1};
  if (/^(fiscal|dgii|facturacion)$/.test(value)) return {action:'fiscal',key:'',page:1};
  return {action:'ayuda',key:'',page:1};
}
export class OwnerAgent {
  constructor(private store: SalesStore, private followup: SalesFollowupAgent, private enrollment: EnrollmentAgent) {}
  async isOwner(recipient: WhatsAppRecipient) {
    if (!isDirectorNumber(recipient) || !this.store.configured()) return false;
    const settings = await this.followup.settings();
    return settings.owner_phone === INTECA_CEO_WHATSAPP;
  }
  async respond(recipient: WhatsAppRecipient, messageId: string, text: string, signed = false) {
    if (!signed || !await this.isOwner(recipient)) throw Error('OWNER_UNAUTHORIZED');
    await this.followup.ownerInbound(recipient.id);
    const cmd = ownerCommand(text);
    if (cmd.action === 'ayuda') return HELP;
    if (cmd.action === 'resumen') {
      const [m, settings, priorityRows, ownerRows] = await Promise.all([
        this.store.request('rpc/crm_sales_followup_metrics','POST',{}), this.followup.settings(),
        this.store.request('crm_sales_opportunities?or=(stage.eq.payment_review,control.eq.human)&order=updated_at.desc,contact_key&limit=4'),
        this.store.request(`crm_sales_opportunities?profile->>phone=eq.${recipient.id}&select=stage,control`),
      ]);
      const pending = priorityRows.filter((r: SalesOpportunity)=>r.profile.phone !== recipient.id).slice(0,3);
      for (const row of ownerRows) {
        if (row.stage === 'payment_pending') m.payment_pending = Math.max(0,Number(m.payment_pending)-1);
        if (row.stage === 'payment_review') m.payment_review = Math.max(0,Number(m.payment_review)-1);
        if (row.control === 'human') m.human = Math.max(0,Number(m.human)-1);
      }
      const config = this.enrollment.status();
      return `INTECA · ${new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Santo_Domingo'}).format(new Date())}\nPagos validados hoy: ${Number(m.paid_today)||0} / meta ${settings.daily_goal}.\nPendientes: ${Number(m.payment_pending)||0}; revisión: ${Number(m.payment_review)||0}; atención humana: ${Number(m.human)||0}.\nCampus automático: ${config.campusSyncEnabled ? 'habilitado' : 'pendiente de activación'}. Correo: ${config.emailConfigured ? 'configurado (no acredita entrega)' : 'sin configurar'}.\n${pending.length ? '\nPrioridades:\n'+pending.map(ownerCase).join('\n\n') : 'Sin casos prioritarios registrados.'}\n\nEscribe estudiantes, pendientes, revisión o ayuda. Los datos corresponden al CRM, no a un extracto bancario.`;
    }
    if (cmd.action === 'fiscal') {
      const profiles = await this.store.request('crm_fiscal_companies?organization_id=eq.org_inteca_main&select=organization_id&limit=1');
      return `DGII: perfil fiscal completo ${profiles.length ? 'registrado' : 'pendiente'}. La emisión electrónica aún no está habilitada en este CRM. El aula virtual es formación; se necesita completar autorización, certificado digital y certificación. El sistema prepara borradores sin validez fiscal. Revisa Pasarelas y Facturación.`;
    }
    if (cmd.action === 'estudiantes') {
      const rows: Enrollment[] = await this.store.request(`crm_student_enrollments?select=registration_code,full_name,course_title,campus_status,email_status,whatsapp_status,last_error&order=created_at.desc,id&limit=7&offset=${(cmd.page-1)*6}`);
      return `Matrículas del CRM · página ${cmd.page}\n${rows.slice(0,6).map(r=>`${clean(r.registration_code)} — ${clean(r.full_name,80)}\n${clean(r.course_title,90)} · campus ${r.campus_status}\nCorreo ${r.email_status}; WhatsApp ${r.whatsapp_status}${r.last_error ? '\nRevisar: '+clean(r.last_error) : ''}`).join('\n\n') || 'No hay matrículas registradas en esta página.'}\nAceptado por el proveedor no significa entregado. ${rows.length>6 ? `Más: estudiantes ${cmd.page+1}` : ''}`;
    }
    const filters:Record<string,string> = {'pagos validados':'stage=eq.won',pendientes:'stage=eq.payment_pending',revision:'stage=eq.payment_review',atencion:'control=eq.human'};
    if (filters[cmd.action]) {
      const rows: SalesOpportunity[] = await this.store.request(`crm_sales_opportunities?${filters[cmd.action]}&or=(profile->>phone.is.null,profile->>phone.neq.${recipient.id})&order=updated_at.desc,contact_key&limit=7&offset=${(cmd.page-1)*6}`);
      return `${cmd.action.toUpperCase()} · página ${cmd.page}\n${rows.slice(0,6).map(ownerCase).join('\n\n') || 'Sin casos en esta página.'}${rows.length>6 ? `\nMás: ${cmd.action} ${cmd.page+1}` : ''}`;
    }
    const filter = cmd.action==='cliente' ? `profile->>phone=eq.${cmd.key}` : `contact_key=like.${cmd.key}*`;
    const found: SalesOpportunity[] = await this.store.request(`crm_sales_opportunities?${filter}&limit=2`);
    if (found.length !== 1) return 'No hay un caso único con ese ID. Consulta pendientes, revisión o atención y copia su ID; si coincide con otro, utiliza el ID completo del CRM.';
    const sale = found[0];
    if (sale.profile.phone === recipient.id) return 'Ese registro corresponde al director. No se gestiona como prospecto de ventas.';
    if (cmd.action === 'ficha' || cmd.action === 'cliente') {
      const student = await this.enrollment.get(sale.contact_key);
      return `${ownerCase(sale)}\nContacto: ${clean(sale.profile.phone || 'WhatsApp sin teléfono disponible',25)}\nCorreo: ${clean(sale.profile.email || 'pendiente')}\n${student ? `Matrícula: ${student.registration_code}; campus ${student.campus_status}; correo ${student.email_status}; WhatsApp ${student.whatsapp_status}. ${clean(student.last_error)}` : 'Matrícula: no creada.'}`;
    }
    const result = await this.store.request('rpc/crm_owner_command','POST',{
      p_owner:recipient.id,p_message:messageId,p_key:sale.contact_key,p_action:cmd.action,
    });
    if (result.applied && cmd.action === 'matricular') void this.enrollment.tick();
    return String(result.message);
  }
}
