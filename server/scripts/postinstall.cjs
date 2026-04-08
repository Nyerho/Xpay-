const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const hasDbUrl = Boolean(process.env.DATABASE_URL);

if (hasDbUrl) {
  run("npx prisma db push");
}

run("npx prisma generate");
run("npx tsc -p tsconfig.json");

