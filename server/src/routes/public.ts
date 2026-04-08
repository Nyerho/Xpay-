import { Router } from "express";
import { prisma } from "../prisma";

export const publicRouter = Router();

function toDbErrorCode(err: unknown) {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as Record<string, unknown>;
  const code = typeof anyErr.code === "string" ? anyErr.code : null;
  const errorCode = typeof anyErr.errorCode === "string" ? anyErr.errorCode : null;
  return code ?? errorCode;
}

publicRouter.get("/spreads", async (_req, res) => {
  try {
    const s = await prisma.setting.findUnique({ where: { key: "spreads" } });
    if (!s) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ key: s.key, valueJson: s.valueJson, updatedAt: s.updatedAt });
  } catch (err) {
    process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
    res.status(503).json({ error: "db_unavailable", code: toDbErrorCode(err) });
  }
});

publicRouter.get("/gift-card-rates", async (_req, res) => {
  try {
    const s = await prisma.setting.findUnique({ where: { key: "giftCardRates" } });
    if (!s) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ key: s.key, valueJson: s.valueJson, updatedAt: s.updatedAt });
  } catch (err) {
    process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
    res.status(503).json({ error: "db_unavailable", code: toDbErrorCode(err) });
  }
});

publicRouter.get("/db-health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (err) {
    process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
    res.status(503).json({ ok: false, error: "db_unavailable", code: toDbErrorCode(err) });
  }
});
