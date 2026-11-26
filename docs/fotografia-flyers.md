# Fotos originales en el calendario de INTECA

El calendario crea dos piezas al día: Autorizaciones Médicas a las 9:00 y otro curso a las 17:00 (Santo Domingo). Cada pieza tiene una foto original para Facebook e Instagram. El renderizador añade la marca, el gancho educativo, los datos oficiales y el WhatsApp comercial. No se consulta el CRM de clientes para preparar la imagen.

En el servidor, `CM_FLYER_PHOTOGRAPHY_ENABLED=true` habilita la función después de aplicar la migración de fotos y confirmar el costo con Dirección. La integración usa `CM_FLYER_IMAGE_API_KEY`, si existe, y de lo contrario `GEMINI_API_KEY`. La clave debe admitir el modelo `gemini-3.1-flash-lite-image` con facturación habilitada. Configurar las claves en el entorno del servidor, fuera del historial del repositorio. El panel del Community Manager indica si la función está activada y si la clave está configurada. Esto no confirma que el proveedor haya aceptado un pedido.

Supabase permite un máximo de una solicitud por horario y día, incluso tras reiniciar el servicio o cambiar de catálogo. Se compara cada nueva foto con el historial y se bloquea la publicación si es demasiado similar. Una solicitud incierta no se repite automáticamente. Si falla el proveedor, el flyer afectado queda bloqueado con su código; no usa una foto vieja como reemplazo. Las piezas ya preparadas conservan su archivo. Activar entre ventanas de publicación para que la transición aplique a la próxima pieza. Los reels y el contenido de video conservan su proceso.

Para volver al arte ilustrado, desactivar `CM_FLYER_PHOTOGRAPHY_ENABLED` en Render. Esto no modifica los archivos ni reprograma publicaciones anteriores. El asistente de Dirección y el agente de ventas de WhatsApp son flujos separados y no dependen de esta función.
