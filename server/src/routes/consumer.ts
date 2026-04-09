import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, signAccessToken, verifyPassword, type AuthenticatedRequest, hashPassword } from "../auth";
import {
  consumerDepositRequestSchema,
  consumerCryptoBuySchema,
  consumerCryptoSellSchema,
  consumerConvertSchema,
  consumerGiftCardSubmitSchema,
  consumerGiftCardBuySchema,
  consumerSwapRequestSchema,
  consumerUsdcWithdrawalSchema,
  consumerWithdrawalRequestSchema,
  loginSchema,
  signupSchema,
} from "../validators";
import { writeAuditLog } from "../audit";
import { circleCreateUserWallets, getCircleBlockchains, isCircleEnabled } from "../circle";

export const consumerRouter = Router();

function param(value: unknown) {
  return Array.isArray(value) ? String(value[0]) : String(value);
}

function parseDecimalToBigInt(amount: string, decimals: number) {
  const m = amount.trim().match(/^(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const whole = m[1] ?? "0";
  const frac = (m[2] ?? "").slice(0, decimals);
  const fracPadded = frac + "0".repeat(decimals - frac.length);
  const digits = (whole.replace(/^0+/, "") || "0") + fracPadded;
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

function formatMinorToDecimalString(minor: bigint, decimals: number) {
  const neg = minor < 0n;
  const v = neg ? -minor : minor;
  const s = v.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals);
  const trimmedFrac = frac.replace(/0+$/, "");
  const out = trimmedFrac.length ? `${whole}.${trimmedFrac}` : whole;
  return neg ? `-${out}` : out;
}

function calcPriceCents(midUsd: number, bps: number, side: "buy" | "sell") {
  const midCents = Math.round(midUsd * 100);
  const mult = side === "buy" ? 10000 + bps : 10000 - bps;
  return Math.floor((midCents * mult) / 10000);
}

async function getQuotes() {
  const s = await prisma.setting.findUnique({ where: { key: "spreads" } });
  if (!s) return null;
  let parsed: any = {};
  try {
    parsed = JSON.parse(s.valueJson || "{}");
  } catch {
    parsed = {};
  }

  function q(asset: "USDT" | "BTC" | "ETH") {
    const midUsd = typeof parsed?.[asset]?.midUsd === "number" ? parsed[asset].midUsd : null;
    const buyBps = typeof parsed?.[asset]?.buyBps === "number" ? parsed[asset].buyBps : 0;
    const sellBps = typeof parsed?.[asset]?.sellBps === "number" ? parsed[asset].sellBps : 0;
    if (!midUsd || !Number.isFinite(midUsd) || midUsd <= 0) return null;
    return {
      midUsd,
      buyBps,
      sellBps,
      buyPriceUsdCents: calcPriceCents(midUsd, buyBps, "buy"),
      sellPriceUsdCents: calcPriceCents(midUsd, sellBps, "sell"),
    };
  }

  return { updatedAt: s.updatedAt, USDT: q("USDT"), BTC: q("BTC"), ETH: q("ETH") };
}

async function getFx() {
  const s = await prisma.setting.findUnique({ where: { key: "fxRates" } });
  if (!s) return null;
  let parsed: any = {};
  try {
    parsed = JSON.parse(s.valueJson || "{}");
  } catch {
    parsed = {};
  }
  const mid = typeof parsed?.USDNGN?.mid === "number" ? parsed.USDNGN.mid : null;
  const buyBps = typeof parsed?.USDNGN?.buyBps === "number" ? parsed.USDNGN.buyBps : 0;
  const sellBps = typeof parsed?.USDNGN?.sellBps === "number" ? parsed.USDNGN.sellBps : 0;
  if (!mid || !Number.isFinite(mid) || mid <= 0) return null;
  return { updatedAt: s.updatedAt, USDNGN: { mid, buyBps, sellBps } };
}

async function getTradeLimits() {
  const s = await prisma.setting.findUnique({ where: { key: "tradeLimits" } });
  if (!s) return null;
  try {
    const v = JSON.parse(s.valueJson || "{}") as any;
    const maxPerTxUsdCents = typeof v?.maxPerTxUsdCents === "number" ? v.maxPerTxUsdCents : null;
    const dailyUsdCents = typeof v?.dailyUsdCents === "number" ? v.dailyUsdCents : null;
    if (!maxPerTxUsdCents || !dailyUsdCents) return null;
    return { updatedAt: s.updatedAt, maxPerTxUsdCents, dailyUsdCents };
  } catch {
    return null;
  }
}

async function enforceDailyUsdLimit(params: { userId: string; addUsdCents: number; dailyUsdCents: number }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const agg = await prisma.transaction.aggregate({
    where: {
      userId: params.userId,
      createdAt: { gte: start },
      type: { in: ["CRYPTO_BUY", "CRYPTO_SELL", "CONVERT"] as any },
      status: "COMPLETE",
      amountUsdCents: { not: null },
    },
    _sum: { amountUsdCents: true },
  });
  const used = agg._sum.amountUsdCents ?? 0;
  return used + params.addUsdCents <= params.dailyUsdCents;
}

async function requireKycApproved(userId: string) {
  const required = process.env.TRADING_REQUIRE_KYC === "true";
  if (!required) return true;
  const latest = await prisma.kycCase.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!latest || latest.status !== "APPROVED") return false;
  return true;
}

function parseMoneyToMinor(amount: string, decimals: number) {
  return parseDecimalToBigInt(amount, decimals);
}

function fxRateUsdToNgn(mid: number, sellBps: number) {
  return Math.max(1, Math.floor((mid * (10000 - sellBps)) / 10000));
}

function fxRateNgnToUsdDiv(mid: number, buyBps: number) {
  return Math.max(1, Math.floor((mid * (10000 + buyBps)) / 10000));
}

function getIdempotencyKey(req: AuthenticatedRequest) {
  const raw = req.header("idempotency-key") ?? req.header("Idempotency-Key");
  if (!raw) return null;
  const key = raw.trim();
  if (!key || key.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) return null;
  return key;
}

function safeJsonParse(s: string) {
  try {
    const v = JSON.parse(s || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

consumerRouter.post("/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ error: "email_in_use" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.user.create({
    data: {
      email,
      phone: parsed.data.phone,
      passwordHash,
      role: "CONSUMER",
      balance: { create: {} },
      kycCases: { create: { status: "PENDING" } },
    },
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.signup",
    entity: "User",
    entityId: user.id,
    after: { email: user.email },
  });

  const token = signAccessToken({ userId: user.id, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

consumerRouter.post("/auth/login", async (req, res) => {
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
  if (user.role !== "CONSUMER") {
    res.status(403).json({ error: "not_consumer" });
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

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.login",
    entity: "User",
    entityId: user.id,
  });

  const token = signAccessToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

consumerRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    mfaEnabled: user.mfaEnabled,
    isFrozen: user.isFrozen,
  });
});

consumerRouter.get("/balance", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { balance: true },
  });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const b = user.balance ?? (await prisma.balance.create({ data: { userId: user.id } }));
  res.json({
    usdCents: b.usdCents,
    ngnKobo: b.ngnKobo,
    usdtCents: b.usdtCents,
    btcSats: b.btcSats,
    ethWei: b.ethWei,
  });
});

