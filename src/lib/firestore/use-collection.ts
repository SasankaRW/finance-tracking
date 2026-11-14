"use client";

import * as React from "react";
import type {
  DocumentData,
  Query,
  QuerySnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

export function useRealtimeQuery<T = DocumentData>(
  query: Query | null,
  map: (snap: QuerySnapshot) => T,
) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Keep the latest mapper without forcing re-subscribe if the caller recreates `map`.
  const mapRef = React.useRef(map);
  React.useEffect(() => {
    mapRef.current = map;
  }, [map]);

  React.useEffect(() => {
    let unsub: Unsubscribe | null = null;
    let active = true;
    if (!query) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    unsub = onSnapshot(
      query,
      (snap) => {
        if (!active) return;
        setData(mapRef.current(snap));
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      if (!unsub) return;
      // Firestore has had rare "internal assertion" issues during dev reload / rapid resubscribe.
      // Never let cleanup throw and crash the whole app.
      try {
        unsub();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Firestore unsubscribe threw; ignored during cleanup.", e);
      }
    };
  }, [query]);

  React.useEffect(() => {
    if (!error) return;
    toast.error("Couldn't load the latest data", {
      description: error.message || "Check your connection and try again.",
    });
  }, [error]);

  return { data, loading, error };
}


