import { cn } from "@/lib/utils";

/** A check mark that draws itself (re-key it to replay). Pair with .sn-pulse-ring for the soft ring pulse. */
export function DrawCheck({ className, strokeWidth = 3 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={cn("sn-tick", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        pathLength={1}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Amount text whose changed digits roll in. */
export function RollingText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={`${i}-${ch}`} className="sn-roll" aria-hidden="true" style={ch === " " ? { whiteSpace: "pre" } : undefined}>
          {ch}
        </span>
      ))}
    </span>
  );
}
