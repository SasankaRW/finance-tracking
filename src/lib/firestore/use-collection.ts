"use client";

import * as React from "react";
import type {
  DocumentData,
  Query,
  QuerySnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

export function useRealtimeQuery<T = DocumentData>(
  query: Query | null,
  map: (snap: QuerySnapshot) => T,
) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let unsub: Unsubscribe | null = null;
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
        setData(map(snap));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub?.();
  }, [query, map]);

  return { data, loading, error };
}