consumerRouter.get("/deposit-addresses", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  if (!isCircleEnabled()) {
    res.status(501).json({ error: "circle_not_configured" });
    return;
  }

  const blockchains = getCircleBlockchains();
  const existing = await prisma.externalWallet.findMany({
    where: { userId: user.id, provider: "circle", blockchain: { in: blockchains } },
  });

  const missing = blockchains.filter((b) => !existing.some((e) => e.blockchain === b));
  for (const blockchain of missing) {
    const created = await circleCreateUserWallets({ blockchains: [blockchain] });
    const w = created[0];
    await prisma.externalWallet.upsert({
      where: { userId_provider_blockchain: { userId: user.id, provider: "circle", blockchain } },
      create: { userId: user.id, provider: "circle", walletId: w.walletId, blockchain: w.blockchain, address: w.address },
      update: { walletId: w.walletId, address: w.address },
    });
  }

  const all = await prisma.externalWallet.findMany({
    where: { userId: user.id, provider: "circle", blockchain: { in: blockchains } },
    orderBy: { blockchain: "asc" },
  });

  res.json({
    provider: "circle",
    asset: "USDC",
    addresses: all.map((w) => ({ blockchain: w.blockchain, address: w.address })),
  });
});

consumerRouter.get("/kyc", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const latest = await prisma.kycCase.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ status: latest?.status ?? "PENDING" });
});

consumerRouter.get("/transactions", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const items = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(
    items.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      asset: t.asset,
      amountUsdCents: t.amountUsdCents,
      createdAt: t.createdAt,
    })),
  );
});

consumerRouter.get("/transactions/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const id = param(req.params.id);
  const t = await prisma.transaction.findUnique({ where: { id } });
  if (!t || t.userId !== user.id) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    id: t.id,
    type: t.type,
    status: t.status,
    asset: t.asset,
    amountUsdCents: t.amountUsdCents,
    amountAssetMinor: t.amountAssetMinor,
    metadataJson: t.metadataJson,
    externalRef: t.externalRef,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  });
});

