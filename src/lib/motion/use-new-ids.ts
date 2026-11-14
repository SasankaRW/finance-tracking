"use client";

import * as React from "react";

/**
 * Ids that appeared after the list's first load, so a new item can animate in at its place.
 * Nothing is "new" on first load or while loading; the set resets after a moment so it stays small.
 */
export function useNewIds(ids: readonly string[], loading: boolean): ReadonlySet<string> {
  const seen = React.useRef<Set<string> | null>(null);
  const [fresh, setFresh] = React.useState<ReadonlySet<string>>(() => new Set());
  const key = ids.join("|");

  React.useEffect(() => {
    if (loading) {
      seen.current = null;
      return;
    }
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const added = ids.filter((id) => !seen.current!.has(id));
    for (const id of ids) seen.current.add(id);
    if (added.length === 0) return;
    setFresh((prev) => new Set([...prev, ...added]));
    const t = window.setTimeout(() => setFresh(new Set()), 2000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loading]);

  return fresh;
}
