import type { RequestHandler } from "express";
import { prisma } from "../prisma";
import { paystackVerifyWebhookSignature } from "../paystack";
import { sendEmail } from "../notify";
import { createNotification } from "../notifications";

function toDbErrorCode(err: unknown) {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as Record<string, unknown>;
  const code = typeof anyErr.code === "string" ? anyErr.code : null;
  const errorCode = typeof anyErr.errorCode === "string" ? anyErr.errorCode : null;
  return code ?? errorCode;
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s || "{}") as any;
  } catch {
    return {};
  }
}

async function getReferralConfig() {
  const s = await prisma.setting.findUnique({ where: { key: "referralConfig" } });
  if (!s) return { referrerBonusKobo: 0, referredBonusKobo: 0 };
  try {
    const v = JSON.parse(s.valueJson || "{}") as any;
    const referrerBonusKobo = typeof v?.referrerBonusKobo === "number" ? v.referrerBonusKobo : 0;
    const referredBonusKobo = typeof v?.referredBonusKobo === "number" ? v.referredBonusKobo : 0;
    return { referrerBonusKobo, referredBonusKobo };
  } catch {
    return { referrerBonusKobo: 0, referredBonusKobo: 0 };
  }
}

async function applyPromoAndReferralBonus(params: { userId: string; depositTxId: string }) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) return;

  const promo = await prisma.promoRedemption.findFirst({
    where: { userId: user.id, appliedAt: null },
    orderBy: { createdAt: "asc" },
    include: { promoCode: true },
  });

  if (promo) {
    const now = new Date();
    const pc = promo.promoCode;
    if (pc.isActive && (!pc.expiresAt || pc.expiresAt > now)) {
      if (!pc.maxRedemptions || pc.redeemedCount < pc.maxRedemptions) {
        const bonus = pc.ngnBonusKobo;
        if (bonus > 0) {
          await prisma.$transaction(async (p) => {
            const locked = await p.promoRedemption.findUnique({ where: { promoCodeId_userId: { promoCodeId: pc.id, userId: user.id } } });
            if (!locked || locked.appliedAt) return;
            const latest = await p.promoCode.findUnique({ where: { id: pc.id } });
            if (!latest || !latest.isActive) return;
            if (latest.expiresAt && latest.expiresAt <= now) return;
            if (latest.maxRedemptions && latest.redeemedCount >= latest.maxRedemptions) return;
            await p.balance.upsert({
              where: { userId: user.id },
              create: { userId: user.id, ngnKobo: bonus },
              update: { ngnKobo: { increment: bonus } },
            });
            await p.promoCode.update({ where: { id: latest.id }, data: { redeemedCount: { increment: 1 } } });
            await p.promoRedemption.update({
              where: { id: locked.id },
              data: { appliedAt: now, appliedTxId: params.depositTxId },
            });
          });
          await createNotification({
            userId: user.id,
            type: "promo.applied",
            title: "Promo bonus applied",
            body: `₦${(bonus / 100).toFixed(2)} bonus credited.`,
            link: "/wallet",
          });
        }
      }
    }
  }

  if (!user.referredById) return;
  const cfg = await getReferralConfig();
  if (cfg.referrerBonusKobo <= 0 && cfg.referredBonusKobo <= 0) return;

  try {
    await prisma.$transaction(async (p) => {
      const exists = await p.referralRedemption.findUnique({ where: { referredUserId: user.id } });
      if (exists) return;
      await p.referralRedemption.create({
        data: { referredUserId: user.id, referrerUserId: user.referredById!, appliedAt: new Date(), depositTxId: params.depositTxId },
      });
      if (cfg.referredBonusKobo > 0) {
        await p.balance.upsert({
          where: { userId: user.id },
          create: { userId: user.id, ngnKobo: cfg.referredBonusKobo },
          update: { ngnKobo: { increment: cfg.referredBonusKobo } },
        });
      }
      if (cfg.referrerBonusKobo > 0) {
        await p.balance.upsert({
          where: { userId: user.referredById! },
          create: { userId: user.referredById!, ngnKobo: cfg.referrerBonusKobo },
          update: { ngnKobo: { increment: cfg.referrerBonusKobo } },
        });
      }
    });
  } catch {
    return;
  }

  if (cfg.referredBonusKobo > 0) {
    await createNotification({
      userId: user.id,
      type: "referral.bonus",
      title: "Referral bonus credited",
      body: `₦${(cfg.referredBonusKobo / 100).toFixed(2)} credited to your wallet.`,
      link: "/wallet",
    });
  }
  if (cfg.referrerBonusKobo > 0) {
    await createNotification({
      userId: user.referredById,
      type: "referral.bonus",
      title: "Referral bonus credited",
      body: `₦${(cfg.referrerBonusKobo / 100).toFixed(2)} credited to your wallet.`,
      link: "/wallet",
    });
  }
}

