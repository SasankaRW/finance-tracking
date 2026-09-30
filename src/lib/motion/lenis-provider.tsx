"use client";

import * as React from "react";
import Lenis from "lenis";
import { useIsDesktopLike } from "@/lib/platform";

// Desktop web and Electron only — momentum-scroll smoothing must never touch
// Capacitor/touch, where it would fight the OS's own native scroll physics.
// The instance is fully constructed/destroyed on the desktop/mobile boundary,
// not just visually disabled, so mobile never pays for or risks it.
export function LenisProvider({ children }: { children: React.ReactNode }) {
  const desktopLike = useIsDesktopLike();

  React.useEffect(() => {
    if (!desktopLike) return;

    const lenis = new Lenis();
    let frameId: number;

    const raf = (time: number) => {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    };
    frameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, [desktopLike]);

  return <>{children}</>;
}
