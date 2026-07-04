"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  applyPrimaryColor,
  clearAppliedPrimaryColor,
  clearStoredPrimaryColor,
  clearThemeColorMode,
  DEFAULT_PRIMARY_COLOR,
  normalizeHexColor,
  readStoredPrimaryColor,
  readThemeColorMode,
  storePrimaryColor,
  storeThemeColorMode,
  type ThemeColorMode,
} from "@/lib/theme/colors";
import {
  getSystemAccentColor,
  isAndroidNative,
  isSystemThemeAvailable,
} from "@/lib/theme/system-theme";

type ThemeColorContextValue = {
  color: string;
  mode: ThemeColorMode;
  systemColorAvailable: boolean;
  setColor: (hex: string) => void;
  setUseSystemColor: (enabled: boolean) => void;
  resetColor: () => void;
};

const ThemeColorContext = React.createContext<ThemeColorContextValue | null>(null);

export function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [color, setColorState] = React.useState(DEFAULT_PRIMARY_COLOR);
  const [mode, setModeState] = React.useState<ThemeColorMode>("custom");
  const [systemColorAvailable, setSystemColorAvailable] = React.useState(false);

  const syncSystemColor = React.useCallback(async () => {
    const systemHex = await getSystemAccentColor();
    if (!systemHex) return false;
    setColorState(systemHex);
    applyPrimaryColor(systemHex);
    return true;
  }, []);

  const applyCustomStored = React.useCallback(() => {
    const stored = readStoredPrimaryColor();
    const next = stored ?? DEFAULT_PRIMARY_COLOR;
    setColorState(next);
    applyPrimaryColor(next);
  }, []);

  const applyTheme = React.useCallback(async () => {
    const storedMode = readThemeColorMode();
    setModeState(storedMode);

    if (storedMode === "system") {
      const synced = await syncSystemColor();
      if (synced) return;
      storeThemeColorMode("custom");
      setModeState("custom");
    }

    applyCustomStored();
  }, [applyCustomStored, syncSystemColor]);

  React.useEffect(() => {
    void isSystemThemeAvailable().then(setSystemColorAvailable);
    void applyTheme();
  }, [applyTheme]);

  React.useEffect(() => {
    if (mode === "system") {
      void syncSystemColor();
      return;
    }
    applyCustomStored();
  }, [resolvedTheme, mode, applyCustomStored, syncSystemColor]);

  React.useEffect(() => {
    if (mode !== "system" || !isAndroidNative()) return;

    const refresh = () => {
      void syncSystemColor();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);

    let removed = false;
    let removeCapListener: (() => void) | undefined;

    void import("@capacitor/app")
      .then(({ App }) => App.addListener("resume", refresh))
      .then((listener) => {
        if (removed) {
          void listener.remove();
          return;
        }
        removeCapListener = () => {
          void listener.remove();
        };
      })
      .catch(() => {
        // @capacitor/app optional on web builds
      });

    return () => {
      removed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
      removeCapListener?.();
    };
  }, [mode, syncSystemColor]);

  const setColor = React.useCallback((hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return;
    storeThemeColorMode("custom");
    setModeState("custom");
    setColorState(normalized);
    applyPrimaryColor(normalized);
    storePrimaryColor(normalized);
  }, []);

  const setUseSystemColor = React.useCallback(
    (enabled: boolean) => {
      if (enabled) {
        storeThemeColorMode("system");
        setModeState("system");
        void syncSystemColor();
        return;
      }

      storeThemeColorMode("custom");
      setModeState("custom");
      applyCustomStored();
    },
    [applyCustomStored, syncSystemColor],
  );

  const resetColor = React.useCallback(() => {
    setModeState("custom");
    setColorState(DEFAULT_PRIMARY_COLOR);
    clearAppliedPrimaryColor();
    clearStoredPrimaryColor();
    clearThemeColorMode();
  }, []);

  const value = React.useMemo(
    () => ({
      color,
      mode,
      systemColorAvailable,
      setColor,
      setUseSystemColor,
      resetColor,
    }),
    [color, mode, systemColorAvailable, setColor, setUseSystemColor, resetColor],
  );

  return (
    <ThemeColorContext.Provider value={value}>{children}</ThemeColorContext.Provider>
  );
}

export function useThemeColor() {
  const ctx = React.useContext(ThemeColorContext);
  if (!ctx) {
    throw new Error("useThemeColor must be used within ThemeColorProvider");
  }
  return ctx;
}
