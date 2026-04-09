import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { requireMinRole, requireAnyRole } from "../rbac";
import {
  createInventorySchema,
  createUserSchema,
  paginationSchema,
  updateGiftCardSchema,
  updateInventorySchema,
  updateKycSchema,
  updateUserSchema,
  upsertSettingSchema,
} from "../validators";
import { hashPassword } from "../auth";
import { writeAuditLog } from "../audit";
import { circleCreateOutboundUsdcTransfer, getCircleBlockchains, isCircleEnabled } from "../circle";
import { sendEmail } from "../notify";
import { paystackInitiateTransfer } from "../paystack";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireMinRole("SUPPORT"));

function param(value: unknown) {
  return Array.isArray(value) ? String(value[0]) : String(value);
}

adminRouter.get("/users", async (req: AuthenticatedRequest, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query" });
    return;
  }
  const q = parsed.data.q?.trim().toLowerCase();
  const users = await prisma.user.findMany({
    where: q ? { email: { contains: q } } : undefined,
    take: parsed.data.limit,
    orderBy: { createdAt: "desc" },
  });
  res.json(users.map((u) => ({
    id: u.id,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isFrozen: u.isFrozen,
    mfaEnabled: u.mfaEnabled,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  })));
});

adminRouter.post("/users", requireMinRole("ADMIN"), async (req: AuthenticatedRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const created = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      passwordHash,
      role: parsed.data.role,
    },
  });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.user.create",
    entity: "User",
    entityId: created.id,
    after: { id: created.id, email: created.email, role: created.role },
  });

  res.status(201).json({ id: created.id });
});

adminRouter.get("/users/:id", async (req, res) => {
  const id = param(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isFrozen: user.isFrozen,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  });
});

adminRouter.patch("/users/:id", requireMinRole("ADMIN"), async (req: AuthenticatedRequest, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const id = param(req.params.id);
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  if (before.role === "SUPERADMIN" && req.auth!.role !== "SUPERADMIN") {
    res.status(403).json({ error: "superadmin_only" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      email: parsed.data.email ? parsed.data.email.toLowerCase() : undefined,
      phone: parsed.data.phone === undefined ? undefined : parsed.data.phone,
      role: parsed.data.role,
      isFrozen: parsed.data.isFrozen,
      mfaEnabled: parsed.data.mfaEnabled,
    },
  });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.user.update",
    entity: "User",
    entityId: updated.id,
    before: { email: before.email, phone: before.phone, role: before.role, isFrozen: before.isFrozen },
    after: { email: updated.email, phone: updated.phone, role: updated.role, isFrozen: updated.isFrozen },
  });

  res.json({ ok: true });
});

adminRouter.delete(
  "/users/:id",
  requireAnyRole(["ADMIN", "SUPERADMIN"]),
  async (req: AuthenticatedRequest, res) => {
    const id = param(req.params.id);
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (before.role === "SUPERADMIN" && req.auth!.role !== "SUPERADMIN") {
      res.status(403).json({ error: "superadmin_only" });
      return;
    }

    await prisma.user.delete({ where: { id: before.id } });

    await writeAuditLog({
      req,
      actorId: req.auth!.userId,
      action: "admin.user.delete",
      entity: "User",
      entityId: before.id,
      before: { email: before.email, role: before.role },
    });

    res.json({ ok: true });
  },
);

adminRouter.get("/kyc", async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query" });
    return;
  }
  const cases = await prisma.kycCase.findMany({
    take: parsed.data.limit,
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
  res.json(
    cases.map((c) => ({
      id: c.id,
      userId: c.userId,
      userEmail: c.user.email,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      reviewedById: c.reviewedById,
      reviewNotes: c.reviewNotes,
    })),
  );
});

adminRouter.patch("/kyc/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = updateKycSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const id = param(req.params.id);
  const before = await prisma.kycCase.findUnique({ where: { id } });
  if (!before) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const updated = await prisma.kycCase.update({
    where: { id },
    data: {
      status: parsed.data.status,
      reviewNotes: parsed.data.reviewNotes === undefined ? undefined : parsed.data.reviewNotes,
      reviewedById: req.auth!.userId,
    },
  });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.kyc.update",
    entity: "KycCase",
    entityId: updated.id,
    before: { status: before.status, reviewNotes: before.reviewNotes },
    after: { status: updated.status, reviewNotes: updated.reviewNotes },
  });

  res.json({ ok: true });
});

