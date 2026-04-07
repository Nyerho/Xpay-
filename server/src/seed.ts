import "dotenv/config";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";

async function main() {
  const email = (process.env.GOD_EMAIL ?? "god@xpay.local").toLowerCase();
  const password = process.env.GOD_PASSWORD ?? "ChangeMe123!";
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

  const defaultSettings: Array<{ key: string; valueJson: string }> = [
    { key: "spreads", valueJson: JSON.stringify({ fixedSpreadBps: 200, quoteLockSeconds: 900 }) },
    {
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
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: { key: s.key, valueJson: s.valueJson },
      update: { valueJson: s.valueJson },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    process.stderr.write(String(err) + "\n");
    await prisma.$disconnect();
    process.exit(1);
  });
