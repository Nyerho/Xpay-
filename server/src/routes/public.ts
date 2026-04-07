import { Router } from "express";
import { prisma } from "../prisma";

export const publicRouter = Router();

publicRouter.get("/spreads", async (_req, res) => {
  const s = await prisma.setting.findUnique({ where: { key: "spreads" } });
  if (!s) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ key: s.key, valueJson: s.valueJson, updatedAt: s.updatedAt });
});

publicRouter.get("/gift-card-rates", async (_req, res) => {
  const s = await prisma.setting.findUnique({ where: { key: "giftCardRates" } });
  if (!s) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ key: s.key, valueJson: s.valueJson, updatedAt: s.updatedAt });
});

