# INTECA — Pasarela de pago con tarjeta preparada antes de contratar (28/10/2026)

## Qué queda implementado

Se integró al módulo **Pasarelas & Facturación** una sección nueva:
"Pasarela de tarjetas · Preparada para contratación", exclusivamente para la empresa INTECA.
La implementación no reemplaza la validación bancaria ni modifica `crm_sales_payments`
o la matrícula de alumnos. Es un módulo nuevo de solicitudes que permanecerá **inactivo para
cobros** hasta contratar, verificar y certificar una pasarela.

- Preparación de solicitudes exclusivamente desde una oportunidad comercial existente con
  `expected_amount` establecido y el curso guardado en Supabase.
- Montos expresados en centavos (`amount_minor`) con moneda fija **DOP**.
- RPC atómica `crm_gateway_prepare_order`: bloquea fila del lead, vuelve a usar la misma solicitud
  si cotización y curso no cambiaron y anula el enlace anterior si cambian.
- Páginas de estudiante `https://sales.ia.crm.inteca.com.do/pagar/<token_firmado>`.
- URLs firmadas por HMAC-SHA256 con `PAYMENT_LINK_SECRET`, protegidas ante modificaciones.
- Vigencia limitada (14 días); al vencer, la solicitud queda informativa e inhabilitada.
- Página de pago visual, importe/carrera reales, contacto WhatsApp institucional **809-643-5502**.
  No se pide número de tarjeta, CVV, NIP, PIN ni contraseña bancaria.
- API pública para consultar estado sin divulgar nombre, teléfono, correo ni identificador del lead.
- Rutas de comienzo de pago y callbacks **deliberadamente bloqueadas** con HTTP 503 mientras
  no exista un contrato, un adaptador oficial, firma validada y pruebas de certificación.
- RLS de Supabase y acceso a las tablas solo con `service_role` desde el backend.

La etiqueta actual es **"Pagos con tarjeta no habilitados"**; nunca declarar "ya se puede pagar"
hasta haber contratado el servicio y ejecutado una transacción de prueba completa.

## Preparación actual en Render

Agregar de manera privada:
- `PAYMENT_LINK_SECRET`: secreto aleatorio de al menos 32 caracteres, independiente de otras APIs.
- `APP_URL=https://sales.ia.crm.inteca.com.do`.
- `PAYMENT_PROVIDER`, `PAYMENT_PUBLIC_KEY`, `PAYMENT_SECRET_KEY`,
  `PAYMENT_WEBHOOK_SECRET`: dejar vacías hasta obtener credenciales legítimas y documentación
  específica del proveedor. **No** completar con valores inventados.
- No conectar tarjetas de publicidad a este módulo: son flujos de gasto saliente distintos.
- Mantener las variables fuera de `VITE_*` y nunca introducirlas en código GitHub.

## Proveedores por seleccionar

**AZUL** tiene una modalidad de **Página de Pagos alojada**: el cliente es enviado al sitio
del proveedor y los datos de tarjeta se capturan allí, no en INTECA.
La documentación pública contempla pruebas/certificación previa a producción:
https://dev.azul.com.do/Pages/developer/pages/lib/index.aspx

**CardNET** publica documentación de su **Botón de Pago** web:
https://developers.cardnet.com.do/guias/boton-de-pago/

Este repositorio **todavía no incluye los adaptadores de cobro de AZUL ni CardNET**, dado que no
se ha seleccionado proveedor ni recibido el conjunto de campos, endpoints autorizados,
credenciales, certificados y reglas definitivas del contrato. No se debe intentar usar
un endpoint inventado o capturar tarjetas directamente desde el CRM.

## Activación una vez contratada

1. Elegir AZUL o CardNET, contratar cuenta de comercio electrónico y conseguir ID de comercio,
   terminal/perfil y credenciales reales para **pruebas**.
2. Implementar y revisar el adaptador del proveedor elegido usando **documentación oficial del
   contrato**, preferiblemente hosted checkout; no captar PAN ni CVV en la infraestructura de INTECA.
3. Configurar sandbox y retorno/callbacks HTTPS; validar origen, firma, identidad del comercio,
   idempotencia, monto exacto, moneda DOP, pago rechazado, pagos duplicados y refund.
4. Autorizar en Supabase `checkout_enabled` **solo después** de certificación de sandbox,
   credenciales de producción y el adaptador revisado; por defecto permanece falso.
5. Nunca confiar solo en el enlace de retorno del navegador. Confirmar transacciones con webhook
   criptográficamente verificado **y/o** consulta server-to-server de conciliación.
6. Solo una confirmación verificable puede originar el registro financiero y la matrícula.
   El procedimiento actual de validación por comprobante bancario es diferente y sigue intacto.
7. Verificar una compra de prueba aceptada/rechazada con proveedor y su reflejo contable;
   habilitar la opción pública de pago con tarjeta, revisar políticas de privacidad/reembolso
   y comunicación de condiciones al estudiante.

## Rutas preparadas

Autenticación CRM administrador bajo `/api/sales/gateway`:
- `GET /status`: contrato, sandbox, disponibilidad, sin exponer secretos.
- `GET /eligible`: oportunidades comerciales con cotización ya registrada.
- `GET /orders`: solicitudes recientes y enlaces firmados, únicamente administrador.
- `POST /orders`: `{"contactKey":"...","provider":"unselected"|"azul"|"cardnet"}`
  con cabecera `X-CRM-Action: sales`. No acepta monto desde el cliente.

Públicas bajo `/api/payments/checkout` (rate limit):
- `GET /:token`: curso, importe DOP, estado y aviso informativo, sin PII.
- `POST /:token/start`: error `GATEWAY_CONTRACT_REQUIRED` hasta integrar adaptador oficial.
- `POST /callbacks/azul`, `POST /callbacks/cardnet`: no aceptan confirmaciones antes
  de certificación. No registrar pagos por peticiones ajenas o URLs de retorno.

## Pruebas

`payment-gateway-precontract.test.ts` verifica firma HMAC, rechazo de enlaces falsos,
importe servidor, anonimización de la vista pública, expiración, rechazo de cobros sin contrato
**incluso si accidentalmente se configuran variables de pagos** y ausencia de actividad
sin secreto firmado. Las migraciones no alteran transacciones ni estudiantes existentes.