adminRouter.get("/gift-cards", async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query" });
    return;
  }
  const submissions = await prisma.giftCardSubmission.findMany({
    take: parsed.data.limit,
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
  res.json(
    submissions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user.email,
      brand: s.brand,
      valueUsdCents: s.valueUsdCents,
      offerUsdtCents: s.offerUsdtCents,
      status: s.status,
      frontImageUrl: s.frontImageUrl,
      backImageUrl: s.backImageUrl,
      createdAt: s.createdAt,
      reviewedById: s.reviewedById,
      reviewNotes: s.reviewNotes,
      fraudFlagsJson: s.fraudFlagsJson,
    })),
  );
});

adminRouter.patch("/gift-cards/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = updateGiftCardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const id = param(req.params.id);
  const before = await prisma.giftCardSubmission.findUnique({ where: { id } });
  if (!before) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const submitter = await prisma.user.findUnique({ where: { id: before.userId } });
  if (before.status === "APPROVED" && parsed.data.status !== "APPROVED") {
    res.status(409).json({ error: "already_approved" });
    return;
  }

  const updated = await prisma.$transaction(async (p) => {
    const next = await p.giftCardSubmission.update({
      where: { id },
      data: {
        status: parsed.data.status,
        reviewNotes: parsed.data.reviewNotes === undefined ? undefined : parsed.data.reviewNotes,
        fraudFlagsJson: parsed.data.fraudFlagsJson ?? before.fraudFlagsJson,
        reviewedById: req.auth!.userId,
      },
    });

    if (before.status !== "APPROVED" && next.status === "APPROVED") {
      await p.balance.upsert({
        where: { userId: before.userId },
        create: { userId: before.userId, usdtCents: before.offerUsdtCents },
        update: { usdtCents: { increment: before.offerUsdtCents } },
      });

      const ref = `giftcard:${before.id}`;
      const existingTx = await p.transaction.findUnique({ where: { externalRef: ref } });
      if (existingTx) {
        if (existingTx.status !== "COMPLETE") {
          await p.transaction.update({ where: { id: existingTx.id }, data: { status: "COMPLETE" } });
        }
      } else {
        await p.transaction.create({
          data: {
            userId: before.userId,
            type: "GIFT_CARD_SELL",
            status: "COMPLETE",
            asset: before.brand,
            amountUsdCents: before.valueUsdCents,
            externalRef: ref,
            metadataJson: JSON.stringify({ submissionId: before.id, offerUsdtCents: before.offerUsdtCents }),
          },
        });
      }
    }

    return next;
  });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.giftCard.update",
    entity: "GiftCardSubmission",
    entityId: updated.id,
    before: { status: before.status, reviewNotes: before.reviewNotes },
    after: { status: updated.status, reviewNotes: updated.reviewNotes },
  });

  if (submitter?.email && before.status !== updated.status) {
    if (updated.status === "APPROVED") {
      await sendEmail({
        to: submitter.email,
        subject: "Gift card approved",
        text: `Your gift card submission was approved.\n\nBrand: ${before.brand}\nValue: $${(before.valueUsdCents / 100).toFixed(2)}\nCredited: ${(before.offerUsdtCents / 100).toFixed(2)} USDT\n\nSubmission ID: ${before.id}\n`,
      });
    } else if (updated.status === "REJECTED") {
      await sendEmail({
        to: submitter.email,
        subject: "Gift card rejected",
        text: `Your gift card submission was rejected.\n\nBrand: ${before.brand}\nValue: $${(before.valueUsdCents / 100).toFixed(2)}\n\nSubmission ID: ${before.id}\nNotes: ${updated.reviewNotes ?? "-"}\n`,
      });
    }
  }

  res.json({ ok: true });
});

adminRouter.get("/settings/:key", requireMinRole("FINANCE"), async (req, res) => {
  const key = param(req.params.key);
  const found = await prisma.setting.findUnique({ where: { key } });
  if (!found) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ key: found.key, valueJson: found.valueJson, updatedAt: found.updatedAt, updatedById: found.updatedById });
});

adminRouter.put("/settings/:key", requireMinRole("FINANCE"), async (req: AuthenticatedRequest, res) => {
  const parsed = upsertSettingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const key = param(req.params.key);
  let before: { valueJson: string } | null = null;
  const existing = await prisma.setting.findUnique({ where: { key } });
  if (existing) before = { valueJson: existing.valueJson };

  const updated = await prisma.setting.upsert({
    where: { key },
    create: { key, valueJson: parsed.data.valueJson, updatedById: req.auth!.userId },
    update: { valueJson: parsed.data.valueJson, updatedById: req.auth!.userId },
  });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.setting.upsert",
    entity: "Setting",
    entityId: updated.key,
    before,
    after: { valueJson: updated.valueJson },
  });

  res.json({ ok: true });
});

