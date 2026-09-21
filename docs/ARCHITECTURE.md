# Arquitectura híbrida 0.8.0

## Fuente única de datos

En producción híbrida, PostgreSQL y la API se ejecutan en el servicio HTTPS central. El navegador y la aplicación Electron cargan la misma interfaz desde ese origen. Electron conserva cookies de sesión en el perfil de la aplicación, aplica aislamiento de contexto, deshabilita Node.js en la página y abre vínculos externos en el navegador del sistema.

La aplicación de escritorio no replica la base central. Esta decisión evita conflictos, ventas duplicadas y estados distintos entre Windows, Mac y web. `http://localhost:3000` continúa siendo una instalación autónoma de contingencia.

## Red

Caddy termina TLS en los puertos 80/443 y reenvía tráfico al contenedor privado de la aplicación. PostgreSQL no publica puertos. `APP_URL` debe coincidir exactamente con el dominio HTTPS; activa cookies seguras y la validación de origen. `TRUST_PROXY=true` permite que Express interprete correctamente IP y protocolo detrás de Caddy.

La puerta de acceso envía sesiones reales a ConnectedCRM. La demostración heredada permanece en App y no comparte el estado de la pantalla operativa.

La interfaz operativa carga los registros desde API, espera confirmación al guardar, refresca las listas y usa IDs devueltos por PostgreSQL. Los contactos se recorren en páginas para no ocultar silenciosamente registros a partir del número 100.

Las rutas se dividen en auth, crm, operations y platform. authenticate verifica token de sesión hash, caducidad, usuario activo y membresía activa. Los permisos restringen escritura y administración. validateRelations valida que contacto, empresa, producto y oportunidad referenciados pertenezcan a la organización seleccionada.

Los modelos y migraciones se conservan del paquete 0.2.0, con una migración adicional de protección RLS. Los roles OWNER, MANAGER, SALES y VIEWER se crean idempotentemente. Los límites/planes heredados aún no son un mecanismo de cobro o licenciamiento.

La interfaz separa montos por moneda y no convierte oportunidades ganadas en cobros. La exportación CSV protege contra valores interpretables como fórmulas. Cambiar la contraseña revoca todas las sesiones.

Docker incluye las herramientas de migración en runtime y el seed compilado. La versión anterior intentaba invocar Prisma tras omitir dependencias de desarrollo y no ejecutaba seed; ambos requisitos ahora forman parte del arranque.
