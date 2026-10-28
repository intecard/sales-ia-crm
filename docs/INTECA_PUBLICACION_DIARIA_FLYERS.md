# INTECA — publicación orgánica diaria de flyers

## Estado validado el 28 de octubre de 2026

- El CRM publicó el nuevo flyer `v4` en Facebook y en Instagram,
  además de las publicaciones anteriores de `v3`. Estos dos reenvíos
  v4 fueron pedidos expresamente por el propietario.
- Facebook: `https://www.facebook.com/122151740445242996/posts/122152156971242996`
- Instagram: `https://www.instagram.com/p/DfDTHsNgbgJ/`
- Se confirmó estado `published` para ambos identificadores de Meta,
  con el mismo JPEG nuevo y con inscripción RD$2,500, mensualidad RD$2,000,
  programa de cinco meses y CTA al WhatsApp 809-643-5502.
- El planificador `v4` en Supabase conserva 29 fechas futuras
  con una pieza diferente por día en Facebook y en Instagram.
- Octubre presenta Técnico en Oficial de Autorizaciones Médicas.
  La rotación de cursos cambia al iniciar otro mes, sin anunciar cursos
  que no existan en el catálogo.

## Horario y activación

- Hora prevista: **09:00 de República Dominicana (UTC−4)**.
- El proceso `communityManager.tick()` revisa la cola cada minuto **mientras
  el servidor Render esté despierto**.
- `.github/workflows/inteca-community-daily-wakeup.yml` realiza peticiones
  públicas GET a `/api/health` a las **09:07, 10:07, 14:07 y 18:07 RD**.
  Los chequeos de respaldo despiertan Render Free si se ha suspendido.
  No incluyen claves, no reciben tarjetas y no publican por sí mismos:
  la API del CRM aplica los controles de duplicados y verificación de Meta.
- Los cron de GitHub Actions pueden retrasarse o saltarse una ejecución;
  Render Free puede suspenderse. Esto **mejora la continuidad**, pero NO
  garantiza puntualidad exacta. Verificar la pestaña Actions y el calendario
  si un día no aparece una publicación.
- Las publicaciones anteriores no se reenvían automáticamente. Un fallo
  de resultado incierto de Meta pasa a revisión y no se publica dos veces.

## Plataformas y limitaciones reales

| Plataforma | Flyer JPEG (1080 × 1350) | Estado |
|---|---|---|
| Facebook Page | Sí | Publicación orgánica verificada |
| Instagram profesional | Sí | Publicación orgánica verificada |
| YouTube | **No**, el publicador actual requiere MP4 | Pendiente de video real revisado |

La API de YouTube Data para videos no equivale al sistema de publicaciones
de Comunidad. El canal puede compartir el flyer manualmente en su pestaña
Comunidad cuando dicha función esté disponible en la cuenta. NO convertir
imágenes estáticas en videos silenciosos para simular reels del personaje:
INTEQUITO debe conservar su calidad e identidad oficial.

## Control de calidad antes de publicar

- Poster `v4`: 1080 × 1350, fotografias `contain` sin recortes, precios
  y beneficios procedentes del catálogo, CTA y teléfono completos.
- Se admite la misma creatividad para Facebook e Instagram de una fecha.
  El diseño cambia cada día por fecha, ilustraciones y composición.
  La biblioteca actual **no garantiza una nueva fotografía real cada día**.
- Si faltan precio o contenido académico verificados, el estado pasa a
  `blocked`. No inventar datos para forzar el post.
- El CRM tiene 7 guiones de reels + 1 video diario por plataforma pero
  la generación de video 3D no está conectada; no afirmarlos publicados.

## Dónde revisar

- Administrador CRM → Agentes IA → Lisa Parkera — Community Manager.
- Supabase `crm_community_jobs`: `published` con id/URL confirma éxito;
  `queued` es pendiente, `blocked` exige revisión; `review_required`
  significa que la API puede haber publicado y **no** debe repetirse
  sin reconciliación externa.
- GitHub Actions → INTECA - Organic Daily Flyer Wake-up.
