# Conectar mensajería y pagos — v0.4.0

## WhatsApp de INTECA

Número confirmado por Luis: **+1 809-643-5502**. Enlace directo: https://wa.me/18096435502.
El enlace abre una conversación; no autoriza el acceso de la IA. El identificador numérico solicitado por Meta es el ID del número en WhatsApp Business Platform, distinto del teléfono.

## Mensajería

Los conectores implementan recepción de webhooks firmados, almacenamiento por empresa, deduplicación por ID de mensaje y respuestas de texto por las APIs de WhatsApp Business, Facebook Messenger e Instagram profesional (Instagram Login). Necesitan validación con una cuenta real; no se han conectado cuentas del propietario durante el desarrollo.

1. Alojar la aplicación en un servidor HTTPS accesible continuamente. `localhost:3000` solo es accesible en su computadora. Configurar APP_URL con el dominio del servidor y un proxy HTTPS; no exponer PostgreSQL.
2. Preparar en Meta la aplicación, cuenta empresarial, permisos y revisión que correspondan al canal. Deben configurarse allí las suscripciones a mensajes y la autorización de la cuenta. No existe inicio de sesión OAuth automático en esta versión: el administrador introduce los tokens obtenidos en Meta.
3. Crear un agente en Agentes IA y configurar Gemini. Cargar productos, precios, políticas y límites en el CRM.
4. En Integraciones elegir WhatsApp, Facebook o Instagram. Introducir token de acceso, secreto de aplicación, token propio de verificación (16 caracteres o más), ID de cuenta y versión Graph API habilitada en Meta. No usar el teléfono como ID. Para Instagram usar credenciales de Instagram Login, no mezclar los tipos de acceso.
5. Configurar el callback en Meta: `https://su-dominio/api/channels/ID_EMPRESA/WHATSAPP`, sustituyendo WHATSAPP por FACEBOOK o INSTAGRAM cuando corresponda. ID_EMPRESA se ve en Licencia & Plan. El token de verificación debe coincidir.
6. Mantener desactivada la respuesta automática durante la primera prueba. Enviar un mensaje desde una cuenta propia de prueba. Revisar Chat Sales Studio, el evento recibido y el registro en Meta.
7. Probar un borrador de texto mediante Enviar al canal conectado. El envío requiere confirmación. Un estado Aceptado significa que el proveedor lo aceptó, no que el destinatario lo haya leído o recibido.
8. Después de comprobar recepción y envío, volver a configurar el canal seleccionando el agente y autorizando respuestas automáticas. Al editar se solicitan de nuevo los secretos para no devolverlos al navegador. La interfaz indica si la automatización está autorizada.
9. Usar Tomar conversación para pasar a atención humana. Permitir agente automático reabre la conversación para mensajes nuevos; no reprocesa mensajes anteriores.

La cola se procesa mientras el servidor funciona. No hay promesa de atender todos los formatos: texto automático; audios, imágenes y documentos requieren revisión humana. No se envían respuestas a ecos del propio canal. Las respuestas se limitan conservadoramente a las primeras 23 horas desde el mensaje entrante. No se implementan plantillas fuera de ventana, comentarios públicos, grupos, llamadas, transcripción ni mensajes masivos.

Si un envío tiene resultado incierto, no se reintenta automáticamente, para evitar duplicados. Consultar la plataforma antes de enviar otro mensaje. El estado de cada evento se muestra en el chat. Cada empresa tiene un límite diario de IA social igual al valor configurado en Vendedor IA & Web; web y redes cuentan por separado, por lo que el máximo conjunto puede ser el doble. Los intentos fallidos también consumen cuota. Esto es un límite de solicitudes, no un presupuesto monetario garantizado.

No se han publicado anuncios. Meta Ads y Google Ads siguen pendientes de conectores de campañas, permisos, presupuestos y pruebas.

## Cobros con enlaces y transferencias

1. En Medios de pago añadir los enlaces HTTPS de checkout de los proveedores elegidos y/o banco, titular, cuenta, tipo y moneda.
2. Crear una Solicitud de pago con importe, concepto y vencimiento.
3. Compartir su enlace privado con el cliente. En Internet requiere el dominio público HTTPS; un enlace localhost no funciona en el teléfono del cliente.
4. El cliente ve los datos y paga en la plataforma externa o en su banco. El CRM no recibe ni almacena tarjetas, CVV ni claves bancarias.
5. El cliente adjunta PDF, PNG o JPG de hasta 5 MB y su referencia. El estado cambia a Comprobante recibido, pendiente de revisión.
6. La empresa verifica el abono directamente en su banco o plataforma y confirma, rechaza o cancela la solicitud. Confirmar crea un solo cobro; subir una imagen no lo crea. El comprobante solo es descargable por usuarios con permiso de pagos.

Los enlaces de tarjeta son configurados manualmente; esta versión no crea automáticamente una sesión de pago con importe exacto ni reconcilia webhooks de Stripe, PayPal, Azul u otros. El comprobante interno no sustituye una factura fiscal. Los archivos se descargan como adjuntos y no tienen escaneo antivirus incorporado.
