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

function calcPriceCents(midUsd: number, bps: number, side: "buy" | "sell") {
  const midCents = Math.round(midUsd * 100);
  const mult = side === "buy" ? 10000 + bps : 10000 - bps;
  return Math.floor((midCents * mult) / 10000);
}

publicRouter.get("/quotes", async (_req, res) => {
  try {
    const s = await prisma.setting.findUnique({ where: { key: "spreads" } });
    if (!s) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const parsed = JSON.parse(s.valueJson || "{}") as any;
    const coins = ["USDT", "BTC", "ETH"] as const;

    const out: Record<string, { midUsd: number; buyPriceUsdCents: number; sellPriceUsdCents: number; buyBps: number; sellBps: number }> =
      {};

    for (const c of coins) {
      const midUsd = typeof parsed?.[c]?.midUsd === "number" ? parsed[c].midUsd : null;
      const buyBps = typeof parsed?.[c]?.buyBps === "number" ? parsed[c].buyBps : 0;
      const sellBps = typeof parsed?.[c]?.sellBps === "number" ? parsed[c].sellBps : 0;
      if (!midUsd || !Number.isFinite(midUsd) || midUsd <= 0) continue;
      if (!Number.isFinite(buyBps) || !Number.isFinite(sellBps)) continue;
      out[c] = {
        midUsd,
        buyBps,
        sellBps,
        buyPriceUsdCents: calcPriceCents(midUsd, buyBps, "buy"),
        sellPriceUsdCents: calcPriceCents(midUsd, sellBps, "sell"),
      };
    }

    if (Object.keys(out).length === 0) {
      res.status(503).json({ error: "quotes_unavailable" });
      return;
    }

    res.json({ quotes: out, updatedAt: s.updatedAt });
  } catch (err) {
    process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
    res.status(503).json({ error: "db_unavailable", code: toDbErrorCode(err) });
  }
});

publicRouter.get("/fx", async (_req, res) => {
  try {
    const s = await prisma.setting.findUnique({ where: { key: "fxRates" } });
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

publicRouter.get("/deposit-instructions", async (_req, res) => {
  try {
    const s = await prisma.setting.findUnique({ where: { key: "depositInstructions" } });
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