adminRouter.get("/inventory", requireMinRole("ADMIN"), async (_req, res) => {
  const items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(items);
});

adminRouter.post("/inventory", requireMinRole("ADMIN"), async (req: AuthenticatedRequest, res) => {
  const parsed = createInventorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const created = await prisma.inventoryItem.create({ data: parsed.data });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.inventory.create",
    entity: "InventoryItem",
    entityId: created.id,
    after: { brand: created.brand, valueUsdCents: created.valueUsdCents, status: created.status },
  });

  res.status(201).json({ id: created.id });
});

adminRouter.patch("/inventory/:id", requireMinRole("ADMIN"), async (req: AuthenticatedRequest, res) => {
  const parsed = updateInventorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const id = param(req.params.id);
  const before = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!before) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const updated = await prisma.inventoryItem.update({ where: { id: before.id }, data: parsed.data });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.inventory.update",
    entity: "InventoryItem",
    entityId: updated.id,
    before: { status: before.status },
    after: { status: updated.status },
  });

  res.json({ ok: true });
});

adminRouter.delete("/inventory/:id", requireMinRole("ADMIN"), async (req: AuthenticatedRequest, res) => {
  const id = param(req.params.id);
  const before = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!before) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  await prisma.inventoryItem.delete({ where: { id: before.id } });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.inventory.delete",
    entity: "InventoryItem",
    entityId: before.id,
    before: { brand: before.brand, valueUsdCents: before.valueUsdCents, status: before.status },
  });

  res.json({ ok: true });
});

