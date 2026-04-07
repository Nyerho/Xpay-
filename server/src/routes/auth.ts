import { Router } from "express";
import { prisma } from "../prisma";
import { loginSchema } from "../validators";
import { signAccessToken, verifyPassword, type AuthenticatedRequest, requireAuth } from "../auth";
import { writeAuditLog } from "../audit";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  if (user.role === "CONSUMER") {
    res.status(403).json({ error: "not_staff" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
  });

  const token = signAccessToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    isFrozen: user.isFrozen,
    mfaEnabled: user.mfaEnabled,
  });
});