consumerRouter.post("/trade/buy", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerCryptoBuySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const idem = getIdempotencyKey(req);
  if (idem) {
    const existing = await prisma.transaction.findFirst({
      where: { userId: req.auth!.userId, externalRef: `idem:buy:${idem}` },
    });
    if (existing) {
      res.json({ ok: true, idempotent: true });
      return;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { balance: true },
  });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }
  const kycOk = await requireKycApproved(user.id);
  if (!kycOk) {
    res.status(403).json({ error: "kyc_required" });
    return;
  }

  const quotes = await getQuotes();
  if (!quotes) {
    res.status(503).json({ error: "quotes_unavailable" });
    return;
  }
  if (parsed.data.quoteUpdatedAt && new Date(parsed.data.quoteUpdatedAt).toISOString() !== quotes.updatedAt.toISOString()) {
    res.status(409).json({ error: "quote_changed" });
    return;
  }

  const limits = await getTradeLimits();
  if (limits) {
    if (parsed.data.usdCents > limits.maxPerTxUsdCents) {
      res.status(400).json({ error: "limit_exceeded" });
      return;
    }
    const ok = await enforceDailyUsdLimit({ userId: user.id, addUsdCents: parsed.data.usdCents, dailyUsdCents: limits.dailyUsdCents });
    if (!ok) {
      res.status(400).json({ error: "daily_limit_exceeded" });
      return;
    }
  }

  const { asset, usdCents } = parsed.data;
  const q = quotes[asset];
  if (!q) {
    res.status(503).json({ error: "quotes_unavailable" });
    return;
  }

  const b = user.balance ?? (await prisma.balance.create({ data: { userId: user.id } }));
  if (b.usdCents < usdCents) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }

  const priceCents = q.buyPriceUsdCents;
  if (priceCents <= 0) {
    res.status(503).json({ error: "quotes_unavailable" });
    return;
  }

  let assetMinor: bigint;
  let decimals: number;
  if (asset === "USDT") {
    decimals = 2;
    assetMinor = (BigInt(usdCents) * 100n) / BigInt(priceCents);
  } else if (asset === "BTC") {
    decimals = 8;
    assetMinor = (BigInt(usdCents) * 100000000n) / BigInt(priceCents);
  } else {
    decimals = 18;
    assetMinor = (BigInt(usdCents) * 1000000000000000000n) / BigInt(priceCents);
  }

  if (assetMinor <= 0n) {
    res.status(400).json({ error: "amount_too_small" });
    return;
  }
  if (asset === "USDT" && assetMinor > 2_000_000_000n) {
    res.status(400).json({ error: "amount_too_large" });
    return;
  }
  if (asset === "BTC" && assetMinor > 2_000_000_000n) {
    res.status(400).json({ error: "amount_too_large" });
    return;
  }

  await prisma.$transaction(async (p) => {
    if (asset === "USDT") {
      await p.balance.update({ where: { userId: b.userId }, data: { usdCents: { decrement: usdCents }, usdtCents: { increment: Number(assetMinor) } } });
    } else if (asset === "BTC") {
      await p.balance.update({ where: { userId: b.userId }, data: { usdCents: { decrement: usdCents }, btcSats: { increment: Number(assetMinor) } } });
    } else {
      const current = BigInt(b.ethWei || "0");
      await p.balance.update({ where: { userId: b.userId }, data: { usdCents: { decrement: usdCents }, ethWei: (current + assetMinor).toString() } });
    }

    await p.transaction.create({
      data: {
        userId: user.id,
        type: "CRYPTO_BUY",
        status: "COMPLETE",
        asset,
        amountUsdCents: usdCents,
        amountAssetMinor: asset === "ETH" ? null : Number(assetMinor),
        externalRef: idem ? `idem:buy:${idem}` : undefined,
        metadataJson: JSON.stringify({
          side: "buy",
          priceUsdCents: priceCents,
          decimals,
          assetMinor: assetMinor.toString(),
          assetAmount: formatMinorToDecimalString(assetMinor, decimals),
          quoteUpdatedAt: quotes.updatedAt,
          limitsUpdatedAt: limits?.updatedAt ?? null,
        }),
      },
    });
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.trade.buy",
    entity: "Transaction",
    after: { asset, usdCents },
  });

  res.json({ ok: true });
});

