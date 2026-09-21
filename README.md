# Sales AI CRM 0.8.1 — Plataforma híbrida

Actualización INTECA: incorpora el agente **Experto en Ventas y Cierre**, especializado en diagnóstico, manejo ético de objeciones, negociación autorizada, conversión y seguimiento hasta inscripción.

La misma plataforma puede utilizarse desde navegador o desde la aplicación instalada en Windows y macOS. En modo híbrido ambos clientes se conectan al mismo servicio HTTPS y comparten usuarios, empresas, contactos, agentes, campañas y documentos.

## Modalidades de lanzamiento

- **Web híbrida:** despliegue `compose.cloud.yml` en un servidor con dominio público. Caddy obtiene y renueva HTTPS automáticamente cuando el DNS apunta al servidor y los puertos 80/443 están disponibles.
- **Escritorio conectado:** compile el instalador dentro de `desktop`. En el primer inicio se solicita la dirección HTTPS del servicio. La sesión queda en el almacenamiento protegido de la aplicación y no se guardan contraseñas en archivos.
- **Local independiente:** `INSTALAR.cmd` continúa iniciando una instalación privada en `http://localhost:3000`. Es útil para pruebas o contingencia, pero constituye otra base de datos y no se sincroniza con el servicio central.

Para trabajar con los mismos datos en PC, Mac y web, todas las aplicaciones deben usar la misma dirección HTTPS.

Actualización sobre 0.3.0. Incluye interfaz oscura/clara, logos del propietario, módulos persistentes por empresa, licencias firmadas y asistente web. NO declara completas todas las funciones de la antigua demostración.

## Actualizar la instalación existente en Windows

1. Mantenga Docker Desktop abierto. No borre ni reinstale la base de datos.
2. Extraiga el ZIP en una carpeta temporal. Copie el CONTENIDO de `SALES_AI_CRM` sobre el contenido de su carpeta instalada en D:, aceptando reemplazar archivos del programa. No cree una carpeta SALES_AI_CRM dentro de la anterior.
3. Conserve el `.env` original, `respaldos` y los volúmenes Docker. Este paquete no contiene `.env` real ni contraseñas.
4. En la carpeta instalada ejecute `ACTUALIZAR.cmd`. Primero hace un respaldo SQL y luego reconstruye los contenedores y aplica las migraciones aditivas para documentos, solicitudes de pago y cola de mensajes.
5. Abra http://localhost:3000 y pulse Ctrl+F5. Inicie sesión con su cuenta existente.
6. La cuenta aparece en modo consulta hasta activar su licencia. Para INTECA use el paquete PRIVADO del propietario: `ACTIVAR_INTECA.cmd`, indicando la ruta de su carpeta instalada. Busca exactamente una empresa llamada INTECA SRL y firma una licencia gratuita sin vencimiento para su ID.
7. Actualice la pantalla. En Licencia & Plan debe indicar INTECA · Gratuita y permanente.

Si falla el respaldo, el actualizador no continúa. Si falla la actualización, conserve todos los archivos y consulte `docker compose logs --tail 80 app`. No ejecute `docker compose down -v`, `prisma migrate reset` ni borre los volúmenes. Para rollback del programa conserve también el ZIP 0.3.0; las migraciones añaden columnas y tablas sin eliminar las anteriores.

## Instalación nueva

Docker Desktop con contenedores Linux y Docker Compose v2. Ejecute INSTALAR.cmd, registre la empresa y active la licencia en Licencia & Plan. No hay usuario ni contraseña de fábrica. El instalador genera secretos aleatorios. Cada instalación local guarda sus propios datos.

## Funciones reales

- Cuenta real con panel ejecutivo, contactos, empresas cliente, catálogo, oportunidades, tareas y configuración existentes.
- Tema claro/oscuro persistente en ambas presentaciones. Logos horizontal y cuadrado originales.
- Agentes: crear/editar instrucciones por empresa; consultas manuales con Gemini. No afirma estar trabajando 24/7 cuando no hay proceso activo.
- Chat: conversaciones guardadas, entradas manuales, borradores, respuestas IA; envío individual de correo mediante Resend con confirmación explícita. ACCEPTED significa aceptado por proveedor, no entregado.
- Embudos: tablero por etapas y cambios persistentes. Mover a una etapa llamada Ganado no marca por sí solo la oportunidad como ganada; cambie el resultado en Gestionar oportunidades.
- Workflows: cada regla activa crea un seguimiento al crear un contacto desde el CRM. La fecha de la tarea no realiza llamadas ni envía mensajes. El canal web crea su propio seguimiento.
- Marketing: campañas con objetivo, audiencia y tope de presupuesto; pueden autorizarse para publicación automática cuando exista una conexión oficial compatible. Sin esa conexión permanecen como borradores y no simulan publicaciones.
- Canales sociales: webhooks firmados, cola persistente, respuestas de texto manuales o automáticas, agente por canal y atención humana. Requieren autorización de las cuentas y pruebas reales. Ver docs/CANALES_Y_PAGOS.md.
- Solicitudes de pago: enlaces de plataformas externas, cuentas bancarias y portal para subir comprobantes; aprobación humana antes de registrar el cobro.
- Cobros: registro manual en efectivo/transferencia/tarjeta externa, estados, reembolsos registrados y comprobantes internos imprimibles. No cobra tarjetas ni emite facturas fiscales.
- Bóveda: PDF, PNG, JPG, TXT y CSV de hasta 5 MB. Archivos guardados en PostgreSQL con acceso por empresa, descarga como adjunto, incluidos en el SQL. No hay análisis antivirus.
- Analítica: ventas por moneda, cobros manuales y proyección ponderada por probabilidad. No inventa CAC, LTV o retornos; no es un modelo predictivo validado.
- Licencias: verificación Ed25519, vinculadas al ID de empresa. INTECA gratuita permanente; clientes comerciales requieren licencia con vencimiento. Sin licencia se conserva consulta/exportación; las escrituras se rechazan. No hay pago recurrente automático.
- Vendedor IA & Web: catálogo y condiciones comerciales autorizadas, guion editable, iframe web, conversación persistente, oportunidad y seguimiento automáticos. La venta no se marca cobrada por lo que diga la IA.

