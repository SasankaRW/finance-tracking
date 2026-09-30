import { useId } from "react";

/**
 * Cashly mark: a wallet with ascending bars breaking out of its top edge —
 * "your money, going up." Fixed brand gradient (independent of the user's
 * dynamic --primary-hue theme), matching the app icon/splash exactly so the
 * OS-level icon and this in-app mark always read as the same brand.
 */
export function CashlyLogo({ className }: { className?: string }) {
  const uid = useId();
  const gradientId = `cashlyMark-${uid}`;
  const clipId = `cashlyClip-${uid}`;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#163832" />
          <stop offset="50%" stopColor="#1f5c4a" />
          <stop offset="100%" stopColor="#2f8f6b" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="100" height="100" rx="22" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
        <rect x="27" y="24" width="46" height="20" rx="10" fill="#fff" opacity="0.45" />
        <rect x="18" y="34" width="64" height="42" rx="14" fill="#fff" />
        <circle cx="30" cy="55" r="4.2" fill="#2f8f6b" />
        <rect x="44" y="42" width="8" height="16" rx="3" fill="#ffd9a0" />
        <rect x="55" y="34" width="8" height="24" rx="3" fill="#ffd9a0" />
        <rect x="66" y="24" width="8" height="34" rx="3" fill="#ffd9a0" />
      </g>
    </svg>
  );
}
