"use client";

import * as React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowLeftRight, ArrowDownRight, ArrowUpRight, Plus } from "@/components/icons";
import type { Tone } from "@/components/sonoma";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { easeIos, easeIosSpring } from "@/lib/motion/easings";
import { getReducedMotion } from "@/lib/motion/reduced-motion";

const LONG_PRESS_MS = 420;

type Kind = "expense" | "income" | "transfer";

const SATELLITES: Array<{ kind: Kind; label: string; icon: typeof Plus; tone: Tone }> = [
  { kind: "transfer", label: "Transfer", icon: ArrowLeftRight, tone: "blue" },
  { kind: "income", label: "Income", icon: ArrowUpRight, tone: "green" },
  { kind: "expense", label: "Expense", icon: ArrowDownRight, tone: "coral" },
];

// Closed resting transform/opacity, applied once as the CSS baseline. GSAP
// takes ownership of these two properties via direct DOM mutation from here
// on, so this object is intentionally a stable reference React never changes
// — if it were recomputed from `open` it would fight GSAP on every re-render.
const SATELLITE_CLOSED_STYLE: React.CSSProperties = {
  opacity: 0,
  transform: "translateY(12px) scale(0.85)",
};

// The satellites stay mounted at all times and are only hidden with opacity/
// scale — never conditionally unmounted — so a dialog that's mid-open when the
// dial closes is never torn down out from under itself.
function SpeedDialSatellite({
  kind,
  label,
  icon: Icon,
  tone,
  open,
  onPick,
}: {
  kind: Kind;
  label: string;
  icon: typeof Plus;
  tone: Tone;
  open: boolean;
  onPick: () => void;
}) {
  return (
    <CreateTransactionDialog
      defaultKind={kind}
      trigger={
        <button
          type="button"
          data-fab-satellite
          tabIndex={open ? 0 : -1}
          onClick={() => {
            void hapticLight();
            onPick();
          }}
          className={`sn-card flex items-center gap-2 !rounded-full py-2 pl-2 pr-4 text-sm font-semibold ${
            open ? "pointer-events-auto" : "pointer-events-none"
          }`}
          style={SATELLITE_CLOSED_STYLE}
        >
          <span className={`sn-tile c-${tone} !size-8 !rounded-full`}>
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </button>
      }
    />
  );
}

// Short tap opens the default (expense) dialog exactly as a plain FAB would.
// Long-press instead reveals Expense/Income/Transfer satellites above it —
// releasing without moving suppresses that default tap via preventDefault(),
// which Radix's own trigger respects (it checks event.defaultPrevented before
// opening), so a long-press never also opens the default dialog underneath.
export function SpeedDialFab() {
  const [dialOpen, setDialOpen] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const firedRef = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isFirstRender = React.useRef(true);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPress = () => {
    firedRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      void hapticMedium();
      setDialOpen(true);
    }, LONG_PRESS_MS);
  };

  const endPress = () => clearTimer();

  React.useEffect(() => clearTimer, []);

  // Staggered reveal/dismiss of the satellites, reversible on every toggle.
  // The initial render is a plain gsap.set (no tween) so mounting never
  // animates — only actual open/close toggles do.
  useGSAP(
    () => {
      const satellites = gsap.utils.toArray<HTMLElement>("[data-fab-satellite]", containerRef.current);
      if (satellites.length === 0) return;

      if (isFirstRender.current) {
        isFirstRender.current = false;
        gsap.set(satellites, { transition: "none" });
        return;
      }

      if (getReducedMotion()) {
        gsap.set(satellites, dialOpen
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 12, scale: 0.85 });
        return;
      }

      if (dialOpen) {
        gsap.to(satellites, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.32,
          ease: easeIosSpring,
          stagger: 0.03,
        });
      } else {
        gsap.to(satellites, {
          opacity: 0,
          y: 12,
          scale: 0.85,
          duration: 0.2,
          ease: easeIos,
        });
      }
    },
    { scope: containerRef, dependencies: [dialOpen] },
  );

  return (
    <>
      {/* Rendered as a sibling of, not nested inside, the translate/opacity
          wrapper below: a `transform` (even an identity translate-y-0) makes
          its element a containing block for fixed descendants, which would
          shrink this backdrop down to the wrapper's own small box instead of
          covering the viewport. */}
      {dialOpen && (
        <div
          aria-hidden="true"
          onClick={() => setDialOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <div
        ref={containerRef}
        className={`sn-fab-wrap motion-expressive fixed bottom-[calc(100px+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-3 md:hidden `}
      >
      {SATELLITES.map((s) => (
        <SpeedDialSatellite
          key={s.kind}
          kind={s.kind}
          label={s.label}
          icon={s.icon}
          tone={s.tone}
          open={dialOpen}
          onPick={() => setDialOpen(false)}
        />
      ))}

      <CreateTransactionDialog
        trigger={
          <button
            type="button"
            data-compact
            onPointerDown={startPress}
            onPointerUp={endPress}
            onPointerLeave={endPress}
            onPointerCancel={endPress}
            onClick={(e) => {
              if (firedRef.current) {
                // Long-press already handled this gesture — don't also open
                // the default dialog underneath the satellites.
                e.preventDefault();
                firedRef.current = false;
                return;
              }
              void hapticLight();
            }}
            className="sn-fab press-expressive"
            aria-label="Add transaction — hold for more options"
          >
            <Plus className={`h-6 w-6 ${dialOpen ? "rotate-45" : ""}`} />
          </button>
        }
      />
      </div>
    </>
  );
}
