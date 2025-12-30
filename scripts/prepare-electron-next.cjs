const fs = require("fs");
const path = require("path");

function rmRF(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (!stat.isDirectory()) throw new Error(`copyDir: ${src} is not a directory`);
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) copyFile(s, d);
  }
}

// Repo root
const ROOT = path.resolve(__dirname, "..");
const NEXT_STANDALONE = path.join(ROOT, ".next", "standalone");
const NEXT_STATIC = path.join(ROOT, ".next", "static");
const PUBLIC_DIR = path.join(ROOT, "public");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_PROD = path.join(ROOT, ".env.production");
const ENV = path.join(ROOT, ".env");

const OUT_DIR = path.join(ROOT, "dist", "next");

if (!fs.existsSync(NEXT_STANDALONE)) {
  throw new Error(
    "Missing .next/standalone. Run `npm run build` first (Next output must be standalone).",
  );
}

rmRF(OUT_DIR);
ensureDir(OUT_DIR);

// Copy standalone server (includes minimal node_modules + server.js + required files)
copyDir(NEXT_STANDALONE, OUT_DIR);

// Next standalone expects `.next/static` relative to its cwd
copyDir(NEXT_STATIC, path.join(OUT_DIR, ".next", "static"));

// If your app serves anything from /public, include it
copyDir(PUBLIC_DIR, path.join(OUT_DIR, "public"));

// Bundle env files for the packaged app (needed for Firebase Admin + server env).
// NOTE: This includes secrets; that's expected for a single-user desktop install.
if (fs.existsSync(ENV_LOCAL)) copyFile(ENV_LOCAL, path.join(OUT_DIR, ".env.local"));
if (fs.existsSync(ENV_PROD)) copyFile(ENV_PROD, path.join(OUT_DIR, ".env.production"));
if (fs.existsSync(ENV)) copyFile(ENV, path.join(OUT_DIR, ".env"));

console.log("Prepared Electron Next bundle at:", OUT_DIR);

