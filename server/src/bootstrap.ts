import { prisma } from "./prisma";
import { hashPassword } from "./auth";

export async function bootstrap() {
  const email = process.env.GOD_EMAIL?.toLowerCase();
  const password = process.env.GOD_PASSWORD;

  if (email && password) {
    const passwordHash = await hashPassword(password);
    const god = await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, role: "SUPERADMIN" },
      update: { passwordHash, role: "SUPERADMIN" },
    });
    await prisma.balance.upsert({
      where: { userId: god.id },
      create: { userId: god.id },
      update: {},
    });
  }

  const defaultSpreads = {
    USDT: { midUsd: 1, buyBps: 50, sellBps: 50 },
    BTC: { midUsd: 70000, buyBps: 200, sellBps: 200 },
    ETH: { midUsd: 3500, buyBps: 200, sellBps: 200 },
  };

  await prisma.setting.upsert({
    where: { key: "spreads" },
    create: {
      key: "spreads",
      valueJson: JSON.stringify(defaultSpreads),
    },
    update: {},
  });

  const spreads = await prisma.setting.findUnique({ where: { key: "spreads" } });
  if (spreads) {
    try {
      const v = JSON.parse(spreads.valueJson || "{}") as any;
      const hasNewFormat = typeof v?.USDT === "object" || typeof v?.BTC === "object" || typeof v?.ETH === "object";
      const hasOldFormat = typeof v?.fixedSpreadBps === "number" || typeof v?.quoteLockSeconds === "number";
      if (!hasNewFormat && hasOldFormat) {
        await prisma.setting.update({ where: { key: "spreads" }, data: { valueJson: JSON.stringify(defaultSpreads) } });
      }
    } catch {
    }
  }

  const spreadsJson = process.env.SPREADS_JSON;
  if (spreadsJson && spreadsJson.trim().length > 0) {
    try {
      const v = JSON.parse(spreadsJson) as any;
      const ok =
        v &&
        typeof v === "object" &&
        typeof v.USDT?.midUsd === "number" &&
        typeof v.BTC?.midUsd === "number" &&
        typeof v.ETH?.midUsd === "number";
      if (ok) {
        await prisma.setting.update({ where: { key: "spreads" }, data: { valueJson: spreadsJson } });
      }
    } catch {
    }
  }

  await prisma.setting.upsert({
    where: { key: "fxRates" },
    create: {
      key: "fxRates",
      valueJson: JSON.stringify({
        USDNGN: { mid: 1500, buyBps: 100, sellBps: 100 },
      }),
      updatedById: null,
    },
    update: {},
  });

  const fxJson = process.env.FX_JSON;
  if (fxJson && fxJson.trim().length > 0) {
    try {
      const v = JSON.parse(fxJson) as any;
      const ok = v && typeof v === "object" && typeof v.USDNGN?.mid === "number";
      if (ok) {
        await prisma.setting.update({ where: { key: "fxRates" }, data: { valueJson: fxJson } });
      }
    } catch {
    }
  }

  await prisma.setting.upsert({
    where: { key: "tradeLimits" },
    create: {
      key: "tradeLimits",
      valueJson: JSON.stringify({ maxPerTxUsdCents: 200_000, dailyUsdCents: 1_000_000 }),
      updatedById: null,
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: "giftCardRates" },
    create: {
      key: "giftCardRates",
      valueJson: JSON.stringify({
        AMAZON: { buyPct: 0.75, sellPct: 0.85 },
        ITUNES: { buyPct: 0.7, sellPct: 0.82 },
        GOOGLE_PLAY: { buyPct: 0.7, sellPct: 0.82 },
        STEAM: { buyPct: 0.8, sellPct: 0.9 },
        WALMART: { buyPct: 0.75, sellPct: 0.86 },
        VISA: { buyPct: 0.65, sellPct: 0.88 },
        AMEX: { buyPct: 0.65, sellPct: 0.88 },
        EBAY: { buyPct: 0.7, sellPct: 0.82 },
      }),
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: "referralConfig" },
    create: { key: "referralConfig", valueJson: JSON.stringify({ referrerBonusKobo: 10000, referredBonusKobo: 10000 }), updatedById: null },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: "depositInstructions" },
    create: { key: "depositInstructions", valueJson: JSON.stringify({}), updatedById: null },
    update: {},
  });
}
