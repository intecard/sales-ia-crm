# Sales AI CRM Enterprise

CRM comercial SaaS multiempresa para ventas, marketing, atencion omnicanal, agentes IA 24/7, cobros, facturacion electronica, auditoria e integraciones externas.

INTECA SRL queda configurada como empresa principal con licencia gratis permanente, pero el CRM esta disenado para vender licencias a cualquier tipo de negocio.

## Que incluye

- Dashboard ejecutivo comercial.
- Leads CRM 360 con embudo completo.
- Agentes IA autonomos de ventas, marketing, publicidad, embudos, prospeccion, WhatsApp, creativos, video, facturacion, lanzamientos y operaciones.
- Chat Sales Studio con respuesta IA usando Gemini cuando `GEMINI_API_KEY` esta configurada.
- Catalogo de productos, servicios y cursos.
- Embudos y workflows.
- IA Marketing & Ads para Meta, Google, YouTube, WhatsApp, email y campanas omnicanal.
- Cabina Marketing, Ads & Ventas para preparar nicho, ventaja injusta, oferta, anuncios, embudo maestro, guiones, objeciones, KPIs y escala.
- Operacion Autonoma con conectores preparados para redes, anuncios, pagos y e-CF.
- Pasarelas & Facturacion con cotizaciones, pagos, comprobantes y facturas e-CF.
- Facturacion electronica e-CF completa con encabezado fiscal, e-NCF, detalle comercial, impuestos, XML, PDF, firma digital y QR.
- Contabilidad Autonoma con agente IA para estados financieros, compras, recibos, conciliacion bancaria e inventario diario.
- Auditoria & Historial para registrar acciones del sistema, usuarios, agentes, webhooks e integraciones.
- Multiempresa, roles y licencia gratis permanente para INTECA.
- Webhooks listos para WhatsApp Cloud API, Meta Lead Ads, Google Ads, YouTube, formularios web, pagos y DGII/e-CF.

## Modos incluidos

El mismo proyecto trae dos modos:

- `production`: version original/real para operar y conectar plataformas externas.
- `trial`: version de prueba segura para ensayar campanas, agentes, cobros y datos sin afectar operacion real.

Render debe quedar asi para la version real:

```env
DEPLOYMENT_MODE=production
VITE_DEPLOYMENT_MODE=production
NODE_ENV=production
```

Para prueba controlada:

```env
DEPLOYMENT_MODE=trial
VITE_DEPLOYMENT_MODE=trial
NODE_ENV=production
```

## Desarrollo local

Requisitos:

- Node.js 22 LTS o compatible.
- Git.
- Cuenta de Gemini si quieres probar IA real.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Build de produccion

```bash
npm run typecheck
npm run build
npm start
```

## Render

Build Command:

```bash
npm ci && npm run build
```

Start Command:

```bash
node dist/server.cjs
```

No uses `seed.cjs` en el Start Command. Si necesitas datos iniciales reales, debes cargarlos una sola vez desde un script controlado o desde la base de datos.

## Variables minimas en Render

```env
NODE_ENV=production
DEPLOYMENT_MODE=production
VITE_DEPLOYMENT_MODE=production
PORT=10000
APP_URL=https://sales.ia.crm.inteca.com.do
APP_SECRET=usa_un_valor_largo_y_privado
GEMINI_API_KEY=tu_clave_gemini
GEMINI_MODEL=gemini-3.6-flash
META_WEBHOOK_VERIFY_TOKEN=sales_ai_crm_whatsapp_verify_2026
```

## Webhooks principales

Usa tu dominio real delante de cada ruta:

```text
/api/webhooks/meta/whatsapp
/api/webhooks/meta/leadgen
/api/webhooks/google-ads/leads
/api/webhooks/youtube/events
/api/webhooks/web/forms
/api/webhooks/payments
/api/webhooks/dgii/ecf-status
/api/audit/events
/api/ai/generate-growth-system
/api/ai/generate-ecf-invoice
/api/ai/generate-accounting-report
/api/health
/api/runtime/config
```

Ejemplo WhatsApp Cloud API:

```text
https://sales.ia.crm.inteca.com.do/api/webhooks/meta/whatsapp
```

Evento a suscribir en Meta:

```text
messages
```

## Estado de integraciones

El CRM queda listo para conectar plataformas externas. Sin credenciales oficiales, el sistema muestra los modulos, rutas, agentes y flujos, pero no puede publicar anuncios, enviar WhatsApp real, cobrar tarjetas ni emitir e-CF ante DGII.

Eso no es un fallo del CRM: esas acciones requieren tokens, permisos, certificados, proveedores y aprobaciones externas.

## Comandos utiles

```bash
npm run typecheck
npm run lint
npm run build
npm run check
```

## Estructura principal

```text
src/
  components/
  data/
  types.ts
server.ts
.env.example
Dockerfile
render.yaml
docs/
```

## Seguridad operativa

- No subir `.env.local` a GitHub.
- No poner tokens reales dentro del codigo.
- Usar variables de entorno en Render.
- Validar pagos antes de marcar cliente activo.
- Aprobar testimonios, cambios de precio y publicaciones institucionales antes de activar campanas.
- Revisar `Auditoria & Historial` para ver acciones del CRM y agentes.
