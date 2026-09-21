import type { Request } from 'express';
import { prisma } from './db';
import type { AuthContext } from './security';

export async function audit(
  req: Request,
  auth: AuthContext | undefined,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  await prisma.auditLog.create({
    data: {
      organizationId: auth?.organizationId,
      actorUserId: auth?.userId,
      action,
      entityType,
      entityId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 500),
      metadata: metadata as object,
    },
  });
}
