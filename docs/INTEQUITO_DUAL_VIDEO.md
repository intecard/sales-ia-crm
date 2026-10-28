# INTEQUITO · Estudio audiovisual con HeyGen + Runway

## Motores seleccionables
- **HeyGen Avatar Video v3**: produce un video vertical con guion, lip-sync y subtítulos. Puede usar el avatar propio aprobado (`HEYGEN_INTEQUITO_AVATAR_ID`) **o** la imagen oficial importada (`HEYGEN_INTEQUITO_IMAGE_ASSET_ID`), además de `HEYGEN_API_KEY` y `HEYGEN_INTEQUITO_VOICE_ID`. Nunca sustituye INTEQUITO por avatares genéricos.
- **Runway Gen-4.5**: produce **un único plano animado de 5 segundos** a partir de `public/intequito-oficial.png` y la escena 1 del guion. Requiere `RUNWAYML_API_SECRET`; 5 segundos cuestan aproximadamente 60 créditos API según tarifa publicada. **No es un video final de 45 o 60 segundos**.
- **ElevenLabs**: módulo de voz opcional y separado para futuras composiciones; HeyGen utiliza su voz configurada. No se exige ElevenLabs para Runway.

## Cómo utilizar ambos en una misma campaña
1. Crear guiones desde el catálogo real de INTECA. Cada guion mantiene a INTEQUITO y el CTA: WhatsApp **809-643-5502**.
2. En **Community Manager → Estudio audiovisual**, seleccionar HeyGen o Runway. Puede generar una versión por motor para la misma pieza.
3. Aceptar el gasto de esa solicitud concreta. No hay publicación ni gastos recurrentes automáticos.
4. Revisar estado en la ficha del guion. Las solicitudes se registran previamente en `crm_community_video_generations`, bloqueando duplicados incluso tras reinicios.
5. Revisar el video o clip en el proveedor antes de usarlo. **La unión de ambos, mezcla, SRT, music licensing y exportación editorial en un solo MP4 todavía requieren un orquestador de postproducción y control de calidad**, no se declara terminado.

## Instalación
1. Aplicar, en orden, migraciones `20261027204000_intequito_community_calendar.sql` y `20261027215000_intequito_dual_video_generations.sql` sobre la instancia confirmada de Supabase. No se han aplicado por este commit.
2. Guardar el **archivo original** de INTEQUITO en `public/intequito-oficial.png`; revisarlo visualmente antes de activar Runway. El CRM no improvisa otro personaje.
3. El 27 de octubre de 2026 la cuenta HeyGen conectada `intecaedu@gmail.com` estaba en plan Free y la creación de avatar privado respondió **403: requiere plan pagado**. Se logró importar el PNG original a los recursos de HeyGen. Alternativa condicional: usar `HEYGEN_INTEQUITO_IMAGE_ASSET_ID` (ID real del recurso importado) en lugar de un avatar; esto requiere una cuenta API que permita crear el video y **no se ha verificado que el plan Free habilite generaciones API**. Elegir una voz en español, configurar `HEYGEN_API_KEY` y `HEYGEN_INTEQUITO_VOICE_ID` en Render. Nunca guardar claves en GitHub.
4. Habilitar créditos API Runway y clave en Render si se usarán escenas animadas.
5. Probar en modo limitado: una sola generación aprobada por motor; inspeccionar continuidad del rostro, logo, movimiento, voz, subtítulos, duración y costos reales.
6. Solo después de aprobar pruebas, habilitar cualquier flujo adicional de producción o publicación.

## API del CRM (admin autenticado)
- `GET /api/advertising/community/video-provider`: estado separado de HeyGen/Runway sin revelar secretos.
- `GET /api/advertising/community/video/generations`: historial privado.
- `POST /api/advertising/community/video/generate`: solicitud **manual** persistida; body: `{ communityJobId, provider: "heygen"|"runway", requestId: UUID, confirmSpend: true, maxRunwayCredits?: 60 }`. Requiere cabecera `X-CRM-Action: advertising`.
- `GET /api/advertising/community/video/generations/:id/status`: consulta proveedor; estado final de producción es `review_required`, nunca `published`.

## Controles
- Sin secretos API en el repositorio.
- No repetir automáticamente solicitudes de resultado desconocido (riesgo de doble cargo).
- No afirmar que Runway ha producido un anuncio completo cuando es un clip.
- No sustituir la mascota oficial por avatares ajenos.
- No publicar automáticamente material no revisado ni ejecutar campañas pagadas sin una autorización independiente.
- No prometer resultados comerciales ni inventar certificaciones, empleo o cupos.

Fuentes de integración: https://developers.heygen.com/reference/create-video ; https://developers.heygen.com/reference/get-video ; https://docs.dev.runwayml.com/guides/using-the-api/ .
