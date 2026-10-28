# Matrícula después de pago verificado

## Operación

1. En Agentes IA → Ventas y Cierre, seleccionar el contacto. Confirmar nombre, correo y curso en la conversación.
2. Importar el comprobante original recibido por WhatsApp o adjuntarlo (PDF, PNG, JPEG o WebP, máximo 5 MB). Queda en un bucket privado de Supabase.
3. Descargarlo y revisar titular, importe, fecha y referencia. Confirmar el abono en el banco: una imagen por sí sola no acredita fondos. Marcar ambas confirmaciones y validar el importe exacto. Se rechazan referencias y recibos reutilizados.
4. El servidor crea una sola matrícula persistente por contacto/pago cuando están completos los datos. No matricula mediante formularios públicos ni por un mensaje que diga «pagué».
5. Agentes IA → Conversión y Matrícula muestra el resultado real. Primero crea o reutiliza la cuenta de estudiante y asigna el curso en el campus; después envía matrícula y acceso por correo y WhatsApp. Nunca genera contraseñas ficticias.
6. Si el resultado de un envío se pierde, queda en revisión. Comprobar el proveedor antes de marcar «no enviado» y reintentar. «Aceptado por el proveedor» no significa entregado ni leído.


## Diagnóstico y activación segura (octubre 2026)

El Campus existente usa Firebase **Authentication** y una base Firestore con nombre; no
se instala Moodle para sustituirlo ni se crea un campus de prueba diferente.

- Proyecto: `gen-lang-client-0415952714`.
- Firestore database: `ai-studio-campusvirtualint-dbc5e5fa-0c2e-4740-85d5-91566cdb7d70`.
- URL prevista: `https://campus.inteca.com.do`. Verificar en el navegador que resuelva al
  campus correcto antes de enviar mensajes de bienvenida.
- CRM: `https://sales.ia.crm.inteca.com.do`.

En **Render > sales-ia-crm > Environment** están preparados los identificadores no
secretos `INTECA_FIREBASE_PROJECT_ID`, `INTECA_FIRESTORE_DATABASE_ID`,
`INTECA_CAMPUS_BASE_URL`, `INTECA_CAMPUS_DEFAULT_ROLE=student`.
La bandera `INTECA_CAMPUS_SYNC_ENABLED=false` bloquea las operaciones de escritura
hasta que se confirme todo lo siguiente.

**Dependencias indispensables, ninguna debe inventarse:**

