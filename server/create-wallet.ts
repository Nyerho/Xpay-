import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { initiateDeveloperControlledWalletsClient, registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

function envPath() {
  return path.join(process.cwd(), ".env");
}

function appendEnvLine(key: string, value: string) {
  fs.appendFileSync(envPath(), `\n${key}=${value}\n`, "utf8");
}

function ensureDir(p: string) {
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    if (!stat.isDirectory()) {
      throw new Error(`Invalid Directory: ${p}`);
    }
    return;
  }
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) throw new Error("CIRCLE_API_KEY is required");

  const entitySecret = process.env.CIRCLE_ENTITY_SECRET ?? crypto.randomBytes(32).toString("hex");

  if (!process.env.CIRCLE_ENTITY_SECRET) {
    const outDir = path.join(process.cwd(), "circle-output");
    ensureDir(outDir);
    await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
      recoveryFileDownloadPath: outDir,
    });
    appendEnvLine("CIRCLE_ENTITY_SECRET", entitySecret);
  }

  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  const walletSetName = process.env.CIRCLE_WALLET_SET_NAME ?? "Xpay Wallet Set";
  const walletSet = (await client.createWalletSet({ name: walletSetName })).data?.walletSet;
  if (!walletSet?.id) throw new Error("Wallet set creation failed");

  appendEnvLine("CIRCLE_WALLET_SET_ID", walletSet.id);

  const blockchain = process.env.CIRCLE_BLOCKCHAINS ?? "ARC-TESTNET";
  appendEnvLine("CIRCLE_BLOCKCHAINS", blockchain);

  process.stdout.write(`Wallet set created.\n`);
  process.stdout.write(`CIRCLE_WALLET_SET_ID=${walletSet.id}\n`);
  process.stdout.write(`CIRCLE_BLOCKCHAINS=${blockchain}\n`);
  process.stdout.write(`Entity secret saved to .env and recovery file saved to circle-output.\n`);
}

main().catch((err) => {
  process.stderr.write(String(err instanceof Error ? err.message : err) + "\n");
  process.exit(1);
});
