"use client";

import * as React from "react";
import { hapticSelection } from "@/lib/haptics";

const STORAGE_KEY = "cashly:balance-hidden:v1";
const CHANGE_EVENT = "cashly:balance-visibility-changed";

function readHidden() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// Shared "hide my balance" toggle for the dashboard's hero cards. State lives in
// localStorage (not tied to a device-only session) and broadcasts a same-tab
// event so the mobile and desktop hero — both mounted at once, shown/hidden by
// breakpoint — stay in sync with a toggle made in either one.
export function useBalanceVisibility() {
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    setHidden(readHidden());

    const onChange = () => setHidden(readHidden());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = React.useCallback(() => {
    void hapticSelection();
    const next = !readHidden();
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore storage failures
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { hidden, toggle };
}
