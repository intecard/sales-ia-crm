# Lisa Parkerd — operación real de INTECA

La solicitud del propietario autoriza publicación orgánica en las cuentas ya conectadas, sin descuentos ni gasto pagado. La migración crea una autorización explícita habilitada para org_inteca_main; otras empresas no comparten esta autorización.

## Operación

- 30 días: 60 originales verticales, 30 flyers y 90 historias visuales para Instagram; 4 guiones para videos largos. Cada original vertical se adapta a Facebook, Instagram y YouTube. Son 334 entradas de calendario, incluyendo los cuatro guiones. No son 334 archivos originales.
- Catálogo de Supabase fresco antes de producir y antes de enviar. Se bloquea si cambia el catálogo; no se mantienen precios antiguos.
- Primer flyer al activar, resto en horarios de prueba RD; las franjas pasadas se omiten. Ventana de recuperación máxima 90 minutos para evitar una avalancha tras suspensiones.
- Fotos ilustrativas existentes con identidad INTECA; logo institucional original. JPG 720×1280; MP4 24s, H.264/AAC, 3 escenas legibles, sin voz ni música comercial. No son clases grabadas ni testimonios reales.
- Facebook: fotos y videos en la página; los videos no se presentan como Reels verificados. Instagram: imágenes, Reels y Stories, sujetos a permisos y tipo de cuenta del proveedor. YouTube: subida de videos solicitada pública, estado público solo cuando lo confirma la respuesta. No se afirma éxito con un archivo local.
- Cada envío tiene bloqueo condicional en Supabase, destino fijado, hash de contenido y auditoría. Un resultado incierto o una interrupción durante envío queda en revisión y nunca se reintenta automáticamente. Antes de reintentar manualmente, comprobar el proveedor.
- Pausa desde la ficha Lisa en Agentes IA. El chat permite coordinar notas y solicitudes; las frases del chat no ejecutan publicaciones ni aprueban gasto. El calendario realiza la operación externa.
- Métricas: interacciones de las últimas 20 publicaciones de Meta cada 12 horas. No se inventan alcance, retención, conversiones, leads, pagos o ceroes ante un fallo del proveedor.

## Límites pendientes

- YouTube OAuth requiere registrar la URL del CRM en Google Cloud y autorizar de nuevo si devuelve invalid_grant/redirect_uri_mismatch.
- Respuestas públicas a comentarios, moderación y mensajes de Instagram no tienen un ejecutor conectado aquí; se preparan propuestas en el chat. No se capturan datos privados de perfiles ni se envía spam. Los prospectos siguen los flujos existentes del sitio/WhatsApp y Ventas.
- No hay integración ejecutora de Canva, CapCut, Google Trends, generación de voz, colaboradores, directos ni grabación de docentes. La guía aportada no equivale a credenciales de esas herramientas.
- Los videos largos requieren grabación y revisión humana. No se generan ficticiamente docentes, historias de alumnos ni avales.
- Pauta y optimización de presupuesto siguen en el módulo Publicidad/Tarjeta y Pauta con aprobación y presupuesto. Lisa no recibe PAN/CVC ni puede ofrecer descuentos.
- La selección de curso rota por el catálogo completo; no se deducen fechas de inicio de notas sin confirmar ni se automatizan campañas fechadas desde el chat.
- Las tareas periódicas existen mientras el proceso Render corre. El servicio gratuito puede dormir; no se ha contratado un plan de pago ni configurado tráfico artificial para mantenerlo despierto.
- No se garantiza viralidad ni éxito comercial del 100%. La guía del propietario se conserva en docs/community-manager-source.md y se incluye en el contexto de Lisa; el catálogo vigente prevalece en los datos de los cursos.

## Verificación

Pruebas de calendario, precios, concurrencia, catálogo cambiado, pausa y resultado incierto; pruebas del chat por área y de conexiones compartidas. Producción real JPG y MP4 local inspeccionada antes de desplegar. Revisar IDs de proveedor y estados en Supabase después de desplegar antes de declarar publicación conseguida.

## Crecimiento orgánico de la comunidad

Lisa prioriza seguidores y suscriptores auténticos, vistas, interacciones y consultas. Alterna ganchos educativos, preguntas útiles, invitaciones a guardar y compartir, y visitas al programa con enlaces UTM. No compra seguidores, no inventa premios ni cifras y no activa descuentos o gasto. Las publicaciones programadas que todavía no tienen recursos producidos se actualizan después de reclamarlas y validar su catálogo y hash. Las publicaciones ya producidas, publicadas o inciertas se conservan.

El panel Crecimiento de la comunidad muestra las últimas métricas observadas por red, con una sola lectura por publicación para evitar sumar duplicados. Los seguidores se leen como total de la cuenta y su evolución se calcula entre muestras, sin atribuir el cambio a una pieza. Se consulta YouTube videos.list y channels.list con la autorización existente; ante falta de permisos los datos quedan no disponibles. Meta conserva interacciones por publicación y consulta seguidores si el campo está autorizado. Las visitas web, alcance y retención permanecen no disponibles sin analítica adicional. No se solicita una autorización nueva ni se amplían permisos.

El chat interno de Lisa recibe estos resultados y las piezas con más interacciones para preparar comparaciones de formatos, temas y horarios, considerando antigüedad y alcance. El ranking no activa pauta ni prueba causalidad. La observación es cada 12 horas mientras el servidor esté activo; Render gratuito puede suspenderse. Los resultados dependen de la audiencia y no se garantizan.
