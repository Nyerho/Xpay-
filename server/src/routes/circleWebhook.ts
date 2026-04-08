import type { RequestHandler } from "express";
import { prisma } from "../prisma";
import { circleFetchPublicKeyPem, circleVerifyWebhook } from "../circle";

const publicKeyCache = new Map<string, { pem: string; fetchedAt: number }>();

async function getCachedKeyPem(keyId: string) {
  const now = Date.now();
  const cached = publicKeyCache.get(keyId);
  if (cached && now - cached.fetchedAt < 15 * 60 * 1000) return cached.pem;
  const pem = await circleFetchPublicKeyPem({ keyId });
  publicKeyCache.set(keyId, { pem, fetchedAt: now });
  return pem;
}

function parseAmountToCents(amountStr: string) {
  const [whole, frac = ""] = amountStr.split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  const centsStr = (whole.replace(/^0+/, "") || "0") + fracPadded;
  const cents = Number(centsStr);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s || "{}") as any;
  } catch {
    return {};
  }
}

export const circleWebhookHandler: RequestHandler = async (req, res) => {
  try {
    const sig = req.header("X-Circle-Signature");
    const keyId = req.header("X-Circle-Key-Id");
    if (!sig || !keyId) {
      res.status(400).json({ error: "missing_signature" });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.from("");
    const pem = await getCachedKeyPem(keyId);
    const verify = circleVerifyWebhook({ rawBody, signature: sig, publicKeyPem: pem });
    if (!verify.ok) {
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

    const notificationId = typeof payload?.notificationId === "string" ? payload.notificationId : null;
    if (!notificationId) {
      res.status(400).json({ error: "missing_notification_id" });
      return;
    }

    try {
      await prisma.externalWebhookEvent.create({
        data: { provider: "circle", eventId: notificationId, payloadJson: payloadStr },
      });
    } catch {
      res.json({ ok: true });
      return;
    }

    const type = typeof payload?.notificationType === "string" ? payload.notificationType : null;
    const n = payload?.notification;
    if (type === "transactions.inbound" && n && typeof n === "object") {
      const state = typeof n.state === "string" ? n.state : null;
      const walletId = typeof n.walletId === "string" ? n.walletId : null;
      const blockchain = typeof n.blockchain === "string" ? n.blockchain : null;
      const txId = typeof n.id === "string" ? n.id : null;
      const txHash = typeof n.txHash === "string" ? n.txHash : null;
      const amounts = Array.isArray(n.amounts) ? (n.amounts as unknown[]) : [];
      const amountStr = typeof amounts[0] === "string" ? (amounts[0] as string) : null;
      const tokenSymbol =
        (typeof n.token?.symbol === "string" ? (n.token.symbol as string) : null) ??
        (typeof n.tokenSymbol === "string" ? (n.tokenSymbol as string) : null);

      if (state === "COMPLETE" && walletId && amountStr && (tokenSymbol === "USDC" || tokenSymbol === "USD")) {
        const wallet = await prisma.externalWallet.findFirst({ where: { provider: "circle", walletId } });
        if (wallet) {
          const cents = parseAmountToCents(amountStr);
          if (cents) {
            const externalRef = txId ? `circle:${txId}` : `circle:${notificationId}`;
            try {
              await prisma.$transaction(async (p) => {
                await p.transaction.create({
                  data: {
                    userId: wallet.userId,
                    type: "DEPOSIT",
                    status: "COMPLETE",
                    asset: blockchain ? `USDC:${blockchain}` : "USDC",
                    amountUsdCents: cents,
                    externalRef,
                    metadataJson: JSON.stringify({
                      provider: "circle",
                      walletId,
                      blockchain,
                      txId,
                      txHash,
                      amount: amountStr,
                    }),
                  },
                });
                await p.balance.update({
                  where: { userId: wallet.userId },
                  data: { usdCents: { increment: cents } },
                });
              });
            } catch {
            }
          }
        }
      }
    } else if (type === "transactions.outbound" && n && typeof n === "object") {
      const state = typeof n.state === "string" ? n.state : null;
      const txId = typeof n.id === "string" ? n.id : null;
      const txHash = typeof n.txHash === "string" ? n.txHash : null;
      const blockchain = typeof n.blockchain === "string" ? n.blockchain : null;

      if (txId && (state === "COMPLETE" || state === "FAILED" || state === "CANCELLED" || state === "DENIED")) {
        const externalRef = `circle:outbound:${txId}`;
        const t = await prisma.transaction.findFirst({ where: { externalRef } });
        if (t && t.type === "WITHDRAWAL" && t.status === "PENDING") {
          const meta = safeJsonParse(t.metadataJson);
          if (state === "COMPLETE") {
            await prisma.transaction.update({
              where: { id: t.id },
              data: { status: "COMPLETE", metadataJson: JSON.stringify({ ...meta, circle: { txId, blockchain, txHash, state } }) },
            });
          } else {
            const debited = Boolean(meta?.debited);
            const usdCents = typeof t.amountUsdCents === "number" ? t.amountUsdCents : null;
            await prisma.$transaction(async (p) => {
              await p.transaction.update({
                where: { id: t.id },
                data: { status: "FAILED", metadataJson: JSON.stringify({ ...meta, circle: { txId, blockchain, txHash, state } }) },
              });
              if (debited && usdCents && usdCents > 0) {
                await p.balance.update({ where: { userId: t.userId }, data: { usdCents: { increment: usdCents } } });
              }
            });
          }
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("missing_env:CIRCLE_API_KEY")) {
      res.status(503).json({ error: "circle_not_configured" });
      return;
    }
    if (msg.startsWith("circle_public_key_fetch_failed:")) {
      res.status(401).json({ error: "circle_public_key_fetch_failed" });
      return;
    }
    res.status(500).json({ error: "circle_webhook_error" });
  }
};
