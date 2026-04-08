const { execSync } = require("node:child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

run("npx prisma generate");
run("npx tsc -p tsconfig.json");
