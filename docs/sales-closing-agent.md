# Agente de Ventas y Cierre de INTECA

El flujo real está conectado al webhook de WhatsApp y a Supabase. El panel está en **Agentes IA → Agente IA de Ventas y Cierre**. Después de actualizar, cerrar sesión e iniciar sesión para obtener la cookie administrativa del servidor (8 horas, HttpOnly, SameSite Strict, Secure en producción).

## Funcionamiento

- Conserva nombre confirmado, curso, horario solicitado y correo por identidad de WhatsApp. Soporta teléfono y BSUID sin mezclarlos.
- Registra cada mensaje entrante una sola vez, actualiza la oportunidad y deja una tarea de seguimiento. Los mensajes enviados quedan en la actividad y en la memoria conversacional.
- Responde a la petición concreta antes de avanzar la inscripción. Usa historial, objeciones y estado comercial; pregunta un dato faltante a la vez.
- Las instrucciones de transferencia vienen de WHATSAPP_PAYMENT_INSTRUCTIONS, nunca de cuentas generadas por el modelo. El importe conocido de inscripción de Autorizaciones Médicas es RD$2,500. Otros cursos requieren importe confirmado por un administrador.
- Un aviso o adjunto de pago pasa a revisión. No se interpreta una imagen como prueba de abono. El administrador consulta el original y comprueba en el banco: cliente, referencia e importe exacto de inscripción. Una referencia no puede registrarse dos veces en el mismo banco.
- Validar registra el pago y cierre comercial, sin inventar matrícula, credenciales, grupo, factura ni activación de campus.
- Pedir un asesor pausa las respuestas automáticas del contacto y deja una tarea. Pedir que no le escriban bloquea la reactivación ordinaria.
- La pausa general detiene las respuestas nuevas y sigue registrando entradas. Una respuesta que ya estaba en curso puede terminar de enviarse.

## Seguimiento y operación

El panel muestra 100 oportunidades por página, con filtros y navegación. Los contadores corresponden a la página. Se actualiza cada 30 segundos. Las tareas vencidas son recordatorios internos; no disparan mensajes proactivos. Para enviar mensajes fuera de una conversación se necesitan consentimiento y plantillas/ventanas compatibles con WhatsApp; esta versión no programa campañas.

Los adjuntos se referencian por el ID de Meta y deben revisarse en el canal original. No hay OCR ni conexión de conciliación bancaria. Las tareas se pueden completar o programar y quedan auditadas. Un pago validado permanece validado aunque lleguen mensajes posteriores. Cursos adicionales para un cliente con pago validado requieren gestión humana; no se reutiliza el pago anterior.

La sesión administrativa protege lectura, ajustes y validación. Sin sesión las rutas /api/sales devuelven 401. Las escrituras requieren encabezado X-CRM-Action: sales y cookie; no hay CORS de origen externo. La API pública de conversión rechaza paymentConfirmed y el webhook de pagos responde 503 hasta implementar un verificador de proveedor auténtico.

## Base de datos y despliegue

Aplicar la migración sales_closing_agent antes de desplegar el código. Tablas: crm_sales_settings, crm_sales_opportunities, crm_sales_events y crm_sales_payments. Todas tienen RLS y sin acceso anon/authenticated; solo el servidor usa service_role. Las funciones son SECURITY INVOKER con ejecución exclusiva de service_role. Las transacciones bloquean la oportunidad para evitar cierres duplicados concurrentes.

Usa SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL/ADMIN_PASSWORD (o sus aliases CRM_ADMIN_*), las credenciales de WhatsApp y Gemini existentes. No hay nuevas claves que copiar al navegador. /api/health incluye salesAgent.ready. Si Supabase falla, el agente no afirma haber registrado un pago/solicitud; deja el error en logs. La recuperación/reintento de envíos fallidos sigue dependiendo de la recepción del webhook; no hay una cola durable de salida nueva.

Render Free puede suspender el servicio por inactividad. La memoria y las oportunidades sobreviven al reinicio, pero esta infraestructura no ofrece disponibilidad continua garantizada.

## Verificación

- npm run typecheck
- npm run test:whatsapp
- npm run test:sales
- ESLint de archivos modificados.
- SQL en Supabase, con datos ficticios dentro de una transacción revertida: inscripción → aviso de pago → verificación, referencia duplicada, importe incorrecto, baja persistente e idempotencia.
- Ninguna prueba envía mensajes reales a clientes ni registra pagos reales.

Para la aceptación final, el dueño puede escribir desde su propio WhatsApp: “Quiero inscribirme en Autorizaciones Médicas”, responder nombre/horario/correo y pedir “Dame las instrucciones de pago”. Verificar que la conversación avanza y aparece en el panel. No validar dinero ficticio.
