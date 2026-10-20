# Publicidad INTECA

El panel Agentes IA → Publicidad usa `/api/advertising`, una sesión administrativa HttpOnly y Supabase. Las campañas e historial sobreviven reinicios de Render. Solo el administrador configurado puede aprobar. Los prompts y los botones decorativos de otros agentes no conceden permisos.

Cada borrador es inmutable. La aprobación se vincula a su hash, versión del catálogo y cuenta destino. Una modificación requiere otro borrador. Descuentos, gratuidad, becas, precios no presentes en la inversión del curso y archivos multimedia requieren aprobación económica explícita. La detección textual es conservadora: el dueño también debe revisar imágenes, videos y afirmaciones. Toda publicación exige revisión humana, incluso si no se detecta descuento.

Las propuestas pendientes se muestran dentro del panel. No se envían avisos de aprobación por correo ni WhatsApp.

## Operaciones implementadas

- Facebook: publicación de texto o fotografía desde archivo público de Supabase.
- Instagram: publicación de imagen JPEG y descripción de hasta 2,200 caracteres.
- Meta Ads: creación de campaña de tráfico PAUSED y consulta de métricas de 7 días. Aún hay que completar conjuntos, público, presupuesto y creativos en Meta; no activa gasto.
- Google Ads: creación atómica de presupuesto y campaña Search PAUSED, en DOP, y métricas de 7 días. Aún hay que completar grupos, palabras clave, ubicación y anuncios en Google; no activa gasto.
- YouTube: subida de MP4 de hasta 20 MB como video privado, después de verificar el canal del token. Revisión y publicación final en YouTube Studio. Los anuncios de YouTube no se crean con YouTube Data API.

No se declara conectado por detectar variables: «Comprobar cuenta» hace una lectura real y no afirma que la escritura fue probada. La publicación exige una respuesta con ID del proveedor. Un fallo incierto no se reintenta; el dueño debe revisar la plataforma. Las campañas atascadas en `executing` tras un reinicio tampoco se reenvían. La ejecución programada revisa aprobadas vencidas cada minuto; en un servicio Render free suspendido se ejecutará al despertar, no garantiza puntualidad 24/7.

## Credenciales

Guardar en Multiempresa y Seguridad → conexiones (persistencia en Render requiere su API key ya configurada) o directamente en Environment de Render. No incluir secretos en GitHub ni en el chat.

Facebook: `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN` con permisos de página para lectura/publicación. Instagram: `INSTAGRAM_BUSINESS_ACCOUNT_ID`, token de página y permisos de Instagram mediante Facebook Login. Meta Ads: `META_AD_ACCOUNT_ID`, `META_ADS_ACCESS_TOKEN` con acceso a la cuenta y `ads_management` / `ads_read` según operación. Versión Graph: `META_GRAPH_API_VERSION` (por defecto v26.0).

Google Ads: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`; opcional `GOOGLE_ADS_LOGIN_CUSTOMER_ID` si es cuenta administradora. OAuth scope `https://www.googleapis.com/auth/adwords`. Versión configurable `GOOGLE_ADS_API_VERSION` (v26).

YouTube: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID`. Autorizar scopes `youtube.readonly` y `youtube.upload`. Una API key sola no permite subir videos. No se implementó un nuevo flujo OAuth en el CRM; hay que autorizar las aplicaciones oficiales y guardar los tokens en el servidor.

## Verificación

`node --experimental-strip-types --test advertising-agent.test.ts`

`npm run typecheck && npm run build && node --test advertising-api.test.mjs`

Pruebas sin publicaciones ni gasto externo. Para declarar cada canal operativo faltan credenciales, verificación de cuenta y una prueba real aprobada por el dueño. Nunca usar un test automatizado para gastar presupuesto.

## Presupuesto y planificación (20 octubre 2026)

Tarjeta & Pauta IA usa ahora Supabase, no un perfil ficticio guardado en localStorage. No recopila PAN, vencimiento ni CVC. Enlaza a Meta Business/Google Ads para registrar el medio de pago en su facturación. Registrar una tarjeta allí no concede permisos API al CRM, y un token de Stripe no sirve automáticamente para pagar anuncios de Meta/Google.

`crm_ad_plans` guarda planes inmutables por curso: total DOP mínimo 1000, límite diario, duración propuesta, costo objetivo por matrícula y canales. Un plan comienza pendiente y requiere autorización del administrador con su hash. Reparto orientativo: 20% pruebas A/B, 70% anuncios con evidencia y 10% reserva; no constituye autorización de gasto. Las campañas pagadas requieren plan aprobado, `planId`, asignación total `totalBudgetDop` y diaria `dailyBudget`. El trigger serializa asignaciones por plan y bloquea sumas superiores a ambos límites, incluso con varios servidores. Al rechazar un borrador no ejecutado se libera su asignación; las campañas preparadas conservan la reserva.

Estos son límites de ASIGNACIÓN del CRM, no un límite de cobro aplicado por el proveedor. Las campañas siguen PAUSED. No hay activación, escalado ni pausa automática externa. Falta verificar facturación, límites nativos y atribución antes de habilitar gasto. Google puede tratar el presupuesto diario como promedio; no equivale a un tope estricto. No se supone que la cuenta de Meta permita DOP ni se convierte moneda silenciosamente.

La estrategia usa el curso y precios del catálogo actual. `evaluatePerformance` solo propone aumentos con datos completos, 72 horas, al menos cinco matrículas pagadas atribuidas, costo dentro del objetivo, ingresos superiores al gasto y 24 horas desde el último aumento. Tope por propuesta 20%, limitado por saldo y diario. Sin prueba de atribución no aumenta: la ruta de evaluación obtiene métricas reales de cuenta (últimos siete días), distingue conversiones del proveedor de matrículas verificadas y devuelve espera. La atribución de pagos todavía está pendiente; no se presentan cero matrículas ni ROAS inventados. La duración en el plan es propuesta, no una fecha de inicio/cierre ya configurada en el proveedor.

Pruebas: `node --experimental-strip-types --test advertising-agent.test.ts advertising-plans.test.ts`, build/API y transacción Supabase con ROLLBACK para mínimo, límites acumulados, inmovilidad del plan y bloqueo tras cancelación. Sin cargos ni publicaciones reales.
