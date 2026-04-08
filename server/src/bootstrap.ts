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

  await prisma.setting.upsert({
    where: { key: "spreads" },
    create: { key: "spreads", valueJson: JSON.stringify({ fixedSpreadBps: 200, quoteLockSeconds: 900 }) },
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
}

