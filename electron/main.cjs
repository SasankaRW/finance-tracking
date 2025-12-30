const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;

function loadDotEnvIfPresent(envPath) {
  try {
    if (!fs.existsSync(envPath)) return;
    const txt = fs.readFileSync(envPath, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith("\"") && val.endsWith("\"")) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // Don't overwrite values that were already provided by the OS.
      if (process.env[key] == null) process.env[key] = val;
    }
  } catch (_) {
    // ignore
  }
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#0b0b0b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.once("ready-to-show", () => win.show());
  win.loadURL(url);
}

async function waitForServer(url, { timeoutMs = 20_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch (_) {
      // ignore until server is ready
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for server: ${url}`);
}

async function startProdNextServer({ port }) {
  // `dist/next` is copied into `resources/next` via electron-builder extraResources.
  const nextRoot = path.join(process.resourcesPath, "next");
  const serverPath = path.join(nextRoot, "server.js");

  // Make relative paths inside Next standalone resolve correctly.
  process.chdir(nextRoot);

  process.env.NODE_ENV = "production";
  process.env.ELECTRON = "1";
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";

  // Ensure server-side env vars (Firebase Admin) are available in packaged app.
  // The prepare script copies `.env.local`/`.env.production` into `resources/next`.
  loadDotEnvIfPresent(path.join(nextRoot, ".env.local"));
  loadDotEnvIfPresent(path.join(nextRoot, ".env.production"));
  loadDotEnvIfPresent(path.join(nextRoot, ".env"));

  // Next standalone server starts immediately when required.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  require(serverPath);
}

app.whenReady().then(async () => {
  const port = Number(process.env.PORT || 3000);
  const url = `http://127.0.0.1:${port}`;

  if (isDev) {
    // In dev we assume `next dev` is already running.
    await waitForServer(url);
    createWindow(url);
  } else {
    await startProdNextServer({ port });
    await waitForServer(url);
    createWindow(url);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});