consumerRouter.post("/trade/sell", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerCryptoSellSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const idem = getIdempotencyKey(req);
  if (idem) {
    const existing = await prisma.transaction.findFirst({
      where: { userId: req.auth!.userId, externalRef: `idem:sell:${idem}` },
    });
    if (existing) {
      res.json({ ok: true, idempotent: true });
      return;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { balance: true },
  });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }
  const kycOk = await requireKycApproved(user.id);
  if (!kycOk) {
    res.status(403).json({ error: "kyc_required" });
    return;
  }

  const quotes = await getQuotes();
  if (!quotes) {
    res.status(503).json({ error: "quotes_unavailable" });
    return;
  }
  if (parsed.data.quoteUpdatedAt && new Date(parsed.data.quoteUpdatedAt).toISOString() !== quotes.updatedAt.toISOString()) {
    res.status(409).json({ error: "quote_changed" });
    return;
  }

  const { asset, amount } = parsed.data;
  const q = quotes[asset];
  if (!q) {
    res.status(503).json({ error: "quotes_unavailable" });
    return;
  }

  const b = user.balance ?? (await prisma.balance.create({ data: { userId: user.id } }));
  const priceCents = q.sellPriceUsdCents;
  if (priceCents <= 0) {
    res.status(503).json({ error: "quotes_unavailable" });
    return;
  }

  let decimals: number;
  let assetMinor: bigint;
  if (asset === "USDT") {
    decimals = 2;
    assetMinor = parseDecimalToBigInt(amount, decimals) ?? -1n;
    if (assetMinor <= 0n) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    if (b.usdtCents < Number(assetMinor)) {
      res.status(409).json({ error: "insufficient_funds" });
      return;
    }
  } else if (asset === "BTC") {
    decimals = 8;
    assetMinor = parseDecimalToBigInt(amount, decimals) ?? -1n;
    if (assetMinor <= 0n) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    if (b.btcSats < Number(assetMinor)) {
      res.status(409).json({ error: "insufficient_funds" });
      return;
    }
  } else {
    decimals = 18;
    assetMinor = parseDecimalToBigInt(amount, decimals) ?? -1n;
    if (assetMinor <= 0n) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    const current = BigInt(b.ethWei || "0");
    if (current < assetMinor) {
      res.status(409).json({ error: "insufficient_funds" });
      return;
    }
  }

  const usdCents = Number((assetMinor * BigInt(priceCents)) / (asset === "USDT" ? 100n : asset === "BTC" ? 100000000n : 1000000000000000000n));
  if (!Number.isFinite(usdCents) || usdCents <= 0) {
    res.status(400).json({ error: "amount_too_small" });
    return;
  }

  const limits = await getTradeLimits();
  if (limits) {
    const ok = await enforceDailyUsdLimit({ userId: user.id, addUsdCents: usdCents, dailyUsdCents: limits.dailyUsdCents });
    if (!ok) {
      res.status(400).json({ error: "daily_limit_exceeded" });
      return;
    }
  }

  await prisma.$transaction(async (p) => {
    if (asset === "USDT") {
      await p.balance.update({ where: { userId: b.userId }, data: { usdtCents: { decrement: Number(assetMinor) }, usdCents: { increment: usdCents } } });
    } else if (asset === "BTC") {
      await p.balance.update({ where: { userId: b.userId }, data: { btcSats: { decrement: Number(assetMinor) }, usdCents: { increment: usdCents } } });
    } else {
      const current = BigInt(b.ethWei || "0");
      await p.balance.update({ where: { userId: b.userId }, data: { ethWei: (current - assetMinor).toString(), usdCents: { increment: usdCents } } });
    }

    await p.transaction.create({
      data: {
        userId: user.id,
        type: "CRYPTO_SELL",
        status: "COMPLETE",
        asset,
        amountUsdCents: usdCents,
        amountAssetMinor: asset === "ETH" ? null : Number(assetMinor),
        externalRef: idem ? `idem:sell:${idem}` : undefined,
        metadataJson: JSON.stringify({
          side: "sell",
          priceUsdCents: priceCents,
          decimals,
          assetMinor: assetMinor.toString(),
          assetAmount: amount,
          quoteUpdatedAt: quotes.updatedAt,
          limitsUpdatedAt: limits?.updatedAt ?? null,
        }),
      },
    });
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.trade.sell",
    entity: "Transaction",
    after: { asset, amount },
  });

  res.json({ ok: true });
});

