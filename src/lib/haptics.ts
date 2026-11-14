import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// Haptics only exist on a real device — on web/desktop these are silent no-ops
// so every call site can fire them unconditionally without a platform check,
// and a plugin hiccup never breaks the interaction it's decorating.
function isNative() {
  return Capacitor.isNativePlatform();
}

/** A light tick for toggles, expand/collapse, and picking between options. */
export async function hapticSelection() {
  if (!isNative()) return;
  try {
    await Haptics.selectionChanged();
  } catch {
    // best-effort
  }
}

/** A light tap for navigation and low-stakes button presses. */
export async function hapticLight() {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // best-effort
  }
}

/** A firmer tap for a deliberate, higher-stakes press (e.g. a destructive confirm). */
export async function hapticMedium() {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // best-effort
  }
}

/** Confirms a financial action actually completed (saved, settled, paid, deleted). */
export async function hapticSuccess() {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // best-effort
  }
}

/** A heads-up buzz right as a destructive confirmation appears. */
export async function hapticWarning() {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    // best-effort
  }
}

/** Signals a save/action failed. */
export async function hapticError() {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // best-effort
  }
}
