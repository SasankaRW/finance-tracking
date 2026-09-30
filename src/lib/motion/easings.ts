// Ported from the CSS custom properties in globals.css so JS-driven motion
// (GSAP, Motion) matches the app's existing CSS-transition feel instead of
// introducing a second, competing "personality".

// Motion (and CSS) accept a cubic-bezier control-point array directly.
export const EASE_IOS = [0.32, 0.72, 0, 1] as const;
export const EASE_IOS_SPRING = [0.34, 1.25, 0.64, 1] as const;

// React Spring config visually tuned to match --ease-ios-spring's overshoot.
export const SPRING_IOS = { mass: 1, tension: 280, friction: 26 };

// GSAP takes an ease *function* (progress in, progress out), not a bezier
// array, so the same control points are converted here via the same
// Newton-Raphson solver browsers use internally for CSS cubic-bezier() —
// keeps GSAP timelines on the identical curve as the CSS/Motion versions
// instead of approximating with a named GSAP ease.
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleCurveDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  function solveCurveX(x: number) {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xEst = sampleCurveX(t) - x;
      if (Math.abs(xEst) < 1e-6) return t;
      const d = sampleCurveDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= xEst / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const xEst = sampleCurveX(t);
      if (Math.abs(xEst - x) < 1e-6) return t;
      if (x > xEst) lo = t;
      else hi = t;
      t = (hi - lo) / 2 + lo;
    }
    return t;
  }

  return (x: number) => sampleCurveY(solveCurveX(x));
}

export const easeIos = cubicBezier(...EASE_IOS);
export const easeIosSpring = cubicBezier(...EASE_IOS_SPRING);
