/**
 * Cashly mark: a seed-colored squircle holding an open coin ring ("C") with a
 * coin-dot in the gap. Colors track the dynamic theme via CSS variables.
 */
export function CashlyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="10.5" fill="var(--primary)" />
      <circle
        cx="16"
        cy="16"
        r="7.5"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3.4"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="72 28"
        strokeDashoffset="86"
      />
      <circle cx="23.5" cy="16" r="2.1" fill="var(--primary-foreground)" />
    </svg>
  );
}
