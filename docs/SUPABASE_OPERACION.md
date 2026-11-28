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

Para una copia cifrada del esquema público del CRM en Windows, sigue [Primer respaldo en tu PC](#primer-respaldo-en-tu-pc). Para una migración completa con herramientas oficiales:

1. Usar una estación autorizada con Supabase CLI y Docker. Usar la conexión de base de datos del proyecto (rol, esquema y datos), desde **Connect** en Supabase. Validar el proyecto antes de exportar. No guardar la contraseña en el repositorio, el chat ni el historial de comandos.
2. Guardar los archivos del respaldo en almacenamiento privado cifrado, con acceso restringido al custodio. Un volcado de Postgres no contiene los archivos de Storage; respaldar por separado los objetos que requiera la recuperación, preservando la separación pública/privada.
3. Validar la primera restauración en un entorno separado sin reanudar los cron de producción, enviar mensajes ni usar credenciales de redes sociales. Registrar fecha y última restauración comprobada.
4. Revisar capacidad y periodicidad durante el período de respaldo. Cambiar a un plan de pago o retener copias indefinidamente requiere decisión de INTECA.

Los proyectos pausados `formulario campus virtual` e `INTECA-Pagina Web` no forman parte de la conexión de producción del CRM. No se requieren para la memoria de WhatsApp ni para publicar. La matrícula se guarda en Supabase; sincronizarla con el campus requiere la API de acceso y la verificación de permisos del backend de campus.

## Primer respaldo en tu PC

1. Descarga [respaldo_supabase.py](../ops/backup/respaldo_supabase.py). Necesitas Python 3.10+, [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) abierto en modo Linux **o** [las herramientas de PostgreSQL 17](https://www.postgresql.org/download/windows/), y `age` (instálalo con `winget install --id FiloSottile.age`).
2. Abre una terminal nueva de PowerShell en la PC donde se guardará la copia. Si guardaste el archivo en Descargas, comprueba las herramientas y luego ejecuta:

   ```powershell
   py -3 "$HOME\Downloads\respaldo_supabase.py" --comprobar
   py -3 "$HOME\Downloads\respaldo_supabase.py"
   ```

3. Abre [Connect en Supabase](https://supabase.com/dashboard/project/cldqyiyecxeagnzlylwr?showConnect=true). Elige **Session pooler** (puerto 5432) y copia solo el campo **Host**. Escribe la contraseña de la base de datos directamente en la terminal cuando se solicite; no es la contraseña de la cuenta del panel. El programa valida el proyecto y el certificado TLS antes de respaldar. Si tu instalación no reconoce el certificado, descarga el certificado raíz desde Supabase y repite con `--certificado "C:\ruta\supabase.cer"`.
4. El cifrador te pedirá una frase de respaldo, la confirmación y, al leer de nuevo el archivo, esa misma frase. Guárdala aparte, en tu gestor de contraseñas. La descarga se cifra directamente en `%LOCALAPPDATA%\INTECA\Respaldos`; se conserva el archivo final solo si puede leerse el archivo cifrado y verificarse el volcado. El resumen muestra el nombre y la huella SHA-256.
5. Este paso copia estructura y datos de las tablas CRM del esquema `public`. No copia archivos de Storage, cuentas de Auth, credenciales de Render ni trabajos de cron. Leer el volcado prueba que se puede abrir; aún se debe practicar una restauración a un entorno separado.