consumerRouter.post("/convert", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerConvertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const idem = getIdempotencyKey(req);
  if (idem) {
    const existing = await prisma.transaction.findFirst({
      where: { userId: req.auth!.userId, externalRef: `idem:convert:${idem}` },
    });
    if (existing) {
      res.json({ ok: true, idempotent: true });
      return;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { balance: true },
  });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }

  const { from, to, amount } = parsed.data;
  if (from === to) {
    res.status(400).json({ error: "same_asset" });
    return;
  }

  const cryptoSet = new Set(["USDT", "BTC", "ETH"]);
  const involvesCrypto = cryptoSet.has(from) || cryptoSet.has(to);
  if (involvesCrypto) {
    const kycOk = await requireKycApproved(user.id);
    if (!kycOk) {
      res.status(403).json({ error: "kyc_required" });
      return;
    }
  }

  const b = user.balance ?? (await prisma.balance.create({ data: { userId: user.id } }));
  const quotes = involvesCrypto ? await getQuotes() : null;
  if (involvesCrypto && !quotes) {
    res.status(503).json({ error: "quotes_unavailable" });
    return;
  }
  const fx = (from === "NGN" || to === "NGN") ? await getFx() : null;
  if ((from === "NGN" || to === "NGN") && !fx) {
    res.status(503).json({ error: "fx_unavailable" });
    return;
  }
  if (involvesCrypto && parsed.data.quoteUpdatedAt && new Date(parsed.data.quoteUpdatedAt).toISOString() !== quotes!.updatedAt.toISOString()) {
    res.status(409).json({ error: "quote_changed" });
    return;
  }
  if ((from === "NGN" || to === "NGN") && parsed.data.fxUpdatedAt && new Date(parsed.data.fxUpdatedAt).toISOString() !== fx!.updatedAt.toISOString()) {
    res.status(409).json({ error: "fx_changed" });
    return;
  }

  function minorForAsset(a: string, amt: string) {
    if (a === "USD") return parseMoneyToMinor(amt, 2);
    if (a === "NGN") return parseMoneyToMinor(amt, 2);
    if (a === "USDT") return parseMoneyToMinor(amt, 2);
    if (a === "BTC") return parseMoneyToMinor(amt, 8);
    if (a === "ETH") return parseMoneyToMinor(amt, 18);
    return null;
  }

  const fromMinor = minorForAsset(from, amount);
  if (!fromMinor || fromMinor <= 0n) {
    res.status(400).json({ error: "invalid_amount" });
    return;
  }

  function usdCentsFromAsset(a: string, minor: bigint) {
    if (a === "USD") return minor;
    if (a === "NGN") {
      const rateDiv = fxRateNgnToUsdDiv(fx!.USDNGN.mid, fx!.USDNGN.buyBps);
      return minor / BigInt(rateDiv);
    }
    if (a === "USDT") {
      const q = quotes!.USDT!;
      return (minor * BigInt(q.sellPriceUsdCents)) / 100n;
    }
    if (a === "BTC") {
      const q = quotes!.BTC!;
      return (minor * BigInt(q.sellPriceUsdCents)) / 100000000n;
    }
    if (a === "ETH") {
      const q = quotes!.ETH!;
      return (minor * BigInt(q.sellPriceUsdCents)) / 1000000000000000000n;
    }
    return null;
  }

  function assetFromUsdCents(a: string, usdCents: bigint) {
    if (a === "USD") return usdCents;
    if (a === "NGN") {
      const rate = fxRateUsdToNgn(fx!.USDNGN.mid, fx!.USDNGN.sellBps);
      return usdCents * BigInt(rate);
    }
    if (a === "USDT") {
      const q = quotes!.USDT!;
      return (usdCents * 100n) / BigInt(q.buyPriceUsdCents);
    }
    if (a === "BTC") {
      const q = quotes!.BTC!;
      return (usdCents * 100000000n) / BigInt(q.buyPriceUsdCents);
    }
    if (a === "ETH") {
      const q = quotes!.ETH!;
      return (usdCents * 1000000000000000000n) / BigInt(q.buyPriceUsdCents);
    }
    return null;
  }

  const usdCentsValue = usdCentsFromAsset(from, fromMinor);
  if (!usdCentsValue || usdCentsValue <= 0n) {
    res.status(400).json({ error: "amount_too_small" });
    return;
  }
  const limits = await getTradeLimits();
  if (limits) {
    const addUsd = Number(usdCentsValue);
    if (!Number.isFinite(addUsd) || addUsd <= 0) {
      res.status(400).json({ error: "amount_too_small" });
      return;
    }
    if (addUsd > limits.maxPerTxUsdCents) {
      res.status(400).json({ error: "limit_exceeded" });
      return;
    }
    const ok = await enforceDailyUsdLimit({ userId: user.id, addUsdCents: addUsd, dailyUsdCents: limits.dailyUsdCents });
    if (!ok) {
      res.status(400).json({ error: "daily_limit_exceeded" });
      return;
    }
  }
  const toMinor = assetFromUsdCents(to, usdCentsValue);
  if (!toMinor || toMinor <= 0n) {
    res.status(400).json({ error: "amount_too_small" });
    return;
  }
  const toDecimals = to === "BTC" ? 8 : to === "ETH" ? 18 : 2;
  const toAmount = formatMinorToDecimalString(toMinor, toDecimals);

  if (from === "USD" && b.usdCents < Number(fromMinor)) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }
  if (from === "NGN" && b.ngnKobo < Number(fromMinor)) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }
  if (from === "USDT" && b.usdtCents < Number(fromMinor)) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }
  if (from === "BTC" && b.btcSats < Number(fromMinor)) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }
  if (from === "ETH" && BigInt(b.ethWei || "0") < fromMinor) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }
  if (toMinor > BigInt(2_000_000_000) && (to === "USDT" || to === "BTC" || to === "NGN" || to === "USD")) {
    res.status(400).json({ error: "amount_too_large" });
    return;
  }

  const update: any = {};
  if (from === "USD") update.usdCents = { decrement: Number(fromMinor) };
  if (from === "NGN") update.ngnKobo = { decrement: Number(fromMinor) };
  if (from === "USDT") update.usdtCents = { decrement: Number(fromMinor) };
  if (from === "BTC") update.btcSats = { decrement: Number(fromMinor) };
  if (from === "ETH") update.ethWei = (BigInt(b.ethWei || "0") - fromMinor).toString();

  if (to === "USD") update.usdCents = { ...(update.usdCents ?? {}), increment: Number(toMinor) };
  if (to === "NGN") update.ngnKobo = { ...(update.ngnKobo ?? {}), increment: Number(toMinor) };
  if (to === "USDT") update.usdtCents = { ...(update.usdtCents ?? {}), increment: Number(toMinor) };
  if (to === "BTC") update.btcSats = { ...(update.btcSats ?? {}), increment: Number(toMinor) };
  if (to === "ETH") update.ethWei = (BigInt(b.ethWei || "0") + toMinor).toString();

  await prisma.$transaction(async (p) => {
    await p.balance.update({ where: { userId: b.userId }, data: update });
    await p.transaction.create({
      data: {
        userId: user.id,
        type: "CONVERT",
        status: "COMPLETE",
        asset: `${from}->${to}`,
        amountUsdCents: Number(usdCentsValue),
        externalRef: idem ? `idem:convert:${idem}` : undefined,
        metadataJson: JSON.stringify({
          from,
          to,
          fromAmount: amount,
          toAmount,
          fromMinor: fromMinor.toString(),
          toMinor: toMinor.toString(),
          usdCentsValue: usdCentsValue.toString(),
          quotesUpdatedAt: quotes?.updatedAt ?? null,
          fxUpdatedAt: fx?.updatedAt ?? null,
          limitsUpdatedAt: limits?.updatedAt ?? null,
        }),
      },
    });
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.convert",
    entity: "Transaction",
    after: { from, to, amount },
  });

  res.json({ ok: true });
});