adminRouter.get("/transactions", requireMinRole("SUPPORT"), async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const items = await prisma.transaction.findMany({
    where: q
      ? {
          OR: [
            { id: { contains: q } },
            { user: { email: { contains: q.toLowerCase() } } },
            { asset: { contains: q } },
          ],
        }
      : undefined,
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(
    items.map((t) => ({
      id: t.id,
      userId: t.userId,
      userEmail: t.user.email,
      type: t.type,
      status: t.status,
      asset: t.asset,
      amountUsdCents: t.amountUsdCents,
      createdAt: t.createdAt,
    })),
  );
});

adminRouter.post("/transactions/:id/settle", requireMinRole("FINANCE"), async (req: AuthenticatedRequest, res) => {
  const id = param(req.params.id);
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!(tx.type === "DEPOSIT" || tx.type === "WITHDRAWAL")) {
    res.status(400).json({ error: "unsupported_type" });
    return;
  }
  if (tx.status === "COMPLETE") {
    res.status(409).json({ error: "already_complete" });
    return;
  }
  if (tx.status !== "PENDING") {
    res.status(409).json({ error: "not_pending" });
    return;
  }
  if (tx.type === "WITHDRAWAL" && tx.externalRef) {
    res.status(409).json({ error: "already_submitted" });
    return;
  }

  let meta: any = {};
  try {
    meta = JSON.parse(tx.metadataJson || "{}");
  } catch {
    meta = {};
  }

  const assetRail = typeof tx.asset === "string" ? tx.asset : "";
  const [asset, rail] = assetRail.split(":");

  const user = await prisma.user.findUnique({ where: { id: tx.userId }, include: { balance: true } });
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  const balance = user.balance ?? (await prisma.balance.create({ data: { userId: user.id } }));

  const amountStr = typeof meta.amount === "string" ? meta.amount : null;
  if (!amountStr || !/^\d+(\.\d+)?$/.test(amountStr)) {
    res.status(400).json({ error: "invalid_amount" });
    return;
  }

  function parseToMinor(a: string, decimals: number) {
    const [whole, frac = ""] = a.split(".");
    const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
    const digits = (whole.replace(/^0+/, "") || "0") + fracPadded;
    return digits.replace(/^0+/, "") || "0";
  }

  const updateBalance: Record<string, any> = {};
  if (tx.type === "DEPOSIT" && asset === "USD" && rail === "BANK") {
    const cents = Number(parseToMinor(amountStr, 2));
    if (!Number.isFinite(cents) || cents <= 0) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    updateBalance.usdCents = balance.usdCents + cents;
  } else if (tx.type === "DEPOSIT" && asset === "NGN" && rail === "BANK") {
    const kobo = Number(parseToMinor(amountStr, 2));
    if (!Number.isFinite(kobo) || kobo <= 0) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    updateBalance.ngnKobo = balance.ngnKobo + kobo;
  } else if (tx.type === "DEPOSIT" && asset === "USDT" && (rail === "TRC20" || rail === "ERC20")) {
    const cents = Number(parseToMinor(amountStr, 2));
    if (!Number.isFinite(cents) || cents <= 0) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    updateBalance.usdtCents = balance.usdtCents + cents;
  } else if (tx.type === "DEPOSIT" && asset === "BTC" && rail === "BTC") {
    const sats = Number(parseToMinor(amountStr, 8));
    if (!Number.isFinite(sats) || sats <= 0 || sats > 2_000_000_000) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    updateBalance.btcSats = balance.btcSats + sats;
  } else if (tx.type === "DEPOSIT" && asset === "ETH" && rail === "ETH") {
    const wei = BigInt(parseToMinor(amountStr, 18));
    if (wei <= 0n) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    const current = BigInt(balance.ethWei || "0");
    updateBalance.ethWei = (current + wei).toString();
  } else if (tx.type === "WITHDRAWAL" && asset === "NGN" && rail === "BANK") {
    const bankName = typeof meta.bankName === "string" ? meta.bankName.trim() : "";
    const accountName = typeof meta.accountName === "string" ? meta.accountName.trim() : "";
    const accountNumber = typeof meta.accountNumber === "string" ? meta.accountNumber.trim() : "";
    if (!bankName || !accountName || !accountNumber) {
      res.status(400).json({ error: "missing_bank_details" });
      return;
    }
    const kobo = Number(parseToMinor(amountStr, 2));
    if (!Number.isFinite(kobo) || kobo <= 0) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    if (balance.ngnKobo < kobo) {
      res.status(409).json({ error: "insufficient_funds" });
      return;
    }
    updateBalance.ngnKobo = balance.ngnKobo - kobo;
  } else if (tx.type === "WITHDRAWAL") {
    if (asset !== "USD") {
      res.status(400).json({ error: "unsupported_asset" });
      return;
    }
    const dest = typeof meta.address === "string" ? meta.address.trim() : "";
    if (!dest) {
      res.status(400).json({ error: "missing_destination" });
      return;
    }

    const cents = Number(parseToMinor(amountStr, 2));
    if (!Number.isFinite(cents) || cents <= 0) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    if (balance.usdCents < cents) {
      res.status(409).json({ error: "insufficient_funds" });
      return;
    }

    if (!isCircleEnabled()) {
      res.status(501).json({ error: "circle_not_configured" });
      return;
    }

    const blockchain = getCircleBlockchains()[0];
    if (!blockchain) {
      res.status(501).json({ error: "circle_not_configured" });
      return;
    }

    const userWallet = await prisma.externalWallet.findFirst({ where: { provider: "circle", userId: user.id, blockchain } });
    if (!userWallet) {
      res.status(409).json({ error: "no_custody_wallet" });
      return;
    }

    const circleTx = await circleCreateOutboundUsdcTransfer({
      blockchain,
      walletId: userWallet.walletId,
      walletAddress: userWallet.address,
      destinationAddress: dest,
      amountUsdCents: cents,
    });

    await prisma.$transaction(async (p) => {
      await p.balance.update({ where: { userId: balance.userId }, data: { usdCents: { decrement: cents } } });
      await p.transaction.update({
        where: { id: tx.id },
        data: {
          externalRef: `circle:outbound:${circleTx.id}`,
          metadataJson: JSON.stringify({ ...meta, debited: true, circle: { txId: circleTx.id, blockchain, state: circleTx.state } }),
        },
      });
    });

    await writeAuditLog({
      req,
      actorId: req.auth!.userId,
      action: "admin.withdrawal.submit",
      entity: "Transaction",
      entityId: tx.id,
      after: { status: "PENDING", externalRef: `circle:outbound:${circleTx.id}` },
    });

    res.json({ ok: true });
    return;
  } else {
    res.status(400).json({ error: "unsupported_asset" });
    return;
  }

  await prisma.$transaction(async (p) => {
    await p.balance.update({ where: { userId: balance.userId }, data: updateBalance });
    await p.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETE" } });
  });

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: tx.type === "DEPOSIT" ? "admin.deposit.settle" : "admin.withdrawal.settle",
    entity: "Transaction",
    entityId: tx.id,
    after: { status: "COMPLETE", asset: tx.asset, amount: amountStr },
  });

  res.json({ ok: true });
});

