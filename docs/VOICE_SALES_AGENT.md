# Valeria Parkert — ventas telefónicas

Implementación independiente de WhatsApp y publicidad. El despliegue inicial conserva llamadas deshabilitadas, presupuesto cero y ninguna llamada piloto realizada.

## Flujo implementado

- Cuenta Twilio y número de voz verificados con su API. ConversationRelay STT/TTS en español latino, voz femenina Google es-US-Neural2-A preconfigurada, WebSocket firmado y conversación mediante la IA existente del CRM. No usa ni exige una nueva clave OpenAI.
- El proveedor requiere activar ConversationRelay y aceptar sus condiciones en su consola. Esa aceptación corresponde al titular, no la realiza el CRM.
- Presentación cálida como Valeria Parkert, identidad virtual honesta al preguntarle, aviso de transcripción, preguntas de diagnóstico, catálogo autorizado, objeciones, rechazo, baja y solicitud de persona. Español latino neutro con estilo elegante, sereno, cálido y profesional; requiere piloto auditivo para confirmar el resultado.
- Supabase guarda contactos, permiso, programación, texto de conversación, resultado, reserva estimada e identificador Twilio. No se graba audio. Se omiten secuencias numéricas largas y referencias evidentes a claves en el texto guardado.
- Un trabajador por minuto procesa la cola mientras Render está activo. Una llamada activa o de resultado incierto bloquea otras llamadas de la misma empresa. Una reserva transaccional comprueba horario, consentimiento, tope diario, reservas y frecuencia; otra instancia no puede reservar simultáneamente una segunda llamada.
- La importación INTECA solo incluye interesados de WhatsApp con callbackConsent=yes y control automático, excluye pagos validados y vuelve a comprobar el permiso antes de marcar. La baja de voz no se restaura al importar nuevamente.
- Otras empresas tienen catálogo, contactos, número y límites separados. Solo el administrador global actual controla la operación telefónica. El personal de Call Center puede coordinar propuestas en el chat; no obtiene credenciales ni permisos de llamada por elegir un rol visual.
- Una solicitud de pago de un contacto de WhatsApp se comunica al flujo de ventas como intención de pago; nunca se confirma la venta ni se matricula por la declaración del cliente. Para contactos manuales u otras empresas queda registrada en el historial telefónico.
- La transferencia usa exclusivamente el número humano configurado, con duración adicional limitada. La atención humana y el seguimiento sin fecha confirmada quedan en next_action para coordinación; no se inventa una cita.
- El simulador usa texto y la IA del CRM. No marca números ni ejecuta acciones de clientes.

## Autorización de costos

La habilitación exige que el administrador introduzca el número propio, reserva estimada por llamada y diaria, confirme costos y confirme la activación de ConversationRelay. Los costos reales dependen de Twilio, STT/TTS/relay, IA, destinos y transferencias. Las reservas son un control interno conservador, no un límite garantizado de la factura externa. Configurar también alertas, permisos geográficos y controles de gasto en el proveedor. No se compra un número ni se modifica una suscripción automáticamente.

## Límites actuales

No existe llamada real verificada hasta conectar cuenta, número, activación del proveedor y completar un piloto autorizado con un límite de gasto. Render gratuito puede dormir o cerrar conexiones; no se garantiza atención continua. Este módulo inicia llamadas salientes; no se configuró un número para recibir llamadas entrantes públicas. No envía WhatsApp desde el discurso del modelo, no captura pagos por teléfono, no concede descuentos, no ofrece garantía de cierre ni optimiza automáticamente argumentos a partir de matrículas no verificadas.

Si se pierde una respuesta después de pedir una llamada, no se vuelve a marcar automáticamente. Con un Call SID conocido se consulta Twilio; si no se recibió SID, el administrador debe conciliar el caso con el proveedor antes de desbloquearlo. Esto evita duplicados con costo e interrupciones a clientes.

Para INTECA se consulta Supabase y se aplican los cambios confirmados por el propietario el 25/10/2026: Promotor de Salud 6 meses y Promotor de Seguros de Salud 5 meses; ambos inscripción RD$2,500 y mensualidad RD$2,000. Los cambios aquí no reescriben el archivo público de conocimiento de otros módulos.

## Referencias consultadas

- https://www.twilio.com/docs/voice/conversationrelay/onboarding
- https://www.twilio.com/docs/voice/conversationrelay/websocket-messages
- https://www.twilio.com/docs/voice/conversationrelay/voice-configuration
- https://www.twilio.com/docs/voice/api/call-resource
- https://render.com/docs/deploys
- https://render.com/docs/health-checks

Voz seleccionada: https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types (es-US-Neural2-A, FEMALE). El perfil también se aplica a despedidas y avisos de transferencia para mantener la misma voz.

## Prueba de voz en el navegador (sin Twilio)

