import type { Variants } from "motion/react";
import { EASE_IOS, EASE_IOS_SPRING } from "./easings";

// Mirrors @keyframes ios-in in globals.css — the app's default "content
// arriving" shape. Used for page transitions and mount reveals.
export const iosIn: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.34, ease: EASE_IOS },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.99,
    transition: { duration: 0.18, ease: EASE_IOS },
  },
};

// Mirrors @keyframes expressive-pop — a springier overshoot for elements
// that should feel more alive (satellite buttons, popped-in tiles).
export const expressivePop: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 4 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE_IOS_SPRING },
  },
};
