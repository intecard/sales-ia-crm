# Catálogo académico de WhatsApp

Fuente de cursos: https://cldqyiyecxeagnzlylwr.supabase.co/storage/v1/object/public/knowledge-base/Catalogo_Academico_INTECA_2026.txt

El servidor descarga el TXT público, sin credenciales de Storage, al arrancar y vuelve a consultarlo con el siguiente mensaje si han pasado 60 segundos. Reemplazar el archivo en la misma ruta actualiza las respuestas sin desplegar de nuevo. Una consulta con versión evita reutilizar la anterior copia del CDN. No se ejecutan instrucciones del documento.

El formato mantiene encabezados numerados de cursos, campos `Duración:`, `Modalidad:`, `Inversión:` y `Horario:`, y la sección `Horarios de clases`. Los campos y horarios comunes se extraen directamente para las consultas habituales. Enfermería usa su excepción específica. Duraciones pendientes, modalidades según apertura y disponibilidad de grupos se comunican sin asumir datos. Las preguntas adicionales reciben el catálogo completo, sin las antiguas guías locales contradictorias.

La caché es de 60 segundos y las descargas tienen un límite de 8 segundos / 180 KB. Si una actualización falla, el agente evita citar precios antiguos y comunica que no puede consultar los datos actuales. Se reintenta después de 10 segundos. La memoria del contacto continúa en Supabase, separada de esta caché del catálogo.

## Pagos

El TXT revisado el 19 de octubre no contiene métodos de pago ni cuentas. El servidor utiliza únicamente la variable privada `WHATSAPP_PAYMENT_INSTRUCTIONS` como fuente alternativa de pagos. Las cuentas y los identificadores personales no se incluyen en el código público. Si no hay instrucciones configuradas, se solicita confirmarlas con INTECA. No se afirma que esas cuentas procedan del TXT. El importe de inscripción se extrae del catálogo; si no puede confirmarse, se pide confirmarlo antes de transferir.

Para administrar también los métodos de pago desde el TXT, añadir al final una sección claramente titulada `Métodos de pago` con las instrucciones oficiales completas. Esta sección tiene prioridad sobre la configuración del CRM. No incluir contraseñas ni claves: el archivo es público. Un recibo nunca confirma automáticamente el abono o la matrícula; se mantienen las verificaciones existentes.

## Verificación

`GET /api/knowledge/inteca/status` consulta el archivo y devuelve `whatsAppCatalog`: URL, fecha de consulta, SHA-256, cantidad de programas, fuente de pagos y errores. `GET /api/health` muestra el mismo estado sin bloquear el control de salud con una descarga.

`npm run test:whatsapp` comprueba actualización, fallos, instrucciones de pago, diferencias entre programas y conservación de contexto. Todas las llamadas a proveedores en las pruebas están simuladas; no se envían mensajes a clientes.
