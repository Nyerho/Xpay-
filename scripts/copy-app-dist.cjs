const fs = require("node:fs");
const path = require("node:path");

const src = path.join(process.cwd(), "app", "dist");
const dest = path.join(process.cwd(), "dist");

function rm(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(fromPath, toPath);
    else if (entry.isFile()) fs.copyFileSync(fromPath, toPath);
  }
}

if (!fs.existsSync(src)) {
  process.stderr.write(`missing_app_dist:${src}\n`);
  process.exit(1);
}

rm(dest);
copyDir(src, dest);
process.stdout.write(`copied:${src} -> ${dest}\n`);

