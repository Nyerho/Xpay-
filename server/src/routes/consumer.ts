import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, signAccessToken, verifyPassword, type AuthenticatedRequest, hashPassword } from "../auth";
import {
  consumerDepositRequestSchema,
  consumerSwapRequestSchema,
  consumerWithdrawalRequestSchema,
  loginSchema,
  signupSchema,
} from "../validators";
import { writeAuditLog } from "../audit";
import { circleCreateUserWallets, getCircleBlockchains, isCircleEnabled } from "../circle";

export const consumerRouter = Router();

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
