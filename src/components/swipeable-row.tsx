"use client";

import * as React from "react";
import { motion, useMotionValue, animate, type PanInfo } from "motion/react";
import { Pencil, Trash2 } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { EASE_IOS } from "@/lib/motion/easings";
import { getReducedMotion } from "@/lib/motion/reduced-motion";

const ACTION_WIDTH = 72;
const SNAP_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const SWIPE_HINT_KEY = "cashly:swipe-hint-seen:v1";

// Swipe-left-to-reveal actions (iOS Mail style), driven by Motion's drag
// gesture instead of hand-rolled Pointer Events. `touch-action: pan-y` on the
// draggable layer is still what actually prevents the vertical-scroll
// conflict — the browser decides at the OS level whether a touch is a
// vertical scroll or a horizontal drag, so there's no preventDefault()/
// passive-listener fight to get wrong (same reasoning as before, now backed
// by Motion's gesture engine instead of a manual pointer-move axis check).
export function SwipeableRow({
  children,
  onEdit,
  onDelete,
  className,
  hint = false,
}: {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
  className?: string;
  // One-time "this row swipes" nudge: slides open just enough to reveal the
  // actions, then springs back. Shown once per device, never under reduced motion.
  hint?: boolean;
}) {
  const actionsWidth = onEdit ? ACTION_WIDTH * 2 : ACTION_WIDTH;
  const x = useMotionValue(0);

  React.useEffect(() => {
    if (!hint || getReducedMotion()) return;
    try {
      if (window.localStorage.getItem(SWIPE_HINT_KEY) === "1") return;
    } catch {
      return;
    }
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(SWIPE_HINT_KEY, "1");
      } catch {
        // storage unavailable — worst case the hint shows again next time
      }
      animate(x, -Math.min(actionsWidth, 96), { duration: 0.4, ease: EASE_IOS }).then(() => {
        animate(x, 0, { ...SNAP_SPRING, delay: 0.35 });
      });
    }, 900);
    return () => window.clearTimeout(id);
  }, [hint, actionsWidth, x]);

  const close = () => animate(x, 0, SNAP_SPRING);

  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const shouldOpen = x.get() < -actionsWidth / 2 || info.velocity.x < -500;
    animate(x, shouldOpen ? -actionsWidth : 0, SNAP_SPRING);
  };

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div className="absolute inset-y-0 right-0 flex" style={{ width: actionsWidth }}>
        {onEdit && (
          <button
            type="button"
            aria-label="Edit"
            onClick={() => {
              void hapticLight();
              close();
              onEdit();
            }}
            style={{ width: ACTION_WIDTH }}
            className="flex items-center justify-center bg-sky-500 text-white active:bg-sky-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          aria-label="Delete"
          onClick={() => {
            close();
            onDelete();
          }}
          style={{ width: ACTION_WIDTH }}
          className="flex items-center justify-center bg-rose-500 text-white active:bg-rose-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -actionsWidth - 24, right: 0 }}
        dragElastic={0.15}
        onDragEnd={onDragEnd}
        style={{ x, touchAction: "pan-y" }}
        className="relative bg-card"
      >
        {children}
      </motion.div>
    </div>
  );
}
