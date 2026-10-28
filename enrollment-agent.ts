import crypto from 'node:crypto';
import { SalesStore, type SalesOpportunity } from './sales-agent.ts';
import { buildWhatsAppTextPayload, type WhatsAppRecipient } from './whatsapp-routing.ts';

export interface Enrollment {
  id: string;
  contact_key: string;
  payment_id: string;
  registration_code: string;
  full_name: string;
  email: string;
  course_title: string;
  campus_course_id: string | null;
  campus_uid: string | null;
  campus_status: 'pending' | 'active';
  email_status: 'pending' | 'sending' | 'accepted' | 'review';
  whatsapp_status: 'pending' | 'sending' | 'accepted' | 'review';
  email_provider_id: string | null;
  whatsapp_provider_id: string | null;
  last_error: string;
  lease_token: string;
  attempts: number;
}
export const ENROLLMENT_ERRORS: Record<string, string> = {
  CAMPUS_NOT_CONFIGURED: 'Falta conectar la cuenta de servicio de Firebase del campus.',
  CAMPUS_SYNC_NOT_ACTIVATED: 'Antes de matricular automáticamente, instala en el campus el parche de protección de cursos y autoriza la sincronización en Render.',
  CAMPUS_PERMISSION_DENIED: 'La cuenta de servicio no tiene acceso a Firebase Authentication o Firestore. Revisa sus permisos.',
  COURSE_MAPPING_STALE: 'El curso del campus fue renombrado o eliminado desde que se vinculó. Revisa la equivalencia antes de matricular.',
  CAMPUS_CREDENTIALS_INVALID: 'Revisa la credencial y el proyecto de Firebase.',
  COURSE_MAPPING_REQUIRED: 'Falta asociar el curso vendido con el curso real del campus.',
  COURSE_NOT_FOUND: 'El curso asociado ya no existe en el campus.',
  CAMPUS_ROLE_CONFLICT:
    'El correo pertenece a una cuenta no estudiantil o suspendida. Requiere revisión.',
  EMAIL_NOT_CONFIGURED: 'Falta configurar el servicio de correo de salida (Resend o SMTP).',
  EMAIL_REVIEW_REQUIRED:
    'El envío de correo tuvo un resultado incierto. Revisar antes de reenviar.',
  WHATSAPP_REVIEW_REQUIRED:
    'El envío de WhatsApp tuvo un resultado incierto. Revisar antes de reenviar.',
  WHATSAPP_WINDOW_CLOSED: 'Esperando un mensaje del alumno o una plantilla de bienvenida aprobada.',
  CONTACT_OPTED_OUT: 'El contacto pidió no recibir mensajes. Requiere revisión humana.',
  RECEIPT_REQUIRED: 'Adjunta y revisa el recibo antes de validar el pago.',
  PAYMENT_REQUIRED: 'No existe un pago con recibo validado para este contacto.',
  RECEIPT_INVALID: 'El recibo debe ser JPG, PNG, WebP o PDF y ocupar como máximo 5 MB.',
  RECEIPT_UNAVAILABLE: 'No se pudo recuperar el recibo. Adjunta el archivo original.',
  STORAGE_UNAVAILABLE: 'No se pudo guardar o recuperar el documento privado.',
  PROVIDER_ERROR: 'La integración rechazó la operación. Revisa su conexión.',
};
export const enrollmentError = (error: unknown) =>
  error instanceof Error && ENROLLMENT_ERRORS[error.message] ? error.message : 'PROVIDER_ERROR';
