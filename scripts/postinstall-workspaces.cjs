/* eslint-disable no-console */
const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

if (!process.env.VERCEL && !process.env.CI) {
  process.exit(0);
}

if (process.env.XPAY_POSTINSTALL_WORKSPACES === "1") {
  process.exit(0);
}

function hasDep(path) {
  return existsSync(path);
}

const hasFirebase = hasDep("app/node_modules/firebase/package.json");
const hasLottie = hasDep("app/node_modules/lottie-web/package.json");

if (hasFirebase && hasLottie) {
  process.exit(0);
}

const env = { ...process.env, XPAY_POSTINSTALL_WORKSPACES: "1" };
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const res = spawnSync(npmCmd, ["install", "--workspaces", "--include-workspace-root", "--no-fund", "--no-audit"], {
  stdio: "inherit",
  env,
});

process.exit(res.status ?? 1);
