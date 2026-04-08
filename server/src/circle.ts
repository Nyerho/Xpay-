import crypto from "node:crypto";

type CircleBlockchain = string;

function getEnvRequired(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`missing_env:${key}`);
  return v;
}

function chunk64(s: string) {
  return s.match(/.{1,64}/g)?.join("\n") ?? s;
}

function asPemPublicKey(maybePemOrBase64OrJwk: string) {
  const trimmed = maybePemOrBase64OrJwk.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) return trimmed;
  if (trimmed.startsWith("{")) {
    const jwk = JSON.parse(trimmed);
    const keyObj = crypto.createPublicKey({ key: jwk, format: "jwk" });
    return keyObj.export({ format: "pem", type: "spki" }).toString();
  }

  const base64 = trimmed.replace(/\s+/g, "");
  return `-----BEGIN PUBLIC KEY-----\n${chunk64(base64)}\n-----END PUBLIC KEY-----\n`;
}

function normalizeBase64OrBase64Url(input: string) {
  const s = input.trim();
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  return base64 + "=".repeat(padLen);
}

function getCircleConfig() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  const blockchainsRaw = process.env.CIRCLE_BLOCKCHAINS;

  if (!apiKey || !entitySecret || !walletSetId || !blockchainsRaw) {
    return null;
  }

  const blockchains = blockchainsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (blockchains.length === 0) return null;

  return { apiKey, entitySecret, walletSetId, blockchains };
}

export function isCircleEnabled() {
  return Boolean(getCircleConfig());
}

async function circleSdk() {
  const mod = await import("@circle-fin/developer-controlled-wallets");
  return mod;
}

export async function circleCreateUserWallets(params: {
  blockchains: CircleBlockchain[];
}): Promise<Array<{ walletId: string; address: string; blockchain: string }>> {
  const cfg = getCircleConfig();
  if (!cfg) throw new Error("circle_not_configured");

  const { initiateDeveloperControlledWalletsClient } = await circleSdk();
  const client = initiateDeveloperControlledWalletsClient({ apiKey: cfg.apiKey, entitySecret: cfg.entitySecret });

  const resp = await client.createWallets({
    walletSetId: cfg.walletSetId,
    blockchains: params.blockchains as any,
    count: 1,
    accountType: "EOA",
  });

  const wallet = resp.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address || !wallet.blockchain) throw new Error("circle_wallet_create_failed");

  return [{ walletId: wallet.id, address: wallet.address, blockchain: wallet.blockchain }];
}

function getUsdcTokenAddress(blockchain: string) {
  const override = process.env.CIRCLE_USDC_TOKEN_ADDRESS;
  if (override && override.trim().length > 0) return override.trim();
  if (blockchain === "ARC-TESTNET") return "0x3600000000000000000000000000000000000000";
  return null;
}

export async function circleCreateOutboundUsdcTransfer(params: {
  blockchain: string;
  walletId: string;
  walletAddress: string;
  destinationAddress: string;
  amountUsdCents: number;
}): Promise<{ id: string; state: string | null }> {
  const cfg = getCircleConfig();
  if (!cfg) throw new Error("circle_not_configured");
  const tokenAddress = getUsdcTokenAddress(params.blockchain);
  if (!tokenAddress) throw new Error("circle_usdc_token_unknown");

  const { initiateDeveloperControlledWalletsClient } = await circleSdk();
  const client = initiateDeveloperControlledWalletsClient({ apiKey: cfg.apiKey, entitySecret: cfg.entitySecret });

  const resp = await client.createTransaction({
    blockchain: params.blockchain as any,
    walletAddress: params.walletAddress,
    destinationAddress: params.destinationAddress,
    amount: [(params.amountUsdCents / 100).toFixed(2)],
    tokenAddress,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  } as any);

  const id = resp.data?.id;
  if (!id) throw new Error("circle_tx_create_failed");
  const state = typeof resp.data?.state === "string" ? (resp.data.state as string) : null;
  return { id, state };
}

export async function circleFetchPublicKeyPem(params: { keyId: string }) {
  const apiKey = getEnvRequired("CIRCLE_API_KEY");
  const url = `https://api.circle.com/v2/notifications/publicKey/${encodeURIComponent(params.keyId)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } });
  if (!res.ok) {
    throw new Error(`circle_public_key_fetch_failed:${res.status}`);
  }
  const json = (await res.json()) as any;
  const raw =
    (typeof json?.data?.publicKey === "string" ? json.data.publicKey : null) ??
    (typeof json?.data?.publicKeyPem === "string" ? json.data.publicKeyPem : null) ??
    (typeof json?.data?.key === "string" ? json.data.key : null);
  if (!raw) throw new Error("circle_public_key_missing");
  return asPemPublicKey(raw);
}

export function circleVerifyWebhook(params: { rawBody: Buffer; signature: string; publicKeyPem: string }): {
  ok: boolean;
  error?: "signature_decode" | "key_decode";
} {
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(normalizeBase64OrBase64Url(params.signature), "base64");
  } catch {
    return { ok: false, error: "signature_decode" };
  }

  let keyObj: crypto.KeyObject;
  try {
    keyObj = crypto.createPublicKey(params.publicKeyPem);
  } catch {
    return { ok: false, error: "key_decode" };
  }

  try {
    return { ok: crypto.verify("RSA-SHA256", params.rawBody, keyObj, sigBuf) };
  } catch {
    return { ok: false, error: "key_decode" };
  }
}

export function getCircleBlockchains() {
  const cfg = getCircleConfig();
  return cfg?.blockchains ?? [];
}
