# Matriz de variables Render para agentes e integraciones

Esta matriz define las variables que el CRM lee realmente para operar agentes,
conectores y webhooks. No guardes secretos en el repositorio ni en el frontend.
En Render se agregan desde **Service > Environment > Add Environment Variable**
o como **Secret File** cuando se trate de certificados.

Regla de precedencia:

1. Credenciales por empresa guardadas en backend seguro/Supabase cifrado.
2. Variables globales del servicio en Render.
3. Valores visuales de la UI solo como ayuda; no prueban conexión.

| Variable | Función | Obligatoria para | Dónde obtenerla | Servicio Render | Secreta o pública | Prueba de validación |
|---|---|---|---|---|---|---|
| `APP_URL` | URL pública del CRM | Webhooks, links, callbacks | Dominio/subdominio publicado | Web Service | Pública | Abrir `/api/health` y verificar URL |
| `DEPLOYMENT_MODE` | Modo servidor | Producción real | Definir `production` | Web Service | Pública | `/api/health` muestra `production` |
| `VITE_DEPLOYMENT_MODE` | Modo frontend | UI producción | Definir `production` | Web Service | Pública | UI no muestra modo demo |
| `TRUST_PROXY` | Proxy de Render para Express | Rate limit y HTTPS | Definir `true` | Web Service | Pública | No debe fallar rate-limit en Render |
| `ADMIN_EMAIL` | Usuario propietario | Login real | Dueño CRM | Web Service | Secreta parcial | Login `/api/auth/login` |
| `ADMIN_PASSWORD` | Contraseña propietario | Login real | Dueño CRM | Web Service | Secreta | Login correcto |
| `GEMINI_API_KEY` | Generación IA | Todos los agentes IA | Google AI Studio | Web Service | Secreta | `/api/health` `geminiConfigured=true` |
| `GEMINI_MODEL` | Modelo principal | Agentes IA | Definir modelo disponible | Web Service | Pública | `/api/health` lista modelo |
| `GEMINI_FALLBACK_MODELS` | Modelos respaldo | Resiliencia IA | Lista separada por coma | Web Service | Pública | `/api/health` lista fallbacks |
| `SUPABASE_URL` | URL proyecto Supabase | Persistencia real | Supabase Project Settings | Web/Worker | Pública | `/api/integrations/status` sin faltante |
| `SUPABASE_ANON_KEY` | Cliente público limitado | Frontend controlado | Supabase API Settings | Web Service | Pública sensible | Prueba lectura con RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones backend | Jobs, auditoría, secretos | Supabase API Settings | Web/Worker | Secreta | Solo backend; nunca frontend |
| `SUPABASE_JWT_SECRET` | Validación tokens | Auth/RLS backend | Supabase API Settings | Web Service | Secreta | Validar token firmado |
| `SUPABASE_STORAGE_BUCKET` | Archivos/evidencias | Flyers, videos, XML/PDF | Supabase Storage | Web/Worker | Pública | Subir archivo de prueba autorizado |
| `META_WEBHOOK_VERIFY_TOKEN` | Verificación webhook Meta | WhatsApp/Meta webhooks | Valor definido por ti | Web Service | Secreta | Meta challenge devuelve challenge |
| `META_GRAPH_API_VERSION` | Versión Graph API | Meta/WhatsApp | Meta Developers | Web Service | Pública | Requests usan versión configurada |
| `WHATSAPP_ACCESS_TOKEN` | Envío WhatsApp | Agente WhatsApp | Meta Business permanent token | Web Service | Secreta | Enviar mensaje de prueba autorizado |
| `WHATSAPP_PHONE_NUMBER_ID` | Número API | Agente WhatsApp | WhatsApp > API Setup | Web Service | Pública sensible | API `/messages` acepta phone id |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA | WhatsApp Cloud | Business Manager | Web Service | Pública sensible | Webhook asociado a WABA |
| `WHATSAPP_AUTO_REPLY_ENABLED` | Auto respuesta | WhatsApp IA | `true`/`false` | Web Service | Pública | Mensaje entrante dispara respuesta |
| `META_APP_ID` | App Meta | Facebook/Instagram/Ads | Meta Developers | Web Service | Pública | App existe y permisos listos |
| `META_APP_SECRET` | Firma/seguridad app | Meta | Meta Developers | Web Service | Secreta | Validar app secret proof |
| `META_PAGE_ACCESS_TOKEN` | Página FB/IG | Publicación/mensajes | Meta Graph API | Web Service | Secreta | Leer página autorizada |
| `META_AD_ACCOUNT_ID` | Cuenta anuncios | Meta Ads | Ads Manager | Web Service | Pública sensible | Leer cuenta publicitaria |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | IG business | Instagram | Meta Graph API | Web Service | Pública sensible | Leer perfil business |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | API Ads | Google Ads | Google Ads API Center | Web Service | Secreta | Leer customer accesible |
| `GOOGLE_ADS_CLIENT_ID` | OAuth Google | Google Ads/YouTube | Google Cloud Console | Web Service | Pública sensible | OAuth inicia correctamente |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth secreto | Google Ads | Google Cloud Console | Web Service | Secreta | Refresh token funciona |
| `GOOGLE_ADS_REFRESH_TOKEN` | Renovación OAuth | Google Ads | Flujo OAuth autorizado | Web Service | Secreta | Obtener access token |
| `GOOGLE_ADS_CUSTOMER_ID` | Cuenta anunciante | Google Ads | Google Ads | Web Service | Pública sensible | Leer campañas |
| `YOUTUBE_API_KEY` | Lecturas YouTube | YouTube | Google Cloud Console | Web Service | Secreta | Leer canal/cuota |
| `YOUTUBE_CHANNEL_ID` | Canal autorizado | YouTube | YouTube Studio | Web Service | Pública | Consultar metadatos canal |
| `IMAGE_GENERATION_PROVIDER` | Proveedor imagen | Creativos IA | OpenAI/otro proveedor | Web/Worker | Pública | Estado proveedor configurado |
| `IMAGE_GENERATION_API_KEY` | API imagen | Flyers/carruseles | Proveedor IA | Web/Worker | Secreta | Crear asset de prueba no público |
| `VIDEO_GENERATION_PROVIDER` | Proveedor video | Videos 30-60s | Proveedor IA | Web/Worker | Pública | Estado proveedor configurado |
| `VIDEO_GENERATION_API_KEY` | API video | Videos IA | Proveedor IA | Web/Worker | Secreta | Crear job de prueba no público |
| `PAYMENT_PROVIDER` | Pasarela cobros | Pagos | Azul/CardNet/Stripe/etc. | Web Service | Pública | Endpoint estado |
| `PAYMENT_PUBLIC_KEY` | Clave pública pagos | Checkout | Proveedor pagos | Web Service | Pública | Crear intento pago sandbox |
| `PAYMENT_SECRET_KEY` | Clave secreta pagos | Confirmación pagos | Proveedor pagos | Web Service | Secreta | Validar pago sandbox |
| `PAYMENT_WEBHOOK_SECRET` | Firma webhook pagos | Pagos | Proveedor pagos | Web Service | Secreta | Firma webhook válida |
| `AD_PAYMENT_PROVIDER` | Tarjeta pauta | Pago campañas | Proveedor/tokenizador | Web Service | Pública | Token de tarjeta existe |
| `AD_PAYMENT_SECRET_KEY` | Token secreto pauta | Gasto Ads | Proveedor/tokenizador | Web Service | Secreta | Validar token sin cargo real |
| `AD_PAYMENT_WEBHOOK_SECRET` | Webhook pauta | Gasto Ads | Proveedor/tokenizador | Web Service | Secreta | Firma webhook válida |
| `META_ADS_BILLING_ACCOUNT_ID` | Billing Meta | Meta Ads | Business Manager | Web Service | Pública sensible | Cuenta billing asociada |
| `GOOGLE_ADS_BILLING_SETUP_ID` | Billing Google | Google Ads | Google Ads billing | Web Service | Pública sensible | Billing setup válido |
| `DGII_ECF_ENVIRONMENT` | Ambiente fiscal | e-CF | DGII/proveedor | Web Service | Pública | `certification` o `production` |
| `DGII_ECF_CERTIFICATE_PATH` | Certificado firma | e-CF | Secret File Render | Web Service | Secreta por archivo | Archivo existe y se lee |
| `DGII_ECF_CERTIFICATE_PASSWORD` | Clave certificado | e-CF | Certificado digital | Web Service | Secreta | Abrir certificado |
| `DGII_ECF_ISSUER_RNC` | RNC emisor | e-CF | Empresa | Web Service | Pública sensible | Validar formato RNC |
| `DGII_ECF_PROVIDER_API_KEY` | Proveedor e-CF | e-CF | Proveedor autorizado | Web Service | Secreta | Ping/estado proveedor |
| `OWNER_NOTIFICATION_WHATSAPP` | Avisos dueño | Escalamiento | Número dueño | Web Service | Pública sensible | Enviar aviso autorizado |
| `OWNER_NOTIFICATION_EMAIL` | Avisos dueño | Escalamiento | Correo dueño | Web Service | Pública sensible | Enviar correo autorizado |

Después de guardar variables en Render:

1. Presiona **Save Changes**.
2. Ejecuta **Manual Deploy > Deploy latest commit**.
3. Abre `/api/health`.
4. Abre `/api/integrations/status`.
5. Abre `/api/agents/runtime/manifest`.
6. En el CRM, pulsa **Revisar estado** dentro de Multiempresa & Seguridad.

No marques una integración como operativa solo porque exista una clave. Debe superar
una prueba de lectura o escritura autorizada según la operación.
