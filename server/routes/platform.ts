import {licenseGuard} from '../licence';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { audit } from '../audit';
import { authenticate, requirePermission, type AuthenticatedRequest } from '../security';

import { validateRelations } from '../tenant-relations';

export const platformRouter = Router();
platformRouter.use(authenticate,licenseGuard);

platformRouter.get('/organization', async (req: AuthenticatedRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.auth!.organizationId },
      include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 }, modules: true },
    });
    res.json({ success: true, organization });
  } catch (error) { next(error); }
});

platformRouter.get('/integrations', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const configured = await prisma.integrationConnection.findMany({ where: { organizationId: req.auth!.organizationId } });
    const providers = ['WHATSAPP', 'EMAIL', 'SMS', 'META', 'TELEGRAM', 'STRIPE', 'PAYPAL', 'LOCAL_GATEWAY'];
    const byProvider = new Map(configured.map((item) => [item.provider, item]));
    res.json({
      success: true,
      items: providers.map((provider) => (byProvider.has(provider) ? { provider, status: byProvider.get(provider)!.status, lastCheckedAt: byProvider.get(provider)!.lastCheckedAt } : null) ?? { provider, status: 'NOT_CONFIGURED' }),
    });
  } catch (error) { next(error); }
});

platformRouter.put('/integrations/:provider/sandbox', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const provider = req.params.provider.toUpperCase();
    const allowed = ['WHATSAPP', 'EMAIL', 'SMS', 'META', 'TELEGRAM', 'STRIPE', 'PAYPAL', 'LOCAL_GATEWAY'];
    if (!allowed.includes(provider)) return res.status(400).json({ success: false, error: 'UNSUPPORTED_PROVIDER' });
    const item = await prisma.integrationConnection.upsert({
      where: { organizationId_provider: { organizationId: req.auth!.organizationId, provider } },
      update: { status: 'SANDBOX', encryptedConfig: null, lastError: null, lastCheckedAt: new Date() },
      create: { organizationId: req.auth!.organizationId, provider, status: 'SANDBOX', lastCheckedAt: new Date() },
    });
    await audit(req, req.auth, 'integration.sandbox_enabled', 'IntegrationConnection', item.id, { provider });
    res.json({ success: true, item, warning: 'SANDBOX_DOES_NOT_SEND_MESSAGES_OR_PROCESS_MONEY' });
  } catch (error) { next(error); }
});

const paymentSchema = z.object({
  contactId: z.string().optional(),
  productId: z.string().optional(),
  amount: z.coerce.number().positive().max(999_999_999),
  currency: z.string().length(3).default('DOP'),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

platformRouter.post('/payments/sandbox', requirePermission('payments.manage'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    if (!(await validateRelations(req.auth!.organizationId, parsed.data))) return res.status(400).json({ error: 'INVALID_RELATED_RECORD' });
    const idempotencyKey = parsed.data.idempotencyKey ?? randomUUID();
    const existing = await prisma.payment.findUnique({
      where: { organizationId_idempotencyKey: { organizationId: req.auth!.organizationId, idempotencyKey } },
    });
    if (existing) return res.json({ success: true, item: existing, idempotentReplay: true });
    const item = await prisma.payment.create({
      data: {
        ...parsed.data,
        idempotencyKey,
        organizationId: req.auth!.organizationId,
        provider: 'SANDBOX',
        status: 'PENDING',
        metadata: { warning: 'No money was processed' },
      },
    });
    await audit(req, req.auth, 'payment.sandbox_created', 'Payment', item.id);
    res.status(201).json({ success: true, item, warning: 'NO_MONEY_PROCESSED' });
  } catch (error) { next(error); }
});

platformRouter.get('/payments', requirePermission('payments.read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const items = await prisma.payment.findMany({ where: { organizationId: req.auth!.organizationId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, items });
  } catch (error) { next(error); }
});

platformRouter.post('/payments/webhooks/:provider', (_req, res) => {
  res.status(501).json({
    success: false,
    error: 'PROVIDER_NOT_CONFIGURED',
    message: 'Configure an official provider and signature secret before enabling webhooks.',
  });
});

const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS', 'META', 'TELEGRAM']),
  audience: z.record(z.string(), z.unknown()).default({}),
  content: z.record(z.string(), z.unknown()).default({}),
  scheduledAt: z.coerce.date().optional(),
});

platformRouter.get('/campaigns', requirePermission('crm.read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const items = await prisma.campaign.findMany({ where: { organizationId: req.auth!.organizationId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, items });
  } catch (error) { next(error); }
});

platformRouter.post('/campaigns', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    const item = await prisma.campaign.create({
      data: {
        ...parsed.data,
        audience: parsed.data.audience as Prisma.InputJsonValue,
        content: parsed.data.content as Prisma.InputJsonValue,
        status: 'DRAFT',
        organizationId: req.auth!.organizationId,
      },
    });
    await audit(req, req.auth, 'campaign.draft_created', 'Campaign', item.id);
    res.status(201).json({ success: true, item, warning: 'DRAFT_NOT_SENT' });
  } catch (error) { next(error); }
});

platformRouter.post('/documents/upload-request', requirePermission('crm.write'), (_req, res) => {
  res.status(503).json({
    success: false,
    error: 'DOCUMENT_STORAGE_NOT_CONFIGURED',
    requirements: ['S3-compatible storage', 'malware scanner', 'signed URL secret'],
  });
});
