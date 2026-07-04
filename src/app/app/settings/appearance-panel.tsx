"use client";

import * as React from "react";
import { RotateCcw, Smartphone } from "lucide-react";
import { useThemeColor } from "@/lib/theme/theme-color-provider";
import {
  DEFAULT_PRIMARY_COLOR,
  isValidHexColor,
  normalizeHexColor,
} from "@/lib/theme/colors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function toColorInputValue(hex: string): string {
  return (normalizeHexColor(hex) ?? DEFAULT_PRIMARY_COLOR).toLowerCase();
}

export function AppearancePanel() {
  const { color, mode, systemColorAvailable, setColor, setUseSystemColor, resetColor } =
    useThemeColor();
  const [hexInput, setHexInput] = React.useState(color);
  const [hexError, setHexError] = React.useState(false);
  const useSystemColor = mode === "system";
  const customControlsDisabled = useSystemColor;

  React.useEffect(() => {
    setHexInput(color);
    setHexError(false);
  }, [color]);

  const commitHex = React.useCallback(() => {
    if (!isValidHexColor(hexInput)) {
      setHexError(true);
      return;
    }
    const normalized = normalizeHexColor(hexInput);
    if (!normalized) {
      setHexError(true);
      return;
    }
    setHexError(false);
    setHexInput(normalized);
    setColor(normalized);
  }, [hexInput, setColor]);

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitHex();
    }
  };

  const isDefault = mode === "custom" && color === DEFAULT_PRIMARY_COLOR;

  return (
    <Card className="surface-tonal max-w-xl">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Pick any accent color for buttons, highlights, the hero card, and active states.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {systemColorAvailable && (
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Use system color</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Match Android Material You — follows your wallpaper and system theme
                  (Android 12+).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useSystemColor}
                onClick={() => setUseSystemColor(!useSystemColor)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  useSystemColor ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    useSystemColor ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {useSystemColor && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <span
                  className="h-10 w-10 shrink-0 rounded-xl border shadow-sm"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Current system color</p>
                  <p className="font-mono text-xs text-muted-foreground">{color}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className={`space-y-6 ${customControlsDisabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <div className="flex items-center gap-4">
            <div
              className="h-14 w-14 shrink-0 rounded-2xl border shadow-sm"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">Preview</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">Primary button</Button>
                <Badge>Accent badge</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="color-picker" className="text-sm font-medium">
              Color picker
            </Label>
            <div className="overflow-hidden rounded-2xl border bg-card p-2">
              <input
                id="color-picker"
                type="color"
                value={toColorInputValue(color)}
                disabled={customControlsDisabled}
                onChange={(e) => {
                  const next = normalizeHexColor(e.target.value);
                  if (next) {
                    setHexInput(next);
                    setColor(next);
                    setHexError(false);
                  }
                }}
                className="color-picker-input h-28 w-full cursor-pointer rounded-xl border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                aria-label="Choose accent color"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hex-input" className="text-sm font-medium">
              Color code
            </Label>
            <div className="flex gap-2">
              <Input
                id="hex-input"
                value={hexInput}
                disabled={customControlsDisabled}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  setHexError(false);
                }}
                onBlur={commitHex}
                onKeyDown={handleHexKeyDown}
                placeholder="#000000"
                className={`h-11 font-mono uppercase ${hexError ? "border-destructive" : ""}`}
                spellCheck={false}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-11 shrink-0"
                onClick={commitHex}
                disabled={customControlsDisabled}
              >
                Apply
              </Button>
            </div>
            {hexError ? (
              <p className="text-xs text-destructive">
                Enter a valid hex color (e.g. #000000, #FFFFFF, #2E8B8B)
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Supports any 3- or 6-digit hex code, including black, white, and grays.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {["#000000", "#FFFFFF", "#2E8B8B", "#E11D48", "#F59E0B", "#8B5CF6"].map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={customControlsDisabled}
                onClick={() => setColor(preset)}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
                aria-label={`Use ${preset}`}
              >
                <span
                  className="h-4 w-4 rounded-full border shadow-sm"
                  style={{ backgroundColor: preset }}
                />
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <div className="text-sm text-muted-foreground">Default: {DEFAULT_PRIMARY_COLOR}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetColor}
            disabled={isDefault && !useSystemColor}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
