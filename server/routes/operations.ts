import {licenseGuard} from '../licence';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requirePermission, type AuthenticatedRequest } from '../security';
import { validateRelations } from '../tenant-relations';
import { audit } from '../audit';

export const operationsRouter = Router();
operationsRouter.use(authenticate,licenseGuard);
const text = z.string().trim().min(1).max(200);
const optionalId = z.string().min(1).nullable().optional();
const money = z.coerce.number().finite().min(0).max(999999999);
const currency = z.string().regex(/^[A-Z]{3}$/);

operationsRouter.patch('/products/:id', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = z.object({ name: text, description: z.string().max(5000), sku: z.string().max(80).nullable(), type: z.enum(['PRODUCT','SERVICE','COURSE']), price: money, currency, active: z.boolean() }).partial().parse(req.body);
    const result = await prisma.product.updateMany({ where: { id: req.params.id, organizationId: req.auth!.organizationId }, data: { ...data, ...(data.sku === '' ? { sku: null } : {}) } });
    if (!result.count) return res.status(404).json({ error: 'RECORD_NOT_FOUND' });
    await audit(req, req.auth, 'product.updated', 'Product', req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
});

const companySchema = z.object({ name: text, email: z.string().email().or(z.literal('')).optional(), phone: z.string().max(40).optional(), website: z.string().url().or(z.literal('')).optional() });
operationsRouter.get('/companies', requirePermission('crm.read'), async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ items: await prisma.company.findMany({ where: { organizationId: req.auth!.organizationId }, orderBy: { name: 'asc' } }) }); } catch (error) { next(error); }
});
operationsRouter.post('/companies', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const item = await prisma.company.create({ data: { ...companySchema.parse(req.body), organizationId: req.auth!.organizationId } });
    await audit(req, req.auth, 'company.created', 'Company', item.id);
    res.status(201).json({ item });
  } catch (error) { next(error); }
});
operationsRouter.patch('/companies/:id', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await prisma.company.updateMany({ where: { id: req.params.id, organizationId: req.auth!.organizationId }, data: companySchema.partial().parse(req.body) });
    if (!result.count) return res.status(404).json({ error: 'RECORD_NOT_FOUND' });
    await audit(req, req.auth, 'company.updated', 'Company', req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
});
operationsRouter.patch('/deals/:id', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = z.object({ title: text, value: money, currency, stageId: text, status: z.enum(['OPEN','WON','LOST']), probability: z.number().int().min(0).max(100), lostReason: z.string().max(2000), contactId: optionalId, companyId: optionalId, productId: optionalId }).partial().parse(req.body);
    const organizationId = req.auth!.organizationId;
    const existing = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId } });
    if (!existing) return res.status(404).json({ error: 'RECORD_NOT_FOUND' });
    if (data.stageId && !(await prisma.stage.count({ where: { id: data.stageId, pipelineId: existing.pipelineId } }))) return res.status(400).json({ error: 'INVALID_PIPELINE_STAGE' });
    if (!(await validateRelations(organizationId, data))) return res.status(400).json({ error: 'INVALID_RELATED_RECORD' });
    const item = await prisma.deal.update({ where: { id: existing.id }, data });
    await audit(req, req.auth, 'deal.updated', 'Deal', item.id);
    res.json({ item });
  } catch (error) { next(error); }
});
const activitySchema = z.object({ title: text, description: z.string().max(5000).optional(), type: z.enum(['NOTE','TASK','CALL','EMAIL','MEETING','FOLLOW_UP']), contactId: optionalId, dealId: optionalId, dueAt: z.string().datetime().nullable().optional(), completedAt: z.string().datetime().nullable().optional() });
operationsRouter.get('/activities', requirePermission('crm.read'), async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ items: await prisma.activity.findMany({ where: { organizationId: req.auth!.organizationId }, orderBy: { dueAt: 'asc' } }) }); } catch (error) { next(error); }
});
operationsRouter.post('/activities', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = activitySchema.parse(req.body);
    if (!(await validateRelations(req.auth!.organizationId, data))) return res.status(400).json({ error: 'INVALID_RELATED_RECORD' });
    const item = await prisma.activity.create({ data: { ...data, organizationId: req.auth!.organizationId } });
    await audit(req, req.auth, 'activity.created', 'Activity', item.id);
    res.status(201).json({ item });
  } catch (error) { next(error); }
});
operationsRouter.patch('/activities/:id', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = activitySchema.partial().parse(req.body);
    if (!(await validateRelations(req.auth!.organizationId, data))) return res.status(400).json({ error: 'INVALID_RELATED_RECORD' });
    const result = await prisma.activity.updateMany({ where: { id: req.params.id, organizationId: req.auth!.organizationId }, data });
    if (!result.count) return res.status(404).json({ error: 'RECORD_NOT_FOUND' });
    await audit(req, req.auth, 'activity.updated', 'Activity', req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
});
operationsRouter.patch('/organization', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = z.object({ name: text, currency, timezone: text.refine((v) => { try { new Intl.DateTimeFormat('es', { timeZone: v }); return true; } catch { return false; } }) }).parse(req.body);
    const item = await prisma.organization.update({ where: { id: req.auth!.organizationId }, data });
    await audit(req, req.auth, 'organization.updated', 'Organization', item.id);
    res.json({ item });
  } catch (error) { next(error); }
});
operationsRouter.post('/pipelines', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = z.object({ name: text, stages: z.array(text).min(2).max(20) }).parse(req.body);
    const item = await prisma.pipeline.create({ data: { name: data.name, organizationId: req.auth!.organizationId, stages: { create: data.stages.map((name, position) => ({ name, position })) } }, include: { stages: true } });
    await audit(req, req.auth, 'pipeline.created', 'Pipeline', item.id);
    res.status(201).json({ item });
  } catch (error) { next(error); }
});
operationsRouter.get('/team', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ items: await prisma.membership.findMany({ where: { organizationId: req.auth!.organizationId }, select: { id: true, active: true, role: { select: { code: true } }, user: { select: { name: true, email: true } } } }) }); } catch (error) { next(error); }
});
operationsRouter.post('/team', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = z.object({ name: text, email: z.string().email().transform((v) => v.toLowerCase()), password: z.string().min(10).refine((v) => Buffer.byteLength(v) <= 72), role: z.enum(['MANAGER','SALES','VIEWER']) }).parse(req.body);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: data.role } });
    if (await prisma.user.findUnique({ where: { email: data.email } })) return res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS' });
    const passwordHash = await bcrypt.hash(data.password, 12);
    const item = await prisma.membership.create({ data: { organization: { connect: { id: req.auth!.organizationId } }, role: { connect: { id: role.id } }, user: { create: { name: data.name, email: data.email, passwordHash } } }, select: { id: true } });
    await audit(req, req.auth, 'member.created', 'Membership', item.id);
    res.status(201).json({ item });
  } catch (error) { next(error); }
});
operationsRouter.patch('/team/:id', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = z.object({ active: z.boolean() }).parse(req.body);
    const result = await prisma.membership.updateMany({ where: { id: req.params.id, organizationId: req.auth!.organizationId, role: { code: { not: 'OWNER' } } }, data });
    if (!result.count) return res.status(404).json({ error: 'RECORD_NOT_FOUND' });
    await audit(req, req.auth, 'member.updated', 'Membership', req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
});
operationsRouter.post('/password', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = z.object({ current: z.string(), password: z.string().min(10).refine((v) => Buffer.byteLength(v) <= 72) }).parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
    if (!(await bcrypt.compare(data.current, user.passwordHash))) return res.status(400).json({ error: 'INVALID_CREDENTIALS' });
    const passwordHash = await bcrypt.hash(data.password, 12);
    await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { passwordHash } }), prisma.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } })]);
    res.json({ success: true });
  } catch (error) { next(error); }
});
operationsRouter.get('/audit', requirePermission('settings.manage'), async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ items: await prisma.auditLog.findMany({ where: { organizationId: req.auth!.organizationId }, orderBy: { createdAt: 'desc' }, take: 100 }) }); } catch (error) { next(error); }
});
