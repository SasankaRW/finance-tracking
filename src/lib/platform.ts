import { Capacitor } from "@capacitor/core";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

// True for desktop web and Electron (real mouse/trackpad input), false for
// Capacitor/touch — the gate for anything (like Lenis) that must never run
// against native touch scrolling.
export function useIsDesktopLike(): boolean {
  const pointerFine = useMediaQuery("(pointer: fine)");
  return pointerFine && !isAndroidNative();
}
