import { Capacitor, registerPlugin } from "@capacitor/core";
import { normalizeHexColor } from "@/lib/theme/colors";

interface SystemThemePlugin {
  getAccentColor(): Promise<{ hex: string }>;
  isAvailable(): Promise<{ available: boolean }>;
}

const SystemTheme = registerPlugin<SystemThemePlugin>("SystemTheme");

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function isSystemThemeAvailable(): Promise<boolean> {
  if (!isAndroidNative()) return false;
  try {
    const { available } = await SystemTheme.isAvailable();
    return available;
  } catch {
    return true;
  }
}

export async function getSystemAccentColor(): Promise<string | null> {
  if (!isAndroidNative()) return null;
  try {
    const { hex } = await SystemTheme.getAccentColor();
    return normalizeHexColor(hex);
  } catch {
    return null;
  }
}
