import { createHash } from 'node:crypto';
import { z } from 'zod';

export const FISCAL_RULE_VERSION = 'DO-commercial-preflight-2026-10-23.1';
export { DOCUMENT_TYPES } from './contracts.ts';
export const docTypeSchema = z.enum(['31', '32', '33', '34', '41', '43', '44', '45', '46', '47']);
export const organizationSchema = z.string().regex(/^[a-zA-Z0-9_-]{3,120}$/);
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (v) => ![...v].some((c) => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0))),
      'Caracteres de control no permitidos',
    );
const optionalText = (max: number) => z.string().trim().max(max).default('');
export const decimal = (scale = 2, positive = false) =>
  z
    .string()
    .regex(
      new RegExp(`^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,${scale}})?$`),
      `Usa un importe sin separadores de miles y hasta ${scale} decimales`,
    )
    .refine((v) => !positive || /[1-9]/.test(v), 'Debe ser mayor que cero');
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v + 'T00:00:00Z')) &&
      new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v,
    'Fecha inválida',
  );
export const companySchema = z
  .object({
    legalName: text(150),
    tradeName: optionalText(150),
    taxId: z.string().regex(/^\d{9}(?:\d{2})?$/),
    address: text(250),
    email: z.string().email().max(200),
    phone: optionalText(40),
    activity: text(250),
    country: z.literal('DO').default('DO'),
    currency: z.enum(['DOP', 'USD', 'EUR']).default('DOP'),
    environment: z
      .enum(['precertification', 'certification', 'production'])
      .default('precertification'),
    enabledTypes: z
      .array(docTypeSchema)
      .min(1)
      .max(10)
      .refine((v) => new Set(v).size === v.length),
    defaultTax: z.enum(['EXENTO', 'ITBIS0', 'ITBIS16', 'ITBIS18']),
    providerName: optionalText(150),
    authorizationReference: optionalText(250),
    certificateReference: optionalText(250),
    certificateExpiresOn: z.union([date, z.literal('')]).default(''),
  })
  .strict();
export type FiscalCompany = z.infer<typeof companySchema>;
export const lineSchema = z
  .object({
    description: text(500),
    kind: z.enum(['goods', 'service']),
    unit: text(30),
    quantity: decimal(4, true),
    unitPrice: decimal(4),
    discount: decimal().default('0'),
    tax: z.enum(['EXENTO', 'ITBIS0', 'ITBIS16', 'ITBIS18']),
  })
  .strict();
