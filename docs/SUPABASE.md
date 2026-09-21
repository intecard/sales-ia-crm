# Conexión opcional a Supabase

La instalación Windows solicitada usa PostgreSQL local. Esta alternativa necesita un proyecto Supabase y configuración privada; no se ha activado ni probado contra la cuenta del usuario.

## Arquitectura

El navegador se comunica con el servidor del CRM. El servidor usa Prisma y una cadena PostgreSQL privada, no la clave pública de Supabase. Nunca incluya DATABASE_URL en variables VITE_ ni en el frontend.

La referencia oficial es https://supabase.com/docs/guides/database/prisma. Para un servidor persistente, Supabase documenta Session pooler (puerto 5432); use la cadena EXACTA de Connect de su proyecto. Este paquete conserva Prisma 6 y su configuración en schema.prisma; no copie instrucciones de configuración de otra versión de Prisma sin adaptarlas.

## Pasos

1. Use un proyecto/base dedicado al CRM o revise previamente su esquema y permisos. No conecte a una base de un negocio existente sin revisar conflictos y respaldo.
2. En Connect obtenga la cadena PostgreSQL Session pooler. Configure una cuenta de base de datos privada con permisos para crear el esquema y aplicar las migraciones, siguiendo las instrucciones oficiales.
3. Copie `.env.supabase.example` como `.env.supabase`. Complete DATABASE_URL solo en su equipo; codifique correctamente los caracteres especiales de la contraseña para una URL.
4. Use `schema=sales_ai` para mantener las tablas en un esquema separado y no expuesto por la API de Supabase; conserve `sslmode=require`. Verifique que ese esquema NO esté en la lista de esquemas expuestos.
5. Establezca APP_SECRET con un valor aleatorio de al menos 32 caracteres.
6. Detenga primero el CRM local para liberar el puerto 3000 y ejecute:

```bat
docker compose -f compose.supabase.yml --env-file .env.supabase up -d --build --wait --wait-timeout 300
```

7. Cree una empresa de prueba, un contacto, recargue y vuelva a entrar. Verifique en el panel que los datos estén en el esquema seleccionado.

Este procedimiento crea una instalación separada, no copia los datos del PostgreSQL local a Supabase. La migración de datos existentes requiere planificación y respaldo.

## Acceso y separación

Las sesiones y usuarios pertenecen al CRM; no usa Supabase Auth. El servidor comprueba organización y permisos. Las migraciones activan RLS sin políticas públicas en las tablas del CRM para bloquear accesos directos de roles sin privilegios. El propietario de las tablas usado por Prisma puede operar: RLS no sustituye el aislamiento de la API ni hace seguro distribuir su contraseña.

No comparta contraseñas, service_role ni cadenas con secretos por chat. Se puede compartir la URL pública del proyecto y una captura de Connect con la contraseña oculta para revisar el formato. No se necesita la clave pública para esta arquitectura.

Los respaldos de Supabase deben gestionarse con las herramientas de su proyecto o con pg_dump autorizado. `RESPALDAR.cmd` solo respalda la instalación local.
