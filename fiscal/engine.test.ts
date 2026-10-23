import test from 'node:test';
import assert from 'node:assert/strict';
import {
  companySchema,
  documentSchema,
  calculate,
  preflight,
  digest,
  emissionBlockers,
  FiscalService,
  FiscalError,
} from './engine.ts';
const profile = () =>
  companySchema.parse({
    legalName: 'Empresa de pruebas',
    taxId: '123456789',
    address: 'Dirección de pruebas',
    email: 'test@example.test',
    activity: 'Venta de bienes y servicios',
    enabledTypes: ['31', '32', '33', '34', '41', '43', '44', '45', '46', '47'],
    defaultTax: 'ITBIS18',
  });
const draft = (extra: Record<string, unknown> = {}) =>
  documentSchema.parse({
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
    type: '32',
    issuedOn: '2026-10-23',
    receiver: { name: 'Cliente de pruebas', taxId: '123456789' },
    items: [
      {
        description: 'Producto de pruebas',
        kind: 'goods',
        unit: 'unidad',
        quantity: '2',
        unitPrice: '100',
        discount: '10',
        tax: 'ITBIS18',
      },
    ],
    ...extra,
  });
test('exact cents, goods/services, mixed ITBIS and exemption; no AI arithmetic', () => {
  const input = draft({
    items: [
      {
        description: 'Bien',
        kind: 'goods',
        unit: 'u',
        quantity: '2',
        unitPrice: '100',
        discount: '10',
        tax: 'ITBIS18',
      },
      {
        description: 'Servicio',
        kind: 'service',
        unit: 'hora',
        quantity: '1.5',
        unitPrice: '20',
        tax: 'ITBIS16',
      },
      {
        description: 'Exento',
        kind: 'service',
        unit: 'u',
        quantity: '1',
        unitPrice: '1.005',
        tax: 'EXENTO',
      },
    ],
  });
  const t = calculate(input);
  assert.equal(t.subtotal, '231.01');
  assert.equal(t.net, '221.01');
  assert.equal(t.itbis, '39.00');
  assert.equal(t.fiscalTotal, '260.01');
  assert.equal(t.bases.EXENTO, '1.01');
  assert.equal(t.items[0].net, '190.00');
});
test('additional charges and withholding do not lower RFCE threshold total', () => {
  const t = calculate(
    draft({
      items: [
        {
          description: 'Bien',
          kind: 'goods',
          unit: 'u',
          quantity: '1',
          unitPrice: '250000',
          tax: 'EXENTO',
        },
      ],
      adjustments: [
        { kind: 'ISR_WITHHOLDING', description: 'Retención declarada', amount: '10000' },
      ],
    }),
  );
  assert.equal(t.route, 'ECF');
  assert.equal(t.amountDue, '240000.00');
  assert.equal(t.fiscalTotal, '250000.00');
});
test('RFCE below threshold, full ECF at threshold and above', () => {
  for (const [amount, route] of [
    ['249999.99', 'RFCE'],
    ['250000', 'ECF'],
    ['250000.01', 'ECF'],
  ])
    assert.equal(
      calculate(
        draft({
          items: [
            {
              description: 'Bien',
              kind: 'goods',
              unit: 'u',
              quantity: '1',
              unitPrice: amount,
              tax: 'EXENTO',
            },
          ],
        }),
      ).route,
      route,
    );
  assert.equal(
    calculate(
      draft({
        currency: 'USD',
        exchangeRate: '62.5',
        items: [
          {
            description: 'Servicio',
            kind: 'service',
            unit: 'u',
            quantity: '1',
            unitPrice: '4000',
            tax: 'EXENTO',
          },
        ],
      }),
    ).route,
    'ECF',
  );
});
test('negative numbers, thousands separators and impossible dates are refused', () => {
  assert.equal(documentSchema.safeParse({ ...draft(), issuedOn: '2026-02-30' }).success, false);
  for (const price of ['-1', '1,000', 'NaN', 'Infinity'])
    assert.equal(
      documentSchema.safeParse({ ...draft(), items: [{ ...draft().items[0], unitPrice: price }] })
        .success,
      false,
    );
});
test('excess discount and retentions fail; no credit for fake paid state', () => {
  assert.throws(
    () => calculate(draft({ items: [{ ...draft().items[0], discount: '201' }] })),
    /descuento/,
  );
  assert.throws(
    () =>
      calculate(
        draft({ adjustments: [{ kind: 'ITBIS_WITHHOLDING', description: 'Test', amount: '100' }] }),
      ),
    /retenciones/,
  );
  assert.equal(documentSchema.safeParse({ ...draft(), paymentStatus: 'paid' }).success, false);
  assert.equal(documentSchema.safeParse({ ...draft(), fiscalStatus: 'accepted' }).success, false);
});
test('document type is enabled by each company; credit/debit require reference', () => {
  const p = profile();
  p.enabledTypes = ['32'];
  assert.throws(() => preflight(p, draft({ type: '31' })), /habilitado/);
  assert.throws(() => preflight(profile(), draft({ type: '34' })), /original/);
  const r = { number: 'E310000000001', issuedOn: '2026-10-22', reason: 'Corrección', code: '1' };
  assert.equal(preflight(profile(), draft({ type: '34', reference: r })).effect, 'credit');
});
test('buyer identification and export requirements', () => {
  assert.throws(
    () => preflight(profile(), draft({ type: '31', receiver: { name: 'Cliente' } })),
    /RNC/,
  );
  assert.throws(() => preflight(profile(), draft({ type: '46' })), /extranjero/);
  assert.equal(
    preflight(
      profile(),
      draft({
        type: '46',
        receiver: { name: 'Cliente extranjero', taxId: 'FOREIGN-123', country: 'US' },
      }),
    ).currency,
    'DOP',
  );
});
test('profile metadata does not enable fiscal transmission', () => {
  const p = profile();
  p.authorizationReference = 'reference';
  p.certificateReference = 'vault/ref';
  p.certificateExpiresOn = '2030-01-01';
  assert.ok(emissionBlockers(p).length >= 3);
  assert.ok(emissionBlockers(p).some((m) => m.includes('XML')));
});
test('stable request hash and company-scoped service reads', async () => {
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
  const calls: string[] = [];
  const service = new FiscalService({
    request: async (resource) => {
      calls.push(resource);
      return [];
    },
  });
  await assert.rejects(
    service.document('company_a', '00000000-0000-4000-8000-000000000001'),
    (error: unknown) => error instanceof FiscalError && error.code === 'NOT_FOUND',
  );
  assert.match(calls[0], /organization_id=eq.company_a/);
});

test('private certificate material is not accepted in the company profile', () => {
  assert.equal(
    companySchema.safeParse({ ...profile(), privateKey: 'test-only-not-a-key' }).success,
    false,
  );
});
