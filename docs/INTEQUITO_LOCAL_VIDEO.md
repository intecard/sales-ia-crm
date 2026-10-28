# INTECA · Motor de video autohospedado con INTEQUITO

## Resultado y límites
Este proyecto añade un **tercer motor** al módulo Community Manager del CRM:
**Motor propio INTECA**, además de HeyGen y Runway. No utiliza sus APIs para generar videos.

- Backend del CRM (Render): calendarios, autenticación, cola, seguimiento, almacenamiento y revisión.
- Equipo con GPU administrado por INTECA: ComfyUI + un modelo Wan 2.2, voz local Piper, edición con FFmpeg.
- Conexión: el trabajador de la GPU **consulta** por HTTPS el CRM, con un token exclusivo. La GPU no necesita abrir un puerto público.
- Entregable: MP4 vertical con escenas animadas por IA, narración española, subtítulos y CTA fijo `809-643-5502`.
- La imagen original INTEQUITO es obligatoria. No sustituirla por otro personaje.
- **No garantiza lipsync perfecto**: la voz es una narración. Incorporar MuseTalk y una revisión de rostros es fase posterior.
- No garantiza 7 reels y 1 video *terminados* cada día con una sola GPU; dependerá del tiempo real de inferencia y de la calidad.

**Coste por plataforma externa de video: cero.** No significa coste operacional cero.
Hay inversión de GPU, electricidad, discos, conectividad y mantenimiento. El proyecto
no compra equipos ni alquila GPU. La producción autónoma inicia **deshabilitada**.

## Modelo y licencias

