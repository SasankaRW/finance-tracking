import { getReducedMotion } from "@/lib/motion/reduced-motion";

/**
 * Collapse an element out (size to 0 plus fade) so a removed row/pill does not just vanish.
 * Resolves when finished. Call `cancel()` on the result to undo (e.g. the delete failed).
 */
export function collapseElement(
  el: Element | null,
  opts: { axis?: "y" | "x"; ms?: number } = {},
): { done: Promise<void>; cancel: () => void } {
  const noop = { done: Promise.resolve(), cancel: () => {} };
  if (!el || getReducedMotion() || typeof (el as HTMLElement).animate !== "function") return noop;
  const node = el as HTMLElement;
  const { axis = "y", ms = 260 } = opts;
  const rect = node.getBoundingClientRect();
  const prevOverflow = node.style.overflow;
  node.style.overflow = "hidden";
  node.style.pointerEvents = "none";
  const from: Keyframe =
    axis === "y"
      ? { height: `${rect.height}px`, opacity: 1 }
      : { width: `${rect.width}px`, opacity: 1, transform: "scale(1)" };
  const to: Keyframe =
    axis === "y"
      ? { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px", borderTopWidth: "0px", borderBottomWidth: "0px" }
      : { width: "0px", opacity: 0, transform: "scale(0.8)", paddingLeft: "0px", paddingRight: "0px", marginRight: "-8px" };
  const anim = node.animate([from, to], { duration: ms, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" });
  return {
    done: anim.finished.then(
      () => undefined,
      () => undefined,
    ),
    cancel: () => {
      anim.cancel();
      node.style.overflow = prevOverflow;
      node.style.pointerEvents = "";
    },
  };
}

/** Collapse the element(s) matching a data attribute, e.g. collapseByAttr("data-tx-id", id). */
export function collapseByAttr(attr: string, id: string, opts: { axis?: "y" | "x"; ms?: number } = {}) {
  if (typeof document === "undefined") return { done: Promise.resolve(), cancel: () => {} };
  const nodes = Array.from(document.querySelectorAll(`[${attr}="${id.replace(/"/g, '\\"')}"]`));
  const runs = nodes.map((n) => collapseElement(n, opts));
  return {
    done: Promise.all(runs.map((r) => r.done)).then(() => undefined),
    cancel: () => runs.forEach((r) => r.cancel()),
  };
}
