# Implementaciones incluidas

## Agentes IA

- Director comercial y estrategia.
- Closer de ventas 24/7.
- Agente de conversion y matricula para registrar leads, validar inscripcion, convertir a estudiante y enviar bienvenida/campus.
- Agente WhatsApp instantaneo.
- Agente de adquisicion y pauta.
- Agente de embudos y conversion.
- Agente growth strategist para nicho, ventaja injusta y oferta obvia.
- Agente media buyer para Meta Ads, Google Ads, YouTube y retargeting.
- Agente SDR para prospeccion, calificacion, seguimiento y agenda.
- Agente closer elite para objeciones, negociacion, pagos y cierre.
- Agente CRO analytics para auditoria de embudo, pruebas A/B y escala.
- Agente de creativos para flyers.
- Agente de videos 30 a 60 segundos.
- Agente de facturacion, cobros y e-CF.
- Agente contable autonomo para estados financieros, compras, recibos, conciliaciones e inventario.
- Agente de lanzamientos y relanzamientos.
- Agente de operaciones y notificaciones al dueno.

## Marketing y ventas

- Adquisicion: trafico desde Meta, Google, YouTube, WhatsApp y web.
- Conversion: embudos, respuestas, objeciones, cotizaciones y pagos.
- Aceleracion: campanas validadas, nuevos mercados, relanzamientos y optimizacion.
- Ventaja injusta: experiencia de INTECA en ARS, autorizaciones, call center, formacion y CRM.
- Copy para explicar que hace cada tecnico, que aprendera el estudiante y como mejora su oportunidad laboral.
- Cabina especializada Marketing, Ads & Ventas con configuracion de nicho, propuesta de valor, cuello de botella, pauta, meta de ventas y tasa de cierre.
- Embudo maestro: anuncio/flyer/short -> WhatsApp/landing -> diagnostico -> prueba de valor -> oferta -> pago -> onboarding -> referidos.
- Arsenal tactico: investigacion de mercado, oferta irresistible, publicidad agresiva, embudo completo, ventas optimizadas y analitica de escala.
- Generador IA de sistema comercial completo con endpoint `/api/ai/generate-growth-system`.
- Las metas de 5 ventas diarias, 80% de exito o ROAS objetivo se tratan como objetivos operativos medibles, no como garantias automaticas.

## CRM comercial

- Acceso real protegido por usuario y contrasena.
- Boton separado para entrar y salir de la version demo.
- Cierre de sesion real y salida de demo desde el encabezado.
- Tema claro/oscuro persistente en login y dentro del CRM.
- Leads CRM 360.
- Chat Sales Studio.
- Productos / servicios.
- Embudos & workflows.
- Cotizaciones.
- Pagos.
- Facturas e-CF.
- Seguimiento.
- Analitica predictiva.
- Auditoria & historial.
- Multiempresa y roles.
- Licencia INTECA gratis permanente.

## Conversion, matricula y campus

- Registro autonomo de leads desde WhatsApp, formulario web, Meta Ads, Google Ads, API o carga manual.
- Normalizacion de datos: nombre, telefono, WhatsApp, correo, curso, fuente, campana y mensaje inicial.
- Calificacion del lead, deteccion de campos faltantes y seguimiento inmediato.
- Boton en Chat Sales Studio para validar inscripcion y enviar bienvenida.
- Al confirmar pago de inscripcion, el lead pasa a estudiante activo con estado `Ganado`.
- Generacion de codigo de estudiante, usuario de campus, clave temporal, codigo del curso y mensaje de bienvenida.
- Panel de campus dentro del modal del lead para revisar credenciales, estado y seguimiento academico.
- Endpoint operativo: `/api/agents/conversion/process-lead`.
- Endpoint de consulta: `/api/agents/conversion/leads`.
- Si falta API real del campus, el CRM deja credenciales provisionales y estado pendiente de sincronizacion externa.

## Integraciones listas para conectar

- WhatsApp Cloud API.
- Facebook / Instagram / Meta Lead Ads.
- Google Ads.
- YouTube.
- Formularios web.
- Pasarelas de pago.
- Campus Virtual INTECA / LMS.
- DGII / proveedor de facturacion electronica.
- Notificaciones al dueno por WhatsApp/email cuando existan credenciales.

## Auditoria

El CRM registra:

- Acciones de usuarios.
- Acciones de agentes IA.
- Mensajes recibidos.
- Respuestas generadas.
- Leads creados o actualizados.
- Campanas generadas.
- Pagos creados o validados.
- Eventos de webhook.
- Errores criticos.

## Facturacion electronica e-CF completa

El modulo de facturacion electronica incluye:

- Encabezado fiscal: emisor, receptor, RNC, direccion fiscal y fecha de emision.
- Numero e-CF / e-NCF segun tipo de comprobante.
- Detalle comercial: cantidad, descripcion, precio unitario, descuentos, ITBIS y total.
- Impuestos desglosados: montos gravados, exentos, ITBIS, ISC, otros cargos y total general.
- XML oficial preparado para proveedor e-CF.
- Representacion PDF para el cliente.
- Firma digital como estado controlado pendiente de certificado cuando no este conectado.
- Codigo QR con payload y URL de verificacion.
- Auditoria fiscal de cada paso.
- Endpoint IA: `/api/ai/generate-ecf-invoice`.

## Contabilidad autonoma

El modulo contable incluye:

- Estado de resultados: ingresos, costos, gastos y utilidad.
- Balance general / Estado de Situacion Financiera con activos, pasivos y patrimonio.
- Estado de flujo de efectivo: entradas, salidas y flujo neto.
- Orden o solicitud de compra.
- Recibo de caja o ingreso.
- Formulario de conciliacion bancaria.
- Reporte de inventario diario.
- Referencia NIF B-6 para Estado de Situacion Financiera.
- Referencia NIF B-7 para adquisiciones de negocios.
- Endpoint IA: `/api/ai/generate-accounting-report`.

## Lo que requiere credenciales externas

El ZIP queda funcional como aplicacion. Para operar con plataformas reales necesitas conectar:

- Tokens de Meta/WhatsApp.
- Permisos de Meta Lead Ads.
- Credenciales Google Ads/YouTube.
- Gemini API Key.
- Pasarela de pago.
- Certificado/proveedor DGII e-CF.
- Correo o proveedor de notificaciones.
