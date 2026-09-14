"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

const ACTION_WIDTH = 72;

// Swipe-left-to-reveal actions (iOS Mail style), built on Pointer Events + a
// CSS transform rather than a gesture library. `touch-action: pan-y` on the
// draggable layer is what actually prevents the vertical-scroll conflict —
// the browser decides at the OS level whether a touch is a vertical scroll or
// something JS should handle, so there's no preventDefault()/passive-listener
// fight to get wrong. The axis is also locked from the first ~6px of movement
// so a wobbly vertical scroll never gets mistaken for a swipe.
export function SwipeableRow({
  children,
  onEdit,
  onDelete,
  className,
}: {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const actionsWidth = onEdit ? ACTION_WIDTH * 2 : ACTION_WIDTH;
  const [translateX, setTranslateX] = React.useState(0);
  const drag = React.useRef<{
    startX: number;
    startY: number;
    startTranslate: number;
    axis: "none" | "x" | "y";
  } | null>(null);

  const close = () => setTranslateX(0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startY: e.clientY, startTranslate: translateX, axis: "none" };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (state.axis === "none") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (state.axis === "x") {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else {
        drag.current = null; // hand the gesture back to the page's own scroll
        return;
      }
    }

    if (state.axis !== "x") return;
    const next = Math.min(0, Math.max(-actionsWidth - 24, state.startTranslate + dx));
    setTranslateX(next);
  };

  const endDrag = () => {
    const state = drag.current;
    drag.current = null;
    if (!state || state.axis !== "x") return;
    setTranslateX((current) => (current < -actionsWidth / 2 ? -actionsWidth : 0));
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

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ transform: `translateX(${translateX}px)`, touchAction: "pan-y" }}
        className="motion-expressive relative bg-card"
      >
        {children}
      </div>
    </div>
  );
}
