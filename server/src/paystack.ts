import crypto from "node:crypto";

export type PaystackInitResult = { authorizationUrl: string; reference: string };

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("paystack_not_configured");
  return key;
}

export function paystackVerifyWebhookSignature(params: { rawBody: Buffer; signature: string }) {
  const secret = getPaystackSecretKey();
  const h = crypto.createHmac("sha512", secret).update(params.rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(h, "utf8"), Buffer.from(params.signature, "utf8"));
}

export async function paystackInitializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitResult> {
  const secret = getPaystackSecretKey();
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      currency: "NGN",
      reference: params.reference,
      callback_url: params.callbackUrl ?? undefined,
      metadata: params.metadata ?? undefined,
    }),
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    throw new Error(`paystack_init_failed:${res.status}`);
  }
  const url = typeof json?.data?.authorization_url === "string" ? (json.data.authorization_url as string) : null;
  const reference = typeof json?.data?.reference === "string" ? (json.data.reference as string) : null;
  if (!url || !reference) throw new Error("paystack_init_failed");
  return { authorizationUrl: url, reference };
}

