# Matriz operativa de agentes, conectores y pruebas

Esta matriz evita declarar como “100% conectado” algo que solo está dibujado en
pantalla. Cada agente debe tener una configuración efectiva, una operación
probada y una evidencia.

Estados permitidos:

- **No configurado:** no hay variables ni credenciales.
- **Pendiente autorización:** faltan OAuth, revisión, certificado o aprobación.
- **Conectado sin validar:** hay credenciales, pero no se hizo prueba.
- **Conectado y probado:** existe prueba exitosa con evidencia.
- **Limitado por permisos:** el proveedor responde, pero faltan scopes/activos.
- **Degradado:** puede operar parcialmente.
- **Fallido:** hubo error real y debe revisarse.

| Agente | Función | Plataformas | Configuración efectiva | Operación probada | Evidencia | Estado | Pendiente |
|---|---|---|---|---|---|---|---|
| Agente IA WhatsApp | Recibir y responder leads | WhatsApp, Gemini, Supabase | Render/Supabase por empresa | Webhook challenge, mensaje entrante, envío texto | Audit event + ID mensaje | Preparado | Token permanente, WABA, suscripción `messages` |
| Agente IA Omnicanal | Enrutar leads multicanal | Web, Meta, Google Ads, WhatsApp | Variables globales + cuenta empresa | Recibir formulario/webhook | Audit event + lead creado | Preparado | Permisos Meta/Google reales |
| Agente IA Conversión y Matrícula | Registrar leads, convertir a estudiantes y enviar bienvenida | WhatsApp, formularios, pagos, campus, Supabase | Render/Supabase por empresa | `POST /api/agents/conversion/process-lead` con y sin pago confirmado | Lead + matrícula + audit event | Preparado | API real del campus para sincronización automática |
| Agente IA Ventas | Seguimiento y cierre | Gemini, Supabase, WhatsApp, pagos | Por empresa | Crear tarea, actualizar oportunidad | Job + ejecución | Preparado | Pasarela y WhatsApp reales |
| Agente IA Marketing | Copys, campañas y embudo | Gemini, Meta, Google, YouTube | Por empresa | Generar brief/copy | Asset/brief guardado | Preparado | Publicación requiere aprobación |
| Agente IA Publicidad | Pauta y presupuesto | Meta Ads, Google Ads, tarjeta pauta | Por empresa | Leer cuenta/campañas | Métrica leída | Pendiente | OAuth, billing y límites de gasto |
| Agente IA Creativo | Flyers, imágenes y carruseles | IA creativa, Storage, Meta/WhatsApp | Por empresa | Generar asset no público | Archivo en storage | Pendiente | Proveedor imagen/video |
| Agente IA Video | Guion, video y YouTube | Gemini, video IA, YouTube | Por empresa | Preparar metadata o subir prueba privada | ID video/job | Pendiente | OAuth YouTube y cuota |
| Agente e-CF | Facturación electrónica | Pagos, DGII/proveedor, Supabase | Global + empresa | Validar datos fiscales y XML | XML/PDF/respuesta proveedor | Pendiente | Certificado, RNC, secuencias, ambiente DGII |
| Agente Contable | Reportes y conciliaciones | Supabase, pagos, DGII | Por empresa | Generar reporte borrador | Reporte + fuente | Preparado | Revisión humana para definitivo |
| Agente Compras RD | Requisición y órdenes | Supabase, notificaciones | Por empresa | Crear requisición/OC borrador | OC + auditoría | Preparado | Aprobación humana de compra |
| Agente Dueño | Notificaciones ejecutivas | WhatsApp/email, Supabase | Dueño global | Enviar aviso de prueba | Audit event | Pendiente | Canal de aviso autorizado |

Reglas de ejecución:

1. Una acción externa de escritura requiere permisos, límites y auditoría.
2. Una lectura exitosa no prueba capacidad de publicación, gasto o emisión fiscal.
3. Si un resultado externo es incierto, no repetir ciegamente; guardar estado
   `resultado_incierto` y escalar.
4. Nunca usar credenciales de INTECA para otra empresa.
5. Nunca mezclar conocimiento, leads, campañas, pagos ni archivos entre empresas.
6. Los agentes pueden colaborar creando tareas internas, no prestándose credenciales.

Endpoint de diagnóstico incluido:

```txt
GET /api/agents/runtime/manifest
```

Ese endpoint devuelve agentes, conectores requeridos, conectores opcionales,
variables faltantes y estado operativo calculado.
