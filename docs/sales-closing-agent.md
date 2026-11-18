# Agente de Ventas y Cierre de INTECA

El flujo real está conectado al webhook de WhatsApp y a Supabase. El panel está en **Agentes IA → Agente IA de Ventas y Cierre**. Después de actualizar, cerrar sesión e iniciar sesión para obtener la cookie administrativa del servidor (8 horas, HttpOnly, SameSite Strict, Secure en producción).

## Funcionamiento

- Conserva nombre confirmado, curso, horario solicitado y correo por identidad de WhatsApp. Soporta teléfono y BSUID sin mezclarlos.
- Registra cada mensaje entrante una sola vez, actualiza la oportunidad y deja una tarea de seguimiento. Los mensajes enviados quedan en la actividad y en la memoria conversacional.
- Responde a la petición concreta antes de avanzar la inscripción. Usa historial, objeciones y estado comercial; pregunta un dato faltante a la vez.
- Las instrucciones de transferencia vienen del documento autorizado guardado en crm_sales_automation_settings; WHATSAPP_PAYMENT_INSTRUCTIONS es respaldo. Nunca se generan cuentas con el modelo. El importe conocido de inscripción de Autorizaciones Médicas es RD$2,500. Otros cursos requieren importe confirmado por un administrador.
- Un aviso o adjunto de pago pasa a revisión. No se interpreta una imagen como prueba de abono. El administrador consulta el original y comprueba en el banco: cliente, referencia e importe exacto de inscripción. Una referencia no puede registrarse dos veces en el mismo banco.
- Validar registra el pago y cierre comercial, sin inventar matrícula, credenciales, grupo, factura ni activación de campus.
- Pedir un asesor pausa las respuestas automáticas del contacto y deja una tarea. Pedir que no le escriban bloquea la reactivación ordinaria.
- La pausa general detiene las respuestas nuevas y sigue registrando entradas. Una respuesta que ya estaba en curso puede terminar de enviarse.

## Seguimiento y operación

El panel muestra 100 oportunidades por página, con filtros y navegación. Los contadores corresponden a la página. Se actualiza cada 30 segundos. El nuevo panel de seguimiento en Leads CRM y Ventas y Cierre programa mensajes para oportunidades vencidas. Consulta cada minuto mientras el servidor está activo, de 09:00 a 20:00 hora dominicana. Máximo tres seguimientos por contacto, separados al menos 24 horas. No cobra a casos pagados o en revisión, ni escribe a contactos pausados o dados de baja. Fuera de 23 horas desde la última entrada requiere consentimiento explícito y una plantilla aprobada. Las tareas antiguas sin consentimiento no disparan mensajes fuera de la ventana.

Los adjuntos se referencian por el ID de Meta y deben revisarse en el canal original. No hay OCR ni conexión de conciliación bancaria. Las tareas se pueden completar o programar y quedan auditadas. Un pago validado permanece validado aunque lleguen mensajes posteriores. Cursos adicionales para un cliente con pago validado requieren gestión humana; no se reutiliza el pago anterior.

La sesión administrativa protege lectura, ajustes y validación. Sin sesión las rutas /api/sales devuelven 401. Las escrituras requieren encabezado X-CRM-Action: sales y cookie; no hay CORS de origen externo. La API pública de conversión rechaza paymentConfirmed y el webhook de pagos responde 503 hasta implementar un verificador de proveedor auténtico.

## Base de datos y despliegue

Aplicar la migración sales_closing_agent antes de desplegar el código. Tablas: crm_sales_settings, crm_sales_opportunities, crm_sales_events y crm_sales_payments. Todas tienen RLS y sin acceso anon/authenticated; solo el servidor usa service_role. Las funciones son SECURITY INVOKER con ejecución exclusiva de service_role. Las transacciones bloquean la oportunidad para evitar cierres duplicados concurrentes.

Usa SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL/ADMIN_PASSWORD (o sus aliases CRM_ADMIN_*), las credenciales de WhatsApp y Gemini existentes. No hay nuevas claves que copiar al navegador. /api/health incluye salesAgent.ready. Si Supabase falla, el agente no afirma haber registrado un pago/solicitud; deja el error en logs. La cola crm_sales_outbox usa deduplicación y reclamación transaccional. Los envíos aceptados se registran con ID de Meta; no equivalen a entrega confirmada. Un resultado de red ambiguo se retiene para revisión, sin reenvío automático.

Render Free puede suspender el servicio por inactividad. La memoria y las oportunidades sobreviven al reinicio, pero esta infraestructura no ofrece disponibilidad continua garantizada.

## Verificación

- npm run typecheck
- npm run test:whatsapp
- npm run test:sales
- ESLint de archivos modificados.
- SQL en Supabase, con datos ficticios dentro de una transacción revertida: inscripción → aviso de pago → verificación, referencia duplicada, importe incorrecto, baja persistente e idempotencia.
- Ninguna prueba envía mensajes reales a clientes ni registra pagos reales.

Para la aceptación final, el dueño puede escribir desde su propio WhatsApp: “Quiero inscribirme en Autorizaciones Médicas”, responder nombre/horario/correo y pedir “Dame las instrucciones de pago”. Verificar que la conversación avanza y aparece en el panel. No validar dinero ficticio.

## Seguimiento comercial y tarifa internacional (noviembre 2026)

Aplicar `supabase/migrations/20261118193540_whatsapp_sales_followups.sql` antes del despliegue. El documento original de pagos y las instrucciones seleccionadas se guardan únicamente en la configuración privada de Supabase, sin exponer datos bancarios en el repositorio. Las tablas nuevas y sus funciones solo admiten service_role.

Para residentes fuera de República Dominicana que confirman pago en USD: inscripción US$60 más cinco pagos de US$30, total US$210. Se recuerda residencia y moneda; no se deducen del teléfono. Se elimina el importe esperado DOP automático para esos nuevos casos. La validación bancaria existente sigue registrando el importe DOP efectivamente acreditado; no convertir automáticamente US$60 en RD$60. Confirmar comisiones y conversión antes de transferir.

El dueño recibe avisos de revisión bancaria, pago validado, atención humana, incidencias críticas agrupadas por tipo y día, y un resumen después de las 18:00. Su teléfono se configura de forma privada. Para texto libre debe haber escrito al WhatsApp empresarial durante la ventana; fuera de ella requiere plantilla aprobada. No se afirma que un aviso bloqueado haya sido enviado.

Configurar desde el panel los nombres de dos plantillas aprobadas (seguimiento y avisos al dueño) y el idioma exacto. Cada una debe admitir un único parámetro de cuerpo `{{1}}`, sin parámetros adicionales ni encabezados multimedia requeridos. El servidor consulta aprobación y estructura en Meta usando WHATSAPP_BUSINESS_ACCOUNT_ID y el token existente antes de enviarlas. Nombres vacíos, aprobación faltante o errores de proveedor quedan visibles en el panel. No se crea ni se aprueba una plantilla automáticamente.

El objetivo es cinco ventas con pago validado por día, no una garantía. Se comparan respuestas y pagos observados durante siete días posteriores al seguimiento. Se requiere un mínimo de veinte contactos por estrategia antes de favorecer una, manteniendo exploración. Las cifras son observacionales y nunca autorizan inventar pagos, modificar precios o prometer resultados.

Render Free puede dormir por inactividad; el proceso de seguimiento no corre mientras el servicio está suspendido. Para horarios continuos se requiere alojamiento que permanezca activo. Revisar `/api/health` (salesAutomation), el panel y los bloqueos antes de declarar la operación autónoma completa.
