# Validación de Sales AI CRM v0.4.0

## Entorno y alcance

Pruebas locales en Linux con Node, Prisma y una base PostgreSQL compatible aislada mediante PGlite y su socket. No se ejecutó Docker Desktop de Windows ni se accedió a la computadora de Luis. Los scripts CMD y Docker se revisaron, pero su ejecución debe verificarse al actualizar en Windows.

## Resultados

- TypeScript, ESLint y compilación Vite/esbuild: correctos.
- 4 pruebas de API básica: correctas.
- 1 prueba integrada de funciones existentes: correcta; esta suite aísla el control de licencia para comprobar la regresión anterior.
- 1 prueba integrada ampliada con control real de licencia: correcta. Cubre licencias inválidas/vencidas/de otra empresa, firma alterada, agentes, workflows, conversación, correo con proveedor simulado, documentos, permisos, pagos e idempotencia.
- Portal de pago: cuenta bancaria y enlace visibles, rechazo de archivo inválido, prueba pendiente de revisión, doble envío bloqueado, aprobación solo por la empresa autorizada, un único cobro y comprobantes ocultos a usuarios sin permiso de pagos.
- Canales: verificación del webhook, firma obligatoria, mensajes duplicados almacenados una vez, manual sin envío, envío explícito simulado una vez, respuesta automática con Gemini y Meta simulados, pausa humana sin generación y rechazo de ecos/cuentas ajenas.
- Asistente web: respuesta simulada, sesión del visitante, creación de oportunidad y seguimiento.
- Migración incremental: una empresa y contacto preexistentes conservaron ID, nombre y teléfono al aplicar las tres migraciones nuevas.
- Navegador Chromium: registro, activación de INTECA, contacto, agente, conversación y archivo; temas persistentes real/demo, móvil sin desbordamiento horizontal y sin errores JavaScript detectados en estos recorridos.

Los recorridos integrados agrupan numerosas aserciones en dos pruebas amplias; no equivalen a pruebas exhaustivas de todos los formularios o condiciones de proveedores.

## Evidencia visual

Carpeta `capturas-v040`: cuenta clara y oscura, móvil, demostración clara y oscura. Todos los nombres y registros usados en las capturas son datos de prueba aislados. No se incluyen usuarios de prueba en el paquete instalado.

## Límites de verificación

No se enviaron mensajes ni correos reales. No se procesaron cargos ni se abrieron campañas publicitarias. Las pruebas simuladas comprueban el código, no certifican permisos, revisión de aplicaciones, tokens, planes, entrega ni compatibilidad de una cuenta externa concreta. La activación de Meta/Gemini/Resend necesita una prueba controlada con cuentas autorizadas y HTTPS.

No se han realizado pruebas de carga, auditoría externa de seguridad, recuperación completa de un respaldo en Windows ni evaluación comercial de tasas de cierre. Las marcas de estado no prueban que un cliente leyó el mensaje. El alcance pendiente se detalla en README.md y CANALES_Y_PAGOS.md.

## Ampliación 0.4.1: conocimiento de cursos

Prueba integrada de fichas: borrador excluido del contexto, aprobación con fuente obligatoria, acceso aislado por empresa, preservación de metadatos, vencimiento y cambio de precio que invalidan el uso de una ficha anterior. Los tres canales de IA consumen el mismo cargador de catálogo. No se han cargado documentos reales de cursos en la instalación del usuario.
