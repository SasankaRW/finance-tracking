const fs = require("fs");
const path = require("path");

function rmRF(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

const ROOT = path.resolve(__dirname, "..");
rmRF(path.join(ROOT, ".next"));
rmRF(path.join(ROOT, "node_modules", ".cache"));
rmRF(path.join(ROOT, "dist"));

console.log("Cleaned .next, node_modules/.cache, dist");











