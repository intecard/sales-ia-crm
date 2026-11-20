# Revisión del CRM y los 22 agentes — 19 noviembre 2026

## Cambios

- Cada agente dispone de objetivo, entregable y medida de calidad propios. El chat muestra esas pautas y conserva las restricciones de empresa/área. Las reglas comerciales INTECA no se transfieren a otras empresas.
- La instrucción institucional ya no cambia la identidad de todos los agentes por la representante de WhatsApp. Los módulos esperan la lectura vigente del catálogo antes de cotizar, sin recurrir a precios antiguos cuando falla la fuente.
- Orientación comercial determinista para presupuesto, horarios, dudas y confianza; mantiene el plan USD autorizado, sin descuentos inventados. Los contactos con pago validado, pago en revisión, control humano o baja quedan fuera de esa orientación de cobro.
- Generación de IA con plazo por intento, presupuesto total, máximo de tres modelos configurados y enfriamiento ante fallos. Respuestas vacías/truncadas pasan al respaldo; errores de acceso y bloqueos de contenido no se reintentan. Diagnósticos sin texto privado del proveedor. Las acciones externas no se reintentan con este mecanismo.
- Historial, notas y tareas del equipo se consultan en paralelo. El cambio de empresa reinicia la vista del chat y el cambio de agente limpia los mensajes visibles anteriores.
- Carga de módulos bajo demanda y recuperación por módulo ante errores de renderizado. El paquete JavaScript principal anterior medía 821.261 bytes; el nuevo ronda 379 KB sin comprimir. Esto mide tamaño, no tiempo real de carga ni todo el código descargado durante una sesión.
- Se sustituye el aviso fijo de actividad 24/7 por configuración consultada al servidor. Seguimientos y avisos al dueño muestran sus requisitos de plantilla por separado.
- Migración de base de datos: RLS y retirada de permisos públicos en dos tablas antiguas; retirada de lectura universal en tablas antiguas de interesados/conversaciones/mensajes; cinco políticas limitadas al servidor y cinco índices de claves foráneas. No se eliminan registros.

## Segunda revisión de estabilidad

- Suscripciones de lectura con cancelación al cambiar de vista, límite de 30 segundos y una sola consulta periódica en curso. Las vistas de pagos, matrícula, telefonía, contabilidad, publicidad y video consumen las respuestas mediante callbacks de suscripción.
- Las lecturas independientes de diagnóstico y video se realizan en paralelo. Si una verificación deja de responder se elimina su evidencia antigua de la pantalla.
- Los formularios fiscales se reinician por período: las confirmaciones de fuentes de un mes no se reutilizan para otro.
- La voz utiliza referencias del render confirmado y libera micrófono, audio y solicitudes al desmontar la sesión. El cambio de empresa crea una sesión de voz nueva.
- La exportación creativa exige que haya cargado la imagen del curso y versión seleccionados; cupos y fecha límite se reinician al cambiar de curso.
- La verificación de pull requests ejecuta ahora el control global y todas las pruebas de módulos y API, además de las pruebas existentes del worker.
- Dos pruebas adicionales cubren respuestas tardías tras desmontaje y ausencia de consultas periódicas simultáneas.

## Verificación

- 181 pruebas funcionales TypeScript mediante `npm test` (el ejecutor anterior de strip-only no soportaba todas las clases del proyecto).
- 6 pruebas de API compilada: autenticación, permisos de publicidad, validación bancaria, pausa comercial, WhatsApp, aislamiento de contactos, duplicados y borradores fiscales.
- Comprobación de tipos, compilación de producción y lint global, sin errores ni advertencias.
- SQL confirma RLS y ausencia de lectura para anon/authenticated en las siete tablas reforzadas; service_role conserva lectura. Los avisos de seguridad por RLS desactivado desaparecen.

## Límites y pendientes reales

- Los entregables del chat interno son asistencia especializada; un texto no equivale a campaña publicada, llamada realizada, compra aprobada, factura fiscal emitida ni matrícula ejecutada.
- La meta de cinco ventas pagadas al día se mide con pagos validados; no es una garantía de resultados. Aún no hay evidencia suficiente para certificar una mejora de conversión en producción.
- Las plantillas de seguimiento y avisos al dueño seguían pendientes de aprobación de Meta durante la revisión. Fuera de la ventana de servicio no se debe declarar un aviso entregado.
- El servidor Render Free puede suspenderse. No se contrató capacidad ni gasto externo. La sincronización automática del campus continúa desactivada.
- Segunda revisión: corregidos los avisos globales de lint, las referencias de voz actualizadas durante render y las suscripciones de datos sin cancelación. `npm run check` verifica ahora tipos, lint global y compilación juntos.
- Supabase conserva un aviso previo por pg_net en public; no se mueve una extensión activa sin revisar sus dependencias. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

## Referencias técnicas

- https://aistudio.google.com/docs/troubleshooting
- https://aistudio.google.com/docs/models/gemini-3.8-flash
- https://supabase.com/docs/guides/api/securing-your-api

## Recuperación

El código puede revertirse al commit anterior mediante un despliegue de Render. La migración es independiente y preserva los registros; no se deben restaurar permisos públicos para revertir un cambio visual. La pausa de seguimiento sigue disponible en el panel comercial.