1. Conceder acceso de escritura al repositorio
   [Campus Virtual INTECA](https://github.com/intecard/campus-virtual-intecaAPK)
   para aplicar el parche `docs/campus-enrollment.patch`. El 28 de octubre la
   conexión GitHub de este chat recibió HTTP **403** al crear una rama allí. Ese
   parche elimina el borrado de cursos en el arranque, reconoce inscripciones
   por UID de Firebase y añade «Olvidé mi contraseña / Primer acceso».
2. Antes de desplegar, **respaldar Firestore** y revisar además sus reglas de
   seguridad: no basta con ocultar botones de administración en React. El código
   actual debe impedir que un alumno sin matrícula lea materiales privados o
   cambie su propio rol. Revisar también que cursos/duraciones sean correctos:
   el repositorio contiene material inicial obsoleto (por ejemplo, una duración
   de 10 meses para autorizaciones y 6 meses para enfermería). **No reemplazar
   cursos existentes automáticamente**.
3. En la consola de Google Cloud del proyecto correcto, crear una **cuenta de
   servicio dedicada** al CRM con privilegios mínimos de Firebase Authentication
   Admin y Cloud Datastore User. Descargar el JSON de esa identidad y guardarlo
   **directamente en Render**, en la variable privada
   `INTECA_FIREBASE_SERVICE_ACCOUNT_JSON`. Jamás pegarlo en el chat, GitHub,
   ni prefijar una variable secreta con `VITE_`.
4. Desplegar la revisión del Campus y verificar que «Primer acceso» realmente
   funciona con Firebase Authentication y el dominio de correo previsto.
5. Abrir el CRM como administrador → **Agentes IA → Conversión y Matrícula** →
   «Verificar Firebase y cursos». El nuevo diagnóstico consulta de forma
   **solo lectura** Authentication y Firestore, muestra número de cursos y
   estado de los permisos. No devuelve información de usuarios ni claves.
6. Vincular los cursos del catálogo del CRM con **documentos reales** de Firestore.
   La vinculación automática se hace únicamente para un único título exactamente
   coincidente; si los nombres/duraciones difieren, Coordinación Académica debe
   comprobar programa, duración y curso, y aprobar la asociación. No inventar
   identificadores de cursos ni asignar estudiantes a cursos de otro país.
7. Configurar un remitente institucional verificado para Resend en
   `RESEND_API_KEY` y `EMAIL_FROM`, o un SMTP autorizado. La bienvenida por
   WhatsApp usa la conexión existente y exige plantilla de Meta aprobada cuando
   finalice la ventana de conversación; no crear contraseñas temporales.
8. Activar `INTECA_CAMPUS_SYNC_ENABLED=true` **solo entonces**. Mantener la
   validación de transferencias bancarias antes de matricular. El módulo de
   tarjetas es una preparación contractual y **no** acredita cobro real.
9. Realizar una prueba autorizada con una **transferencia verificada real**,
   corroborar un único usuario en Firebase Auth, `users/{uid}`, matrícula
   `crm_enrollments/{enrollmentId}`, curso asignado y registro de Supabase.
   El registro bancario no debe duplicarse, ni enviar correos dos veces.

**Estado de datos verificado 28/10/2026**: Supabase tiene 0 asociaciones CRM↔Campus,
0 matrículas y 0 pagos con comprobante bancario verificado. Por ello no se
puede afirmar que exista un estudiante real transferido al campus.

La clave `INTECA_CAMPUS_API_KEY` que aparece en una sección antigua del CRM
no sustituye el JSON de la cuenta de servicio necesaria para este conector.


## Conexiones de servidor pendientes

Guardar secretos solo en Render → sales-ia-crm → Environment. No pegarlos en GitHub, el navegador público ni en conversaciones.

- `INTECA_FIREBASE_SERVICE_ACCOUNT_JSON`: JSON de una cuenta de servicio autorizada del proyecto `gen-lang-client-0415952714`, con permisos de Firebase Authentication para consultar/crear usuarios y Firestore para consultar cursos y escribir perfiles, membresías y `crm_enrollments`. No reutilizar ni extraer la credencial de GitHub Actions. El administrador puede crear una cuenta dedicada con los permisos mínimos necesarios (`Firebase Authentication Admin` y `Cloud Datastore User`, restringidos al proyecto correspondiente).
- `INTECA_FIREBASE_PROJECT_ID`: `gen-lang-client-0415952714`.
- `INTECA_FIRESTORE_DATABASE_ID`: `ai-studio-campusvirtualint-dbc5e5fa-0c2e-4740-85d5-91566cdb7d70`.
- `INTECA_CAMPUS_BASE_URL`: `https://campus.inteca.com.do`.
- `RESEND_API_KEY`: clave de envío de Resend. Verificar primero un dominio institucional de envío en Resend.
- `EMAIL_FROM`: remitente autorizado de ese dominio. No inventar un correo; usar el remitente que INTECA configure.
- Alternativa en servidores que permitan SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `EMAIL_FROM`. Render Free bloquea SMTP 25/465/587, por lo que se usa Resend HTTPS.
- WhatsApp usa las credenciales existentes. Para enviar fuera de la ventana de atención, configurar `WHATSAPP_ENROLLMENT_TEMPLATE_NAME` y `WHATSAPP_ENROLLMENT_TEMPLATE_LANGUAGE` solo después de que Meta apruebe la plantilla correspondiente. Sus cinco parámetros de cuerpo son: nombre, matrícula, curso, URL del campus y correo, en ese orden. Sin plantilla el mensaje queda pendiente; no se elude la restricción.

Antes de activar el flujo, publicar también `docs/campus-enrollment.patch` en el repositorio `intecard/campus-virtual-intecaAPK` (base `4dc411cfbf5b8dbe6299dfd423ff60d6bb90d2bc`). Incluye primer acceso por correo, identificación por UID y protección contra reemplazar cursos al iniciar. Los cambios compilan localmente, pero la conexión de GitHub devolvió 403 al intentar publicarlos en ese repositorio; todavía no están en el campus en producción.

Después de configurar Firebase, abrir Conversión y Matrícula → Consultar cursos del campus y asociar el título usado en ventas con el curso real. No se adivinan IDs. Reiniciar/desplegar tras cambiar variables; comprobar la consulta del catálogo antes de validar una matrícula real. El primer acceso se hace desde «Olvidé mi contraseña / Primer acceso» del campus, mediante el enlace enviado por Firebase al correo del estudiante.

`ENROLLMENT_AUTO_ENABLED=false` pausa el procesador. Por defecto se ejecuta cada minuto y al validar un pago, con reintentos persistentes cada 15 minutos. Render Free puede suspender el proceso por inactividad: al despertar recupera lo pendiente desde Supabase; este plan no garantiza procesamiento continuo 24/7. No hay conciliación bancaria automática sin una API bancaria/pasarela configurada: la confirmación del abono es administrativa.

## Verificación

`npm run test:enrollment` verifica la puerta de pago, privacidad de las rutas, recibos válidos, estados inciertos y acuses de correo/WhatsApp con proveedores simulados. Las pruebas no envían mensajes reales. La migración también se comprobó en una transacción revertida: sin pago no hay matrícula, sin recibo no hay cierre, una misma matrícula no se duplica ni se reclama dos veces, y los roles públicos no acceden a los datos.

La integración completa requiere una prueba autorizada después de configurar credenciales y asociar el curso. Hasta entonces el panel muestra las conexiones pendientes y no afirma que el campus o los mensajes estén activos.