## Conectar IA y correo

En Integraciones configure su clave Gemini y un modelo habilitado en SU cuenta, o Resend con API key y correo de un dominio verificado. Las claves se cifran con APP_SECRET. Conserve el .env y su secreto: cambiarlo impide descifrar las credenciales guardadas. No envíe claves por chat.

Guardar una clave no prueba su funcionamiento. Gemini pasa a Verificado tras una respuesta; Resend tras un envío aceptado. Los fallos se muestran sin imprimir claves en la interfaz. No se han probado cuentas externas reales en esta entrega; el envío de prueba automatizado usa un proveedor simulado y no contacta personas.

El software gratuito de INTECA no hace gratuitos los proveedores, anuncios, servidor ni dominios. No se configura ni ejecuta gasto publicitario desde este paquete.

## Página web

1. Cargue productos reales, precios y moneda en Catálogo.
2. En Vendedor IA & Web configure políticas, guion, correo humano, enlace de pago HTTPS (si ya dispone de uno) y límite diario de consultas.
3. Configure Gemini, active el asistente y guarde.
4. Pruebe el enlace. Para visitantes de Internet debe desplegar el CRM en un servidor HTTPS y reemplazar el origen localhost por ese dominio.
5. Configure WIDGET_ALLOWED_ORIGINS en el servidor con los orígenes HTTPS autorizados, separados por comas, por ejemplo `https://www.suempresa.com`. El iframe se bloquea para sitios externos por defecto.
6. Inserte el iframe mostrado en su página. El visitante facilita nombre, correo y consentimiento de atención. La conversación se guarda y el asistente responde usando catálogo y políticas; no navega ni extrae automáticamente todo su sitio.
7. Las consultas web tienen límite diario por empresa y límites por IP. El límite incluye intentos fallidos para evitar costes ilimitados. El asistente debe permanecer en un servidor encendido; un PC apagado no atiende clientes.

## Pendiente para el alcance total solicitado

Conexión y validación de cuentas reales de WhatsApp Business/Facebook/Instagram, Google Ads y Meta Ads, publicación/optimización de campañas, audio, checkout integrado con importe automático y conciliación de tarjetas, facturación fiscal, recuperación por correo, CRM alojado 24/7, cobro automático de licencias, revocación centralizada y pruebas con proveedores reales.

Los menús equivalentes a la demo no significan que las acciones externas estén conectadas. La demo conserva datos ilustrativos; el modo real empieza con los datos del negocio. No existe un discurso infalible ni una garantía de cierre; el guion debe respetar las condiciones autorizadas y permitir atención humana.

## Seguridad y límites de licencias locales

El paquete de clientes solo contiene la clave pública. NO comparta el ZIP del propietario, private-key.pem ni las herramientas privadas con clientes. El propietario emite una licencia después de confirmar manualmente una compra. Conserve copias cifradas de su clave privada: perderla impide emitir nuevas licencias compatibles.

Como se entrega código fuente y el cliente administra su equipo, un usuario con control del servidor puede modificar el software o el reloj. La licencia local no es DRM invulnerable. Para control comercial fuerte se necesita hosting y un servicio central de licencias.

## Pruebas

`npm ci`, `npm run db:generate`, `npm run check`.
Las suites integradas requieren una base aislada, roles sembrados y RUN_DATABASE_TESTS=1. Las nuevas pruebas de licencias requieren además TEST_LICENSE_PRIVATE_KEY_PATH y APP_SECRET de prueba; la clave privada no se incluye en el paquete de clientes. Nunca ejecute estas pruebas en una base con datos reales.

Consulte docs/VALIDACION_V040.md para las pruebas realizadas y sus límites.

## Fichas completas de cursos

En **Conocimiento de cursos**, seleccione un producto del catálogo y registre módulos, pénsum, duración, horarios/fechas/zona horaria, modalidad, requisitos, desglose de pagos, avales otorgados, certificación y políticas. Indique fuentes y fecha de verificación. Un administrador debe aprobar la ficha para que la usen los agentes; puede establecer vencimiento.

Chat, web y mensajería consultan la misma información actual por empresa. No se precargan planes de estudios, precios ni avales de INTECA sin documentos actuales verificados. Los datos vacíos se señalan como pendientes. Una solicitud de aval no prueba su concesión. Si cambia nombre, descripción, precio o moneda del catálogo, vuelva a revisar y aprobar la ficha para evitar condiciones contradictorias. No hay extracción automática de archivos PDF de la bóveda: se deben transcribir los datos revisados en estos campos.

La base de conocimiento mejora la consistencia, pero no garantiza que un modelo nunca se equivoque. Pruebe preguntas sobre cada curso antes de habilitar respuestas automáticas. Mensajes extensos que superan el límite de texto del conector pasan a revisión humana.