Recomendación inicial: [Wan2.2 TI2V-5B](https://github.com/Wan-Video/Wan2.2)
(Apache 2.0, image-to-video; 720p; aproximadamente **24 GB VRAM** con offload).
Usar [ComfyUI](https://github.com/Comfy-Org/ComfyUI) para ejecutar el workflow.
Para voz, instalar [Piper](https://github.com/OHF-Voice/piper1-gpl);
su distribución actual usa GPL-3.0, y las voces tienen licencias **individuales**:
revisar la ficha de la voz española antes de utilizarla en anuncios comerciales.
Este repositorio no distribuye modelos, audios, voces, pesos ni librerías GPL.
Para un talking avatar con labios, MuseTalk es una posible fase posterior,
sujeto a licencias del detector facial y de sus dependencias.

## Requisitos del equipo GPU

- GPU NVIDIA con **24 GB o más de VRAM** para el punto de partida Wan TI2V-5B; validar configuración del modelo.
- 100 GB o más libres para checkpoints, caché, renders y temp (se recomienda capacidad adicional).
- Windows 11 o Linux moderno con controladores NVIDIA/CUDA y Python compatible con ComfyUI.
- ComfyUI escuchando **únicamente en 127.0.0.1:8188**, con workflow image-to-video Wan2.2 y nodo final SaveVideo (MP4).
- Piper CLI y un modelo de voz española permitido para uso comercial (`.onnx` más `.onnx.json`).
- FFmpeg compilado con drawtext, subtitles, libx264, aac y ffprobe.

No ejecutamos inferencia de Wan directamente en la instancia web gratuita de Render.
La web es el **plano de control**; el cómputo lo hace la máquina GPU dedicada.

## Instalación en el CRM

1. Revisar y aplicar en la instancia correcta de Supabase la migración
   `supabase/migrations/20261027233000_local_video_engine.sql`.
   Antes debe existir el esquema del Community Manager.
2. Aplicar también `supabase/migrations/20261028165000_local_video_official_reference.sql`.
   Esta migración crea el bucket privado `crm-local-reference` para el personaje
   oficial, sin permitir lectura anónima, y campos de integridad SHA-256.
3. En Render, guardar `INTECA_LOCAL_VIDEO_WORKER_TOKEN` como secreto robusto,
   distinto de las claves de WhatsApp, Firebase o del administrador.
   `openssl rand -hex 32` genera uno. No incluirlo en Git ni mensajes.
4. Abrir **Agentes IA Autónomos → Community Manager → Motor propio INTECA**.
   En «Referencia oficial de INTEQUITO», seleccionar el PNG **original del usuario**
   y pulsar «Instalar imagen oficial». El CRM verifica dimensiones, formato e integridad
   y lo guarda en Supabase privado. La imagen no se publica a redes ni se envía
   a servicios de video externos. No crear personajes sustitutos.
5. Comprobar en «Verificar conexiones»: servidor, tablas, dos buckets privados y
   referencia oficial deben quedar listos. Si una conexión está pendiente, corregir
   ese punto concreto; las migraciones ya instaladas no se deben repetir.
6. La GPU debe operar desde un ordenador o estación de trabajo NVIDIA propia,
   porque Render Free solamente aloja el plano de control. Instalar en esa máquina
   ComfyUI, modelo Wan 2.2, Piper y FFmpeg, comprobar licencias comerciales.
7. Poner en el entorno privado del trabajador el **mismo token** generado en
   Render; no usar contraseña de usuario ni clave service_role de Supabase.
8. Iniciar una prueba con `--once`. Confirmar estado «GPU conectada», generar un
   MP4 de prueba y revisarlo; **solo después** considerar la producción automática.
   El estado «Conectada» significa que el trabajador contacta al CRM, no garantiza
   que su GPU, modelos y workflow hayan superado las pruebas.


## Instalación del trabajador en una GPU propia

Colocar el modelo, ComfyUI, Piper y los binarios FFmpeg; construir **un workflow real**
en ComfyUI con nodos ya funcionando en esa GPU. Exportar usando
**Save (API Format)** o la opción equivalente de la versión instalada.
La gráfica JSON debe contener literalmente, en valores de `inputs`:

- `__INTEQUITO_IMAGE__` en el nodo `LoadImage`.
- `__INTEQUITO_PROMPT__` en el nodo de texto positivo.
- `__INTEQUITO_PREFIX__` en el campo `filename_prefix` del nodo `SaveVideo`.

El worker sustituye esas tres referencias por el PNG oficial, las escenas del guion
y el nombre temporal del archivo. **No se incluye un workflow ficticio ni se descarga
un modelo a escondidas.** La gráfica debe tener un nodo real de salida MP4 en el historial.

Ejemplo de configuración del trabajador (todos son secretos locales de la GPU):

```bash
export INTECA_CRM_URL="https://sales.ia.crm.inteca.com.do"
export INTECA_LOCAL_VIDEO_WORKER_TOKEN="<token_privado_igual_al_configurado_en_Render>"
export INTECA_COMFYUI_URL="http://127.0.0.1:8188"
export INTECA_COMFY_WORKFLOW="/ruta/intequito_wan_api.json"
export INTECA_PIPER_VOICE_MODEL="/ruta/voz_es_ES.onnx"
export INTECA_GPU_WORKER_ID="inteca-gpu-1"
python workers/intequito_local_video/worker.py --once
# Tras validar una sola generación, quitar --once para iniciar el sondeo continuo.
```

No copiar el token a un `VITE_*` ni al frontend. El trabajador
sólo solicita trabajos, recibe guiones e imagen aprobados y sube archivos por HTTPS.
No necesita ni debe recibir la clave `SUPABASE_SERVICE_ROLE_KEY`.

## Flujo de aprobación y automatización

1. Lisa genera su calendario oficial con **1 post + 7 reels + 1 video al día**.
2. El motor propio puede ser usado manualmente desde el calendario; la cola registra
   un solo trabajo por pieza creativa aunque se publique en varias redes.
3. Tras validar la GPU, la imagen y la migración, el administrador puede habilitar
   «Producción automática». El servidor programa piezas que vencen próximamente.
   Límite inicial: **8 creatividades nuevas por día**; no recupera días vencidos en masa.
4. El trabajador reclama trabajos mediante un procedimiento SQL atómico, crea los
   clips en ComfyUI, la voz en Piper y el MP4 con FFmpeg.
5. El MP4 se sube a un bucket privado; el CRM muestra **Listo para revisión**.
6. La publicación en Facebook, Instagram o YouTube no ocurre hasta implementar
   una etapa posterior de revisión/aprobación y asociación del MP4 validado al job.

Un trabajo fallido o con resultado de subida incierto **no se repite automáticamente**:
su operador debe conciliar el estado y, si procede, crear una nueva producción autorizada.
Así se previene sobrecarga de GPU y publicación duplicada.

## Endpoints del servidor

Todos los admin quedan protegidos por sesión del CRM bajo `/api/advertising`:

- `GET /api/advertising/community/video/local/status`
- `GET /api/advertising/community/video/local/jobs`
- `POST /api/advertising/community/video/local/settings` con `{"enabled": true|false}`
- `POST /api/advertising/community/video/local/queue` con `{"communityJobId": "<uuid>"}`
- `GET /api/advertising/community/video/local/jobs/<uuid>/file`

Para llamadas POST admin, enviar `X-CRM-Action: advertising`.

Solo el trabajador GPU conoce el secreto `Authorization: Bearer <token>`:

- `GET /api/local-video/worker/reference`
- `POST /api/local-video/worker/claim` con `{"workerId":"inteca-gpu-1"}`
- `POST /api/local-video/worker/jobs/<uuid>/progress`
- `POST /api/local-video/worker/jobs/<uuid>/upload` con MP4 y cabecera `X-INTECA-Claim-Token`

## Prueba de aceptación

- Test de autenticación: sin token o con token inválido responde 401.
- Test de cola: scripts cambiados o precios erróneos no se aceptan.
- Test de idempotencia: 1 asset creativo => 1 job, aunque haya 3 redes.
- Test GPU de extremo a extremo: un solo guion de INTEQUITO, WAV Piper, MP4 720×1280,
  voz completa, subtítulos, CTA y estado «Listo para revisión».
- Verificación visual humana: cabello, uniforme, logo, voz, movimiento, manos, boca,
  ortografía, datos del catálogo y ausencia de ofertas no autorizadas.
- Benchmark: medir minutos por clip y utilización GPU antes de prometer 8 videos diarios.

Si la calidad no alcanza los criterios, mantener la generación automática desactivada.

## Nuevos endpoints protegidos de referencia oficial

- Administrador autenticado: `POST /api/advertising/community/video/local/reference`, cuerpo `image/png`, cabecera `X-CRM-Action: advertising`, tamaño 1 KB–6 MB, dimensión mínima 400×400. No admite JPEG disfrazado de PNG.
- Administrador autenticado: `GET /api/advertising/community/video/local/reference` para previsualización.
- Trabajador con token: `GET /api/local-video/worker/reference`; lee la misma imagen desde el bucket privado, verificando SHA-256.
- `GET /api/advertising/community/video/local/status` distingue `databaseReady`, `videoBucketReady`, `referenceBucketReady`, `referencePresent`, `workerConnected` y `readyForProduction`.
- La sustitución de una imagen **desactiva automáticamente** la generación automática. Los videos pasan siempre a revisión manual. No se publica en redes desde este motor.
