# Creativos y seguimiento comercial

## Materiales

En Marketing y en los agentes `agent_creative` y `agent_video`, el estudio consulta el catálogo vigente del servidor (Supabase Storage) y ofrece todos los cursos. Dibuja el logo institucional original optimizado para web, título del curso, descripción/beneficios, duración, inversión y llamada a solicitar información. No permite editar precios de la plantilla ni inventar descuentos.

Se descargan flyers PNG 1080×1350, banners PNG 1600×900 y videos WebM de 30 segundos, con cuatro escenas de texto y logo. El video usa Canvas/MediaRecorder en el navegador; requiere una pestaña visible y un navegador compatible. No tiene audio, escenas cinematográficas ni conversión a MP4. No publica en redes ni activa gasto. La generación de guiones por IA sigue disponible en el generador de marketing, con controles de catálogo y aprobación de descuentos.

## Interesados y embudo

Los registros reales son `crm_sales_opportunities`. El webhook de WhatsApp existente crea/actualiza los contactos y conserva su curso, datos y etapa en Supabase. Leads, Embudos y Bóveda muestran estos registros del servidor; los datos manuales locales de la interfaz anterior se presentan por separado. El documento HTML descargable con nombre, teléfono, correo, curso, solicitud de llamada, etapa, objeción y tarea se genera con todos los contactos guardados mediante paginación. Los datos faltantes se indican como pendientes; el reporte no inventa contactos ni atribuye ventas.

El permiso de llamada se conserva en `profile.callbackConsent` y su fecha; una solicitud negativa lo revoca. El documento se reconstruye con los datos persistentes: no existe una copia pública de los contactos en Storage. Solo el administrador con sesión firmada puede consultarlos. La captación de nuevos interesados por anuncios depende de canales, formularios y permisos externos operativos. Los conectores de formularios existentes no se consideran verificados por este cambio.

## Claves

El botón Ver consulta únicamente la variable seleccionada usando sesión firmada, cabecera de acción y contraseña actual del administrador. La respuesta es `no-store`, está limitada por frecuencia y se audita solo el nombre de la variable. Ocultar vuelve a enmascarar claves sensibles. No se guardan valores revelados en almacenamiento del navegador ni en el código. El guardado conserva el flujo existente de persistencia en Render; sin esas credenciales solo afecta al proceso actual.

## Matrícula

El nombre de curso del CRM es un selector cargado automáticamente desde el catálogo. La lista del campus se consulta al abrir el panel; devuelve todos los documentos reales de `courses`. Fallos de sesión o configuración se muestran como errores y no se sustituyen con identificadores ficticios. La asociación requiere seleccionar y guardar cada correspondencia real. Ningún cambio de selector omite la validación de recibo y abono para matricular.

## Validación

TypeScript y build de producción; pruebas de conversación para permiso/revocación de llamada y pruebas API para sesión, cabecera de acción, reautenticación, variables permitidas y no-cache. Sin cargos, publicación externa ni mensajes a clientes durante las pruebas. La respuesta a objeciones mejora el guion comercial, pero no garantiza un cierre del 100%.