consumerRouter.get("/gift-cards", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const items = await prisma.giftCardSubmission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(
    items.map((s) => ({
      id: s.id,
      brand: s.brand,
      valueUsdCents: s.valueUsdCents,
      offerUsdtCents: s.offerUsdtCents,
      status: s.status,
      frontImageUrl: s.frontImageUrl,
      backImageUrl: s.backImageUrl,
      createdAt: s.createdAt,
    })),
  );
});

consumerRouter.get("/gift-cards/inventory", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const brand = typeof req.query.brand === "string" ? req.query.brand : null;
  const brandKey = brand ? brand.trim().toUpperCase().replaceAll(" ", "_") : null;
  const rows = await prisma.inventoryItem.groupBy({
    by: ["brand", "valueUsdCents"],
    where: { status: "AVAILABLE", ...(brandKey ? { brand: brandKey } : {}) },
    _count: { _all: true },
    orderBy: [{ brand: "asc" }, { valueUsdCents: "asc" }],
  });
  res.json(rows.map((r) => ({ brand: r.brand, valueUsdCents: r.valueUsdCents, availableCount: r._count._all })));
});

consumerRouter.get("/gift-cards/purchases", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const items = await prisma.inventoryItem.findMany({
    where: { purchasedById: user.id, status: "SOLD" },
    orderBy: { purchasedAt: "desc" },
    take: 200,
  });
  res.json(
    items.map((i) => ({
      id: i.id,
      brand: i.brand,
      valueUsdCents: i.valueUsdCents,
      purchasedAt: i.purchasedAt,
    })),
  );
});

consumerRouter.get("/gift-cards/purchases/:id/code", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const id = param(req.params.id);
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.purchasedById !== user.id || item.status !== "SOLD") {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ id: item.id, code: item.code, brand: item.brand, valueUsdCents: item.valueUsdCents, purchasedAt: item.purchasedAt });
});

