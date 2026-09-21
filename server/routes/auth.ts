import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../server/db';
import { audit } from '../../server/audit';
import {
  authenticate,
  createSession,
  hashToken,
  type AuthenticatedRequest,
} from '../../server/security';
import { config } from '../../server/config';

export const authRouter = Router();

const registerSchema = z.object({
  organizationName: z.string().min(2).max(150),
  organizationSlug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(150),
  email: z.string().email(),
  password: z.string().min(10).refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Máximo 72 bytes'),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_REQUEST', details: parsed.error.flatten() });
    const input = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) return res.status(409).json({ success: false, error: 'EMAIL_ALREADY_EXISTS' });

    const [ownerRole, plan] = await Promise.all([
      prisma.role.findUnique({ where: { code: 'OWNER' } }),
      prisma.plan.findUnique({ where: { code: 'STARTER' } }),
    ]);
    if (!ownerRole || !plan) return res.status(503).json({ success: false, error: 'PLATFORM_NOT_SEEDED' });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.organizationName, slug: input.organizationSlug },
      });
      const user = await tx.user.create({
        data: { name: input.name, email: input.email.toLowerCase(), passwordHash },
      });
      await tx.membership.create({
        data: { organizationId: organization.id, userId: user.id, roleId: ownerRole.id },
      });
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: plan.id,
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
      const pipeline = await tx.pipeline.create({
        data: { organizationId: organization.id, name: 'Ventas', isDefault: true },
      });
      await tx.stage.createMany({
        data: ['Nuevo', 'Contactado', 'Propuesta', 'Negociación', 'Ganado'].map((name, position) => ({
          pipelineId: pipeline.id,
          name,
          position,
        })),
      });
      return { organization, user };
    });
    await createSession(result.user.id, req, res);
    await audit(req, { userId: result.user.id, organizationId: result.organization.id, membershipId: '', roleCode: 'OWNER', permissions: [] }, 'organization.registered', 'Organization', result.organization.id);
    res.status(201).json({
      success: true,
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
      organization: result.organization,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'INVALID_REQUEST' });
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { memberships: { where: { active: true }, include: { organization: true, role: true } } },
    });
    if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' });
    }
    await createSession(user.id, req, res);
    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      organizations: user.memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role.code,
      })),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { id: true, name: true, email: true } });
  res.json({ success: true, user, organizationId: req.auth!.organizationId, role: req.auth!.roleCode, permissions: req.auth!.permissions });
  } catch (error) { next(error); }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (token) await prisma.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(config.SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
