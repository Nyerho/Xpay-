import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

export type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    role: Role;
  };
};

const jwtSecret = (() => {
  const v = process.env.JWT_SECRET;
  if (!v) throw new Error("JWT_SECRET is required");
  return v;
})();

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(payload: { userId: string; role: Role }) {
  return jwt.sign(payload, jwtSecret, { expiresIn: "12h" });
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    res.status(401).json({ error: "missing_token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as unknown as { userId: string; role: Role };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    if (user.isFrozen) {
      res.status(403).json({ error: "user_frozen" });
      return;
    }
    req.auth = { userId: user.id, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

export function getRequestIp(req: Request) {
  const forwarded = req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.socket.remoteAddress ?? undefined;
}
