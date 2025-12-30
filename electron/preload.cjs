const { contextBridge } = require("electron");

// Keep this minimal for security. Add APIs only when needed.
contextBridge.exposeInMainWorld("cashly", {
  platform: process.platform,
});


