# Dirección por WhatsApp y bienvenida

## Cambios del 20 de noviembre de 2026

El número de dirección procede de `crm_sales_automation_settings.owner_phone` (INTECA: +18097065502). Se compara con el remitente telefónico real de Meta. Un nombre de perfil, mensaje que afirme ser el director o BSUID sin vinculación no autoriza operaciones.

La ruta privilegiada exige firma HMAC SHA-256 sobre los bytes originales y el ID del teléfono empresarial configurado. Guarda **el secreto de la aplicación de WhatsApp** en `WHATSAPP_APP_SECRET` mediante Conexiones o Render. `DS_META_APP_SECRET` corresponde a publicidad y no sirve como sustituto. Sin el secreto de WhatsApp, el asistente del director queda bloqueado y no entra en ventas; se conserva el comportamiento anterior para clientes. Con el secreto configurado, todo webhook de WhatsApp sin firma válida recibe 401. El indicador `ownerAssistant` de salud y el panel de seguimiento muestran esta dependencia.

Consultas: `resumen`, `estudiantes`, `pendientes`, `revisión`, `atención`, `fiscal`, `ficha ID`. Las listas incluyen seis casos y paginación (`pendientes 2`). Los datos son registros del CRM, no una conciliación bancaria ni un registro exhaustivo de cuotas futuras. Los importes sin moneda confirmada lo indican.

Instrucciones: `pausar ID`, `reanudar ID`, `seguimiento ID`, `matricular ID`. Solo se acepta un caso inequívoco. El RPC privado registra mensaje de Meta, actor, caso, operación y resultado en una transacción; repetir el mensaje devuelve el resultado anterior sin repetir el cambio. Respeta bajas, pagos en revisión y controles humanos. Matricular reutiliza la puerta bancaria existente; no valida pagos por WhatsApp. No hay ejecución arbitraria de SQL ni herramientas seleccionadas por un modelo.

La bienvenida por correo genera un enlace personal de Firebase para establecer/restablecer contraseña. Comprueba que el UID corresponde al correo estudiantil y no está suspendido ni tiene rol privilegiado. El enlace solo se incluye en el correo al estudiante: no se guarda en CRM, auditoría, prompts o informes del director. Una cuenta existente conserva su contraseña hasta que el propio estudiante complete el enlace. Primero se activa el curso; después se envía bienvenida. Los resultados inciertos quedan en revisión y no se repiten automáticamente.

## Dependencias pendientes verificadas

- Campus: la integración GitHub devuelve 403 al crear rama en `intecard/campus-virtual-intecaAPK`. El parche `docs/campus-enrollment.patch` sigue pendiente de publicación. Antes de habilitar sincronización, verificar también reglas de Firestore, respaldo, curso real y primer acceso. El campus en producción aún no muestra recuperación de contraseña.
- `INTECA_CAMPUS_SYNC_ENABLED` continúa desactivado. Firebase y correo aparecen configurados; esto no prueba permisos de escritura ni entrega real. No hay matrículas ni pagos verificados en Supabase en la revisión de hoy.
- La plantilla de bienvenida de WhatsApp aún no está configurada: fuera de la ventana de atención, se conserva pendiente; correo y WhatsApp mantienen estados independientes.
- DGII: perfil fiscal completo ausente; borrador de alta en precertificación con registro y autorización sin verificar. No se habilitó emisión fiscal. Aula virtual no equivale a autorización de emisor.

Fuentes oficiales consultadas el 20/11/2026:
- https://firebase.google.com/docs/auth/admin/email-action-links
- https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/default.aspx
- https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx

Para continuar DGII, completar perfil fiscal y verificar acceso a Oficina Virtual, alta NCF, certificado digital tributario y proceso de certificación de la modalidad elegida. El módulo actual prepara borradores comerciales, no XML fiscal firmado ni comprobantes autorizados. No registrar capacitación como certificación obtenida.
