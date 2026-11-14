"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { hapticTick } from "@/lib/haptics";

/** The five tones (meaning, never decoration) plus a neutral. */
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

/** Leading list-row avatar: 36x36 round, tonal container, filled glyph. */
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

/** Chip / status tag: height 24, radius 8, tonal. */
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

/** Live/synced state: a slowly pinging dot, and text that cross-fades when it changes. Data is realtime, so this reflects connectivity and first load. */
export function SyncStatus({ loading, className }: { loading?: boolean; className?: string }) {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const text = !online ? "Offline" : loading ? "Syncing" : "Synced";
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs text-white/70", className)} role="status">
      <Dot tone={online ? "green" : "amber"} live={online && !loading} />
      <span key={text} className="sn-sync-text">
        {text}
      </span>
    </span>
  );
}

/** One dim sentence-case caption per page, the headline, and room for page actions. */
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
  const colour = (i: number) => (over ? "var(--color-coral)" : SPLIT_TONES[i] ?? "#a9abb6");
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

function useHold(onConfirm: () => void, disabled?: boolean) {
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
    hapticTick(8);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      done.current = true;
      setHolding(false);
      hapticTick(20);
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
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      start();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
        e.preventDefault();
        start();
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") stop();
    },
    onClick: (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
  };
  return { holding, hint, handlers };
}

/**
 * Destructive action: a round error-container button you hold for 1.2 s (a ring fills). A tap only says to hold.
 * The mutation, toast and error handling stay with the caller's `onConfirm`. Used for every delete.
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
  const { holding, hint, handlers } = useHold(onConfirm, disabled);
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
        {...handlers}
      >
        {icon}
        <svg aria-hidden="true" viewBox={`0 0 ${box} ${box}`}>
          <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="rgba(255,180,171,.2)" strokeWidth="2" />
          <circle
            className="sn-ring"
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            stroke="#ffb4ab"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
            pathLength={135}
          />
        </svg>
      </button>
      {hint && (
        <span className="sn-popin text-[13px] whitespace-nowrap text-[#ffb4ab]" role="status">
          {text}
        </span>
      )}
    </span>
  );
}

/** The same hold-to-confirm as a full-round labelled button (used in the destructive confirm dialog). */
export function HoldPill({
  onConfirm,
  label,
  className,
}: {
  onConfirm: () => void;
  label: string;
  className?: string;
}) {
  const { holding, hint, handlers } = useHold(onConfirm);
  return (
    <button
      type="button"
      data-compact
      aria-label={`Hold to ${label.toLowerCase()}`}
      className={cn("sn-hold-wide", holding && "holding", className)}
      {...handlers}
    >
      <span className="sn-fill" aria-hidden="true" />
      <span role={hint ? "status" : undefined}>{hint ? `Hold to ${label.toLowerCase()}` : label}</span>
    </button>
  );
}
