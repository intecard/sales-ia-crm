# Supabase del CRM de INTECA

Producción: proyecto `sales-ai-crm-inteca` (`cldqyiyecxeagnzlylwr`), conectado a Render.
El CRM usa sesiones propias; las operaciones de base de datos pasan por el servidor. Nunca incluir la clave de servidor en variables del frontend ni en una exportación compartida.

## Acceso y comprobaciones

- Mantener RLS activado en las tablas. Las tablas internas y secuencias no requieren permisos de Data API para `anon` o `authenticated`. Si una integración futura necesita acceso directo, otorgar el permiso mínimo junto con una política explícita.
- `crm-community` y `knowledge-base` son públicos por diseño: las redes sociales consultan los medios y el servidor consulta el catálogo. Recibos, referencia local y videos de revisión están en buckets privados.
- Comprobar [estado del CRM](https://sales.ia.crm.inteca.com.do/api/health), acceso de servidor a `crm_whatsapp_memory` y configuración de los trabajos de publicación. El estado saludable no acredita por sí solo que una red publicó una pieza: revisar los trabajos del calendario.
- Siete cron de producción activan el calendario. En esta versión `pg_net` no se puede mover de esquema con `ALTER EXTENSION … SET SCHEMA`; no reinstalarlo para eliminar el aviso del linter mientras lo necesiten los cron.
- WhatsApp ignora estados de conversación vencidos después de 30 días. No se ha activado un borrado automático; su política de eliminación debe decidirse aparte de la memoria operativa y de la retención de oportunidades y pagos.

## Respaldos y restauración

El plan Free no incluye respaldos diarios automáticos. [Guía oficial de respaldos](https://supabase.com/docs/guides/platform/backups) y [copia/restauración con CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

1. Usar una estación autorizada con Supabase CLI y Docker. Usar la conexión de base de datos del proyecto (rol, esquema y datos), desde **Connect** en Supabase. Validar el proyecto antes de exportar. No guardar la contraseña en el repositorio, el chat ni el historial de comandos.
2. Guardar los archivos del respaldo en almacenamiento privado cifrado, con acceso restringido al custodio. Un volcado de Postgres no contiene los archivos de Storage; respaldar por separado los objetos que requiera la recuperación, preservando la separación pública/privada.
3. Validar la primera restauración en un entorno separado sin reanudar los cron de producción, enviar mensajes ni usar credenciales de redes sociales. Registrar fecha y última restauración comprobada.
4. Revisar capacidad y periodicidad durante el período de respaldo. Cambiar a un plan de pago o retener copias indefinidamente requiere decisión de INTECA.

Los proyectos pausados `formulario campus virtual` e `INTECA-Pagina Web` no forman parte de la conexión de producción del CRM. No se requieren para la memoria de WhatsApp ni para publicar. La matrícula se guarda en Supabase; sincronizarla con el campus requiere la API de acceso y la verificación de permisos del backend de campus.
