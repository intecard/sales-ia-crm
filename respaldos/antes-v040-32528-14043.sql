--
-- PostgreSQL database dump
--

\restrict hSQHe0ySvQBWkTWiJAcXrY5SsNpQpmyw4GqRfEoMbFMyfXgls9kf3ccObNL5x1u

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ActivityType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActivityType" AS ENUM (
    'NOTE',
    'TASK',
    'CALL',
    'EMAIL',
    'MEETING',
    'FOLLOW_UP'
);


--
-- Name: ContactStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContactStatus" AS ENUM (
    'ACTIVE',
    'WON',
    'LOST',
    'PAUSED'
);


--
-- Name: DealStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DealStatus" AS ENUM (
    'OPEN',
    'WON',
    'LOST'
);


--
-- Name: IntegrationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IntegrationStatus" AS ENUM (
    'NOT_CONFIGURED',
    'SANDBOX',
    'CONNECTED',
    'ERROR',
    'PAUSED'
);


--
-- Name: MessageDirection; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MessageDirection" AS ENUM (
    'INBOUND',
    'OUTBOUND'
);


--
-- Name: OrganizationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrganizationStatus" AS ENUM (
    'TRIAL',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REFUNDED',
    'CANCELED'
);


--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AIAgent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AIAgent" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "systemPrompt" text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Activity" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "contactId" text,
    "dealId" text,
    "assignedUserId" text,
    type public."ActivityType" NOT NULL,
    title text NOT NULL,
    description text,
    "dueAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "organizationId" text,
    "actorUserId" text,
    action text NOT NULL,
    "entityType" text,
    "entityId" text,
    "ipAddress" text,
    "userAgent" text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Automation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Automation" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    trigger jsonb NOT NULL,
    actions jsonb NOT NULL,
    active boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Campaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Campaign" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    channel text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    audience jsonb DEFAULT '{}'::jsonb NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    "scheduledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ChannelEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChannelEvent" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    provider text NOT NULL,
    "externalId" text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "conversationId" text,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Company" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    website text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Contact" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "companyId" text,
    "firstName" text NOT NULL,
    "lastName" text,
    email text,
    phone text,
    status public."ContactStatus" DEFAULT 'ACTIVE'::public."ContactStatus" NOT NULL,
    source text,
    "ownerUserId" text,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Conversation" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "contactId" text,
    channel text NOT NULL,
    "externalRef" text,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CreativeContent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CreativeContent" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    type text NOT NULL,
    format text NOT NULL,
    title text NOT NULL,
    subtitle text,
    body text NOT NULL,
    "callToAction" text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "sourceName" text,
    "sourceVerified" boolean DEFAULT false NOT NULL,
    "consentConfirmed" boolean DEFAULT false NOT NULL,
    "factsConfirmed" boolean DEFAULT false NOT NULL,
    "brandSettings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "reviewNotes" text,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CustomFieldDefinition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomFieldDefinition" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "entityType" text NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    "fieldType" text NOT NULL,
    required boolean DEFAULT false NOT NULL,
    options jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: Deal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Deal" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "pipelineId" text NOT NULL,
    "stageId" text NOT NULL,
    "contactId" text,
    "companyId" text,
    "productId" text,
    title text NOT NULL,
    value numeric(12,2) NOT NULL,
    currency text DEFAULT 'DOP'::text NOT NULL,
    probability integer DEFAULT 0 NOT NULL,
    status public."DealStatus" DEFAULT 'OPEN'::public."DealStatus" NOT NULL,
    "expectedCloseAt" timestamp(3) without time zone,
    "lostReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "ownerEntity" text,
    "ownerEntityId" text,
    name text NOT NULL,
    "mimeType" text NOT NULL,
    "sizeBytes" integer NOT NULL,
    "storageKey" text NOT NULL,
    checksum text NOT NULL,
    status text DEFAULT 'PENDING_SCAN'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    content bytea
);


--
-- Name: IntegrationConnection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IntegrationConnection" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    provider text NOT NULL,
    status public."IntegrationStatus" DEFAULT 'NOT_CONFIGURED'::public."IntegrationStatus" NOT NULL,
    "encryptedConfig" text,
    "lastError" text,
    "lastCheckedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Membership" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text NOT NULL,
    "roleId" text NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    direction public."MessageDirection" NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "externalRef" text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ModuleInstallation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ModuleInstallation" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "moduleCode" text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: Organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Organization" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    status public."OrganizationStatus" DEFAULT 'TRIAL'::public."OrganizationStatus" NOT NULL,
    timezone text DEFAULT 'America/Santo_Domingo'::text NOT NULL,
    locale text DEFAULT 'es-DO'::text NOT NULL,
    currency text DEFAULT 'DOP'::text NOT NULL,
    "logoUrl" text,
    "primaryColor" text DEFAULT '#4f46e5'::text,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "contactId" text,
    "productId" text,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'DOP'::text NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    provider text NOT NULL,
    "providerRef" text,
    "idempotencyKey" text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PaymentRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentRequest" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "contactId" text,
    token text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "paymentId" text,
    "proofMeta" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Permission" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


--
-- Name: Pipeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Pipeline" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Plan" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "monthlyPrice" numeric(12,2) NOT NULL,
    "annualPrice" numeric(12,2) NOT NULL,
    "userLimit" integer NOT NULL,
    "contactLimit" integer NOT NULL,
    "storageMbLimit" integer NOT NULL,
    "aiCreditsLimit" integer NOT NULL,
    features jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    sku text,
    type text DEFAULT 'SERVICE'::text NOT NULL,
    description text,
    price numeric(12,2) NOT NULL,
    currency text DEFAULT 'DOP'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PromptVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PromptVersion" (
    id text NOT NULL,
    "agentId" text NOT NULL,
    version integer NOT NULL,
    prompt text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


--
-- Name: RolePermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RolePermission" (
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Stage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Stage" (
    id text NOT NULL,
    "pipelineId" text NOT NULL,
    name text NOT NULL,
    "position" integer NOT NULL,
    color text
);


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "planId" text NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'TRIALING'::public."SubscriptionStatus" NOT NULL,
    "startsAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "trialEndsAt" timestamp(3) without time zone,
    "currentEndAt" timestamp(3) without time zone,
    "canceledAt" timestamp(3) without time zone,
    provider text,
    "providerRef" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UsageRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UsageRecord" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    metric text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    period text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "emailVerifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: AIAgent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AIAgent" (id, "organizationId", name, role, active, "systemPrompt", settings, "createdAt", "updatedAt") FROM stdin;