consumerRouter.post("/gift-cards", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerGiftCardSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }

  const ratesSetting = await prisma.setting.findUnique({ where: { key: "giftCardRates" } });
  if (!ratesSetting) {
    res.status(503).json({ error: "rates_unavailable" });
    return;
  }
  const rates = safeJsonParse(ratesSetting.valueJson);
  const brandKey = parsed.data.brand.trim().toUpperCase().replaceAll(" ", "_");
  const rateAny = rates[brandKey];
  const buyPct =
    rateAny && typeof rateAny === "object" && !Array.isArray(rateAny) && typeof (rateAny as Record<string, unknown>).buyPct === "number"
      ? ((rateAny as Record<string, unknown>).buyPct as number)
      : null;
  if (!buyPct || !Number.isFinite(buyPct) || buyPct <= 0 || buyPct > 1.5) {
    res.status(400).json({ error: "unsupported_brand" });
    return;
  }

  const offerUsdtCents = Math.floor((parsed.data.valueUsdCents / 100) * buyPct * 100);
  if (!Number.isFinite(offerUsdtCents) || offerUsdtCents <= 0) {
    res.status(400).json({ error: "invalid_value" });
    return;
  }

  const submission = await prisma.giftCardSubmission.create({
    data: {
      userId: user.id,
      brand: brandKey,
      valueUsdCents: parsed.data.valueUsdCents,
      offerUsdtCents,
      status: "REVIEWING",
      frontImageUrl: parsed.data.frontImageUrl,
      backImageUrl: parsed.data.backImageUrl ?? null,
    },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "GIFT_CARD_SELL",
      status: "PENDING",
      asset: brandKey,
      amountUsdCents: parsed.data.valueUsdCents,
      externalRef: `giftcard:${submission.id}`,
      metadataJson: JSON.stringify({
        submissionId: submission.id,
        offerUsdtCents,
        frontImageUrl: parsed.data.frontImageUrl,
        backImageUrl: parsed.data.backImageUrl ?? null,
      }),
    },
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.giftCard.submit",
    entity: "GiftCardSubmission",
    entityId: submission.id,
    after: { brand: brandKey, valueUsdCents: parsed.data.valueUsdCents, offerUsdtCents },
  });

  res.status(201).json({ id: submission.id, offerUsdtCents, status: submission.status });
});

consumerRouter.post("/gift-cards/buy", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerGiftCardBuySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, include: { balance: true } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }

  const ratesSetting = await prisma.setting.findUnique({ where: { key: "giftCardRates" } });
  if (!ratesSetting) {
    res.status(503).json({ error: "rates_unavailable" });
    return;
  }
  const rates = safeJsonParse(ratesSetting.valueJson);

  const brandKey = parsed.data.brand.trim().toUpperCase().replaceAll(" ", "_");
  const rateAny = rates[brandKey];
  const sellPct =
    rateAny && typeof rateAny === "object" && !Array.isArray(rateAny) && typeof (rateAny as Record<string, unknown>).sellPct === "number"
      ? ((rateAny as Record<string, unknown>).sellPct as number)
      : null;
  if (!sellPct || !Number.isFinite(sellPct) || sellPct <= 0 || sellPct > 5) {
    res.status(400).json({ error: "unsupported_brand" });
    return;
  }

  const valueUsdCents = parsed.data.valueUsdCents;
  const priceUsdCents = Math.floor((valueUsdCents / 100) * sellPct * 100);
  if (!Number.isFinite(priceUsdCents) || priceUsdCents <= 0) {
    res.status(400).json({ error: "invalid_value" });
    return;
  }

  const b = user.balance ?? (await prisma.balance.create({ data: { userId: user.id } }));
  if (b.usdCents < priceUsdCents) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }

  const now = new Date();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async (p) => {
        const item = await p.inventoryItem.findFirst({
          where: { status: "AVAILABLE", brand: brandKey, valueUsdCents },
          orderBy: { createdAt: "asc" },
        });
        if (!item) {
          return { ok: false as const, error: "sold_out" as const };
        }

        const updated = await p.inventoryItem.updateMany({
          where: { id: item.id, status: "AVAILABLE" },
          data: { status: "SOLD", purchasedById: user.id, purchasedAt: now },
        });
        if (updated.count !== 1) {
          throw new Error("race");
        }

        await p.balance.update({ where: { userId: b.userId }, data: { usdCents: { decrement: priceUsdCents } } });

        await p.transaction.create({
          data: {
            userId: user.id,
            type: "GIFT_CARD_BUY",
            status: "COMPLETE",
            asset: brandKey,
            amountUsdCents: priceUsdCents,
            externalRef: `inventory:${item.id}`,
            metadataJson: JSON.stringify({ inventoryItemId: item.id, valueUsdCents, priceUsdCents, sellPct }),
          },
        });

        return { ok: true as const, itemId: item.id, code: item.code };
      });

      if (!result.ok) {
        res.status(409).json({ error: result.error });
        return;
      }

      await writeAuditLog({
        req,
        actorId: user.id,
        action: "consumer.giftCard.buy",
        entity: "InventoryItem",
        entityId: result.itemId,
        after: { brand: brandKey, valueUsdCents, priceUsdCents },
      });

      res.json({ ok: true, itemId: result.itemId, code: result.code, priceUsdCents });
      return;
    } catch (err) {
      if (attempt === 2) {
        process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
        res.status(500).json({ error: "buy_failed" });
        return;
      }
    }
  }
});

