import { useId } from "react";

/**
 * Cashly mark: an open coin ring ("C") with a coin-dot in the gap, set on the
 * app's hero gradient with a soft sheen. The gradient tracks --hero-from/via/to
 * (same tokens as .hero-card), so it follows the user's chosen accent color but
 * stays a stable, always-dark mark across light/dark theme.
 */
export function CashlyLogo({ className }: { className?: string }) {
  const uid = useId();
  const gradientId = `cashlyMark-${uid}`;
  const clipId = `cashlyClip-${uid}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--hero-from)" />
          <stop offset="52%" stopColor="var(--hero-via)" />
          <stop offset="100%" stopColor="var(--hero-to)" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="1" y="1" width="30" height="30" rx="10.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="1" y="1" width="30" height="30" fill={`url(#${gradientId})`} />
        <ellipse cx="9" cy="6" rx="14" ry="8" fill="#fff" opacity="0.16" />
        <ellipse cx="27" cy="11" rx="8" ry="6" fill="#fff" opacity="0.08" />
      </g>
      <circle
        cx="16"
        cy="16"
        r="7.5"
        fill="none"
        stroke="#fff"
        strokeWidth="3.6"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="72 28"
        strokeDashoffset="86"
      />
      <circle cx="23.5" cy="16" r="2.3" fill="#fff" />
    </svg>
  );
}
