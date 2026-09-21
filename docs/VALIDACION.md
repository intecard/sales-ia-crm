> Documento histórico de una versión anterior. Para el estado actual consulte README.md y docs/VALIDACION_V040.md.

# Validación realizada — 19 septiembre 2026

## Resultado comprobado

| Comprobación | Resultado |
|---|---|
| Instalación npm con package-lock | Correcta |
| Validación del esquema Prisma | Correcta |
| TypeScript sin emitir archivos | Correcta |
| ESLint, cero advertencias | Correcta |
| Compilación frontend, servidor y seed | Correcta |
| Suite API básica | 4 pruebas aprobadas |
| Suite integrada | 1 escenario con 42 aserciones, aprobado |
| Migraciones desde base vacía | 2 migraciones aplicadas |
| Inicialización roles/plan | Correcta |
| Servidor compilado en NODE_ENV=production | Inició y sirvió la aplicación |
| Recorrido de navegador Chromium | Aprobado, sin errores de página |
| Capturas escritorio 1440px y móvil 390px | Revisadas; incluidas en docs/capturas |
| npm audit | 0 vulnerabilidades conocidas reportadas en la consulta |

La suite integrada se ejecutó con Prisma mediante protocolo PostgreSQL contra **PGlite 0.5.8**, motor PostgreSQL compilado a WASM, con una conexión. No equivale a validar PostgreSQL 16 nativo, concurrencia bajo carga o el servicio Supabase. Se creó una base vacía aislada; no se usaron datos del usuario.

## Recorridos comprobados

- Registrar dos empresas y propietarios independientes.
- Crear contacto, editar teléfono/nombre y conservar etiquetas.
- Rechazar lectura/escritura de otra organización y referencias cruzadas en oportunidades, tareas y pagos sandbox.
- Crear productos sin SKU sin colisiones entre códigos vacíos, modificar precio y disponibilidad.
- Crear empresa cliente y oportunidad con contacto/producto; rechazar etapas de otro embudo.
- Marcar oportunidad ganada y actualizar conteo sin simular dinero cobrado.
- Crear y completar una actividad.
- Crear usuario de solo lectura; permitir consulta y rechazar escritura/administración.
- Desactivar membresía y rechazar su sesión.
- Rechazar solicitudes de escritura con origen externo.
- Actualizar organización y consultar auditoría.
- Cambiar contraseña, revocar sesiones, iniciar nuevamente y cerrar sesión.

En Chromium se comprobó además: registro desde formulario, sesión tras recarga, alta/edición de contacto, alta de producto, oportunidad asociada y ganada, seguimiento completado y descarga CSV. Se revisaron capturas sin errores de JavaScript.

## Limitaciones verificables

- No se ejecutó Docker Desktop ni el instalador CMD en Windows. Este entorno de trabajo carece de Docker y Windows.
- Las instrucciones y archivos Compose/Dockerfile están preparados, pero la imagen Docker no fue construida aquí.
- No se probó la conexión Supabase, proveedores de mensajes, IA con cuenta real, pagos reales, restauración SQL ni carga multiusuario.
- Las pantallas conceptuales heredadas siguen disponibles solo en demostración. La vista operativa usa una interfaz separada.
- Una auditoría npm sin vulnerabilidades conocidas no certifica la seguridad completa del producto.

## Confirmación final en el PC del usuario

1. Instalar con INSTALAR.cmd y comprobar que ambos servicios aparezcan saludables.
2. Crear empresa, contacto, producto, oportunidad y seguimiento.
3. Cerrar y volver a iniciar con DETENER.cmd e INICIAR.cmd; comprobar que los registros sigan presentes.
4. Generar un SQL con RESPALDAR.cmd y conservar copia externa.
5. Verificar restauración en otra base vacía antes de depender de ese respaldo.

Este informe documenta una versión del núcleo CRM probada; no certifica que todos los módulos comerciales e integraciones estén terminados.
