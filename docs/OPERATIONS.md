# Operación local

## Componentes

- React/Vite y API Express en el contenedor app.
- PostgreSQL 16 en postgres, volumen persistente sales_ai_postgres dentro del proyecto Compose sales-ai-crm.
- Inicio: migraciones idempotentes, seed de roles/plan y servidor.
- La base no abre puertos hacia el PC. El servidor se publica en 127.0.0.1:3000.
- Las cookies son HttpOnly y SameSite=Lax. Se usa Secure cuando APP_URL utiliza HTTPS. HTTP solo corresponde al uso local de este paquete.
- El instalador no crea usuarios de negocio ni ejemplos; el propietario se registra en la pantalla inicial.

## Respaldos

Ejecute RESPALDAR.cmd con los servicios activos. El SQL contiene todas las empresas, usuarios, hashes de contraseñas y sesiones: guárdelo con acceso restringido. Mantenga otra copia fuera del equipo y pruebe periódicamente una restauración en una base vacía.

Para una restauración asistida, prepare una base VACÍA y copie el SQL mediante psql con ON_ERROR_STOP. No ejecute una restauración sobre tablas existentes: puede causar errores o duplicados. El paquete no incluye un botón de restauración destructiva.

## Actualización

Respalde antes de actualizar. Reemplace el código preservando .env, respaldos y volúmenes, y ejecute INSTALAR.cmd. Las migraciones tienen historial; nunca use migrate reset ni docker compose down -v sobre una instalación con datos.

## Diagnóstico

`docker compose ps` informa disponibilidad. `/api/health` indica el proceso; `/api/ready` consulta la base y comprueba el plan inicial. Los errores en la interfaz impiden anunciar un guardado como exitoso. Si se perdió la conexión después de enviar un cambio, actualice y compruebe el registro antes de repetirlo.

## Acceso remoto y comercialización

Este paquete no publica un SaaS. Un servidor compartido requerirá HTTPS, secretos administrados, política de registro, recuperación de cuenta, backups monitoreados y pruebas de carga. La autorización se basa en cookies, membresías y permisos del servidor; no distribuya credenciales PostgreSQL de una instalación multiempresa a clientes.

El código conserva un esquema heredado de planes y sandbox, sin cobro ni cumplimiento comercial de licencias. No anuncie esos módulos como activos.

## Si actualiza desde 0.2.0

El archivo .env anterior puede no contener POSTGRES_PASSWORD. Añada esa variable con la contraseña REAL de su base local existente; no genere otra pensando que cambiará la contraseña del volumen ya inicializado. La instalación nueva genera sus propios secretos. Si antes usaba una base externa, use su configuración correspondiente y revise la migración con un respaldo antes de cambiar de instalación.