cmuap3e28000jpb1idlmfvigj	cmu8zqzix0000qg37m5bwj7li	Estratega de Marketing	Marketing y posicionamiento	t	Diseña estrategias para atraer estudiantes en República Dominicana: segmentación, propuesta de valor, calendario de contenido, noticias institucionales basadas en hechos e indicadores. Puede ordenar la publicación automática de campañas comerciales autorizadas en canales oficiales conectados y debe notificar al propietario después. Noticias, testimonios y cambios institucionales permanecen en revisión hasta aprobación. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.544	2026-09-23 12:34:44.015
cmuap3e0o000fpb1i1015vcw7	cmu8zqzix0000qg37m5bwj7li	Prospector Digital INTECA	Prospección y captación	t	Identifica públicos y fuentes potenciales, propone búsquedas, alianzas, contenidos y campañas para captar nuevos prospectos. Califica señales de interés y prepara acercamientos personalizados sin recopilar datos de forma invasiva ni enviar mensajes masivos no solicitados. Registra fuente, necesidad y siguiente acción cuando el CRM lo permita. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.489	2026-09-23 12:34:43.944
cmuap3e3s000npb1i7ea5cpcu	cmu8zqzix0000qg37m5bwj7li	Diseñador de Embudos	Embudo y automatización	t	Diseña recorridos desde anuncio o referido hasta inscripción: captura, calificación, seguimiento, objeciones, pago y bienvenida. Define disparadores y tareas sin afirmar que una integración inexistente las ejecutó. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.6	2026-09-23 12:34:44.082
cmuap3e6v000vpb1iibzpesvx	cmu8zqzix0000qg37m5bwj7li	Atención al Estudiante	Servicio y coordinación interna	t	Responde preguntas sobre modalidad, horarios, requisitos, inscripción y soporte. Mantiene la continuidad del caso, registra incidencias y coordina con admisiones, docencia, administración o cobros. Deriva reclamos, pagos no identificados y decisiones excepcionales con contexto completo. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.711	2026-09-23 12:34:44.248
cmuap3e9n0013pb1iri3kcst8	cmu8zqzix0000qg37m5bwj7li	Analista Comercial	Datos, oportunidades y optimización	t	Analiza datos reales del CRM: fuentes, necesidades, tiempos de respuesta, etapas, conversiones, cumplimiento de metas y motivos de pérdida. Detecta registros incompletos y propone qué información de clientes u oportunidades debe actualizarse. Señala cuando la muestra es insuficiente y propone experimentos medibles. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.811	2026-09-23 12:34:44.393
cmuap3e4m000ppb1i1g30h3ob	cmu8zqzix0000qg37m5bwj7li	Calificador de Prospectos	Necesidades y calificación de leads	t	Identifica necesidades preguntando objetivo laboral, experiencia, disponibilidad, modalidad deseada, urgencia y capacidad de pago sin discriminar. Resume necesidad, nivel de intención, producto adecuado, objeción principal y próximo paso. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.63	2026-09-23 12:34:44.102
cmuap3dzy000dpb1itilz6ael	cmu8zqzix0000qg37m5bwj7li	Coordinador Comercial INTECA	Dirección, metas y coordinación	t	Coordina los demás especialistas y las áreas internas. Distribuye oportunidades, define metas medibles, controla avances, identifica bloqueos y solicita apoyo de admisiones, docencia, administración o cobros para garantizar atención y entrega. Entrega planes con responsable, canal, plazo e indicador. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.463	2026-09-23 12:34:43.92
cmuap3e66000tpb1i0278dr5w	cmu8zqzix0000qg37m5bwj7li	Agente de Seguimiento	Seguimiento y cierre	t	Da seguimiento desde el primer contacto hasta cierre, pérdida o pausa documentada. Prepara contactos oportunos para interesados sin respuesta, inscripción pendiente y personas que solicitaron contacto posterior. Después de cada interacción propone actualizar etapa, probabilidad, objeción, compromiso y fecha del próximo contacto. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.686	2026-09-23 12:34:44.204
cmuap3e33000lpb1ivqbf51jb	cmu8zqzix0000qg37m5bwj7li	Especialista en Publicidad	Publicidad digital	t	Prepara campañas de Meta Ads y Google Ads: objetivo, público, creatividad, texto, presupuesto, métricas y pruebas A/B. Puede publicar campañas comerciales que cumplan exactamente las condiciones y topes autorizados cuando la integración oficial esté conectada. Debe registrar el identificador devuelto por el proveedor y notificar al propietario; si falta conexión, presupuesto o confirmación del proveedor, deja la campaña pendiente y lo informa. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.575	2026-09-23 12:34:44.048
cmuaqzlqp000dqb1ieb566guw	cmu8zqzix0000qg37m5bwj7li	Experto en Ventas y Cierre	Conversión, objeciones y cierre consultivo	t	Actúa como especialista sénior en ventas consultivas y cierre. Su objetivo es convertir prospectos calificados en estudiantes mediante escucha activa, preguntas de diagnóstico, comunicación de valor, prueba de comprensión y llamados a la acción claros. Antes de responder una objeción identifica su causa real y la clasifica como precio, tiempo, confianza, necesidad, autoridad de decisión, comparación, modalidad o urgencia. Responde con el método: reconocer sin confrontar, preguntar para precisar, vincular la necesidad con beneficios verificables, presentar una alternativa autorizada y solicitar un siguiente paso concreto. Puede utilizar resumen de valor, costo de postergar la decisión sin exageraciones, comparación transparente, cierre por elección, cierre por próximo paso y seguimiento acordado. Detecta señales de compra, confirma condiciones, conduce al procedimiento de inscripción o pago configurado y registra etapa, probabilidad, objeción, respuesta, compromiso y próxima fecha. Si el prospecto no encaja, no puede pagar, pide no ser contactado o necesita una excepción, respeta su decisión y deriva el caso cuando corresponda. Nunca manipula, intimida, oculta condiciones, inventa escasez, desacredita competidores, garantiza empleo o pasantía, ni ofrece descuentos no autorizados. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 04:31:13.106	2026-09-23 12:34:44.17
cmuap3e7p000xpb1ih2dpgit7	cmu8zqzix0000qg37m5bwj7li	Respondedor WhatsApp	Mensajería y primera respuesta	t	Redacta respuestas breves y cálidas para WhatsApp, identifica la necesidad, responde con datos aprobados y conduce al paso siguiente. No usa audios ni archivos salvo que estén disponibles y autorizados. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.742	2026-09-23 12:34:44.293
cmuap3e1j000hpb1ii0723tpu	cmu8zqzix0000qg37m5bwj7li	Gestor de Relaciones	Relaciones y fidelización	t	Mantiene y fortalece relaciones con prospectos, estudiantes y clientes actuales mediante seguimiento útil, atención posventa, recordatorios pertinentes y detección de nuevas necesidades. Evita saturar y conserva contexto, preferencias y compromisos en el CRM. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.52	2026-09-23 12:34:43.981
cmuap3e5b000rpb1imdkhxq1a	cmu8zqzix0000qg37m5bwj7li	Asesor de Ventas	Presentación, asesoría y negociación	t	Presenta productos y servicios de forma consultiva y recomienda solo los que encajen con la necesidad. Explica alcance, precio total, inscripción, mensualidades y condiciones. Negocia únicamente alternativas aprobadas, atiende objeciones con empatía y guía el proceso hasta una decisión clara. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.656	2026-09-23 12:34:44.133
cmuap3e8e000zpb1icrehffrk	cmu8zqzix0000qg37m5bwj7li	Recuperación y Cobros	Recuperación y recordatorios	t	Prepara recordatorios respetuosos de inscripción o mensualidades únicamente cuando exista un registro verificable. No amenaza, no añade mora no autorizada y deriva discrepancias de pago a una persona. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.767	2026-09-23 12:34:44.326
cmuap3e8y0011pb1i02yhttpa	cmu8zqzix0000qg37m5bwj7li	Supervisor de Metas	Metas y desempeño comercial	t	Convierte objetivos aprobados en metas diarias y semanales de prospectos, conversaciones, seguimientos, cierres e ingresos. Compara resultados reales, detecta desviaciones y recomienda acciones responsables sin manipular cifras. Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.	{}	2026-09-21 03:38:10.786	2026-09-23 12:34:44.36
\.


