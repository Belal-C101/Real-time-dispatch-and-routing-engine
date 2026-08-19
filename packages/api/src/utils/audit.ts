import type { PrismaClient } from '@prisma/client';

export interface AuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  priorState: Record<string, unknown>;
  newState: Record<string, unknown>;
  reasonCode: string;
}

export async function createAuditLog(
  prisma: PrismaClient,
  input: AuditLogInput
) {
  return prisma.auditLog.create({
    data: input,
  });
}

export async function getAuditLogs(
  prisma: PrismaClient,
  entityType: string,
  entityId: string
) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { timestamp: 'desc' },
  });
}
