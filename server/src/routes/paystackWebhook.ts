import type { RequestHandler } from "express";
import { prisma } from "../prisma";
import { paystackVerifyWebhookSignature } from "../paystack";

function toDbErrorCode(err: unknown) {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as Record<string, unknown>;
  const code = typeof anyErr.code === "string" ? anyErr.code : null;
  const errorCode = typeof anyErr.errorCode === "string" ? anyErr.errorCode : null;
  return code ?? errorCode;
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
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
    res.status(503).json({ error: "db_unavailable", code: toDbErrorCode(err) });
  }
};

