import {licenseGuard} from '../licence';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { audit } from '../audit';
import { authenticate, requirePermission, type AuthenticatedRequest } from '../security';

import { validateRelations } from '../tenant-relations';

export const crmRouter = Router();
crmRouter.use(authenticate,licenseGuard);

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().max(200).optional(),
});

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  source: z.string().max(100).optional(),
  status: z.enum(['ACTIVE', 'WON', 'LOST', 'PAUSED']).optional(),
  tags: z.array(z.string().max(50)).max(30).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

crmRouter.get('/contacts', requirePermission('crm.read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_QUERY' });
    const { page, pageSize, search } = parsed.data;
    const where = {
      organizationId: req.auth!.organizationId,
      ...(search ? { OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.contact.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.contact.count({ where }),
    ]);
    res.json({ success: true, items, pagination: { page, pageSize, total } });
  } catch (error) { next(error); }
});

crmRouter.post('/contacts', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    const item = await prisma.$transaction(async (tx) => {
    const created = await tx.contact.create({
      data: {
        ...parsed.data,
        metadata: parsed.data.metadata as Prisma.InputJsonValue,
        email: parsed.data.email || null,
        organizationId: req.auth!.organizationId,
      },
    });
    const workflows = await tx.automation.findMany({where:{organizationId:req.auth!.organizationId,active:true}});
    for (const workflow of workflows) {
      const trigger = workflow.trigger as {event?:string};
      const action = workflow.actions as {type?:string;title?:string;delayHours?:number};
      if(trigger.event === 'CONTACT_CREATED' && action.type === 'FOLLOW_UP') {
        await tx.activity.create({data:{organizationId:req.auth!.organizationId,contactId:created.id,type:'FOLLOW_UP',title:(action.title || 'Contactar prospecto').slice(0,200),description:'Creado por automatización: '+workflow.name,dueAt:new Date(Date.now()+Number(action.delayHours||0)*3600000)}});
      }
    }
    return created;
    });
    await audit(req, req.auth, 'contact.created', 'Contact', item.id);
    res.status(201).json({ success: true, item });
  } catch (error) { next(error); }
});

crmRouter.patch('/contacts/:id', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = contactSchema.partial().extend({ tags: z.array(z.string().max(50)).max(30).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, organizationId: req.auth!.organizationId } });
    if (!existing) return res.status(404).json({ success: false, error: 'CONTACT_NOT_FOUND' });
    const { metadata, ...contactUpdates } = parsed.data;
    const item = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        ...contactUpdates,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
    });
    await audit(req, req.auth, 'contact.updated', 'Contact', item.id);
    res.json({ success: true, item });
  } catch (error) { next(error); }
});

const productSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(80).optional(),
  type: z.enum(['PRODUCT', 'SERVICE', 'COURSE']).default('SERVICE'),
  description: z.string().max(5_000).optional(),
  price: z.coerce.number().nonnegative().max(999_999_999),
  currency: z.string().length(3).default('DOP'),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

crmRouter.get('/products', requirePermission('crm.read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const items = await prisma.product.findMany({ where: { organizationId: req.auth!.organizationId }, orderBy: { updatedAt: 'desc' } });
    res.json({ success: true, items });
  } catch (error) { next(error); }
});

crmRouter.post('/products', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    if ('courseKnowledge' in parsed.data.metadata) return res.status(400).json({error:'Use la ficha de conocimiento para registrar información aprobada.'});
    const item = await prisma.product.create({
      data: {
        ...parsed.data,
        sku: parsed.data.sku || null,
        metadata: parsed.data.metadata as Prisma.InputJsonValue,
        organizationId: req.auth!.organizationId,
      },
    });
    await audit(req, req.auth, 'product.created', 'Product', item.id);
    res.status(201).json({ success: true, item });
  } catch (error) { next(error); }
});

crmRouter.get('/pipelines', requirePermission('crm.read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const items = await prisma.pipeline.findMany({ where: { organizationId: req.auth!.organizationId }, include: { stages: { orderBy: { position: 'asc' } } } });
    res.json({ success: true, items });
  } catch (error) { next(error); }
});

const dealSchema = z.object({
  title: z.string().min(1).max(200),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  productId: z.string().optional(),
  value: z.coerce.number().nonnegative().max(999_999_999),
  currency: z.string().length(3).default('DOP'),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  expectedCloseAt: z.coerce.date().optional(),
});

crmRouter.get('/deals', requirePermission('crm.read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const items = await prisma.deal.findMany({
      where: { organizationId: req.auth!.organizationId },
      include: { stage: true, contact: true, product: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, items });
  } catch (error) { next(error); }
});

crmRouter.post('/deals', requirePermission('crm.write'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = dealSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: parsed.data.pipelineId, organizationId: req.auth!.organizationId },
      include: { stages: { where: { id: parsed.data.stageId } } },
    });
    if (!pipeline || pipeline.stages.length !== 1) return res.status(400).json({ success: false, error: 'INVALID_PIPELINE_STAGE' });
    if (!(await validateRelations(req.auth!.organizationId, parsed.data))) return res.status(400).json({ error: 'INVALID_RELATED_RECORD' });
    const item = await prisma.deal.create({ data: { ...parsed.data, organizationId: req.auth!.organizationId } });
    await audit(req, req.auth, 'deal.created', 'Deal', item.id);
    res.status(201).json({ success: true, item });
  } catch (error) { next(error); }
});

crmRouter.get('/dashboard', requirePermission('analytics.read'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const organizationId = req.auth!.organizationId;
    const [contacts, openDeals, wonDeals, payments] = await Promise.all([
      prisma.contact.count({ where: { organizationId } }),
      prisma.deal.count({ where: { organizationId, status: 'OPEN' } }),
      prisma.deal.count({ where: { organizationId, status: 'WON' } }),
      prisma.payment.aggregate({ where: { organizationId, status: 'COMPLETED' }, _sum: { amount: true } }),
    ]);
    res.json({ success: true, metrics: { contacts, openDeals, wonDeals, collectedRevenue: payments._sum.amount ?? 0 } });
  } catch (error) { next(error); }
});
