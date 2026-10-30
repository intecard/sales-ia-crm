# INTECA — Calendario maestro permanente de Community Manager

## Programación indefinida (sin caducidad)

Existe **un solo calendario maestro** para INTECA. Su regla de recurrencia no tiene fecha de finalización. Para no insertar infinitas filas, cada jornada en hora `America/Santo_Domingo` el CRM confirma o prepara una nueva **ventana móvil de 30 días**, desplazándola un día adelante. La siguiente renovación diaria no necesita intervención manual, siempre que el servidor y el despertador de Supabase sigan activos.

La operación es una recurrencia permanente; **los 30 días son solo el horizonte visible/precargado, no un límite de ejecución**. La planificación tiene claves de idempotencia: un reinicio o doble despertador no crea otra tarea idéntica. Los trabajos antiguos, ya publicados o de resultado incierto se conservan para auditoría y no se reenvían.

## Distribución diaria

| Medio | Hora RD | Formato | Estado operativo |
|---|---|---|---|
| Facebook e Instagram | 09:00 | 1 post con arte de Autorizaciones Médicas | Publicación orgánica |
| Facebook e Instagram | 17:00 | 1 imagen de otro curso | Publicación orgánica |
| Facebook e Instagram | 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00 | 8 reels por plataforma | MP4 local / FFmpeg |
| YouTube | 19:30 | 1 video estándar diario | MP4 local / FFmpeg |
| YouTube | 21:00 | 1 video diario hablado por INTEQUITO | **Guion agendado; producción y publicación bloqueadas hasta habilitar avatar oficial, voz, proveedor API, controles y gasto autorizado** |

Son **22 trabajos editoriales por día**: 10 destinos de contenido en Facebook, 10 en Instagram y 2 en YouTube (uno es un guion, NO una publicación audiovisual completada). Por 30 días, 660 trabajos en la ventana actual. La renovación continúa día tras día sin fecha final.

## Programadores

- **Supabase Cron (principal):** consulta `GET /api/health` cada 15 minutos de 07:07 a 23:52 RD. Esto despierta Render, pero un HTTP 200 no acredita publicación.
- **Temporizador interno CRM:** procesa cola cada 60 segundos mientras Render funciona.
- **GitHub Actions (respaldo):** salud a las 07:10 y 19:10 RD, no es un calendario editorial independiente.

Mantener el programador activo, credenciales vigentes y el servicio Render operativo. El plan no garantiza 100 % de publicaciones: las APIs y la infraestructura pueden fallar. No se intentan reenvíos ciegos ante resultados inciertos.

## El segundo video con INTEQUITO

El guion `avatar_video` es separado del video estándar `promo_video`. **No sustituirlo por un slideshow ni marcarlo como publicado sin producir un avatar hablando.** La cuenta HeyGen conectada se verificó en plan Free y no tiene avatar privado disponible a 2026-10-30. El flujo profesional existente admite una generación manual autorizada con revisión y sin gastos recurrentes implícitos. No hacer cargos automáticos sin un límite/cupo explícito y una integración plenamente verificada.

## Archivo y diagnóstico

El panel separa el calendario vigente del historial reciente y de versiones antiguas. El historial no equivale a publicaciones pendientes. El estado `published` exige confirmación real del proveedor; `brief` significa solo guion; `review_required` impide reintentos peligrosos.

Revisar `crm_community_calendar_state`, `crm_community_jobs`, `cron.job_run_details` y `net._http_response` para el diagnóstico. Usar el catálogo oficial para precios y duración, sin ofrecer descuentos no autorizados.
