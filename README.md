# Sales AI CRM

Prototipo de CRM SaaS multiempresa para ventas, marketing y atención asistida por inteligencia artificial. INTECA es la primera organización de demostración, pero el núcleo se está preparando para negocios de cualquier sector.

## Estado actual

- La interfaz funciona con datos de demostración guardados en memoria.
- Los tres endpoints de IA usan Gemini cuando `GEMINI_API_KEY` está configurada.
- Los pagos no procesan dinero: las solicitudes se conservan como pendientes.
- WhatsApp, redes sociales, correo, facturación y almacenamiento todavía no están conectados.
- El aislamiento multitenant mostrado en la interfaz aún no sustituye los controles que deben implementarse en la base de datos y el servidor.

No utilice esta versión para información o pagos reales.

## Desarrollo local

Requisitos: Node.js 22 o una versión LTS compatible.

1. Ejecute `npm install`.
2. Copie `.env.example` como `.env.local`.
3. Configure una clave de desarrollo de Gemini si necesita probar la IA.
4. Ejecute `npm run dev`.
5. Abra `http://localhost:3000`.

## Comprobaciones

- `npm run typecheck`: verifica TypeScript estricto.
- `npm run lint`: ejecuta ESLint.
- `npm run build`: genera frontend y servidor de producción.
- `npm run check`: ejecuta todas las comprobaciones anteriores.

## Próxima fase

La siguiente fase incorporará PostgreSQL, migraciones, autenticación, roles, permisos, aislamiento por organización y persistencia. Los módulos educativos pasarán a ser opcionales sobre un núcleo universal de contactos, empresas, productos, servicios, oportunidades y automatizaciones.
