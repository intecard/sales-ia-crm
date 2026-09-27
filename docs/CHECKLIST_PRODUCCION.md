# Checklist de produccion

## Antes de subir a GitHub

- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar `npm run build`.
- [ ] Confirmar que `.env.local` no se sube.
- [ ] Confirmar que `node_modules` no se sube.
- [ ] Confirmar que `Dockerfile` no llama `seed.cjs`.

## En Render

- [ ] Build Command: `npm ci && npm run build`.
- [ ] Start Command: `node dist/server.cjs`.
- [ ] `NODE_ENV=production`.
- [ ] `DEPLOYMENT_MODE=production`.
- [ ] `VITE_DEPLOYMENT_MODE=production`.
- [ ] `APP_URL=https://sales.ia.crm.inteca.com.do`.
- [ ] Health check `/api/health`.

## Dominio

- [ ] `sales.ia.crm.inteca.com.do` apuntando a Render.
- [ ] SSL activo.
- [ ] Abrir con `https`.

## Meta / WhatsApp

- [ ] Callback URL configurado.
- [ ] Verify Token igual al de Render.
- [ ] Evento `messages` suscrito.
- [ ] Token permanente o token valido configurado.
- [ ] Phone Number ID configurado.

## Operacion

- [ ] Probar crear lead.
- [ ] Probar chat IA.
- [ ] Probar generar campaña.
- [ ] Probar crear solicitud de pago.
- [ ] Probar auditoria.
- [ ] Revisar `/api/audit/events`.
- [ ] Revisar `/api/runtime/config`.