adminRouter.post("/transactions/:id/retry-payout", requireMinRole("FINANCE"), async (req: AuthenticatedRequest, res) => {
  const id = param(req.params.id);
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (tx.type !== "WITHDRAWAL") {
    res.status(400).json({ error: "unsupported_type" });
    return;
  }
  if (tx.status !== "FAILED") {
    res.status(409).json({ error: "not_failed" });
    return;
  }
  if (tx.asset !== "NGN:PAYSTACK_TRANSFER") {
    res.status(400).json({ error: "unsupported_asset" });
    return;
  }
  if (process.env.PAYSTACK_PAYOUTS_ENABLED !== "true") {
    res.status(501).json({ error: "paystack_payouts_disabled" });
    return;
  }

  let meta: any = {};
  try {
    meta = JSON.parse(tx.metadataJson || "{}");
  } catch {
    meta = {};
  }

  const amountKobo = typeof meta.amountKobo === "number" ? meta.amountKobo : null;
  const recipientCode = typeof meta.recipientCode === "string" ? meta.recipientCode : null;
  if (!amountKobo || amountKobo <= 0 || !recipientCode) {
    res.status(400).json({ error: "missing_payout_details" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: tx.userId }, include: { balance: true } });
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  const balance = user.balance ?? (await prisma.balance.create({ data: { userId: user.id } }));
  if (balance.ngnKobo < amountKobo) {
    res.status(409).json({ error: "insufficient_funds" });
    return;
  }

  const reference = `XPAY-WD-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  const externalRef = `paystack:transfer:${reference}`;

  await prisma.$transaction(async (p) => {
    await p.balance.update({ where: { userId: balance.userId }, data: { ngnKobo: { decrement: amountKobo } } });
    await p.transaction.update({
      where: { id: tx.id },
      data: {
        status: "PENDING",
        externalRef,
        metadataJson: JSON.stringify({
          ...meta,
          debited: true,
          reference,
          retryCount: (typeof meta.retryCount === "number" ? meta.retryCount : 0) + 1,
        }),
      },
    });
  });

  try {
    const transfer = await paystackInitiateTransfer({ amountKobo, recipientCode, reference, reason: "NGN Withdrawal retry" });
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { metadataJson: JSON.stringify({ ...meta, debited: true, reference, transfer, retryCount: (typeof meta.retryCount === "number" ? meta.retryCount : 0) + 1 }) },
    });
  } catch (err) {
    await prisma.$transaction(async (p) => {
      await p.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } });
      await p.balance.update({ where: { userId: balance.userId }, data: { ngnKobo: { increment: amountKobo } } });
    });
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "paystack_not_configured") {
      res.status(501).json({ error: "paystack_not_configured" });
      return;
    }
    res.status(502).json({ error: "transfer_failed" });
    return;
  }

  await writeAuditLog({
    req,
    actorId: req.auth!.userId,
    action: "admin.withdrawal.retry",
    entity: "Transaction",
    entityId: tx.id,
    after: { externalRef },
  });

  res.json({ ok: true });
});

function toCsvRow(values: Array<string | number | null | undefined>) {
  return (
    values
      .map((v) => {
        const s = v === null || v === undefined ? "" : String(v);
        const escaped = s.replaceAll("\"", "\"\"");
        return `"${escaped}"`;
      })
      .join(",") + "\n"
  );
}

adminRouter.get("/export/users.csv", requireMinRole("FINANCE"), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
  res.setHeader("content-type", "text/csv");
  res.write(toCsvRow(["id", "email", "role", "isFrozen", "createdAt", "lastLoginAt"]));
  for (const u of users) {
    res.write(toCsvRow([u.id, u.email, u.role, u.isFrozen ? 1 : 0, u.createdAt.toISOString(), u.lastLoginAt?.toISOString()]));
  }
  res.end();
});

adminRouter.get("/export/transactions.csv", requireMinRole("FINANCE"), async (_req, res) => {
  const txs = await prisma.transaction.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { user: true } });
  res.setHeader("content-type", "text/csv");
  res.write(toCsvRow(["id", "userEmail", "type", "status", "asset", "amountUsdCents", "createdAt"]));
  for (const t of txs) {
    res.write(toCsvRow([t.id, t.user.email, t.type, t.status, t.asset, t.amountUsdCents, t.createdAt.toISOString()]));
  }
  res.end();
});

adminRouter.get("/audit", requireAnyRole(["ADMIN", "SUPERADMIN"]), async (_req, res) => {
  const items = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: true },
  });
  res.json(
    items.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      actorEmail: a.actor?.email ?? null,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      ip: a.ip,
    })),
  );
});