--
-- Data for Name: Activity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Activity" (id, "organizationId", "contactId", "dealId", "assignedUserId", type, title, description, "dueAt", "completedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLog" (id, "organizationId", "actorUserId", action, "entityType", "entityId", "ipAddress", "userAgent", metadata, "createdAt") FROM stdin;
cmu8zqzl8000gqg3755tse3be	cmu8zqzix0000qg37m5bwj7li	cmu8zqzj00001qg37vdhxek34	organization.registered	Organization	cmu8zqzix0000qg37m5bwj7li	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	{}	2026-09-19 23:00:55.34
cmu8zt1pa000oqg37y6f03nsm	cmu8zqzix0000qg37m5bwj7li	cmu8zqzj00001qg37vdhxek34	pipeline.created	Pipeline	cmu8zt1ns000iqg37mgbk4xmg	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	{}	2026-09-19 23:02:31.39
\.


--
-- Data for Name: Automation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Automation" (id, "organizationId", name, trigger, actions, active, "createdAt", "updatedAt") FROM stdin;
cmuap3eie0017pb1irloml14p	cmu8zqzix0000qg37m5bwj7li	Primer contacto inmediato	{"event": "CONTACT_CREATED"}	{"type": "FOLLOW_UP", "title": "Contactar nuevo prospecto y confirmar su interés", "delayHours": 0}	t	2026-09-21 03:38:11.126	2026-09-23 12:34:44.771
cmuap3ejh0019pb1ixqlv67m8	cmu8zqzix0000qg37m5bwj7li	Seguimiento de 24 horas	{"event": "CONTACT_CREATED"}	{"type": "FOLLOW_UP", "title": "Dar seguimiento al prospecto con contexto y próxima acción", "delayHours": 24}	t	2026-09-21 03:38:11.165	2026-09-23 12:34:44.805
cmuap3ek5001bpb1ikcbckevx	cmu8zqzix0000qg37m5bwj7li	Seguimiento de 72 horas	{"event": "CONTACT_CREATED"}	{"type": "FOLLOW_UP", "title": "Revisar objeción o falta de respuesta sin presionar", "delayHours": 72}	t	2026-09-21 03:38:11.189	2026-09-23 12:34:44.838
\.


--
-- Data for Name: Campaign; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Campaign" (id, "organizationId", name, channel, status, audience, content, "scheduledAt", "createdAt", "updatedAt") FROM stdin;
cmuap3eku001dpb1iju6veuk9	cmu8zqzix0000qg37m5bwj7li	Conoce el trabajo en autorizaciones médicas	META	DRAFT	{"description": "Adultos en República Dominicana interesados en ingresar al sector salud o fortalecer experiencia administrativa."}	{"text": "¿Te interesa trabajar en procesos de autorizaciones médicas? Conoce cómo se validan coberturas, se orienta al afiliado y se gestionan solicitudes en el sector salud. INTECA ofrece formación virtual práctica. Escríbenos para recibir el pénsum, horarios y condiciones vigentes."}	\N	2026-09-21 03:38:11.214	2026-09-23 12:34:44.959
cmuap3elo001fpb1i78m0uddm	cmu8zqzix0000qg37m5bwj7li	Respuesta inicial a interesados	WHATSAPP	DRAFT	{"description": "Personas que solicitaron información voluntariamente."}	{"text": "¡Hola, {{nombre}}! Gracias por comunicarte con INTECA. Para orientarte correctamente, ¿buscas prepararte para trabajar en autorizaciones médicas, fortalecer experiencia que ya tienes o conocer horarios y costos?"}	\N	2026-09-21 03:38:11.245	2026-09-23 12:34:44.994
cmuap3eml001hpb1itx3269x5	cmu8zqzix0000qg37m5bwj7li	Seguimiento informativo	WHATSAPP	DRAFT	{"description": "Interesados que recibieron información y no solicitaron dejar de ser contactados."}	{"text": "Hola, {{nombre}}. Te escribimos para saber si pudiste revisar la información del programa de Autorizaciones Médicas. Si me indicas tu disponibilidad, puedo ayudarte a identificar el horario que mejor se adapta a ti."}	\N	2026-09-21 03:38:11.277	2026-09-23 12:34:45.027
\.


