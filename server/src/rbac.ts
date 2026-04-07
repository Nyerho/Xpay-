import type { Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import type { AuthenticatedRequest } from "./auth";

const roleRank: Record<Role, number> = {
  CONSUMER: 0,
  SUPPORT: 10,
  FINANCE: 20,
  ADMIN: 30,
  SUPERADMIN: 40,
};

export function requireMinRole(minRole: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.auth?.role;
    if (!role) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (roleRank[role] < roleRank[minRole]) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

export function requireAnyRole(roles: Role[]) {
  const allowed = new Set<Role>(roles);
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.auth?.role;
    if (!role) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!allowed.has(role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