export const paystackWebhookHandler: RequestHandler = async (req, res) => {
  try {
    const sig = req.header("x-paystack-signature");
    if (!sig) {
      res.status(400).json({ error: "missing_signature" });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.from("");
    let ok = false;
    try {
      ok = paystackVerifyWebhookSignature({ rawBody, signature: sig });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "paystack_not_configured") {
        res.status(503).json({ error: "paystack_not_configured" });
        return;
      }
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
    if (!ok) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }

    const payloadStr = rawBody.toString("utf8");
    let payload: any;
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      res.status(400).json({ error: "invalid_json" });
      return;
    }

    const event = typeof payload?.event === "string" ? payload.event : null;
    const data = payload?.data;
    const eventId = typeof data?.id === "number" || typeof data?.id === "string" ? String(data.id) : null;
    if (!eventId) {
      res.status(400).json({ error: "missing_event_id" });
      return;
    }

    try {
      await prisma.externalWebhookEvent.create({
        data: { provider: "paystack", eventId, payloadJson: payloadStr },
      });
    } catch {
      res.json({ ok: true });
      return;
    }

    if (event === "charge.success") {
      const reference = typeof data?.reference === "string" ? data.reference : null;
      const currency = typeof data?.currency === "string" ? data.currency : null;
      const status = typeof data?.status === "string" ? data.status : null;
      const amountKobo = typeof data?.amount === "number" ? data.amount : null;

      if (reference && currency === "NGN" && status === "success" && amountKobo && amountKobo > 0) {
        const t = await prisma.transaction.findFirst({ where: { externalRef: `paystack:${reference}` } });
        if (t && t.type === "DEPOSIT" && t.status === "PENDING") {
          await prisma.$transaction(async (p) => {
            await p.balance.upsert({
              where: { userId: t.userId },
              create: { userId: t.userId, ngnKobo: amountKobo },
              update: { ngnKobo: { increment: amountKobo } },
            });
            await p.transaction.update({
              where: { id: t.id },
              data: {
                status: "COMPLETE",
                metadataJson: JSON.stringify({ ...(JSON.parse(t.metadataJson || "{}") as any), paystack: { eventId, reference, amountKobo } }),
              },
            });
          });
          await createNotification({
            userId: t.userId,
            type: "ngn.deposit.completed",
            title: "NGN deposit received",
            body: `₦${(amountKobo / 100).toFixed(2)} credited to your wallet.`,
            link: "/wallet",
          });
          await applyPromoAndReferralBonus({ userId: t.userId, depositTxId: t.id });
        }
      }
    }

    if (event === "transfer.success" || event === "transfer.failed" || event === "transfer.reversed") {
      const reference = typeof data?.reference === "string" ? data.reference : null;
      const status = typeof data?.status === "string" ? data.status : null;
      const amountKobo = typeof data?.amount === "number" ? data.amount : null;
      const transferCode = typeof data?.transfer_code === "string" ? data.transfer_code : null;

      if (reference) {
        const t = await prisma.transaction.findFirst({ where: { externalRef: `paystack:transfer:${reference}` } });
        if (t && t.type === "WITHDRAWAL" && t.status === "PENDING") {
          const meta = safeJsonParse(t.metadataJson);
          const debited = Boolean(meta?.debited);
          const kobo = typeof meta?.amountKobo === "number" ? (meta.amountKobo as number) : amountKobo;

          if (event === "transfer.success" || status === "success") {
            await prisma.transaction.update({
              where: { id: t.id },
              data: { status: "COMPLETE", metadataJson: JSON.stringify({ ...meta, paystack: { eventId, reference, transferCode, status, amountKobo } }) },
            });
            await createNotification({
              userId: t.userId,
              type: "ngn.withdrawal.completed",
              title: "NGN withdrawal successful",
              body: `₦${(Number(kobo ?? 0) / 100).toFixed(2)} sent to your bank account.`,
              link: "/activity",
            });
            const user = await prisma.user.findUnique({ where: { id: t.userId } });
            if (user?.email) {
              await sendEmail({
                to: user.email,
                subject: "NGN withdrawal successful",
                text: `Your NGN withdrawal is complete.\n\nAmount: ₦${(Number(kobo ?? 0) / 100).toFixed(2)}\nReference: ${reference}\n`,
              });
            }
          } else {
            await prisma.$transaction(async (p) => {
              await p.transaction.update({
                where: { id: t.id },
                data: { status: "FAILED", metadataJson: JSON.stringify({ ...meta, paystack: { eventId, reference, transferCode, status, amountKobo } }) },
              });
              if (debited && typeof kobo === "number" && kobo > 0) {
                await p.balance.update({ where: { userId: t.userId }, data: { ngnKobo: { increment: kobo } } });
              }
            });
            await createNotification({
              userId: t.userId,
              type: "ngn.withdrawal.failed",
              title: "NGN withdrawal failed",
              body: `Your payout failed. Funds have been returned to your NGN wallet.`,
              link: "/activity",
            });
            const user = await prisma.user.findUnique({ where: { id: t.userId } });
            if (user?.email) {
              await sendEmail({
                to: user.email,
                subject: "NGN withdrawal failed",
                text: `Your NGN withdrawal failed.\n\nAmount: ₦${(Number(kobo ?? 0) / 100).toFixed(2)}\nReference: ${reference}\nThe amount has been returned to your NGN wallet if previously debited.\n`,
              });
            }
          }
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
    res.status(503).json({ error: "db_unavailable", code: toDbErrorCode(err) });
  }
};
