"use client";

import * as React from "react";
import { useSpring, animated } from "@react-spring/web";
import { getReducedMotion } from "@/lib/motion/reduced-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (value: number) => string;
  className?: string;
}

// Spring-driven count-up: counts from 0 on first show, then re-animates from whatever the previous value was on
// every change (not just once on mount), so a live balance refetch counts up
// or down from where it last landed instead of snapping.
export function AnimatedNumber({ value, duration, formatFn, className = "" }: AnimatedNumberProps) {
  const { value: animatedValue } = useSpring({
    from: { value: 0 },
    value,
    config: { duration: duration ?? 600, easing: (t: number) => 1 - Math.pow(1 - t, 3) },
    immediate: getReducedMotion(),
  });

  return (
    <animated.span className={`tabular-nums ${className}`}>
      {animatedValue.to((v) => (formatFn ? formatFn(v) : Math.round(v).toLocaleString()))}
    </animated.span>
  );
}
