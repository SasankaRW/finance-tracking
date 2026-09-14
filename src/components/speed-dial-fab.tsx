"use client";

import * as React from "react";
import { ArrowLeftRight, ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { Button } from "@/components/ui/button";

const LONG_PRESS_MS = 420;

type Kind = "expense" | "income" | "transfer";

const SATELLITES: Array<{ kind: Kind; label: string; icon: typeof Plus }> = [
  { kind: "transfer", label: "Transfer", icon: ArrowLeftRight },
  { kind: "income", label: "Income", icon: ArrowUpRight },
  { kind: "expense", label: "Expense", icon: ArrowDownRight },
];

// The satellites stay mounted at all times and are only hidden with opacity/
// scale — never conditionally unmounted — so a dialog that's mid-open when the
// dial closes is never torn down out from under itself.
function SpeedDialSatellite({
  kind,
  label,
  icon: Icon,
  open,
  index,
  onPick,
}: {
  kind: Kind;
  label: string;
  icon: typeof Plus;
  open: boolean;
  index: number;
  onPick: () => void;
}) {
  return (
    <CreateTransactionDialog
      defaultKind={kind}
      trigger={
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            void hapticLight();
            onPick();
          }}
          className="motion-expressive press-expressive elevation-2 flex items-center gap-2 rounded-full bg-card py-2.5 pl-3 pr-4 text-sm font-semibold ring-1 ring-border/60"
          style={{
            transitionDelay: open ? `${index * 30}ms` : "0ms",
            transform: open ? "translateY(0) scale(1)" : "translateY(12px) scale(0.85)",
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
            <Icon className="h-3.5 w-3.5" />
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
export function SpeedDialFab({ hidden }: { hidden?: boolean }) {
  const [dialOpen, setDialOpen] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const firedRef = React.useRef(false);

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
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] md:hidden"
        />
      )}

      <div
        className={`motion-expressive fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-3 md:hidden ${
          hidden ? "pointer-events-none translate-y-20 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
      {SATELLITES.map((s, i) => (
        <SpeedDialSatellite
          key={s.kind}
          kind={s.kind}
          label={s.label}
          icon={s.icon}
          open={dialOpen}
          index={i}
          onPick={() => setDialOpen(false)}
        />
      ))}

      <CreateTransactionDialog
        trigger={
          <Button
            size="icon-lg"
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
            className="motion-expressive elevation-3 h-16 w-16 rounded-[1.4rem] active:scale-90 active:rounded-full"
            aria-label="Add transaction — hold for more options"
          >
            <Plus className={`h-7 w-7 transition-transform duration-200 ${dialOpen ? "rotate-45" : ""}`} />
          </Button>
        }
      />
      </div>
    </>
  );
}
