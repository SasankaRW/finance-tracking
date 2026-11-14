// Motion and React Spring have their own reduced-motion hooks/config; GSAP
// has neither, so every GSAP timeline in the app calls this directly instead.
export function getReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