export function receiptMime(bytes: Buffer) {
  if (!bytes.length || bytes.length > 5242880) throw Error('RECEIPT_INVALID');
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  if (bytes.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  throw Error('RECEIPT_INVALID');
}
export function welcomeText(row: Enrollment, campusUrl: string) {
  if (row.campus_status !== 'active' || !row.campus_uid || !row.campus_course_id)
    throw Error('PAYMENT_REQUIRED');
  return `Hola, ${row.full_name}. Bienvenido/a a INTECA.\n\nTu pago de inscripción fue validado.\nMatrícula: ${row.registration_code}\nCurso: ${row.course_title}\nCampus: ${campusUrl}\nUsuario: ${row.email}\n\nTu curso ya está asignado en el campus. Si es tu primer acceso, pulsa “Olvidé mi contraseña” para establecerla con ese correo. Si ya tienes cuenta, usa tu acceso habitual.\n\nEl equipo académico confirmará el grupo y la fecha de inicio. Conserva tu número de matrícula.`;
}
export function whatsappWelcomePayload(
  row: Enrollment,
  sale: SalesOpportunity,
  env: NodeJS.ProcessEnv,
  now = Date.now(),
) {
  if (sale.control === 'opted_out') throw Error('CONTACT_OPTED_OUT');
  const recipient: WhatsAppRecipient = sale.profile.whatsappUserId
    ? { kind: 'bsuid', id: sale.profile.whatsappUserId }
    : { kind: 'phone', id: sale.profile.phone || '' };
  if (!recipient.id) throw Error('PROVIDER_ERROR');
  const campusUrl = env.INTECA_CAMPUS_BASE_URL || 'https://campus.inteca.com.do';
  // Conservative 23-hour window; outside it, only a configured approved utility template.
  if (now - new Date(sale.last_inbound_at).getTime() < 23 * 3600000)
    return {
      ...buildWhatsAppTextPayload(recipient, welcomeText(row, campusUrl)),
      biz_opaque_callback_data: `enrollment:${row.id}`,
    };
  if (!env.WHATSAPP_ENROLLMENT_TEMPLATE_NAME) throw Error('WHATSAPP_WINDOW_CLOSED');
  return {
    messaging_product: 'whatsapp',
    ...(recipient.kind === 'bsuid' ? { recipient: recipient.id } : { to: recipient.id }),
    type: 'template',
    biz_opaque_callback_data: `enrollment:${row.id}`,
    template: {
      name: env.WHATSAPP_ENROLLMENT_TEMPLATE_NAME,
      language: { code: env.WHATSAPP_ENROLLMENT_TEMPLATE_LANGUAGE || 'es' },
      components: [
        {
          type: 'body',
          parameters: [
            row.full_name,
            row.registration_code,
            row.course_title,
            campusUrl,
            row.email,
          ].map((text) => ({ type: 'text', text })),
        },
      ],
    },
  };
}

export class EnrollmentAgent {
  private store: SalesStore;
  private env: NodeJS.ProcessEnv;
  private running = false;
  private campusClient?: Promise<{
    auth: import('firebase-admin/auth').Auth;
    db: import('firebase-admin/firestore').Firestore;
  }>;
  constructor(store: SalesStore, env: NodeJS.ProcessEnv = process.env) {
    this.store = store;
    this.env = env;
  }
  status() {
    return {
      storage: 'supabase',
      paymentGate: 'receipt_and_bank_validation',
      campusConfigured: Boolean(this.env.INTECA_FIREBASE_SERVICE_ACCOUNT_JSON),
      campusSyncEnabled: this.env.INTECA_CAMPUS_SYNC_ENABLED === 'true',
      campusProjectId: this.env.INTECA_FIREBASE_PROJECT_ID || 'gen-lang-client-0415952714',
      campusDatabaseId: this.env.INTECA_FIRESTORE_DATABASE_ID || 'ai-studio-campusvirtualint-dbc5e5fa-0c2e-4740-85d5-91566cdb7d70',
      emailConfigured: Boolean(
        this.env.EMAIL_FROM &&
        (this.env.RESEND_API_KEY ||
          (this.env.SMTP_HOST && this.env.SMTP_USER && this.env.SMTP_PASSWORD)),
      ),
      whatsappConfigured: Boolean(
        this.env.WHATSAPP_ACCESS_TOKEN && this.env.WHATSAPP_PHONE_NUMBER_ID,
      ),
      whatsappTemplateConfigured: Boolean(this.env.WHATSAPP_ENROLLMENT_TEMPLATE_NAME),
    };
  }
  private async campus() {
    if (!this.env.INTECA_FIREBASE_SERVICE_ACCOUNT_JSON) throw Error('CAMPUS_NOT_CONFIGURED');
    if (!this.campusClient)
      this.campusClient = (async () => {
        let credential;
        try {
          credential = JSON.parse(this.env.INTECA_FIREBASE_SERVICE_ACCOUNT_JSON!);
        } catch {
          throw Error('CAMPUS_CREDENTIALS_INVALID');
        }
        const projectId = this.env.INTECA_FIREBASE_PROJECT_ID || 'gen-lang-client-0415952714';
        if (
          credential.project_id !== projectId ||
          !credential.client_email ||
          !credential.private_key
        )
          throw Error('CAMPUS_CREDENTIALS_INVALID');
        const [{ initializeApp, cert, getApps }, { getAuth }, { Firestore }] = await Promise.all([
          import('firebase-admin/app'),
          import('firebase-admin/auth'),
          import('firebase-admin/firestore'),
        ]);
        const app =
          getApps().find((a) => a.name === 'inteca-enrollment') ||
          initializeApp({ credential: cert(credential), projectId }, 'inteca-enrollment');
        const db = new Firestore({
          projectId,
          databaseId:
            this.env.INTECA_FIRESTORE_DATABASE_ID ||
            'ai-studio-campusvirtualint-dbc5e5fa-0c2e-4740-85d5-91566cdb7d70',
          credentials: {
            client_email: credential.client_email,
            private_key: credential.private_key,
          },
          preferRest: true,
        });
        return { auth: getAuth(app), db };
      })().catch((error) => {
        this.campusClient = undefined;
        throw error;
      });
    return this.campusClient;
  }
  async courses() {
    const { db } = await this.campus();
    const snapshot = await db.collection('courses').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, title: String(doc.get('title') || doc.id) }));
  }
  /**
   * Read-only connection check. It performs no student creation, email or payment.
   * Never returns service-account JSON, user records, private keys or access tokens.
   */
  async campusReadiness(){
    const base=this.status();
    let verified=false,courseCount=0,authReady=false,databaseReady=false;
    let errorCode:string|null=null;
    if(!base.campusConfigured)errorCode='CAMPUS_NOT_CONFIGURED';
    else {
      try {
        const {auth,db}=await this.campus();
        // A minimal user-list check verifies Firebase Auth API permission, without returning user data.
        await auth.listUsers(1);
        authReady=true;
        const courses=await db.collection('courses').get();
        courseCount=courses.size;
        databaseReady=true;
        verified=authReady&&databaseReady;
        if(!courseCount)errorCode='COURSE_NOT_FOUND';
      }catch(error){
        if(error instanceof Error &&
           ['CAMPUS_NOT_CONFIGURED','CAMPUS_CREDENTIALS_INVALID'].includes(error.message))
          errorCode=error.message;
        else errorCode='CAMPUS_PERMISSION_DENIED';
      }
    }
    return {
      ...base, authReady,databaseReady,courseCount,verified,
      errorCode,
      readyForEnrollment:verified&&courseCount>0&&base.campusSyncEnabled,
      checkedAt:new Date().toISOString()
    };
  }
  /** Only exact canonical course titles are mapped automatically.
   * Different courses (e.g. "Autorizaciones Médicas" vs "Técnico en Autorizaciones Médicas")
   * still require the academic administrator's explicit mapping.
   */
  async resolveCourseMapping(db:import('firebase-admin/firestore').Firestore,courseTitle:string){
    const rows=await this.store.request(
      `crm_campus_course_mapping?course_title=eq.${encodeURIComponent(courseTitle)}&select=*`
    );
    if(rows?.[0])return rows[0] as {campus_course_id:string;campus_course_title:string};
    const courses=await db.collection('courses').get();
    const normal=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
    const exact=courses.docs.filter(doc=>normal(String(doc.get('title')||''))===normal(courseTitle));
    if(exact.length!==1)throw Error('COURSE_MAPPING_REQUIRED');
    const doc=exact[0],body={
      course_title:courseTitle,campus_course_id:doc.id,
      campus_course_title:String(doc.get('title')),verified_by:'auto_exact_live',
      updated_at:new Date().toISOString()
    };
    try{await this.store.request('crm_campus_course_mapping','POST',body);}
    catch{
      // Another worker may have created the same mapping concurrently.
      // Never overwrite its academic choice.
      const current=await this.store.request(
        `crm_campus_course_mapping?course_title=eq.${encodeURIComponent(courseTitle)}&select=*`
      );
      if(!current?.[0]||current[0].campus_course_id!==doc.id)
        throw Error('COURSE_MAPPING_REQUIRED');
      return current[0];
    }
    return body;
  }
  async ensure(key: string) {
    return this.store.request('rpc/crm_ensure_student_enrollment', 'POST', { p_key: key });
  }
  async get(key: string): Promise<Enrollment | undefined> {
    return (
      await this.store.request(
        `crm_student_enrollments?contact_key=eq.${encodeURIComponent(key)}&select=*`,
      )
    )[0];
  }
  private async save(row: Enrollment, patch: Record<string, unknown>) {
    const changed = await this.store.request(
      `crm_student_enrollments?id=eq.${row.id}&lease_token=eq.${row.lease_token}`,
      'PATCH',
      { ...patch, updated_at: new Date().toISOString() },
    );
    if (!changed?.length) throw Error('STORAGE_UNAVAILABLE');
    Object.assign(row, patch);
  }
  async provision(row: Enrollment) {
    // Campus repository must first be patched to stop destructive reseeding of courses.
    if (this.env.INTECA_CAMPUS_SYNC_ENABLED !== 'true') throw Error('CAMPUS_SYNC_NOT_ACTIVATED');
    const { auth, db } = await this.campus();
    const mapping=await this.resolveCourseMapping(db,row.course_title);
    const courseRef=db.collection('courses').doc(mapping.campus_course_id);
    const doc=await courseRef.get();
    if(!doc.exists)throw Error('COURSE_NOT_FOUND');
    const canonical=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
    if(canonical(String(doc.get('title')||''))!==canonical(mapping.campus_course_title))
      throw Error('COURSE_MAPPING_STALE');
    let user;
    try {
      user = await auth.getUserByEmail(row.email);
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      try {
        user = await auth.createUser({
          uid: `crm_${crypto.createHash('sha256').update(row.email.toLowerCase()).digest('hex').slice(0, 36)}`,
          email: row.email,
          displayName: row.full_name,
          emailVerified: false,
        });
      } catch (createError) {
        if ((createError as { code?: string }).code !== 'auth/email-already-exists')
          throw createError;
        user = await auth.getUserByEmail(row.email);
      }
    }
    if (
      user.disabled ||
      user.customClaims?.admin ||
      (user.customClaims?.role && user.customClaims.role !== 'student')
    )
      throw Error('CAMPUS_ROLE_CONFLICT');
    const uid = user.uid;
    const userRef = db.collection('users').doc(uid);
    const mirror = db.collection('crm_enrollments').doc(row.id);
    await db.runTransaction(async (tx) => {
      const [profile, course, previous] = await Promise.all([
        tx.get(userRef),
        tx.get(courseRef),
        tx.get(mirror),
      ]);
      if (!course.exists) throw Error('COURSE_NOT_FOUND');
      if (
        profile.exists &&
        ((profile.get('role') && profile.get('role') !== 'student') || profile.get('suspended'))
      )
        throw Error('CAMPUS_ROLE_CONFLICT');
      if (previous.exists) {
        if (
          previous.get('studentId') !== uid ||
          previous.get('courseId') !== mapping.campus_course_id ||
          !course.get('enrolledStudents')?.includes(uid)
        )
          throw Error('CAMPUS_ROLE_CONFLICT');
        return;
      }
      if (!profile.exists)
        tx.set(userRef, {
          id: uid,
          name: row.full_name,
          email: row.email,
          role: 'student',
          academicId: row.registration_code,
          joinedDate: new Date().toISOString(),
          progress: 0,
          attendanceRate: 0,
          averageGrade: 0,
        });
      else if (!profile.get('academicId'))
        tx.update(userRef, { academicId: row.registration_code });
      const students = [
        ...new Set([
          ...(Array.isArray(course.get('enrolledStudents')) ? course.get('enrolledStudents') : []),
          uid,
        ]),
      ];
      tx.update(courseRef, { enrolledStudents: students, studentsCount: students.length });
      tx.create(mirror, {
        registrationCode: row.registration_code,
        studentId: uid,
        courseId: mapping.campus_course_id,
        paymentId: row.payment_id,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
    });
    return { campus_status: 'active', campus_uid: uid, campus_course_id: mapping.campus_course_id };
  }
  private async email(row: Enrollment) {
    if (!this.status().emailConfigured) throw Error('EMAIL_NOT_CONFIGURED');
    const text = welcomeText(
      row,
      this.env.INTECA_CAMPUS_BASE_URL || 'https://campus.inteca.com.do',
    );
    if (this.env.RESEND_API_KEY) {
      await this.save(row, { email_status: 'sending' });
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `crm-enrollment/${row.id}`,
          },
          body: JSON.stringify({
            from: this.env.EMAIL_FROM,
            to: [row.email],
            subject: `Tu matrícula INTECA ${row.registration_code}`,
            text,
          }),
          signal: AbortSignal.timeout(20000),
        });
        const result = await response.json();
        if (!response.ok || !result.id) throw Error('EMAIL_REVIEW_REQUIRED');
        await this.save(row, { email_status: 'accepted', email_provider_id: result.id });
      } catch {
        throw Error('EMAIL_REVIEW_REQUIRED');
      }
      return;
    }
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(this.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: this.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: this.env.SMTP_USER, pass: this.env.SMTP_PASSWORD },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
    });
    await this.save(row, { email_status: 'sending' });
    try {
      const result = await transport.sendMail({
        from: this.env.EMAIL_FROM,
        to: row.email,
        subject: `Tu matrícula INTECA ${row.registration_code}`,
        text,
        messageId: `<enrollment-${row.id}@inteca.com.do>`,
      });
      if (!result.accepted?.length) throw Error('EMAIL_REVIEW_REQUIRED');
      await this.save(row, { email_status: 'accepted', email_provider_id: result.messageId });
    } catch {
      throw Error('EMAIL_REVIEW_REQUIRED');
    } finally {
      transport.close();
    }
  }
  private async whatsapp(row: Enrollment, sale: SalesOpportunity) {
    if (!this.status().whatsappConfigured) throw Error('PROVIDER_ERROR');
    const payload = whatsappWelcomePayload(row, sale, this.env);
    await this.save(row, { whatsapp_status: 'sending' });
    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.env.META_GRAPH_API_VERSION || 'v26.0'}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.messages?.[0]?.id) throw Error('WHATSAPP_REVIEW_REQUIRED');
      await this.save(row, {
        whatsapp_status: 'accepted',
        whatsapp_provider_id: data.messages[0].id,
      });
    } catch {
      throw Error('WHATSAPP_REVIEW_REQUIRED');
    }
  }
  async process(row: Enrollment) {
    const errors: string[] = [];
    try {
      const payment = (
        await this.store.request(
          `crm_sales_payments?id=eq.${row.payment_id}&contact_key=eq.${row.contact_key}&select=receipt_id`,
        )
      )[0];
      if (!payment?.receipt_id) throw Error('PAYMENT_REQUIRED');
      if (row.campus_status !== 'active') await this.save(row, await this.provision(row));
      const sale = await this.store.get(row.contact_key);
      if (!sale) throw Error('PAYMENT_REQUIRED');
      // Never automatically repeat a send whose result was lost during a crash/restart.
      if (String(row.email_status) === 'sending') await this.save(row, { email_status: 'review' });
      if (String(row.whatsapp_status) === 'sending')
        await this.save(row, { whatsapp_status: 'review' });
      if (row.email_status === 'pending') {
        try {
          await this.email(row);
        } catch (error) {
          errors.push(enrollmentError(error));
          if (String(row.email_status) === 'sending')
            await this.save(row, { email_status: 'review' });
        }
      }
      if (row.whatsapp_status === 'pending') {
        try {
          await this.whatsapp(row, sale);
        } catch (error) {
          errors.push(enrollmentError(error));
          if (String(row.whatsapp_status) === 'sending')
            await this.save(row, { whatsapp_status: 'review' });
        }
      }
      if (row.email_status === 'review') errors.push('EMAIL_REVIEW_REQUIRED');
      if (row.whatsapp_status === 'review') errors.push('WHATSAPP_REVIEW_REQUIRED');
    } catch (error) {
      errors.push(enrollmentError(error));
    }
    await this.save(row, {
      last_error: [...new Set(errors)].join(','),
      ...(errors.some((code) =>
        [
          'CAMPUS_NOT_CONFIGURED',
          'CAMPUS_SYNC_NOT_ACTIVATED',
          'CAMPUS_PERMISSION_DENIED',
          'CAMPUS_CREDENTIALS_INVALID',
          'COURSE_MAPPING_STALE',
          'EMAIL_NOT_CONFIGURED',
          'COURSE_MAPPING_REQUIRED',
          'WHATSAPP_WINDOW_CLOSED',
        ].includes(code),
      )
        ? { attempts: 0 }
        : {}),
      lease_token: null,
      lease_until: null,
      next_attempt_at: new Date(Date.now() + 15 * 60000).toISOString(),
    });
  }
  async tick() {
    if (this.running || !this.store.configured() || this.env.ENROLLMENT_AUTO_ENABLED === 'false')
      return;
    this.running = true;
    try {
      // Recover validated payments whose contact details were completed after payment.
      const paid = await this.store.request(
        'crm_sales_payments?receipt_id=not.is.null&select=contact_key,crm_student_enrollments!left(id)&crm_student_enrollments=is.null&order=verified_at.desc&limit=100',
      );
      for (const p of paid) await this.ensure(p.contact_key);
      for (let n = 0; n < 3; n++) {
        const rows = await this.store.request('rpc/crm_claim_student_enrollment', 'POST', {});
        if (!rows?.length) break;
        await this.process(rows[0]);
      }
    } catch {
      console.warn('Enrollment processing pending; inspect the authenticated enrollment panel');
    } finally {
      this.running = false;
    }
  }
  private async storage(path: string, init: RequestInit = {}) {
    const response = await fetch(
      `${this.env.SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/crm-payment-receipts/${path}`,
      {
        ...init,
        headers: {
          apikey: this.env.SUPABASE_SERVICE_ROLE_KEY || '',
          Authorization: `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
          ...init.headers,
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw Error('STORAGE_UNAVAILABLE');
    return response;
  }
  async uploadReceipt(key: string, bytes: Buffer, actor: string, eventId?: string) {
    if (!(await this.store.get(key))) throw Error('PAYMENT_REQUIRED');
    const mime = receiptMime(bytes),
      sha = crypto.createHash('sha256').update(bytes).digest('hex');
    const previous = (
      await this.store.request(`crm_payment_receipts?sha256=eq.${sha}&select=*`)
    )[0];
    if (previous) {
      if (previous.contact_key !== key) throw Error('RECEIPT_INVALID');
      return previous;
    }
    const id = crypto.randomUUID(),
      path = `${key}/${id}`;
    await this.storage(path, {
      method: 'POST',
      headers: { 'Content-Type': mime },
      body: new Uint8Array(bytes),
    });
    return (
      await this.store.request('crm_payment_receipts', 'POST', {
        id,
        contact_key: key,
        storage_path: path,
        sha256: sha,
        mime_type: mime,
        uploaded_by: actor,
        source_event_id: eventId || null,
      })
    )[0];
  }
  async importWhatsAppReceipt(key: string, eventId: string, actor: string) {
    const event = (
      await this.store.request(`crm_sales_events?id=eq.${eventId}&contact_key=eq.${key}&select=*`)
    )[0];
    const mediaId = event?.details?.mediaId;
    if (!mediaId || !['image', 'document'].includes(event?.details?.mediaType))
      throw Error('RECEIPT_UNAVAILABLE');
    const headers = { Authorization: `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}` };
    const response = await fetch(
      `https://graph.facebook.com/${this.env.META_GRAPH_API_VERSION || 'v26.0'}/${encodeURIComponent(mediaId)}`,
      { headers, signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw Error('RECEIPT_UNAVAILABLE');
    const data = await response.json();
    const url = new URL(data.url);
    if (
      url.protocol !== 'https:' ||
      !(url.hostname.endsWith('.fbsbx.com') || url.hostname.endsWith('.fbcdn.net'))
    )
      throw Error('RECEIPT_UNAVAILABLE');
    const media = await fetch(url, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!media.ok || Number(media.headers.get('content-length')) > 5242880)
      throw Error('RECEIPT_INVALID');
    const reader = media.body?.getReader();
    if (!reader) throw Error('RECEIPT_UNAVAILABLE');
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 5242880) {
        await reader.cancel();
        throw Error('RECEIPT_INVALID');
      }
      chunks.push(value);
    }
    return this.uploadReceipt(key, Buffer.concat(chunks), actor, eventId);
  }
  async receipt(id: string) {
    const record = (
      await this.store.request(`crm_payment_receipts?id=eq.${encodeURIComponent(id)}&select=*`)
    )[0];
    if (!record) throw Error('RECEIPT_UNAVAILABLE');
    const response = await this.storage(record.storage_path);
    return { bytes: Buffer.from(await response.arrayBuffer()), mime: record.mime_type };
  }
}