consumerRouter.post("/swap", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerSwapRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }

  const { fromAsset, toAsset, amount } = parsed.data;
  if (fromAsset === toAsset) {
    res.status(400).json({ error: "same_asset" });
    return;
  }
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    res.status(400).json({ error: "invalid_amount" });
    return;
  }

  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "SWAP",
      status: "PENDING",
      asset: `${fromAsset}->${toAsset}`,
      metadataJson: JSON.stringify({ fromAsset, toAsset, amount }),
    },
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.swap.request",
    entity: "Transaction",
    entityId: tx.id,
    after: { fromAsset, toAsset, amount },
  });

  res.status(201).json({ id: tx.id, status: tx.status });
});

consumerRouter.post("/deposits", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerDepositRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }

  const { asset, rail, amount, txid, reference } = parsed.data;
  if (asset === "USD" && rail !== "BANK") {
    res.status(400).json({ error: "invalid_rail" });
    return;
  }
  if (asset === "BTC" && rail !== "BTC") {
    res.status(400).json({ error: "invalid_rail" });
    return;
  }
  if (asset === "ETH" && rail !== "ETH") {
    res.status(400).json({ error: "invalid_rail" });
    return;
  }
  if (asset === "USDT" && !(rail === "TRC20" || rail === "ERC20")) {
    res.status(400).json({ error: "invalid_rail" });
    return;
  }
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    res.status(400).json({ error: "invalid_amount" });
    return;
  }

  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "DEPOSIT",
      status: "PENDING",
      asset: `${asset}:${rail}`,
      metadataJson: JSON.stringify({ asset, rail, amount, txid: txid ?? null, reference: reference ?? null }),
    },
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.deposit.request",
    entity: "Transaction",
    entityId: tx.id,
    after: { asset, rail, amount },
  });

  res.status(201).json({ id: tx.id, status: tx.status });
});

consumerRouter.post("/withdrawals", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerWithdrawalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }

  const { asset, rail, amount, address, memo } = parsed.data;
  if (asset === "BTC" && rail !== "BTC") {
    res.status(400).json({ error: "invalid_rail" });
    return;
  }
  if (asset === "ETH" && rail !== "ETH") {
    res.status(400).json({ error: "invalid_rail" });
    return;
  }
  if (asset === "USDT" && !(rail === "TRC20" || rail === "ERC20")) {
    res.status(400).json({ error: "invalid_rail" });
    return;
  }
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    res.status(400).json({ error: "invalid_amount" });
    return;
  }

  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "WITHDRAWAL",
      status: "PENDING",
      asset: `${asset}:${rail}`,
      metadataJson: JSON.stringify({ asset, rail, amount, address, memo: memo ?? null }),
    },
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.withdrawal.request",
    entity: "Transaction",
    entityId: tx.id,
    after: { asset, rail, amount },
  });

  res.status(201).json({ id: tx.id, status: tx.status });
});

consumerRouter.post("/withdrawals/usdc", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = consumerUsdcWithdrawalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { balance: true },
  });
  if (!user || user.role !== "CONSUMER") {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (user.isFrozen) {
    res.status(403).json({ error: "user_frozen" });
    return;
  }
  const kycOk = await requireKycApproved(user.id);
  if (!kycOk) {
    res.status(403).json({ error: "kyc_required" });
    return;
  }

  const b = user.balance ?? (await prisma.balance.create({ data: { userId: user.id } }));
  const { usdCents, address } = parsed.data;
  if (b.usdCents < usdCents) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }

  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "WITHDRAWAL",
      status: "PENDING",
      asset: "USD:USDC",
      amountUsdCents: usdCents,
      metadataJson: JSON.stringify({
        amount: (usdCents / 100).toFixed(2),
        address,
        rail: "USDC",
      }),
    },
  });

  await writeAuditLog({
    req,
    actorId: user.id,
    action: "consumer.withdrawal.usdc.request",
    entity: "Transaction",
    entityId: tx.id,
    after: { usdCents },
  });

  res.status(201).json({ id: tx.id, status: tx.status });
});
