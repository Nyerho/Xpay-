import crypto from "node:crypto";

export type PaystackInitResult = { authorizationUrl: string; reference: string };
export type PaystackBank = { name: string; code: string };

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

export async function paystackListBanks(): Promise<PaystackBank[]> {
  const secret = getPaystackSecretKey();
  const res = await fetch("https://api.paystack.co/bank?currency=NGN&perPage=200", {
    headers: { authorization: `Bearer ${secret}` },
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(`paystack_banks_failed:${res.status}`);
  const data = Array.isArray(json?.data) ? (json.data as unknown[]) : [];
  const out: PaystackBank[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : null;
    const code = typeof r.code === "string" ? r.code : null;
    if (name && code) out.push({ name, code });
  }
  return out;
}

export async function paystackResolveAccount(params: { accountNumber: string; bankCode: string }) {
  const secret = getPaystackSecretKey();
  const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(
    params.bankCode,
  )}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(`paystack_resolve_failed:${res.status}`);
  const accountName = typeof json?.data?.account_name === "string" ? (json.data.account_name as string) : null;
  if (!accountName) throw new Error("paystack_resolve_failed");
  return { accountName };
}

export async function paystackCreateTransferRecipient(params: { bankCode: string; accountNumber: string; name: string }) {
  const secret = getPaystackSecretKey();
  const res = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({
      type: "nuban",
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    }),
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(`paystack_recipient_failed:${res.status}`);
  const recipientCode = typeof json?.data?.recipient_code === "string" ? (json.data.recipient_code as string) : null;
  if (!recipientCode) throw new Error("paystack_recipient_failed");
  return { recipientCode };
}

export async function paystackInitiateTransfer(params: { amountKobo: number; recipientCode: string; reference: string; reason?: string }) {
  const secret = getPaystackSecretKey();
  const res = await fetch("https://api.paystack.co/transfer", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason ?? "Withdrawal",
    }),
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(`paystack_transfer_failed:${res.status}`);
  const transferCode = typeof json?.data?.transfer_code === "string" ? (json.data.transfer_code as string) : null;
  const status = typeof json?.data?.status === "string" ? (json.data.status as string) : null;
  if (!transferCode) throw new Error("paystack_transfer_failed");
  return { transferCode, status };
}
