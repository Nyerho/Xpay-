import "dotenv/config";
import { spawn } from "node:child_process";
import { createApp } from "./app";
import { bootstrap } from "./bootstrap";

const app = createApp();

const port = Number(process.env.PORT ?? "4000");

async function runDbPushIfNeeded() {
  const hasDbUrl = Boolean(process.env.DATABASE_URL);
  const skip = process.env.SKIP_DB_PUSH === "true";
  if (!hasDbUrl || skip) return;

  const acceptDataLoss = process.env.DB_PUSH_ACCEPT_DATA_LOSS !== "false";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["prisma", "db", "push", ...(acceptDataLoss ? ["--accept-data-loss"] : [])],
      { stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`db_push_failed:${code ?? "unknown"}`));
    });
  });
}

runDbPushIfNeeded()
  .then(() => bootstrap())
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      process.stdout.write(`server listening on 0.0.0.0:${port}\n`);
    });
  })
  .catch((err) => {
    process.stderr.write(String(err) + "\n");
    process.exit(1);
  });
