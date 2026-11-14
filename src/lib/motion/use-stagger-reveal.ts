"use client";

import * as React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { easeIos } from "./easings";
import { getReducedMotion } from "./reduced-motion";

// Fades + rises a list/grid's children in with a small stagger on mount (or
// whenever `deps` changes) — the one shared "list reveal" motion every mobile
// list/card surface uses, so the app has one consistent stagger instead of a
// bespoke timeline per page.
export function useStaggerReveal<T extends HTMLElement>(
  selector: string,
  deps: unknown[],
  options?: { max?: number; stagger?: number; y?: number; enabled?: boolean },
) {
  const ref = React.useRef<T>(null);
  const { max = 12, stagger = 0.04, y = 10, enabled = true } = options ?? {};

  useGSAP(
    () => {
      if (!enabled || getReducedMotion()) return;
      const items = gsap.utils.toArray<HTMLElement>(selector, ref.current).slice(0, max);
      if (items.length === 0) return;

      gsap.fromTo(
        items,
        { opacity: 0, y },
        { opacity: 1, y: 0, duration: 0.36, ease: easeIos, stagger },
      );
    },
    { scope: ref, dependencies: deps },
  );

  return ref;
}