El panel incluye Hablar con Valeria. Usa SpeechRecognition del navegador para dictar y SpeechSynthesis para leer respuestas en español. No requiere credenciales Twilio, tarjeta, número ni autorización de costos telefónicos. La generación usa el mismo endpoint autenticado `/api/advertising/voice/:org/simulate`, catálogo y mandato que el simulador comercial, con historial de los últimos 16 turnos. Ese endpoint no marca teléfonos ni ejecuta acciones sobre leads, pagos o matrículas. No se modifica la configuración de telefonía.

El usuario inicia la conversación y permite el micrófono; el modo continuo escucha y responde por turnos. En modo manual dicta, revisa la transcripción y pulsa Enviar. Puede escribir si el reconocimiento no está disponible, elegir voz española, repetir la respuesta, silenciar y limpiar. Los proveedores del navegador pueden procesar audio fuera del equipo. No se almacena audio en el CRM. El historial es temporal, aislado por empresa y se cancela al salir, cambiar de empresa o esconder la pestaña. La voz disponible depende del dispositivo; no es una prueba de la voz Google telefónica. El modelo de IA conserva su cuota o tarifa existente; esta prueba elimina los cargos de Twilio, no garantiza gratuidad del proveedor de IA.

Una llamada a un celular necesita telefonía conectada. El modo navegador nunca debe presentarse como una llamada celular efectuada.

## Conversación continua y diagnóstico de micrófono

El panel inicia con una solicitud explícita de permiso de audio. Muestra el nombre del dispositivo y un medidor local cuando AudioContext está disponible. El dictado usa el micrófono predeterminado del navegador, independiente del medidor; no se afirma que se haya probado el micrófono físico a distancia. El idioma inicial es es-MX, con opciones es-US y es-DO. Se muestran transcripciones parciales y se espera una pausa de 1.8 segundos antes de enviar. En modo continuo la escucha se reanuda al terminar la respuesta, sin pulsar Enviar. El micrófono no envía preguntas mientras habla Valeria; Interrumpir y hablar cancela la reproducción y abre el siguiente turno. Los reintentos sin voz están acotados a dos, con diagnóstico explícito al tercero.

Terminar, limpiar, ocultar pestaña, cambiar empresa o salir detienen pistas de audio, dictado, timers y peticiones pendientes. Los errores de permiso, dispositivo y red se distinguen. Las voces naturales instaladas se priorizan, pero la síntesis gratuita del navegador no garantiza una calidad neural ni la imitación de una nota de voz. El saludo es cálido y sin anuncio técnico; ante preguntas de identidad responde con honestidad que es una asistente virtual. La ficha está activa para voz en el CRM; la habilitación telefónica conserva sus requisitos de cuenta, número y presupuesto.


## Valeria unificada

Valeria Parkert usa una única ficha `agent_closer` para ventas por WhatsApp, oportunidades, seguimiento y solicitud de pago, voz en el navegador y telefonía autorizada. `agent_voice_closer` se admite como alias histórico en Team Studio; las lecturas combinan mensajes y solicitudes de ambos identificadores por empresa, y las escrituras nuevas usan el identificador canónico. Ventas y Call Center pueden acceder al mismo agente; las demás áreas conservan sus restricciones. No se eliminan conversaciones, contactos, llamadas, claves ni configuraciones de telefonía. Las llamadas siguen sujetas a proveedor, consentimiento, horarios, límites y autorización de costos; ningún pago se confirma por una afirmación verbal. Descuentos requieren aprobación.


## Pitch y preparación de conversaciones

El guion de ventas facilitado por el director se adapta a un diálogo consultivo: presentación con nombre e institución, necesidad, beneficios del curso elegido, inversión autorizada, objeción y siguiente paso. La secuencia para «lo tengo que pensar» verifica primero si la propuesta cumple con la necesidad y, tras la respuesta, pregunta qué necesita saber para decidir y avanzar hoy. Respeta negativas y no presenta matrículas activas ni pagos confirmados por una aceptación verbal. Pasantías, empleo, requisitos, avales y escasez del documento se usan únicamente si están confirmados por el catálogo o proceso autorizado.

Antes de marcar, se consulta la ficha comercial y memoria de WhatsApp vigente por clave vinculada o teléfono exacto, nunca por parecido de nombre. Las oportunidades y WhatsApp de INTECA no se consultan para otra empresa. Una vinculación ambigua o un fallo de almacenamiento impiden la preparación. Si no existe conversación vinculada, usa solo la ficha telefónica y pregunta los datos faltantes. El historial conserva su retención existente de 30 días y se suministran como máximo 16 turnos recientes, además de preferencias y estado comercial. Los datos sensibles numéricos se omiten. El contexto comercial se vuelve a consultar al conectar y se incorpora junto a las conversaciones telefónicas previas. No se crea acceso a conversaciones ajenas ni una memoria ilimitada.

El saludo se produce en el servidor con institución, nombre y tratamiento explícito si existe; no se infiere género por nombre o voz. En la prueba de navegador puede seleccionarse una ficha registrada para preparar la conversación con sus datos. La prueba general funciona sin ficha y pide el tratamiento preferido. La síntesis de navegador depende de las voces instaladas; el estilo de conversación no equivale a clonación de voz.
