import type { Request } from "express";
import { prisma } from "./prisma";
import { getRequestIp, type AuthenticatedRequest } from "./auth";

export async function writeAuditLog(params: {
  req: Request | AuthenticatedRequest;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const ip = getRequestIp(params.req);
  const userAgent = params.req.header("user-agent") ?? undefined;
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      beforeJson: params.before === undefined ? null : JSON.stringify(params.before),
      afterJson: params.after === undefined ? null : JSON.stringify(params.after),
      ip,
      userAgent,
    },
  });
}
