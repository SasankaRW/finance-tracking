import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const resDir = join(__dirname, "..", "resources");

const jobs = [
  { in: "icon-background.svg", out: "icon-background.png", size: 1024 },
  { in: "icon-foreground.svg", out: "icon-foreground.png", size: 1024 },
  { in: "icon-only.svg", out: "icon-only.png", size: 1024 },
  { in: "splash.svg", out: "splash.png", size: 2732 },
];

mkdirSync(resDir, { recursive: true });

for (const job of jobs) {
  const inPath = join(resDir, job.in);
  const outPath = join(resDir, job.out);
  await sharp(inPath, { density: 384 })
    .resize(job.size, job.size)
    .png()
    .toFile(outPath);
  console.log(`wrote ${job.out} (${job.size}x${job.size})`);
}
