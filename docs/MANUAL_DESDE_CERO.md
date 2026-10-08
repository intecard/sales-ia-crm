# Manual desde cero: Sales AI CRM Enterprise

Este manual deja el CRM listo para subirlo a GitHub, desplegarlo en Render y conectar las plataformas externas.

## 1. Preparar la carpeta local

1. Descomprime el ZIP.
2. Abre la carpeta en Visual Studio Code.
3. Abre una terminal dentro de la carpeta.
4. Ejecuta:

```bash
npm install
npm run typecheck
npm run build
```

Si esos comandos pasan, la fuente esta correcta.

## 2. Crear el repositorio en GitHub

Si vas a reemplazar el repositorio actual:

```bash
git init
git add .
git commit -m "Release Sales AI CRM Enterprise definitive"
git branch -M main
git remote add origin https://github.com/intecard/sales-ia-crm.git
git push -u origin main --force-with-lease
```

Si no quieres reemplazar historial, crea un repositorio nuevo y usa su URL.

## 3. Configurar Render

En Render crea o edita el servicio web:

| Campo | Valor |
| --- | --- |
| Runtime | Node |
| Branch | main |
| Build Command | `npm ci && npm run build` |
| Start Command | `node dist/server.cjs` |
| Health Check Path | `/api/health` |

No pongas `seed.cjs` en el Start Command.

## 4. Variables de entorno obligatorias

```env
NODE_ENV=production
DEPLOYMENT_MODE=production
VITE_DEPLOYMENT_MODE=production
PORT=10000
APP_URL=https://sales.ia.crm.inteca.com.do
APP_SECRET=usa_un_valor_largo_y_privado
GEMINI_API_KEY=tu_clave_gemini
GEMINI_MODEL=gemini-3.5-flash
META_WEBHOOK_VERIFY_TOKEN=sales_ai_crm_whatsapp_verify_2026
ADMIN_EMAIL=admin@inteca.com.do
ADMIN_PASSWORD=usa_una_contrasena_privada_y_larga
ADMIN_NAME=Admin General
ADMIN_ORGANIZATION=INTECA SRL
```

`ADMIN_EMAIL` y `ADMIN_PASSWORD` son los datos para entrar a la version real.
La demo no usa esas credenciales; se entra desde el boton **Entrar como demo**.

## 5. WhatsApp Cloud API en Meta

1. En Meta Developers entra a tu app.
2. Ve a WhatsApp > Configuration.
3. Callback URL:

```text
https://sales.ia.crm.inteca.com.do/api/webhooks/meta/whatsapp
```

4. Verify Token:

```text
sales_ai_crm_whatsapp_verify_2026
```

5. Guarda.
6. En suscripciones marca:

```text
messages
```

7. Luego agrega en Render:

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

## 6. Meta Lead Ads, Facebook e Instagram

Webhook:

```text
https://sales.ia.crm.inteca.com.do/api/webhooks/meta/leadgen
```

Variables:

```env
META_APP_ID=
META_APP_SECRET=
META_PAGE_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
```

## 7. Google Ads y YouTube

Google Ads:

```text
https://sales.ia.crm.inteca.com.do/api/webhooks/google-ads/leads
```

YouTube:

```text
https://sales.ia.crm.inteca.com.do/api/webhooks/youtube/events
```

Variables:

```env
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
YOUTUBE_API_KEY=
YOUTUBE_CHANNEL_ID=
```

## 8. Pagos y facturacion electronica

Webhook pagos:

```text
https://sales.ia.crm.inteca.com.do/api/webhooks/payments
```

Webhook DGII / proveedor e-CF:

```text
https://sales.ia.crm.inteca.com.do/api/webhooks/dgii/ecf-status
```

Variables:

```env
PAYMENT_PROVIDER=
PAYMENT_PUBLIC_KEY=
PAYMENT_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=
DGII_ECF_ENVIRONMENT=production
DGII_ECF_CERTIFICATE_PATH=
DGII_ECF_CERTIFICATE_PASSWORD=
DGII_ECF_ISSUER_RNC=
DGII_ECF_PROVIDER_API_KEY=
```

## 9. Campus virtual INTECA y agente de conversion

El agente de conversion registra leads y, cuando el pago de inscripcion queda confirmado, genera bienvenida y credenciales del campus. Agrega estas variables en Render:

```env
INTECA_CAMPUS_BASE_URL=https://campus.inteca.com.do
INTECA_CAMPUS_API_KEY=
INTECA_CAMPUS_DEFAULT_ROLE=student
INTECA_CAMPUS_WELCOME_TEMPLATE_ID=inteca_welcome_default
VITE_INTECA_CAMPUS_URL=https://campus.inteca.com.do
```

Endpoint para registrar un lead:

```text
https://sales.ia.crm.inteca.com.do/api/agents/conversion/process-lead
```

Ejemplo minimo:

```json
{
  "fullName": "Nombre del prospecto",
  "whatsapp": "8090000000",
  "email": "correo@ejemplo.com",
  "courseTitle": "Técnico en Autorizaciones Médicas",
  "source": "WhatsApp"
}
```

Ejemplo cuando ya pago la inscripcion:

```json
{
  "fullName": "Nombre del estudiante",
  "whatsapp": "8090000000",
  "email": "correo@ejemplo.com",
  "courseTitle": "Técnico en Autorizaciones Médicas",
  "source": "Pasarela de pago",
  "paymentConfirmed": true,
  "paymentAmount": 2500,
  "paymentTransactionId": "referencia_real_del_pago"
}
```

Si `INTECA_CAMPUS_API_KEY` esta vacia, el CRM prepara credenciales provisionales y deja la sincronizacion del campus como pendiente de revision humana.

## 10. Verificacion

Abre:

```text
https://sales.ia.crm.inteca.com.do/api/health
https://sales.ia.crm.inteca.com.do/api/runtime/config
```

Endpoints IA internos para los nuevos agentes:

```text
https://sales.ia.crm.inteca.com.do/api/auth/login
https://sales.ia.crm.inteca.com.do/api/auth/logout
https://sales.ia.crm.inteca.com.do/api/ai/generate-growth-system
https://sales.ia.crm.inteca.com.do/api/ai/generate-ecf-invoice
https://sales.ia.crm.inteca.com.do/api/ai/generate-accounting-report
https://sales.ia.crm.inteca.com.do/api/agents/conversion/leads
```

Luego entra al CRM:

```text
https://sales.ia.crm.inteca.com.do
```

Debe verse como version original/produccion. Si quieres prueba segura:

```env
DEPLOYMENT_MODE=trial
VITE_DEPLOYMENT_MODE=trial
```

Despues vuelve a `production`.