--
-- Data for Name: ChannelEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ChannelEvent" (id, "organizationId", provider, "externalId", payload, status, "conversationId", error, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Company; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Company" (id, "organizationId", name, email, phone, website, metadata, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Contact; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Contact" (id, "organizationId", "companyId", "firstName", "lastName", email, phone, status, source, "ownerUserId", tags, metadata, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Conversation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Conversation" (id, "organizationId", "contactId", channel, "externalRef", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: CreativeContent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CreativeContent" (id, "organizationId", type, format, title, subtitle, body, "callToAction", status, "sourceName", "sourceVerified", "consentConfirmed", "factsConfirmed", "brandSettings", "reviewNotes", "approvedBy", "approvedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: CustomFieldDefinition; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomFieldDefinition" (id, "organizationId", "entityType", key, label, "fieldType", required, options) FROM stdin;
\.


--
-- Data for Name: Deal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Deal" (id, "organizationId", "pipelineId", "stageId", "contactId", "companyId", "productId", title, value, currency, probability, status, "expectedCloseAt", "lostReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Document" (id, "organizationId", "ownerEntity", "ownerEntityId", name, "mimeType", "sizeBytes", "storageKey", checksum, status, "createdAt", "updatedAt", content) FROM stdin;
\.


--
-- Data for Name: IntegrationConnection; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."IntegrationConnection" (id, "organizationId", provider, status, "encryptedConfig", "lastError", "lastCheckedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Membership; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Membership" (id, "organizationId", "userId", "roleId", active) FROM stdin;
cmu8zqzj20003qg37ka9qzqem	cmu8zqzix0000qg37m5bwj7li	cmu8zqzj00001qg37vdhxek34	cmu8zkr8f0007qg28en26phu9	t
\.


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Message" (id, "conversationId", direction, content, status, "externalRef", metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: ModuleInstallation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ModuleInstallation" (id, "organizationId", "moduleCode", enabled, settings) FROM stdin;
cmuap3enu001jpb1idnqreaeq	cmu8zqzix0000qg37m5bwj7li	SALES_POLICY	f	{"enabled": false, "website": "https://www.inteca.com.do", "widgetKey": "3c441f33e56484901a0788cbdc99956aacdb55d25d74dfa1", "checkoutUrl": "", "dailyAiLimit": 100, "handoffEmail": "", "salesPlaybook": "1. Saluda e identifica el objetivo de la persona. 2. Pregunta experiencia y disponibilidad. 3. Recomienda únicamente el programa confirmado que encaje. 4. Explica modalidad, duración, horario y precio distinguiendo total, inscripción y cuotas. 5. Responde objeciones con datos verificables. 6. Si desea inscribirse, deriva al WhatsApp institucional o al procedimiento de pago configurado. 7. Registra el próximo seguimiento. 8. Si falta información, indica que debe confirmarse con administración. 9. Respeta solicitudes de no contacto y nunca garantiza empleo, avales o cupos de pasantía.", "businessContext": "INTECA SRL es una institución de capacitación de República Dominicana. Su programa confirmado es Técnico/Oficial de Autorizaciones Médicas, virtual, orientado a procesos de ARS y prestadores de salud. WhatsApp institucional: +1 809-643-5502. Canales oficiales de trabajo: Instagram https://www.instagram.com/formacion.inteca/ ; Facebook https://www.facebook.com/profile.php?id=61577734884829 ; Google Ads, cuenta indicada por el propietario, accesible desde el panel de Integraciones. Utiliza únicamente el catálogo aprobado. La asistencia automática prepara respuestas y no sustituye confirmaciones administrativas, de pago, pasantía o colocación laboral. El propietario autoriza la publicación automática de campañas comerciales que respeten configuración y presupuesto aprobados; se le notifica después. Noticias, testimonios y cambios institucionales requieren aprobación previa.", "autoPublishCampaigns": true, "notifyAfterCampaignPublish": true}
\.


--
-- Data for Name: Organization; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Organization" (id, name, slug, status, timezone, locale, currency, "logoUrl", "primaryColor", settings, "createdAt", "updatedAt") FROM stdin;
cmu8zqzix0000qg37m5bwj7li	INTECA SRL	insituto-tecnico	TRIAL	America/Santo_Domingo	es-DO	DOP	\N	#4f46e5	{}	2026-09-19 23:00:55.258	2026-09-23 12:34:43.715
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "organizationId", "contactId", "productId", amount, currency, status, provider, "providerRef", "idempotencyKey", metadata, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PaymentRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentRequest" (id, "organizationId", "contactId", token, amount, currency, description, status, "expiresAt", "paymentId", "proofMeta", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Permission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Permission" (id, code, name) FROM stdin;
cmu8zkqxg0000qg28eoip157y	crm.write	crm.write
cmu8zkqyz0003qg28a7jib76c	analytics.read	analytics.read
cmu8zkqyj0001qg28wtr4v9ip	crm.read	crm.read
cmu8zkqz20004qg28dzvw435z	ai.use	ai.use
cmu8zkqyx0002qg28qzxkl8bu	settings.manage	settings.manage
cmu8zkqzl0006qg280b6rp8lj	payments.read	payments.read
cmu8zkqze0005qg28bst28jxx	payments.manage	payments.manage
\.


--
-- Data for Name: Pipeline; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Pipeline" (id, "organizationId", name, "isDefault", "createdAt", "updatedAt") FROM stdin;
cmu8zqzje0007qg37zdba0n5r	cmu8zqzix0000qg37m5bwj7li	Ventas	t	2026-09-19 23:00:55.274	2026-09-19 23:00:55.274
cmu8zt1ns000iqg37mgbk4xmg	cmu8zqzix0000qg37m5bwj7li	ingresos 1	f	2026-09-19 23:02:31.336	2026-09-19 23:02:31.336
\.


--
-- Data for Name: Plan; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Plan" (id, code, name, "monthlyPrice", "annualPrice", "userLimit", "contactLimit", "storageMbLimit", "aiCreditsLimit", features, active, "createdAt", "updatedAt") FROM stdin;
cmu8zkrqb000bqg28brcy4fv8	STARTER	Emprendedor	29.00	290.00	3	2500	2048	1000	["crm", "products", "pipelines", "ai_sandbox"]	t	2026-09-19 22:56:05.22	2026-09-19 22:56:05.22
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Product" (id, "organizationId", name, sku, type, description, price, currency, active, metadata, "createdAt", "updatedAt") FROM stdin;
cmuap3eay0015pb1ievu5x914	cmu8zqzix0000qg37m5bwj7li	Técnico/Oficial de Autorizaciones Médicas	INTECA-AUT-MED-2026-10	COURSE	Formación virtual práctica en autorizaciones y precertificaciones médicas, coberturas del PBS, atención al afiliado y procesos del sector salud dominicano.	12500.00	DOP	t	{"courseKnowledge": {"fees": "Precio total RD$12,500. Inscripción RD$2,500 y cinco mensualidades de RD$2,000. La reserva se realiza con la inscripción. Promoción confirmada: tres referidos efectivamente inscritos permiten un descuento equivalente al 50% del precio, aplicado mediante mensualidades ajustadas; confirmar vigencia antes de ofrecer.", "modules": "PBS y marco del Sistema Dominicano de Seguridad Social; flujos de autorizaciones y precertificaciones; validación de coberturas; atención al afiliado; SISALRIL y CNSS; casos prácticos y plataformas; Ley 87-01; reclamos y reembolsos.", "sources": "Información operativa suministrada y confirmada por el propietario de INTECA el 23 de agosto de 2026; horarios, precio e inicio revisados para esta configuración el 20 de septiembre de 2026.", "approved": true, "duration": "5 meses; un encuentro semanal de 2 horas.", "modality": "Virtual.", "policies": "Capacidad informada: 200 participantes. Se anuncian prácticas y pasantía en ARS como parte de la propuesta; disponibilidad, entidad receptora, cupos y condiciones deben confirmarse individualmente antes de prometer colocación. No se garantiza empleo.", "schedule": "Lunes a viernes: 3:00–5:00 p. m. o 7:00–9:00 p. m. Sábados: 10:00 a. m.–12:00 m. o 2:00–4:00 p. m. Domingos: 9:00–11:00 a. m. Inicio informado: 1 de octubre de 2026. Hora de República Dominicana.", "syllabus": "Programa práctico de formación para funciones de autorizaciones médicas en ARS y prestadores de servicios de salud. El detalle ampliado debe entregarse únicamente desde el pénsum institucional vigente.", "reviewedAt": "2026-09-23T12:34:44.473Z", "reviewedBy": "SYSTEM_INTECA_BOOTSTRAP", "validUntil": "2026-10-01T03:59:59.999Z", "certificate": "Documento emitido por INTECA; nombre exacto, alcance y condiciones de entrega deben confirmarse con administración antes de prometerlos.", "requirements": "Dirigido a personas interesadas en trabajar o fortalecer conocimientos en autorizaciones médicas y atención dentro del sector salud. Requisitos documentales específicos: confirmar con admisiones.", "accreditations": "No se ha confirmado ningún aval externo. No presentar solicitudes o alianzas en proceso como avales otorgados.", "catalogueAtReview": {"name": "Técnico/Oficial de Autorizaciones Médicas", "price": "12500", "currency": "DOP", "description": "Formación virtual práctica en autorizaciones y precertificaciones médicas, coberturas del PBS, atención al afiliado y procesos del sector salud dominicano."}}}	2026-09-21 03:38:10.858	2026-09-23 12:34:44.474
\.


--
-- Data for Name: PromptVersion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PromptVersion" (id, "agentId", version, prompt, active, "createdAt") FROM stdin;
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Role" (id, code, name) FROM stdin;
cmu8zkr8f0007qg28en26phu9	OWNER	Propietario
cmu8zkrax0008qg28hqo3sslf	MANAGER	MANAGER
cmu8zkrim0009qg2831h1r05w	SALES	SALES
cmu8zkrns000aqg28q0ewajca	VIEWER	VIEWER
\.


--
-- Data for Name: RolePermission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RolePermission" ("roleId", "permissionId") FROM stdin;
cmu8zkr8f0007qg28en26phu9	cmu8zkqyz0003qg28a7jib76c
cmu8zkr8f0007qg28en26phu9	cmu8zkqyj0001qg28wtr4v9ip
cmu8zkr8f0007qg28en26phu9	cmu8zkqyx0002qg28qzxkl8bu
cmu8zkr8f0007qg28en26phu9	cmu8zkqzl0006qg280b6rp8lj
cmu8zkr8f0007qg28en26phu9	cmu8zkqxg0000qg28eoip157y
cmu8zkr8f0007qg28en26phu9	cmu8zkqze0005qg28bst28jxx
cmu8zkr8f0007qg28en26phu9	cmu8zkqz20004qg28dzvw435z
cmu8zkrax0008qg28hqo3sslf	cmu8zkqyj0001qg28wtr4v9ip
cmu8zkrax0008qg28hqo3sslf	cmu8zkqxg0000qg28eoip157y
cmu8zkrax0008qg28hqo3sslf	cmu8zkqyx0002qg28qzxkl8bu
cmu8zkrax0008qg28hqo3sslf	cmu8zkqzl0006qg280b6rp8lj
cmu8zkrax0008qg28hqo3sslf	cmu8zkqze0005qg28bst28jxx
cmu8zkrax0008qg28hqo3sslf	cmu8zkqz20004qg28dzvw435z
cmu8zkrax0008qg28hqo3sslf	cmu8zkqyz0003qg28a7jib76c
cmu8zkrim0009qg2831h1r05w	cmu8zkqyj0001qg28wtr4v9ip
cmu8zkrim0009qg2831h1r05w	cmu8zkqxg0000qg28eoip157y
cmu8zkrim0009qg2831h1r05w	cmu8zkqz20004qg28dzvw435z
cmu8zkrim0009qg2831h1r05w	cmu8zkqyz0003qg28a7jib76c
cmu8zkrns000aqg28q0ewajca	cmu8zkqyj0001qg28wtr4v9ip
cmu8zkrns000aqg28q0ewajca	cmu8zkqyz0003qg28a7jib76c
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "userId", "tokenHash", "expiresAt", "revokedAt", "ipAddress", "userAgent", "createdAt") FROM stdin;
cmu8zqzki000eqg37z7hrntx8	cmu8zqzj00001qg37vdhxek34	45d691654cf1dd430a12410350e7e0f8cecf91bb05592426cc3661d599f10047	2026-09-26 23:00:55.313	2026-09-19 23:10:17.71	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-19 23:00:55.315
cmu908ge5000qqg379rzem10y	cmu8zqzj00001qg37vdhxek34	c98834e3f38b12dcb99dac213faeedbdaeb31c0172d5def76bf67e3f7cb66af4	2026-09-26 23:14:30.268	2026-09-19 23:15:08.847	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-19 23:14:30.269
cmu90cbn9000sqg378yfbor26	cmu8zqzj00001qg37vdhxek34	c29d47e2ba2abdede1757ba769302d7fc9cdc781e7540e6817c633639779da60	2026-09-26 23:17:30.741	2026-09-19 23:17:46.735	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-19 23:17:30.742
cmuae1k9r0001pa22sk4b854w	cmu8zqzj00001qg37vdhxek34	258115075c07b8ca48e62d762d2899a542f67bd2c5454e6fa68f232079360708	2026-09-27 22:28:49.503	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-20 22:28:49.504
cmuap6mtl0001pb24yqlq3mc6	cmu8zqzj00001qg37vdhxek34	875ad3ce0171f03948f34aeb6576822c8558105be085a4fa0a704ed041dc6642	2026-09-28 03:40:41.864	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-21 03:40:41.865
cmuaqzty60001qb24scflc7aj	cmu8zqzj00001qg37vdhxek34	62176204f4df933eae2b92ba1122958f8b0daaaed0ae0ede358b6985862a334c	2026-09-28 04:31:23.741	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-21 04:31:23.742
\.


--
-- Data for Name: Stage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Stage" (id, "pipelineId", name, "position", color) FROM stdin;
cmu8zt1ns000jqg37d1vn77pk	cmu8zt1ns000iqg37mgbk4xmg	leads	0	\N
cmu8zt1ns000kqg37cv64xti4	cmu8zt1ns000iqg37mgbk4xmg	mensajes	1	\N
cmu8zt1ns000lqg37qeh4brng	cmu8zt1ns000iqg37mgbk4xmg	conversion	2	\N
cmu8zt1ns000mqg37atl1pph4	cmu8zt1ns000iqg37mgbk4xmg	ventas	3	\N
cmu8zqzji0008qg37x3rq9zya	cmu8zqzje0007qg37zdba0n5r	Nuevo	0	\N
cmu8zqzji0009qg37tsxfjh0j	cmu8zqzje0007qg37zdba0n5r	Contactado	1	\N
cmu8zqzji000aqg37ataxq2hi	cmu8zqzje0007qg37zdba0n5r	Interesado	2	\N
cmu8zqzji000bqg37wisxp4yc	cmu8zqzje0007qg37zdba0n5r	Inscripción pendiente	3	\N
cmu8zqzji000cqg375x1wkccx	cmu8zqzje0007qg37zdba0n5r	Matriculado	4	\N
\.


--
-- Data for Name: Subscription; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Subscription" (id, "organizationId", "planId", status, "startsAt", "trialEndsAt", "currentEndAt", "canceledAt", provider, "providerRef", "createdAt", "updatedAt") FROM stdin;
cmu8zqzj90005qg37xf7y1h24	cmu8zqzix0000qg37m5bwj7li	cmu8zkrqb000bqg28brcy4fv8	TRIALING	2026-09-19 23:00:55.269	2026-10-03 23:00:55.267	\N	\N	\N	\N	2026-09-19 23:00:55.269	2026-09-19 23:00:55.269
\.


--
-- Data for Name: UsageRecord; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UsageRecord" (id, "organizationId", metric, quantity, period, "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, "passwordHash", name, active, "emailVerifiedAt", "createdAt", "updatedAt") FROM stdin;
cmu8zqzj00001qg37vdhxek34	intecaedu@gmail.com	$2b$12$RjCX0Z9rbZ4leousFvyJpuOIR.aqHui3CCatKqK.olXqOyFWHmtly	Luis Ramirez	t	\N	2026-09-19 23:00:55.261	2026-09-19 23:00:55.261
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
4d936619-b249-481a-b5e8-fc80a7cf5fca	0d33e90d1c01d6ec34ac5122b18f451bd629391796ad050714093c3138ebf327	2026-09-19 22:56:03.641378+00	20260915_initial	\N	\N	2026-09-19 22:55:55.876359+00	1
b6816669-95b3-404f-b4e3-f6f16a45edfb	0292be43016165c5461428be61003efccae6153ac039bb894695797469c3a38e	2026-09-19 22:56:03.763801+00	20260919_block_public_access	\N	\N	2026-09-19 22:56:03.674047+00	1
f8c346fa-11b3-43d0-90e3-587e1df01388	078518060e9f722a02545ebe8f4def1a3ea13abf41562d262060c6f90d235356	2026-09-20 22:28:38.44535+00	20260919_document_content	\N	\N	2026-09-20 22:28:38.343254+00	1
e88569b4-3f97-4531-a038-d848c1b628d1	6ac69615c13f9502457e6c77995d7ceddd51ffc813851a9114957eae70ffd0c8	2026-09-20 22:28:38.86767+00	20260919_payment_requests	\N	\N	2026-09-20 22:28:38.468279+00	1
f20f421d-920b-410d-8343-056217c18583	cafb7ea739db9777db0cc6b4e521bee8356a53a6e2060065ee7cef3099559c29	2026-09-20 22:28:39.21304+00	20260920_channels	\N	\N	2026-09-20 22:28:38.890792+00	1
bcf44784-901f-4122-808a-6dc834237c87	1ca829c222616f7a1fffe55d0a0d4b9da6a9c09ea33a3c48557d54c95d3ea91a	2026-09-21 03:38:09.973992+00	20260920_creative_studio	\N	\N	2026-09-21 03:38:09.143896+00	1
\.


--
-- Name: AIAgent AIAgent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIAgent"
    ADD CONSTRAINT "AIAgent_pkey" PRIMARY KEY (id);


--
-- Name: Activity Activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Automation Automation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Automation"
    ADD CONSTRAINT "Automation_pkey" PRIMARY KEY (id);


--
-- Name: Campaign Campaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign"
    ADD CONSTRAINT "Campaign_pkey" PRIMARY KEY (id);


--
-- Name: ChannelEvent ChannelEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChannelEvent"
    ADD CONSTRAINT "ChannelEvent_pkey" PRIMARY KEY (id);


--
-- Name: Company Company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Company"
    ADD CONSTRAINT "Company_pkey" PRIMARY KEY (id);


--
-- Name: Contact Contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_pkey" PRIMARY KEY (id);


--
-- Name: Conversation Conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_pkey" PRIMARY KEY (id);


--
-- Name: CreativeContent CreativeContent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreativeContent"
    ADD CONSTRAINT "CreativeContent_pkey" PRIMARY KEY (id);


--
-- Name: CustomFieldDefinition CustomFieldDefinition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomFieldDefinition"
    ADD CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY (id);


--
-- Name: Deal Deal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: IntegrationConnection IntegrationConnection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IntegrationConnection"
    ADD CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY (id);


--
-- Name: Membership Membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: ModuleInstallation ModuleInstallation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ModuleInstallation"
    ADD CONSTRAINT "ModuleInstallation_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: PaymentRequest PaymentRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: Permission Permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Permission"
    ADD CONSTRAINT "Permission_pkey" PRIMARY KEY (id);


--
-- Name: Pipeline Pipeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Pipeline"
    ADD CONSTRAINT "Pipeline_pkey" PRIMARY KEY (id);


--
-- Name: Plan Plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Plan"
    ADD CONSTRAINT "Plan_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: PromptVersion PromptVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromptVersion"
    ADD CONSTRAINT "PromptVersion_pkey" PRIMARY KEY (id);


--
-- Name: RolePermission RolePermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId");


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Stage Stage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Stage"
    ADD CONSTRAINT "Stage_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: UsageRecord UsageRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecord"
    ADD CONSTRAINT "UsageRecord_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AIAgent_organizationId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIAgent_organizationId_active_idx" ON public."AIAgent" USING btree ("organizationId", active);


--
-- Name: Activity_organizationId_dueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Activity_organizationId_dueAt_idx" ON public."Activity" USING btree ("organizationId", "dueAt");


--
-- Name: AuditLog_organizationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON public."AuditLog" USING btree ("organizationId", "createdAt");


--
-- Name: Automation_organizationId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Automation_organizationId_active_idx" ON public."Automation" USING btree ("organizationId", active);


--
-- Name: Campaign_organizationId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Campaign_organizationId_status_idx" ON public."Campaign" USING btree ("organizationId", status);


--
-- Name: ChannelEvent_organizationId_provider_externalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ChannelEvent_organizationId_provider_externalId_key" ON public."ChannelEvent" USING btree ("organizationId", provider, "externalId");


--
-- Name: ChannelEvent_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChannelEvent_status_createdAt_idx" ON public."ChannelEvent" USING btree (status, "createdAt");


--
-- Name: Company_organizationId_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Company_organizationId_name_idx" ON public."Company" USING btree ("organizationId", name);


--
-- Name: Contact_organizationId_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_organizationId_email_idx" ON public."Contact" USING btree ("organizationId", email);


--
-- Name: Contact_organizationId_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_organizationId_phone_idx" ON public."Contact" USING btree ("organizationId", phone);


--
-- Name: Contact_organizationId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_organizationId_status_idx" ON public."Contact" USING btree ("organizationId", status);


--
-- Name: Conversation_organizationId_channel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_organizationId_channel_idx" ON public."Conversation" USING btree ("organizationId", channel);


--
-- Name: CreativeContent_organizationId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CreativeContent_organizationId_status_idx" ON public."CreativeContent" USING btree ("organizationId", status);


--
-- Name: CreativeContent_organizationId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CreativeContent_organizationId_type_idx" ON public."CreativeContent" USING btree ("organizationId", type);


--
-- Name: CustomFieldDefinition_organizationId_entityType_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomFieldDefinition_organizationId_entityType_key_key" ON public."CustomFieldDefinition" USING btree ("organizationId", "entityType", key);


--
-- Name: Deal_organizationId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_organizationId_status_idx" ON public."Deal" USING btree ("organizationId", status);


--
-- Name: Deal_pipelineId_stageId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_pipelineId_stageId_idx" ON public."Deal" USING btree ("pipelineId", "stageId");


--
-- Name: Document_organizationId_ownerEntity_ownerEntityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_organizationId_ownerEntity_ownerEntityId_idx" ON public."Document" USING btree ("organizationId", "ownerEntity", "ownerEntityId");


--
-- Name: Document_storageKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Document_storageKey_key" ON public."Document" USING btree ("storageKey");


--
-- Name: IntegrationConnection_organizationId_provider_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IntegrationConnection_organizationId_provider_key" ON public."IntegrationConnection" USING btree ("organizationId", provider);


--
-- Name: Membership_organizationId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON public."Membership" USING btree ("organizationId", "userId");


--
-- Name: Membership_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Membership_userId_idx" ON public."Membership" USING btree ("userId");


--
-- Name: Message_conversationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_conversationId_createdAt_idx" ON public."Message" USING btree ("conversationId", "createdAt");


--
-- Name: ModuleInstallation_organizationId_moduleCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ModuleInstallation_organizationId_moduleCode_key" ON public."ModuleInstallation" USING btree ("organizationId", "moduleCode");


--
-- Name: Organization_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_slug_key" ON public."Organization" USING btree (slug);


--
-- Name: PaymentRequest_organizationId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentRequest_organizationId_status_idx" ON public."PaymentRequest" USING btree ("organizationId", status);


--
-- Name: PaymentRequest_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentRequest_token_key" ON public."PaymentRequest" USING btree (token);


--
-- Name: Payment_organizationId_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_organizationId_idempotencyKey_key" ON public."Payment" USING btree ("organizationId", "idempotencyKey");


--
-- Name: Payment_organizationId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_organizationId_status_idx" ON public."Payment" USING btree ("organizationId", status);


--
-- Name: Permission_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Permission_code_key" ON public."Permission" USING btree (code);


--
-- Name: Pipeline_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Pipeline_organizationId_idx" ON public."Pipeline" USING btree ("organizationId");


--
-- Name: Plan_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Plan_code_key" ON public."Plan" USING btree (code);


--
-- Name: Product_organizationId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_organizationId_active_idx" ON public."Product" USING btree ("organizationId", active);


--
-- Name: Product_organizationId_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON public."Product" USING btree ("organizationId", sku);


--
-- Name: PromptVersion_agentId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PromptVersion_agentId_version_key" ON public."PromptVersion" USING btree ("agentId", version);


--
-- Name: Role_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Role_code_key" ON public."Role" USING btree (code);


--
-- Name: Session_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_tokenHash_key" ON public."Session" USING btree ("tokenHash");


--
-- Name: Session_userId_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_userId_expiresAt_idx" ON public."Session" USING btree ("userId", "expiresAt");


--
-- Name: Stage_pipelineId_position_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Stage_pipelineId_position_key" ON public."Stage" USING btree ("pipelineId", "position");


--
-- Name: Subscription_organizationId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_organizationId_status_idx" ON public."Subscription" USING btree ("organizationId", status);


--
-- Name: UsageRecord_organizationId_metric_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UsageRecord_organizationId_metric_period_idx" ON public."UsageRecord" USING btree ("organizationId", metric, period);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: AIAgent AIAgent_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIAgent"
    ADD CONSTRAINT "AIAgent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Activity Activity_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Activity Activity_dealId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Activity Activity_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditLog AuditLog_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Automation Automation_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Automation"
    ADD CONSTRAINT "Automation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Campaign Campaign_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign"
    ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChannelEvent ChannelEvent_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChannelEvent"
    ADD CONSTRAINT "ChannelEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON DELETE CASCADE;


--
-- Name: Company Company_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Company"
    ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Contact Contact_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contact Contact_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Conversation Conversation_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Conversation Conversation_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreativeContent CreativeContent_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreativeContent"
    ADD CONSTRAINT "CreativeContent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomFieldDefinition CustomFieldDefinition_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomFieldDefinition"
    ADD CONSTRAINT "CustomFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Deal Deal_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Deal Deal_pipelineId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES public."Pipeline"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Deal Deal_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_stageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES public."Stage"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Document Document_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IntegrationConnection IntegrationConnection_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IntegrationConnection"
    ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Membership Membership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."Conversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ModuleInstallation ModuleInstallation_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ModuleInstallation"
    ADD CONSTRAINT "ModuleInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentRequest PaymentRequest_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Payment Payment_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Pipeline Pipeline_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Pipeline"
    ADD CONSTRAINT "Pipeline_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PromptVersion PromptVersion_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromptVersion"
    ADD CONSTRAINT "PromptVersion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public."AIAgent"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RolePermission RolePermission_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public."Permission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RolePermission RolePermission_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Stage Stage_pipelineId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Stage"
    ADD CONSTRAINT "Stage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES public."Pipeline"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."Plan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UsageRecord UsageRecord_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecord"
    ADD CONSTRAINT "UsageRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AIAgent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AIAgent" ENABLE ROW LEVEL SECURITY;

--
-- Name: Activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Activity" ENABLE ROW LEVEL SECURITY;

--
-- Name: AuditLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: Automation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Automation" ENABLE ROW LEVEL SECURITY;

--
-- Name: Campaign; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Campaign" ENABLE ROW LEVEL SECURITY;

--
-- Name: ChannelEvent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ChannelEvent" ENABLE ROW LEVEL SECURITY;

--
-- Name: Company; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Company" ENABLE ROW LEVEL SECURITY;

--
-- Name: Contact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Contact" ENABLE ROW LEVEL SECURITY;

--
-- Name: Conversation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Conversation" ENABLE ROW LEVEL SECURITY;

--
-- Name: CustomFieldDefinition; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CustomFieldDefinition" ENABLE ROW LEVEL SECURITY;

--
-- Name: Deal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Deal" ENABLE ROW LEVEL SECURITY;

--
-- Name: Document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;

--
-- Name: IntegrationConnection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."IntegrationConnection" ENABLE ROW LEVEL SECURITY;

--
-- Name: Membership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Membership" ENABLE ROW LEVEL SECURITY;

--
-- Name: Message; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;

--
-- Name: ModuleInstallation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ModuleInstallation" ENABLE ROW LEVEL SECURITY;

--
-- Name: Organization; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;

--
-- Name: Payment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;

--
-- Name: PaymentRequest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PaymentRequest" ENABLE ROW LEVEL SECURITY;

--
-- Name: Permission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Permission" ENABLE ROW LEVEL SECURITY;

--
-- Name: Pipeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Pipeline" ENABLE ROW LEVEL SECURITY;

--
-- Name: Plan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Plan" ENABLE ROW LEVEL SECURITY;

--
-- Name: Product; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;

--
-- Name: PromptVersion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PromptVersion" ENABLE ROW LEVEL SECURITY;

--
-- Name: Role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Role" ENABLE ROW LEVEL SECURITY;

--
-- Name: RolePermission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RolePermission" ENABLE ROW LEVEL SECURITY;

--
-- Name: Session; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;

--
-- Name: Stage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Stage" ENABLE ROW LEVEL SECURITY;

--
-- Name: Subscription; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;

--
-- Name: UsageRecord; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UsageRecord" ENABLE ROW LEVEL SECURITY;

--
-- Name: User; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict hSQHe0ySvQBWkTWiJAcXrY5SsNpQpmyw4GqRfEoMbFMyfXgls9kf3ccObNL5x1u

