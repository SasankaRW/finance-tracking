"use client";

import * as React from "react";
import { useSpring, animated } from "@react-spring/web";
import { SPRING_IOS, easeIos } from "@/lib/motion/easings";
import { getReducedMotion } from "@/lib/motion/reduced-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (value: number) => string;
  className?: string;
}

// Spring-driven count-up: re-animates from whatever the previous value was on
// every change (not just once on mount), so a live balance refetch counts up
// or down from where it last landed instead of snapping.
export function AnimatedNumber({ value, duration, formatFn, className = "" }: AnimatedNumberProps) {
  const { value: animatedValue } = useSpring({
    value,
    config: duration ? { duration, easing: easeIos } : SPRING_IOS,
    immediate: getReducedMotion(),
  });

  return (
    <animated.span className={className}>
      {animatedValue.to((v) => (formatFn ? formatFn(v) : Math.round(v).toLocaleString()))}
    </animated.span>
  );
}
