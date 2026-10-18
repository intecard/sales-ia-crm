# Memoria y atención por WhatsApp

Cada contacto tiene un historial de 24 intervenciones y datos recordados (curso,
nombre declarado, horario preferido, correo e interés en inscripción/pago).
La clave separa negocio, organización y tipo de identificador (teléfono o BSUID).
Los mensajes del mismo contacto se procesan por orden de llegada, incluso si Meta
envía varias solicitudes simultáneas. La memoria no se importa de chats anteriores
al despliegue. No se puede recuperar un historial que nunca se guardó.

El modelo recibe las intervenciones de ambas partes y la última pregunta pendiente.
Las reglas de conversación prevalecen sobre los guiones promocionales: respuesta
directa, una pregunta útil como máximo y sin repetir datos ya aportados. Los datos
del cliente se separan de las instrucciones del sistema. Si Gemini falla, el flujo
de respaldo conserva nombre, curso y horario en lugar de reiniciar la promoción.
No se cortan las respuestas a mitad de frase. El agente no verifica comprobantes
ni confirma pagos o cupos por su cuenta.

## Pagos

`WHATSAPP_PAYMENT_INSTRUCTIONS` contiene exclusivamente las instrucciones oficiales
aprobadas por el administrador, por ejemplo banco, tipo de cuenta, número, titular,
moneda y referencia. Nunca introducir claves bancarias. Se entrega como texto sin
pedir primero el nombre o el horario. Sin esta configuración, el agente informa
claramente que no tiene instrucciones verificadas y proporciona el correo oficial.
Una pregunta sobre una cuenta no autoriza al cliente a cambiar este dato.

## Persistencia

Sin una base configurada se usa memoria del proceso, hasta 2000 contactos, con
caducidad tras 30 días sin actividad. Se pierde al reiniciar, suspender o redesplegar
Render. Esto se informa en `/api/health` → `whatsAppMemory`; no se afirma que sea
permanente. No se exponen conversaciones en ese endpoint.

Para conservarla entre reinicios:
1. Aplicar `supabase/migrations/20261018_whatsapp_memory.sql` en el proyecto del CRM.
2. Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor.
3. Desplegar y comprobar tras una conversación que `databaseState` sea `ready` y
   `survivesRestart` sea `true`. Configurar credenciales no demuestra conectividad.
4. Programar la eliminación diaria de filas vencidas indicada en la migración.

RLS impide acceso a clientes anónimos o autenticados; solo el servidor usa la tabla.
Si falla la base, se conserva el contexto del proceso y el estado indica el fallo.
La cola y caché son de un solo proceso: antes de escalar a múltiples instancias,
usar una cola/lock distribuido. No hay cola duradera de entregas; el webhook confirma
recepción antes de procesar y un despliegue puede interrumpir trabajo en curso.

## Validación

`npm run test:whatsapp` ejecuta pruebas de memoria, orden concurrente, aislamiento,
caducidad, recuperación desde almacenamiento, respuestas de respaldo, rutas BSUID,
duplicados, errores y contexto enviado a Gemini. Todas las APIs externas son simuladas.
Confirmar después con una conversación real nueva; las pruebas no envían WhatsApp.

La comprobación global de TypeScript tiene un problema previo en
`server/supabaseService.ts`: falta la dependencia `@supabase/supabase-js`. Este
módulo no se importa en el servidor desplegado ni en la nueva memoria REST.
La compilación de producción y las pruebas del webhook sí se validaron.
