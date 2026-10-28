# INTECA · Campañas mensuales y Community Manager

## Objetivo
- Un programa académico protagonista **durante todo el mes calendario dominicano**.
- Cada mes se cambia al siguiente programa del **catálogo oficial de Supabase**, sin inventar programas, precios, horarios ni avales.
- 1 flyer profesional **diferente cada día**, reutilizado en Facebook e Instagram el mismo día.
- 7 guiones para reels + 1 guion para video diario. **No publicar archivos de video no producidos**: se guardan como `brief` y pasan a los motores HeyGen, Runway o INTECA local con sus requisitos.
- Cada pieza incluye CTA WhatsApp **809-643-5502**.

## Rotación mensual
Primera campaña: octubre 2026, primer curso según el orden vigente del catálogo. Noviembre 2026: segundo curso; diciembre 2026: tercero, y así sucesivamente. Con N programas diferentes, la rotación completa dura N meses, y luego empieza de nuevo. Esto garantiza cobertura de todos los programas aunque N sea mayor que 12. Una modificación del orden oficial del catálogo puede cambiar campañas futuras; las versiones de contenido se separan por hash para impedir mezclar precios.

## ¿Qué impide que repita el mismo flyer?
1. El plan incluye `editorialDate`, `campaignMonth`, `designSeed` y `assetKey` único derivado de la fecha, el curso y la versión del catálogo.
2. El JPEG renderizado usa la fecha visible, tema, titular, paleta, forma gráfica y composición determinados por la fecha.
3. La prueba automatizada compara los SHA-256 de los **bytes JPEG reales** de dos días consecutivos y exige que sean distintos.
4. Facebook e Instagram comparten **la pieza del mismo día**, no requieren dos producciones distintas.
5. Una publicación cuya respuesta externa sea incierta queda en revisión; no se reenvía automáticamente para evitar duplicados.

## Calendario y reintentos
- Flyer diario: 09:00, hora RD. Si Render despierta tarde, todavía puede publicarse hasta el final del mismo día. Después se considera vencido y no se recupera de manera masiva.
- 7 reels: 10:00, 11:00, 12:00, 13:00, 15:00, 17:00 y 19:00.
- Video principal: 20:00.
- Cada día se conserva un horizonte de programación de **30 días** a través del RPC `crm_community_roll_plan`, sin borrar las piezas publicadas.
- La migración nueva no detiene el calendario por sí sola. En la primera inserción exitosa del calendario v3, se retiran atómicamente las filas antiguas que todavía estén `queued`; se conservan `published`, `review_required`, `blocked` e historial.

## Diagnóstico de fallos
Capturas del 27/10/2026 mostraban `CM_CONNECTION_OR_STORAGE` y `CM_SLOT_MISSED`.
La lectura de la base de datos confirmó 6 trabajos publicados, 14 bloqueados, 13 vencidos y 297 pendientes. Los bloqueados no tenían multimedia guardada, por lo que la red social no es la única causa plausible.

El diagnóstico en el panel comprueba:
- existencia de fotos/imagen oficial de INTEQUITO/logotipo;
- presencia de FFmpeg;
- configuración y disponibilidad de bucket `crm-community`;
- identificadores de los destinos Facebook, Instagram y YouTube;
- a demanda, renderizar y subir un JPEG de prueba **sin publicarlo** en redes, y verificar las tres cuentas.

Los errores nuevos se clasifican por fase (`CM_RENDER_FAILED`, `CM_STORAGE_FAILED`, `CM_ACCOUNT_VERIFY_FAILED`, etc.). No se escriben tokens ni cuerpos de respuesta de proveedores en registros de errores.

## Despliegue y seguridad
1. Revisar PR 1 (HeyGen/Runway), PR 2 (motor local), PR 3 (este calendario) en ese orden. Las ramas están apiladas.
2. Comprobar la última CI: `npm run typecheck`, `npm run build`, pruebas de contenido y JPEG real.
3. Aplicar migraciones de Supabase en orden comprobado. En especial, `20261027235900_community_monthly_rotation.sql`.
4. Desplegar la rama integrada en el servicio Render **confirmado** por el propietario. No elegir workspace ni iniciar gastos sin confirmación.
5. Ir a Community Manager → «Revisar configuración», luego «Probar flyer y almacenamiento (sin publicar)».
6. Verificar primero una publicación real de baja criticidad con la cuenta seleccionada; revisar media, cuenta y resultado. No reintentar publicaciones de resultado desconocido.
7. Si Render Free duerme durante todo el día, el código no puede garantizar publicaciones diarias. Es necesaria una instancia que permanezca activa o un despertador programado confiable; no afirmar operación 24/7 en Free.

**Importante:** Esta solución soluciona el calendario mensual, evita diseños gráficos repetidos y añade instrumentación para fallos. No confirma que el CRM de producción ya esté actualizado; se requiere despliegue y prueba de los endpoints reales.
