import express from 'express';
import { z } from 'zod';
import {
  companySchema,
  documentSchema,
  organizationSchema,
  FiscalService,
  FiscalError,
  preflight,
  emissionBlockers,
  FISCAL_RULE_VERSION,
  type Store,
} from './engine.ts';
import { DOCUMENT_TYPES } from './contracts.ts';
import registry from './dgii-reference-registry.json';
const uuid = z.string().uuid();
const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const DB_ERRORS: Record<string, string> = {
  FISCAL_IDEMPOTENCY: 'Este identificador ya pertenece a otro documento. Crea una solicitud nueva.',
  FISCAL_PROFILE_CHANGED:
    'El perfil fiscal cambió. Conserva este borrador y prepara otro con los datos actuales.',
  FISCAL_ISSUER_LOCKED:
    'Esta empresa ya tiene documentos. Registra una empresa nueva para un RNC distinto.',
  FISCAL_NOT_FOUND: 'No se encontró el documento en esta empresa.',
  FISCAL_STATE: 'El estado del documento no permite esa operación.',
  FISCAL_IMMUTABLE: 'Los importes y datos guardados son inmutables.',
  FISCAL_PROFILE_REQUIRED: 'Completa el perfil fiscal de la empresa.',
  FISCAL_TYPE: 'Tipo no habilitado para esta empresa.',
};
function fail(res: express.Response, error: unknown) {
  if (error instanceof z.ZodError)
    return res
      .status(400)
      .json({
        error: 'Revisa los datos del formulario.',
        fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
  if (error instanceof FiscalError)
    return res
      .status(error.code === 'NOT_FOUND' ? 404 : 409)
      .json({ error: error.message, code: error.code });
  const code = error instanceof Error ? error.message : '';
  return res
    .status(DB_ERRORS[code] ? 409 : 503)
    .json({
      error:
        DB_ERRORS[code] ||
        'No se pudo guardar o consultar el almacenamiento fiscal. La operación no está confirmada.',
      code: DB_ERRORS[code] ? code : 'FISCAL_STORAGE_UNAVAILABLE',
    });
}
export function fiscalPrint(row: any): string {
  const p = row.payload,
    t = row.totals,
    issuer = row.issuer_snapshot;
  const html = (value: unknown) => escape(value);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Revisión comercial ${html(row.id)}</title><style>body{font:14px Arial;color:#182b40;margin:35px}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:9px;text-align:left}.warning{background:#fff0cf;padding:14px;font-weight:bold}small{color:#536477}</style></head><body><h1>${html(issuer.tradeName || issuer.legalName)}</h1><p>${html(issuer.legalName)} · RNC ${html(issuer.taxId)}<br>${html(issuer.address)}<br>${html(issuer.email)} · ${html(issuer.phone)}</p><p class="warning">BORRADOR COMERCIAL — SIN VALIDEZ FISCAL. No transmitido a la DGII.</p><p>Tipo solicitado: ${html(p.type)} ${html(DOCUMENT_TYPES[p.type as keyof typeof DOCUMENT_TYPES])} · Fecha ${html(p.issuedOn)} · Ambiente ${html(row.environment)}</p><p>Cliente: ${html(p.receiver.name)} · Identificación: ${html(p.receiver.taxId || 'Pendiente/no aplica')}<br>${html(p.receiver.address)} · ${html(p.receiver.email)}</p><table><thead><tr><th>Bien o servicio</th><th>Cantidad / unidad</th><th>Precio</th><th>Descuento</th><th>Base</th><th>ITBIS</th><th>Total</th></tr></thead><tbody>${t.items.map((i: any) => `<tr><td>${html(i.description)} (${html(i.kind)})</td><td>${html(i.quantity)} ${html(i.unit)}</td><td>${html(i.unitPrice)}</td><td>${html(i.discount)}</td><td>${html(i.net)}</td><td>${html(i.itbis)} (${html(i.tax)})</td><td>${html(i.total)}</td></tr>`).join('')}</tbody></table><p>Moneda ${html(p.currency)} · Tasa DOP ${html(p.exchangeRate)}</p><p>Subtotal ${html(t.subtotal)} · Descuentos ${html(t.discounts)} · Base neta ${html(t.net)}<br>ITBIS ${html(t.itbis)} · Adicionales ${html(t.additional)}<br><strong>Total del documento ${html(t.fiscalTotal)}</strong><br>Retenciones ${html(t.withholdings)} · <strong>Saldo calculado ${html(t.amountDue)}</strong></p>${p.adjustments.length ? `<h2>Ajustes declarados</h2><ul>${p.adjustments.map((a: any) => `<li>${html(a.kind)}: ${html(a.description)} · ${html(a.amount)}</li>`).join('')}</ul>` : ''}${p.reference ? `<p>Referencia ${html(p.reference.number)} · ${html(p.reference.issuedOn)} · ${html(p.reference.reason)}</p>` : ''}<p>${html(p.notes)}</p><small>Documento interno ${html(row.id)} · Estado ${html(row.status)} · Reglas ${html(row.rule_version)}<br>e-NCF, firma, XML fiscal y QR: pendientes de emisión verificada. El saldo calculado no acredita cobro.</small></body></html>`;
}
export function createFiscalRouter(store: Store, actor: () => string) {
  const router = express.Router(),
    service = new FiscalService(store);
  const action =
    (run: (req: express.Request, res: express.Response) => Promise<unknown>) =>
    (req: express.Request, res: express.Response) => {
      void run(req, res).catch((e) => fail(res, e));
    };
  router.get('/registry', (_req, res) =>
    res.json({
      source: registry.source,
      retrievedAt: registry.retrievedAt,
      activation: registry.activation,
      ruleVersion: FISCAL_RULE_VERSION,
      records: registry.records.map(({ gzipBase64: _, ...record }) => record),
    }),
  );
  router.get(
    '/companies',
    action(async (_req, res) =>
      res.json(
        await store.request(
          'crm_fiscal_companies?select=organization_id,profile,updated_at&order=organization_id&limit=500',
        ),
      ),
    ),
  );
  router.use('/:org', (req, res, next) => {
    if (!organizationSchema.safeParse(req.params.org).success)
      return res.status(400).json({ error: 'Empresa inválida.' });
    next();
  });
  router.get(
    '/:org',
    action(async (req, res) => {
      const page = z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(req.query.offset || 0);
      res.json(await service.snapshot(String(req.params.org), page));
    }),
  );
  router.post(
    '/:org/profile',
    action(async (req, res) =>
      res.json(
        await service.saveCompany(String(req.params.org), companySchema.parse(req.body), actor()),
      ),
    ),
  );
  router.post(
    '/:org/calculate',
    action(async (req, res) => {
      const row = await service.company(String(req.params.org));
      if (!row) throw new FiscalError('PROFILE_REQUIRED', 'Guarda primero el perfil fiscal.');
      res.json({
        totals: preflight(companySchema.parse(row.profile), documentSchema.parse(req.body)),
        fiscalValid: false,
        ruleVersion: FISCAL_RULE_VERSION,
      });
    }),
  );
  router.post(
    '/:org/documents',
    action(async (req, res) =>
      res
        .status(201)
        .json(
          await service.create(String(req.params.org), documentSchema.parse(req.body), actor()),
        ),
    ),
  );
  router.param('id', (req, res, next, id) => {
    if (!uuid.safeParse(id).success) return res.status(400).json({ error: 'Documento inválido.' });
    next();
  });
  router.get(
    '/:org/documents/:id',
    action(async (req, res) =>
      res.json(await service.document(String(req.params.org), String(req.params.id))),
    ),
  );
  router.get(
    '/:org/documents/:id/events',
    action(async (req, res) => {
      await service.document(String(req.params.org), String(req.params.id));
      res.json(
        await store.request(
          `crm_fiscal_events?organization_id=eq.${encodeURIComponent(String(req.params.org))}&document_id=eq.${req.params.id}&select=*&order=created_at&limit=200`,
        ),
      );
    }),
  );
  router.get(
    '/:org/documents/:id/package',
    action(async (req, res) => {
      const row = await service.document(String(req.params.org), String(req.params.id));
      res.set('Content-Disposition', `attachment; filename="paquete-comercial-${row.id}.json"`);
      res.json({
        document: row,
        fiscalValid: false,
        xml: null,
        digitalSignature: null,
        eNcf: null,
        trackId: null,
        productionReady: false,
        notice:
          'Paquete para revisión o integración. No es un XML fiscal firmado ni un comprobante emitido.',
      });
    }),
  );
  router.get(
    '/:org/documents/:id/print',
    action(async (req, res) => {
      const row = await service.document(String(req.params.org), String(req.params.id));
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="borrador-comercial-${row.id}.html"`,
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      });
      res.send(fiscalPrint(row));
    }),
  );
  router.post(
    '/:org/documents/:id/review',
    action(async (req, res) => {
      const body = z
        .object({ reviewed: z.literal(true), expectedHash: z.string().regex(/^[a-f0-9]{64}$/) })
        .strict()
        .parse(req.body);
      const row = await service.document(String(req.params.org), String(req.params.id));
      if (row.request_hash !== body.expectedHash)
        throw new FiscalError('CHANGED', 'Actualiza el documento antes de revisar.');
      res.json(await service.review(String(req.params.org), String(req.params.id), actor()));
    }),
  );
  router.post(
    '/:org/documents/:id/cancel',
    action(async (req, res) => {
      z.object({ confirmed: z.literal(true) })
        .strict()
        .parse(req.body);
      res.json(
        await store.request('rpc/crm_cancel_fiscal_draft', 'POST', {
          p_org: String(req.params.org),
          p_id: String(req.params.id),
          p_actor: actor(),
        }),
      );
    }),
  );
  router.post(
    '/:org/documents/:id/issue',
    action(async (req, res) => {
      const row = await service.document(String(req.params.org), String(req.params.id));
      const company = await service.company(String(req.params.org));
      return res
        .status(409)
        .json({
          code: 'FISCAL_ISSUANCE_NOT_CONNECTED',
          error: 'Emisión fiscal pendiente de integración y certificación de esta empresa.',
          transmitted: false,
          documentId: row.id,
          blockers: emissionBlockers(company.profile),
        });
    }),
  );
  return router;
}
