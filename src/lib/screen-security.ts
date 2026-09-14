"use client";

import * as React from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

interface ScreenSecurityPlugin {
  setSecure(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
}

const ScreenSecurity = registerPlugin<ScreenSecurityPlugin>("ScreenSecurity");

function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

// Blocks screenshots/screen recording and blanks the recents/task-switcher
// thumbnail for as long as the calling screen is mounted — scoped rather than
// app-wide, since FLAG_SECURE is a single Window-level flag this SPA's one
// Activity can flip at any time. Always clears on unmount, even if the
// component unmounts because of an error, so a screen never leaves the flag
// stuck on for the rest of the session.
export function useScreenSecurity(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled || !isAndroidNative()) return;

    void ScreenSecurity.setSecure({ enabled: true }).catch(() => {
      // best-effort — an unsupported/older build shouldn't break the screen
    });

    return () => {
      void ScreenSecurity.setSecure({ enabled: false }).catch(() => {
        // best-effort
      });
    };
  }, [enabled]);
}
