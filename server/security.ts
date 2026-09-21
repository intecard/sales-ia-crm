import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from './db';
import { config } from './config';

export type AuthContext = {
  userId: string;
  organizationId: string;
  membershipId: string;
  roleCode: string;
  permissions: string[];
};

export type AuthenticatedRequest = Request & { auth?: AuthContext };

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string, req: Request, res: Response) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 500),
    },
  });
  res.cookie(config.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(config.APP_URL).protocol === 'https:',
    expires: expiresAt,
    path: '/',
  });
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    const organizationId = req.get('x-organization-id');
    if (!token || !organizationId) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });

    const session = await prisma.session.findFirst({
      where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
      include: {
        user: {
          include: {
            memberships: {
              where: { organizationId, active: true },
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        },
      },
    });
    const membership = session?.user.memberships[0];
    if (!session || !session.user.active || !membership) {
      return res.status(401).json({ success: false, error: 'INVALID_SESSION_OR_TENANT' });
    }
    req.auth = {
      userId: session.userId,
      organizationId,
      membershipId: membership.id,
      roleCode: membership.role.code,
      permissions: membership.role.permissions.map((item: any) => item.permission.code),
    };
    next();
  } catch (error) {
    next(error);
  }
}

export const requirePermission = (permission: string) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth?.permissions.includes(permission) && req.auth?.roleCode !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', permission });
    }
    next();
  };