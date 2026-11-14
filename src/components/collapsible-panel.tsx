"use client";

import * as React from "react";
import { ChevronDown } from "@/components/icons";
import { hapticSelection } from "@/lib/haptics";
import { Tile, type Tone } from "@/components/sonoma";

// Shared shell for the dashboard's "needs attention" panels (bills due, messages
// waiting, borrowed money): a flat tappable header with an icon, title, and a
// summary badge, expanding to reveal the detail. Keeping the shell in one place
// is what keeps these panels visually consistent while their icon color and
// summary badge still give each one its own identity.
export function CollapsiblePanel({
  storageKey,
  icon,
  tone = "blue",
  title,
  summary,
  defaultExpanded = false,
  onExpandedChange,
  children,
}: {
  storageKey: string;
  icon: React.ReactNode;
  tone?: Tone;
  title: string;
  summary?: React.ReactNode;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  // Content stays mounted while collapsed (see below), so a caller that wants
  // to animate that content in on reveal — not just on page mount — needs to
  // know when `expanded` actually flips, including the localStorage hydration
  // below, not just direct toggle clicks.
  React.useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null) setExpanded(raw === "1");
    } catch {
      // ignore storage failures
    }
  }, [storageKey]);

  // Collapsed content stays mounted (so the height can animate) but is kept out
  // of the tab order and accessibility tree while closed.
  React.useEffect(() => {
    bodyRef.current?.toggleAttribute("inert", !expanded);
  }, [expanded]);

  const toggle = () => {
    void hapticSelection();
    setExpanded((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  return (
    //  (opacity only): animate-ios-in's transform on the same
    // element as overflow-hidden + rounded-* revives the corner-clip bug (see
    // the hero carousel fix for the full explanation).
    <div className="sn-panel overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="motion-expressive press-expressive flex w-full items-center gap-2.5 px-4 py-3 text-left sm:px-5"
      >
        <Tile tone={tone}>{icon}</Tile>
        <span className="shrink-0 text-[15px] font-semibold">{title}</span>

        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          {summary}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-ios ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Height animates through grid-template-rows, so no measuring is needed. */}
      <div
        ref={bodyRef}
        aria-hidden={!expanded}
        className="grid transition-[grid-template-rows] duration-300 ease-ios"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4 pt-1 sm:px-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
