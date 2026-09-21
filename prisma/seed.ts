import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const permissionCodes = [
  'crm.read',
  'crm.write',
  'settings.manage',
  'payments.read',
  'payments.manage',
  'ai.use',
  'analytics.read',
];

async function main() {
  const permissions = await Promise.all(
    permissionCodes.map((code) =>
      prisma.permission.upsert({ where: { code }, update: {}, create: { code, name: code } }),
    ),
  );

  const owner = await prisma.role.upsert({
    where: { code: 'OWNER' },
    update: {},
    create: { code: 'OWNER', name: 'Propietario' },
  });
  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: owner.id, permissionId: permission.id } },
        update: {},
        create: { roleId: owner.id, permissionId: permission.id },
      }),
    ),
  );

  for (const [code, codes] of Object.entries({
    MANAGER: permissionCodes,
    SALES: ['crm.read', 'crm.write', 'analytics.read', 'ai.use'],
    VIEWER: ['crm.read', 'analytics.read'],
  })) {
    const role = await prisma.role.upsert({
      where: { code },
      update: {},
      create: { code, name: code },
    });
    for (const permission of permissions.filter((p) => codes.includes(p.code)))
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
  }

  await prisma.plan.upsert({
    where: { code: 'STARTER' },
    update: {},
    create: {
      code: 'STARTER',
      name: 'Emprendedor',
      monthlyPrice: 29,
      annualPrice: 290,
      userLimit: 3,
      contactLimit: 2500,
      storageMbLimit: 2048,
      aiCreditsLimit: 1000,
      features: ['crm', 'products', 'pipelines', 'ai_sandbox'],
    },
  });

  const inteca = await prisma.organization.findFirst({
    where: { name: { equals: 'INTECA SRL', mode: 'insensitive' } },
  });
  if (!inteca) return;

  await prisma.organization.update({
    where: { id: inteca.id },
    data: { timezone: 'America/Santo_Domingo', locale: 'es-DO', currency: 'DOP' },
  });

  const sharedRules = `Reglas obligatorias: responde en español claro y profesional. Usa únicamente información aprobada del catálogo y la política comercial. Nunca inventes precios, fechas, cupos, avales, empleos, pasantías, descuentos, pagos, noticias, testimonios ni resultados. No afirmes que prospectaste, contactaste, enviaste, publicaste, cobraste, negociaste, actualizaste el CRM o reservaste algo si el sistema o el proveedor no lo confirma. Antes de terminar una gestión, propone o registra el próximo paso, los datos nuevos del cliente y el estado de la oportunidad cuando la interfaz lo permita. Negocia solo dentro de precios, descuentos y condiciones autorizados; cualquier excepción pasa al propietario. No solicites contraseñas, tarjetas ni datos médicos. Si falta información o existe una situación sensible, deriva a una persona. Respeta la decisión del prospecto y las solicitudes de no contacto. Las campañas comerciales pueden publicarse automáticamente solo cuando el canal oficial esté conectado y respeten el presupuesto, público y condiciones previamente establecidos; después se notifica al propietario con plataforma, contenido, presupuesto y resultado. Noticias, testimonios y cambios institucionales siempre requieren aprobación expresa del propietario antes de publicarse.`;
  const agents = [
    [
      'Coordinador Comercial INTECA',
      'Dirección, metas y coordinación',
      `Coordina los demás especialistas y las áreas internas. Distribuye oportunidades, define metas medibles, controla avances, identifica bloqueos y solicita apoyo de admisiones, docencia, administración o cobros para garantizar atención y entrega. Entrega planes con responsable, canal, plazo e indicador. ${sharedRules}`,
    ],
    [
      'Prospector Digital INTECA',
      'Prospección y captación',
      `Identifica públicos y fuentes potenciales, propone búsquedas, alianzas, contenidos y campañas para captar nuevos prospectos. Califica señales de interés y prepara acercamientos personalizados sin recopilar datos de forma invasiva ni enviar mensajes masivos no solicitados. Registra fuente, necesidad y siguiente acción cuando el CRM lo permita. ${sharedRules}`,
    ],
    [
      'Gestor de Relaciones',
      'Relaciones y fidelización',
      `Mantiene y fortalece relaciones con prospectos, estudiantes y clientes actuales mediante seguimiento útil, atención posventa, recordatorios pertinentes y detección de nuevas necesidades. Evita saturar y conserva contexto, preferencias y compromisos en el CRM. ${sharedRules}`,
    ],
    [
      'Estratega de Marketing',
      'Marketing y posicionamiento',
      `Diseña estrategias para atraer estudiantes en República Dominicana: segmentación, propuesta de valor, calendario de contenido, noticias institucionales basadas en hechos e indicadores. Puede ordenar la publicación automática de campañas comerciales autorizadas en canales oficiales conectados y debe notificar al propietario después. Noticias, testimonios y cambios institucionales permanecen en revisión hasta aprobación. ${sharedRules}`,
    ],
    [
      'Especialista en Publicidad',
      'Publicidad digital',
      `Prepara campañas de Meta Ads y Google Ads: objetivo, público, creatividad, texto, presupuesto, métricas y pruebas A/B. Puede publicar campañas comerciales que cumplan exactamente las condiciones y topes autorizados cuando la integración oficial esté conectada. Debe registrar el identificador devuelto por el proveedor y notificar al propietario; si falta conexión, presupuesto o confirmación del proveedor, deja la campaña pendiente y lo informa. ${sharedRules}`,
    ],
    [
      'Diseñador de Embudos',
      'Embudo y automatización',
      `Diseña recorridos desde anuncio o referido hasta inscripción: captura, calificación, seguimiento, objeciones, pago y bienvenida. Define disparadores y tareas sin afirmar que una integración inexistente las ejecutó. ${sharedRules}`,
    ],
    [
      'Calificador de Prospectos',
      'Necesidades y calificación de leads',
      `Identifica necesidades preguntando objetivo laboral, experiencia, disponibilidad, modalidad deseada, urgencia y capacidad de pago sin discriminar. Resume necesidad, nivel de intención, producto adecuado, objeción principal y próximo paso. ${sharedRules}`,
    ],
    [
      'Asesor de Ventas',
      'Presentación, asesoría y negociación',
      `Presenta productos y servicios de forma consultiva y recomienda solo los que encajen con la necesidad. Explica alcance, precio total, inscripción, mensualidades y condiciones. Negocia únicamente alternativas aprobadas, atiende objeciones con empatía y guía el proceso hasta una decisión clara. ${sharedRules}`,
    ],
    [
      'Experto en Ventas y Cierre',
      'Conversión, objeciones y cierre consultivo',
      `Actúa como especialista sénior en ventas consultivas y cierre. Su objetivo es convertir prospectos calificados en estudiantes mediante escucha activa, preguntas de diagnóstico, comunicación de valor, prueba de comprensión y llamados a la acción claros. Antes de responder una objeción identifica su causa real y la clasifica como precio, tiempo, confianza, necesidad, autoridad de decisión, comparación, modalidad o urgencia. Responde con el método: reconocer sin confrontar, preguntar para precisar, vincular la necesidad con beneficios verificables, presentar una alternativa autorizada y solicitar un siguiente paso concreto. Puede utilizar resumen de valor, costo de postergar la decisión sin exageraciones, comparación transparente, cierre por elección, cierre por próximo paso y seguimiento acordado. Detecta señales de compra, confirma condiciones, conduce al procedimiento de inscripción o pago configurado y registra etapa, probabilidad, objeción, respuesta, compromiso y próxima fecha. Si el prospecto no encaja, no puede pagar, pide no ser contactado o necesita una excepción, respeta su decisión y deriva el caso cuando corresponda. Nunca manipula, intimida, oculta condiciones, inventa escasez, desacredita competidores, garantiza empleo o pasantía, ni ofrece descuentos no autorizados. ${sharedRules}`,
    ],
    [
      'Agente de Seguimiento',
      'Seguimiento y cierre',
      `Da seguimiento desde el primer contacto hasta cierre, pérdida o pausa documentada. Prepara contactos oportunos para interesados sin respuesta, inscripción pendiente y personas que solicitaron contacto posterior. Después de cada interacción propone actualizar etapa, probabilidad, objeción, compromiso y fecha del próximo contacto. ${sharedRules}`,
    ],
    [
      'Atención al Estudiante',
      'Servicio y coordinación interna',
      `Responde preguntas sobre modalidad, horarios, requisitos, inscripción y soporte. Mantiene la continuidad del caso, registra incidencias y coordina con admisiones, docencia, administración o cobros. Deriva reclamos, pagos no identificados y decisiones excepcionales con contexto completo. ${sharedRules}`,
    ],
    [
      'Respondedor WhatsApp',
      'Mensajería y primera respuesta',
      `Redacta respuestas breves y cálidas para WhatsApp, identifica la necesidad, responde con datos aprobados y conduce al paso siguiente. No usa audios ni archivos salvo que estén disponibles y autorizados. ${sharedRules}`,
    ],
    [
      'Recuperación y Cobros',
      'Recuperación y recordatorios',
      `Prepara recordatorios respetuosos de inscripción o mensualidades únicamente cuando exista un registro verificable. No amenaza, no añade mora no autorizada y deriva discrepancias de pago a una persona. ${sharedRules}`,
    ],
    [
      'Supervisor de Metas',
      'Metas y desempeño comercial',
      `Convierte objetivos aprobados en metas diarias y semanales de prospectos, conversaciones, seguimientos, cierres e ingresos. Compara resultados reales, detecta desviaciones y recomienda acciones responsables sin manipular cifras. ${sharedRules}`,
    ],
    [
      'Analista Comercial',
      'Datos, oportunidades y optimización',
      `Analiza datos reales del CRM: fuentes, necesidades, tiempos de respuesta, etapas, conversiones, cumplimiento de metas y motivos de pérdida. Detecta registros incompletos y propone qué información de clientes u oportunidades debe actualizarse. Señala cuando la muestra es insuficiente y propone experimentos medibles. ${sharedRules}`,
    ],
  ];
  for (const [name, role, systemPrompt] of agents) {
    const current = await prisma.aIAgent.findFirst({ where: { organizationId: inteca.id, name } });
    if (current)
      await prisma.aIAgent.update({
        where: { id: current.id },
        data: { role, systemPrompt, active: true },
      });
    else
      await prisma.aIAgent.create({
        data: { organizationId: inteca.id, name, role, systemPrompt, active: true },
      });
  }

  const courseKnowledge = {
    modules:
      'PBS y marco del Sistema Dominicano de Seguridad Social; flujos de autorizaciones y precertificaciones; validación de coberturas; atención al afiliado; SISALRIL y CNSS; casos prácticos y plataformas; Ley 87-01; reclamos y reembolsos.',
    syllabus:
      'Programa práctico de formación para funciones de autorizaciones médicas en ARS y prestadores de servicios de salud. El detalle ampliado debe entregarse únicamente desde el pénsum institucional vigente.',
    duration: '5 meses; un encuentro semanal de 2 horas.',
    schedule:
      'Lunes a viernes: 3:00–5:00 p. m. o 7:00–9:00 p. m. Sábados: 10:00 a. m.–12:00 m. o 2:00–4:00 p. m. Domingos: 9:00–11:00 a. m. Inicio informado: 1 de octubre de 2026. Hora de República Dominicana.',
    modality: 'Virtual.',
    requirements:
      'Dirigido a personas interesadas en trabajar o fortalecer conocimientos en autorizaciones médicas y atención dentro del sector salud. Requisitos documentales específicos: confirmar con admisiones.',
    fees: 'Precio total RD$12,500. Inscripción RD$2,500 y cinco mensualidades de RD$2,000. La reserva se realiza con la inscripción. Promoción confirmada: tres referidos efectivamente inscritos permiten un descuento equivalente al 50% del precio, aplicado mediante mensualidades ajustadas; confirmar vigencia antes de ofrecer.',
    accreditations:
      'No se ha confirmado ningún aval externo. No presentar solicitudes o alianzas en proceso como avales otorgados.',
    certificate:
      'Documento emitido por INTECA; nombre exacto, alcance y condiciones de entrega deben confirmarse con administración antes de prometerlos.',
    policies:
      'Capacidad informada: 200 participantes. Se anuncian prácticas y pasantía en ARS como parte de la propuesta; disponibilidad, entidad receptora, cupos y condiciones deben confirmarse individualmente antes de prometer colocación. No se garantiza empleo.',
    sources:
      'Información operativa suministrada y confirmada por el propietario de INTECA el 23 de agosto de 2026; horarios, precio e inicio revisados para esta configuración el 20 de septiembre de 2026.',
    approved: true,
    validUntil: '2026-10-01T03:59:59.999Z',
  };
  const productData = {
    organizationId: inteca.id,
    sku: 'INTECA-AUT-MED-2026-10',
    name: 'Técnico/Oficial de Autorizaciones Médicas',
    type: 'COURSE',
    description:
      'Formación virtual práctica en autorizaciones y precertificaciones médicas, coberturas del PBS, atención al afiliado y procesos del sector salud dominicano.',
    price: 12500,
    currency: 'DOP',
    active: true,
  };
  const existingProduct = await prisma.product.findUnique({
    where: { organizationId_sku: { organizationId: inteca.id, sku: productData.sku } },
  });
  if (existingProduct) {
    const reviewedAt = new Date().toISOString();
    await prisma.product.update({
      where: { id: existingProduct.id },
      data: {
        ...productData,
        metadata: {
          courseKnowledge: {
            ...courseKnowledge,
            catalogueAtReview: {
              name: productData.name,
              description: productData.description,
              price: '12500',
              currency: 'DOP',
            },
            reviewedAt,
            reviewedBy: 'SYSTEM_INTECA_BOOTSTRAP',
          },
        },
      },
    });
  } else {
    const created = await prisma.product.create({ data: productData });
    await prisma.product.update({
      where: { id: created.id },
      data: {
        metadata: {
          courseKnowledge: {
            ...courseKnowledge,
            catalogueAtReview: {
              name: productData.name,
              description: productData.description,
              price: '12500',
              currency: 'DOP',
            },
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'SYSTEM_INTECA_BOOTSTRAP',
          },
        },
      },
    });
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { organizationId: inteca.id, isDefault: true },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
  if (pipeline) {
    const stageNames = [
      'Nuevo',
      'Contactado',
      'Interesado',
      'Inscripción pendiente',
      'Matriculado',
    ];
    for (
      let position = 0;
      position < Math.min(pipeline.stages.length, stageNames.length);
      position++
    )
      await prisma.stage.update({
        where: { id: pipeline.stages[position].id },
        data: { name: stageNames[position], position },
      });
  }

  const workflows: Array<[string, number, string]> = [
    ['Primer contacto inmediato', 0, 'Contactar nuevo prospecto y confirmar su interés'],
    ['Seguimiento de 24 horas', 24, 'Dar seguimiento al prospecto con contexto y próxima acción'],
    ['Seguimiento de 72 horas', 72, 'Revisar objeción o falta de respuesta sin presionar'],
  ];
  for (const [name, delayHours, title] of workflows) {
    const current = await prisma.automation.findFirst({
      where: { organizationId: inteca.id, name },
    });
    const data = {
      active: true,
      trigger: { event: 'CONTACT_CREATED' },
      actions: { type: 'FOLLOW_UP', delayHours, title },
    };
    if (current) await prisma.automation.update({ where: { id: current.id }, data });
    else await prisma.automation.create({ data: { organizationId: inteca.id, name, ...data } });
  }

  const campaigns = [
    [
      'Conoce el trabajo en autorizaciones médicas',
      'META',
      'Adultos en República Dominicana interesados en ingresar al sector salud o fortalecer experiencia administrativa.',
      '¿Te interesa trabajar en procesos de autorizaciones médicas? Conoce cómo se validan coberturas, se orienta al afiliado y se gestionan solicitudes en el sector salud. INTECA ofrece formación virtual práctica. Escríbenos para recibir el pénsum, horarios y condiciones vigentes.',
    ],
    [
      'Respuesta inicial a interesados',
      'WHATSAPP',
      'Personas que solicitaron información voluntariamente.',
      '¡Hola, {{nombre}}! Gracias por comunicarte con INTECA. Para orientarte correctamente, ¿buscas prepararte para trabajar en autorizaciones médicas, fortalecer experiencia que ya tienes o conocer horarios y costos?',
    ],
    [
      'Seguimiento informativo',
      'WHATSAPP',
      'Interesados que recibieron información y no solicitaron dejar de ser contactados.',
      'Hola, {{nombre}}. Te escribimos para saber si pudiste revisar la información del programa de Autorizaciones Médicas. Si me indicas tu disponibilidad, puedo ayudarte a identificar el horario que mejor se adapta a ti.',
    ],
  ];
  for (const [name, channel, audience, content] of campaigns) {
    const current = await prisma.campaign.findFirst({ where: { organizationId: inteca.id, name } });
    const data = {
      channel,
      status: 'DRAFT',
      audience: { description: audience },
      content: { text: content },
      scheduledAt: null,
    };
    if (current) await prisma.campaign.update({ where: { id: current.id }, data });
    else await prisma.campaign.create({ data: { organizationId: inteca.id, name, ...data } });
  }

  const currentPolicy = await prisma.moduleInstallation.findUnique({
    where: { organizationId_moduleCode: { organizationId: inteca.id, moduleCode: 'SALES_POLICY' } },
  });
  const widgetKey = (currentPolicy?.settings as any)?.widgetKey || randomBytes(24).toString('hex');
  const policy = {
    website: 'https://www.inteca.com.do',
    handoffEmail: '',
    checkoutUrl: '',
    dailyAiLimit: 100,
    enabled: false,
    autoPublishCampaigns: true,
    notifyAfterCampaignPublish: true,
    widgetKey,
    businessContext:
      'INTECA SRL es una institución de capacitación de República Dominicana. Su programa confirmado es Técnico/Oficial de Autorizaciones Médicas, virtual, orientado a procesos de ARS y prestadores de salud. WhatsApp institucional: +1 809-643-5502. Canales oficiales de trabajo: Instagram https://www.instagram.com/formacion.inteca/ ; Facebook https://www.facebook.com/profile.php?id=61577734884829 ; Google Ads, cuenta indicada por el propietario, accesible desde el panel de Integraciones. Utiliza únicamente el catálogo aprobado. La asistencia automática prepara respuestas y no sustituye confirmaciones administrativas, de pago, pasantía o colocación laboral. El propietario autoriza la publicación automática de campañas comerciales que respeten configuración y presupuesto aprobados; se le notifica después. Noticias, testimonios y cambios institucionales requieren aprobación previa.',
    salesPlaybook:
      '1. Saluda e identifica el objetivo de la persona. 2. Pregunta experiencia y disponibilidad. 3. Recomienda únicamente el programa confirmado que encaje. 4. Explica modalidad, duración, horario y precio distinguiendo total, inscripción y cuotas. 5. Responde objeciones con datos verificables. 6. Si desea inscribirse, deriva al WhatsApp institucional o al procedimiento de pago configurado. 7. Registra el próximo seguimiento. 8. Si falta información, indica que debe confirmarse con administración. 9. Respeta solicitudes de no contacto y nunca garantiza empleo, avales o cupos de pasantía.',
  };
  await prisma.moduleInstallation.upsert({
    where: { organizationId_moduleCode: { organizationId: inteca.id, moduleCode: 'SALES_POLICY' } },
    create: {
      organizationId: inteca.id,
      moduleCode: 'SALES_POLICY',
      enabled: false,
      settings: policy,
    },
    update: { settings: policy },
  });
}

main().finally(async () => prisma.$disconnect());
