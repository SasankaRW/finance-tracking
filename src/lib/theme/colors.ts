export const DEFAULT_PRIMARY_HUE = 200;
export const DEFAULT_PRIMARY_COLOR = "#2E8B8B";
export const THEME_COLOR_STORAGE_KEY = "cashly-primary-color";
export const THEME_COLOR_MODE_KEY = "cashly-theme-color-mode";
export const LEGACY_THEME_HUE_STORAGE_KEY = "cashly-primary-hue";

export type ThemeColorMode = "custom" | "system";

export function clampHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  let hex = input.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHue(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return Math.round(h);
}

export function hueToHex(
  hue: number,
  saturation = 0.65,
  lightness = 0.45,
): string {
  const h = clampHue(hue);
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hueFromHex(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  return clampHue(rgbToHue(rgb.r, rgb.g, rgb.b));
}

export function isValidHexColor(input: string): boolean {
  return parseHexColor(input) !== null;
}

export function normalizeHexColor(input: string): string | null {
  const rgb = parseHexColor(input);
  if (!rgb) return null;
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/** Mix channel toward black (amount 0–1) or white (negative amount toward white). */
export function mixHex(hex: string, amount: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const mix = (channel: number) => {
    if (amount < 0) {
      return channel + (255 - channel) * Math.abs(amount);
    }
    return channel * (1 - amount);
  };
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

function heroHueForRgb(r: number, g: number, b: number): number {
  const colorfulness = Math.max(r, g, b) - Math.min(r, g, b);
  return colorfulness < 10 ? DEFAULT_PRIMARY_HUE : rgbToHue(r, g, b);
}

function heroOklch(hue: number, lightness: number, chroma: number): string {
  return `oklch(${lightness} ${chroma} ${clampHue(hue)})`;
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function primaryForegroundForHex(hex: string): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return "#FFFFFF";
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.55 ? "#111827" : "#FFFFFF";
}

export type ThemeColorVars = Record<string, string>;

export function buildThemeColorVars(hex: string): ThemeColorVars {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_PRIMARY_COLOR;
  const rgb = parseHexColor(normalized)!;
  const hue = rgbToHue(rgb.r, rgb.g, rgb.b);
  const heroHue = heroHueForRgb(rgb.r, rgb.g, rgb.b);
  const foreground = primaryForegroundForHex(normalized);

  return {
    "--primary": normalized,
    "--primary-hue": String(hue),
    "--primary-foreground": foreground,
    "--accent-hue": String(clampHue(hue - 15)),
    "--ring": normalized,
    "--sidebar-primary": normalized,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-ring": normalized,
    "--hero-from": heroOklch(heroHue, 0.24, 0.04),
    "--hero-via": heroOklch(heroHue, 0.32, 0.08),
    "--hero-to": heroOklch(heroHue, 0.42, 0.12),
    "--hero-glow": heroOklch(heroHue, 0.64, 0.14),
  };
}

export function applyPrimaryColor(hex: string): void {
  if (typeof document === "undefined") return;
  const vars = buildThemeColorVars(hex);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function clearAppliedPrimaryColor(): void {
  if (typeof document === "undefined") return;
  const keys = [
    "--primary",
    "--primary-hue",
    "--primary-foreground",
    "--accent-hue",
    "--ring",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--sidebar-ring",
    "--hero-from",
    "--hero-via",
    "--hero-to",
    "--hero-glow",
  ];
  const root = document.documentElement;
  for (const key of keys) {
    root.style.removeProperty(key);
  }
}

export function readStoredPrimaryColor(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
    if (raw) {
      const normalized = normalizeHexColor(raw);
      if (normalized) return normalized;
    }

    const legacyHue = localStorage.getItem(LEGACY_THEME_HUE_STORAGE_KEY);
    if (legacyHue != null && legacyHue !== "") {
      const n = Number(legacyHue);
      if (Number.isFinite(n)) {
        return hueToHex(clampHue(n));
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function storePrimaryColor(hex: string): void {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return;
  try {
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, normalized);
    localStorage.removeItem(LEGACY_THEME_HUE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function clearStoredPrimaryColor(): void {
  try {
    localStorage.removeItem(THEME_COLOR_STORAGE_KEY);
    localStorage.removeItem(LEGACY_THEME_HUE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readThemeColorMode(): ThemeColorMode {
  if (typeof window === "undefined") return "custom";
  try {
    const raw = localStorage.getItem(THEME_COLOR_MODE_KEY);
    return raw === "system" ? "system" : "custom";
  } catch {
    return "custom";
  }
}

export function storeThemeColorMode(mode: ThemeColorMode): void {
  try {
    localStorage.setItem(THEME_COLOR_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

export function clearThemeColorMode(): void {
  try {
    localStorage.removeItem(THEME_COLOR_MODE_KEY);
  } catch {
    // ignore
  }
}

/** Inline boot script for layout.tsx — applies stored color before React hydrates. */
export function getThemeColorBootScript(): string {
  return `(function(){try{if(localStorage.getItem("${THEME_COLOR_MODE_KEY}")==="system")return;var k="${THEME_COLOR_STORAGE_KEY}",lk="${LEGACY_THEME_HUE_STORAGE_KEY}",c=localStorage.getItem(k);function n(h){h=h.trim();if(h[0]==="#")h=h.slice(1);if(h.length===3)h=h.split("").map(function(x){return x+x;}).join("");if(!/^[0-9a-fA-F]{6}$/.test(h))return null;var r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return"#"+[r,g,b].map(function(v){return v.toString(16).padStart(2,"0")}).join("").toUpperCase()}function fg(hex){var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);function lin(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)}var L=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);return L>0.55?"#111827":"#FFFFFF"}function hue(hex){var r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(!d)return 0;var h=0;if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;return Math.round(h)}function heroHue(hex){var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return Math.max(r,g,b)-Math.min(r,g,b)<10?${DEFAULT_PRIMARY_HUE}:hue(hex)}function hc(h,l,c){return"oklch("+l+" "+c+" "+h+")"}function apply(x){var el=document.documentElement,h=hue(x),hh=heroHue(x),f=fg(x);el.style.setProperty("--primary",x);el.style.setProperty("--primary-hue",String(h));el.style.setProperty("--primary-foreground",f);el.style.setProperty("--accent-hue",String((h-15+360)%360));el.style.setProperty("--ring",x);el.style.setProperty("--sidebar-primary",x);el.style.setProperty("--sidebar-primary-foreground",f);el.style.setProperty("--sidebar-ring",x);el.style.setProperty("--hero-from",hc(hh,0.24,0.04));el.style.setProperty("--hero-via",hc(hh,0.32,0.08));el.style.setProperty("--hero-to",hc(hh,0.42,0.12));el.style.setProperty("--hero-glow",hc(hh,0.64,0.14))}if(c){var x=n(c);if(x){apply(x);return}}var lh=localStorage.getItem(lk);if(lh!=null&&lh!==""){var hv=Number(lh);if(isFinite(hv)){var hues=((hv%360)+360)%360,c2=0.65,l2=0.45,ch=(1-Math.abs(2*l2-1))*c2,xh=ch*(1-Math.abs((hues/60)%2-1)),mh=l2-ch/2,rr=0,gg=0,bb=0;if(hues<60){rr=ch;gg=xh}else if(hues<120){rr=xh;gg=ch}else if(hues<180){gg=ch;bb=xh}else if(hues<240){gg=xh;bb=ch}else if(hues<300){rr=xh;bb=ch}else{rr=ch;bb=xh}var legacy="#"+[rr,gg,bb].map(function(v){return Math.round((v+mh)*255).toString(16).padStart(2,"0")}).join("").toUpperCase();apply(legacy)}}}catch(e){}})();`;
}

// Back-compat exports
export const applyPrimaryHue = (hue: number) => applyPrimaryColor(hueToHex(hue));
export const readStoredPrimaryHue = (): number | null => {
  const color = readStoredPrimaryColor();
  if (!color) return null;
  return hueFromHex(color);
};
export const storePrimaryHue = (hue: number) => storePrimaryColor(hueToHex(hue));
export const clearStoredPrimaryHue = clearStoredPrimaryColor;
