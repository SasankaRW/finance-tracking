"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Sonoma's five tones (meaning, never decoration) plus a neutral. */
export type Tone = "green" | "amber" | "blue" | "violet" | "coral" | "neutral";

/** Meaning to tone: expense, bills and debt coral; income green; transfers, accounts and info blue; labels violet; warnings amber. */
export const TONE_VAR: Record<Exclude<Tone, "neutral">, string> = {
  green: "var(--color-green)",
  amber: "var(--color-amber)",
  blue: "var(--color-blue)",
  violet: "var(--color-violet)",
  coral: "var(--color-coral)",
};

/** Breakdown colours in order: blue, amber, violet, green, then faint white. Coral is kept for "over". */
export const SPLIT_TONES = [
  "var(--color-blue)",
  "var(--color-amber)",
  "var(--color-violet)",
  "var(--color-green)",
] as const;

/** Leading list-row tile: 36x36, radius 12, tone at 16 %, filled glyph. */
export function Tile({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("sn-tile", `c-${tone}`, className)}>{children}</span>;
}

/** Pill / status tag: height 22, tonal. */
export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("sn-pill", `c-${tone}`, className)}>{children}</span>;
}

export function Dot({ tone, live, className }: { tone: Exclude<Tone, "neutral">; live?: boolean; className?: string }) {
  return (
    <span
      className={cn("sn-sdot", live && "sn-ping", className)}
      style={{ background: TONE_VAR[tone], color: TONE_VAR[tone] }}
    />
  );
}

/** One eyebrow per page, a headline that ends in the accent full stop, and room for page actions. */
export function PageHeader({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rise-in flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <div className="sn-eye">{eyebrow}</div>
        <h1 className="sn-head mt-1.5">
          {title}
          <span className="dot">.</span>
        </h1>
      </div>
      {children}
    </div>
  );
}

/** Group a breakdown into the first `n` parts and "Other". */
export function topParts(parts: { label: string; value: number }[], n = 3) {
  const sorted = [...parts].filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  const rest = sorted.slice(n).reduce((a, p) => a + p.value, 0);
  return rest > 0 ? [...sorted.slice(0, n), { label: "Other", value: rest }] : sorted;
}

/**
 * Breakdown meter: one track split into the parts (blue, amber, violet, green, then faint white), with a legend.
 * Over the max the whole bar turns coral.
 */
export function SplitMeter({
  parts,
  max,
  legend = true,
  className,
  format,
}: {
  parts: { label: string; value: number }[];
  max?: number;
  legend?: boolean;
  className?: string;
  /** when given, the legend shows each part's amount */
  format?: (value: number) => string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const cap = max ?? total;
  const over = cap > 0 && total > cap;
  const scale = Math.max(cap, total, 1);
  const colour = (i: number) => (over ? "var(--color-coral)" : SPLIT_TONES[i] ?? "rgba(255,255,255,.35)");
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className={className}>
      <div
        className="flex h-2 gap-[2px] overflow-hidden rounded-[4px] bg-[var(--track)]"
        role="meter"
        aria-valuenow={Math.round((total / Math.max(cap, 1)) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {shown.map((p, i) => (
          <div
            key={p.label}
            className="meter-fill h-full"
            style={{ width: `${(p.value / scale) * 100}%`, background: colour(i) }}
          />
        ))}
      </div>
      {legend && shown.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-white/70">
          {shown.map((p, i) => (
            <span key={p.label} className="flex items-center gap-1.5">
              <span className="sn-sdot" style={{ background: colour(i) }} />
              {p.label}
              {format && <span className="text-white/55">{format(p.value)}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Single-value meter: accent; amber over 85 %, coral over 100 % (budgets). */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? value / max : 0;
  const color = pct > 1 ? "var(--color-coral)" : pct > 0.85 ? "var(--color-amber)" : "var(--color-blue)";
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-[var(--track)]", className)}
      role="meter"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="meter-fill h-full rounded-full"
        style={{ width: `${Math.min(100, pct * 100)}%`, background: color }}
      />
    </div>
  );
}

/**
 * Destructive action: a round coral button you hold for 1.2 s (an accent ring fills). A tap only says to hold.
 * The mutation, toast and error handling stay with the caller's `onConfirm`.
 */
export function HoldButton({
  onConfirm,
  label,
  icon,
  small,
  disabled,
  className,
}: {
  onConfirm: () => void;
  /** e.g. "Delete" ("Hold to delete") */
  label: string;
  icon: React.ReactNode;
  small?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [holding, setHolding] = React.useState(false);
  const [hint, setHint] = React.useState(false);
  const timer = React.useRef<number | null>(null);
  const done = React.useRef(false);
  const confirmRef = React.useRef(onConfirm);
  confirmRef.current = onConfirm;
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  // a JS timer (not animationend), so it still works with reduced motion
  const start = () => {
    if (timer.current || disabled) return;
    done.current = false;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      done.current = true;
      setHolding(false);
      confirmRef.current();
    }, 1200);
  };
  const stop = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    if (!done.current) {
      setHint(true);
      window.setTimeout(() => setHint(false), 1600);
    }
  };
  const box = small ? 36 : 44;
  const r = box / 2 - 1.5;
  const text = `Hold to ${label.toLowerCase()}`;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={text}
        title={text}
        disabled={disabled}
        data-compact
        className={cn("sn-hold", small && "sm", holding && "holding", className)}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start();
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") stop();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {icon}
        <svg aria-hidden="true" viewBox={`0 0 ${box} ${box}`}>
          <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
          <circle
            className="sn-ring"
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
            pathLength={135}
          />
        </svg>
      </button>
      {hint && (
        <span className="sn-popin text-[13px] whitespace-nowrap text-[var(--primary)]" role="status">
          {text}
        </span>
      )}
    </span>
  );
}