export const documentSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    type: docTypeSchema,
    issuedOn: date,
    receiver: z
      .object({
        name: text(150),
        taxId: optionalText(30),
        email: z.union([z.string().email().max(200), z.literal('')]).default(''),
        country: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .default('DO'),
        address: optionalText(250),
      })
      .strict(),
    currency: z.enum(['DOP', 'USD', 'EUR']).default('DOP'),
    exchangeRate: decimal(6, true).default('1'),
    items: z.array(lineSchema).min(1).max(100),
    adjustments: z
      .array(
        z
          .object({
            kind: z.enum(['ISC', 'OTHER_TAX', 'CHARGE', 'ISR_WITHHOLDING', 'ITBIS_WITHHOLDING']),
            description: text(150),
            amount: decimal(2, true),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    reference: z
      .object({
        number: z.string().regex(/^[A-Z0-9]{11,19}$/),
        issuedOn: date,
        reason: text(250),
        code: z.enum(['1', '2', '3']),
      })
      .strict()
      .optional(),
    notes: optionalText(2000),
  })
  .strict();
export type FiscalDocumentInput = z.infer<typeof documentSchema>;
export function units(value: string, scale: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'));
}
const round = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor;
export function money(cents: bigint) {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export const digest = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
export class FiscalError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
export function calculate(input: FiscalDocumentInput) {
  let subtotal = 0n,
    discounts = 0n,
    net = 0n,
    itbis = 0n,
    extra = 0n,
    withheld = 0n;
  const bases: Record<string, bigint> = { EXENTO: 0n, ITBIS0: 0n, ITBIS16: 0n, ITBIS18: 0n };
  const items = input.items.map((item, index) => {
    const gross = round(units(item.quantity, 4) * units(item.unitPrice, 4), 1000000n),
      discount = units(item.discount, 2);
    if (discount > gross)
      throw new FiscalError(
        'INVALID_DISCOUNT',
        `El descuento supera el importe de la línea ${index + 1}.`,
      );
    const base = gross - discount,
      rate = item.tax === 'ITBIS18' ? 18n : item.tax === 'ITBIS16' ? 16n : 0n,
      tax = round(base * rate, 100n);
    subtotal += gross;
    discounts += discount;
    net += base;
    itbis += tax;
    bases[item.tax] += base;
    return {
      ...item,
      gross: money(gross),
      net: money(base),
      itbis: money(tax),
      total: money(base + tax),
    };
  });
  let retainedItbis = 0n;
  for (const item of input.adjustments) {
    const amount = units(item.amount, 2);
    if (item.kind.endsWith('WITHHOLDING')) withheld += amount;
    else extra += amount;
    if (item.kind === 'ITBIS_WITHHOLDING') retainedItbis += amount;
  }
  const fiscalTotal = net + itbis + extra;
  if (retainedItbis > itbis || withheld > fiscalTotal)
    throw new FiscalError(
      'INVALID_WITHHOLDING',
      'Las retenciones exceden el ITBIS o el total del documento.',
    );
  if (fiscalTotal <= 0n || fiscalTotal > 999999999999n)
    throw new FiscalError(
      'INVALID_TOTAL',
      'El total debe ser positivo y estar dentro del límite del motor.',
    );
  if (input.currency === 'DOP' && units(input.exchangeRate, 6) !== 1000000n)
    throw new FiscalError('INVALID_EXCHANGE_RATE', 'En DOP la tasa de cambio debe ser 1.');
  const totalDop = round(fiscalTotal * units(input.exchangeRate, 6), 1000000n);
  return {
    items,
    subtotal: money(subtotal),
    discounts: money(discounts),
    net: money(net),
    itbis: money(itbis),
    additional: money(extra),
    withholdings: money(withheld),
    fiscalTotal: money(fiscalTotal),
    amountDue: money(fiscalTotal - withheld),
    fiscalTotalDop: money(totalDop),
    bases: Object.fromEntries(Object.entries(bases).map(([k, v]) => [k, money(v)])),
    route: input.type === '32' && totalDop < 25000000n ? 'RFCE' : 'ECF',
    effect: input.type === '34' ? 'credit' : 'debit',
    currency: input.currency,
  };
}
export function preflight(company: FiscalCompany, input: FiscalDocumentInput) {
  if (!company.enabledTypes.includes(input.type))
    throw new FiscalError(
      'TYPE_NOT_ENABLED',
      'Ese tipo de comprobante no está habilitado para esta empresa.',
    );
  if (
    input.receiver.country === 'DO' &&
    input.receiver.taxId &&
    !/^\d{9}(?:\d{2})?$/.test(input.receiver.taxId)
  )
    throw new FiscalError(
      'INVALID_RECEIVER',
      'Revisa el formato de la identificación dominicana del receptor.',
    );
  if (input.type === '31' && !/^\d{9}(?:\d{2})?$/.test(input.receiver.taxId))
    throw new FiscalError(
      'RECEIVER_REQUIRED',
      'El crédito fiscal requiere RNC o cédula del comprador.',
    );
  if (['33', '34'].includes(input.type) && !input.reference)
    throw new FiscalError(
      'REFERENCE_REQUIRED',
      'La nota de crédito o débito necesita el comprobante original, fecha y motivo.',
    );
  if (input.reference && input.reference.issuedOn > input.issuedOn)
    throw new FiscalError(
      'INVALID_REFERENCE',
      'La referencia no puede ser posterior al documento.',
    );
  if (
    ['46', '47'].includes(input.type) &&
    (input.receiver.country === 'DO' || !input.receiver.taxId)
  )
    throw new FiscalError(
      'FOREIGN_RECEIVER_REQUIRED',
      'Indica país extranjero e identificación del receptor.',
    );
  const totals = calculate(input);
  if (input.type === '32' && units(totals.fiscalTotalDop, 2) >= 25000000n && !input.receiver.taxId)
    throw new FiscalError(
      'RECEIVER_REQUIRED',
      'El consumo desde RD$250,000 requiere identificar al comprador.',
    );
  return totals;
}
export function emissionBlockers(company: FiscalCompany): string[] {
  const blockers = [
    'Conectar y verificar un proveedor fiscal autorizado o completar el adaptador DGII propio.',
    'Validar el XML contra el XSD vigente y las reglas condicionales del tipo seleccionado.',
    'Verificar autorización de secuencias, firma digital y pruebas oficiales antes de transmitir.',
  ];
  if (!company.authorizationReference)
    blockers.push('Registrar evidencia de autorización del emisor por la DGII.');
  if (!company.certificateReference || !company.certificateExpiresOn)
    blockers.push('Configurar certificado y firmante en el almacén seguro del proveedor.');
  else if (company.certificateExpiresOn < new Date().toISOString().slice(0, 10))
    blockers.push('El certificado registrado está vencido.');
  return blockers;
}
export type Store = { request(resource: string, method?: string, body?: unknown): Promise<any> };
export class FiscalService {
  private store: Store;
  constructor(store: Store) {
    this.store = store;
  }
  async company(org: string) {
    return (
      await this.store.request(
        `crm_fiscal_companies?organization_id=eq.${encodeURIComponent(org)}&select=*`,
      )
    )[0];
  }
  async snapshot(org: string, offset = 0) {
    const company = await this.company(org);
    if (!company) return { company: null, documents: [], events: [], blockers: [], hasMore: false };
    const documents = await this.store.request(
      `crm_fiscal_documents?organization_id=eq.${encodeURIComponent(org)}&select=*&order=created_at.desc,id&limit=50&offset=${offset}`,
    );
    return {
      company,
      documents,
      blockers: emissionBlockers(company.profile),
      hasMore: documents.length === 50,
    };
  }
  async saveCompany(org: string, profile: FiscalCompany, actor: string) {
    return this.store.request('rpc/crm_save_fiscal_company', 'POST', {
      p_org: org,
      p_profile: profile,
      p_hash: digest(profile),
      p_actor: actor,
    });
  }
  async create(org: string, input: FiscalDocumentInput, actor: string) {
    const company = await this.company(org);
    if (!company)
      throw new FiscalError('PROFILE_REQUIRED', 'Guarda primero el perfil fiscal de esta empresa.');
    const totals = preflight(companySchema.parse(company.profile), input);
    return this.store.request('rpc/crm_create_fiscal_draft', 'POST', {
      p_org: org,
      p_key: input.idempotencyKey,
      p_request_hash: digest(input),
      p_profile_hash: digest(company.profile),
      p_payload: input,
      p_totals: totals,
      p_issuer: company.profile,
      p_rules: FISCAL_RULE_VERSION,
      p_actor: actor,
    });
  }
  async document(org: string, id: string) {
    const row = (
      await this.store.request(
        `crm_fiscal_documents?organization_id=eq.${encodeURIComponent(org)}&id=eq.${id}&select=*`,
      )
    )[0];
    if (!row) throw new FiscalError('NOT_FOUND', 'Documento no encontrado en esta empresa.');
    return row;
  }
  async review(org: string, id: string, actor: string) {
    return this.store.request('rpc/crm_review_fiscal_draft', 'POST', {
      p_org: org,
      p_id: id,
      p_actor: actor,
    });
  }
}
