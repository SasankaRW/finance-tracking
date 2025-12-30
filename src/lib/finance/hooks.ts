"use client";

import * as React from "react";
import {
  orderBy,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
  type QueryConstraint,
  Timestamp,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  accountsCol,
  budgetsCol,
  categoriesCol,
  eventsCol,
  subscriptionsCol,
  transactionsCol,
} from "@/lib/firestore/refs";
import { useRealtimeQuery } from "@/lib/firestore/use-collection";

function docs<T = DocumentData>(snap: QuerySnapshot) {
  return snap.docs.map((d) => d.data() as T);
}

export function useAccounts() {
  const { user } = useAuth();
  const q = React.useMemo(() => {
    if (!user) return null;
    return query(accountsCol(user.uid), orderBy("createdAt", "asc"));
  }, [user]);

  const map = React.useCallback((snap: QuerySnapshot) => docs(snap), []);
  const state = useRealtimeQuery(q, map);
  return { ...state, accounts: state.data ?? [] };
}

export function useCategories(kind?: "income" | "expense") {
  const { user } = useAuth();
  const q = React.useMemo(() => {
    if (!user) return null;
    const base = categoriesCol(user.uid);
    // Intentionally avoid `where(kind) + orderBy(name)` which requires a composite index.
    // Categories are small, so we order by name and filter client-side when `kind` is provided.
    return query(base, orderBy("name", "asc"));
  }, [user, kind]);

  const map = React.useCallback(
    (snap: QuerySnapshot) => {
      const all = docs(snap) as any[];
      if (!kind) return all;
      return all.filter((c) => c?.kind === kind);
    },
    [kind],
  );
  const state = useRealtimeQuery(q, map);
  return { ...state, categories: state.data ?? [] };
}

export type TransactionFilters = {
  accountId?: string;
  categoryId?: string;
  eventId?: string;
  noEvent?: boolean;
  start?: Date;
  end?: Date;
  includeDeleted?: boolean;
};

export function useTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  const q = React.useMemo(() => {
    if (!user) return null;

    const constraints: QueryConstraint[] = [];
    if (!filters.includeDeleted) constraints.push(where("status", "==", "active"));
    if (filters.eventId) {
      // Event queries should avoid additional where/range filters (which would require more composite indexes).
      // We'll filter account/category/date client-side when eventId is provided.
      constraints.push(where("eventId", "==", filters.eventId));
    } else {
      if (filters.accountId) constraints.push(where("accountId", "==", filters.accountId));
      if (filters.categoryId) constraints.push(where("categoryId", "==", filters.categoryId));
      if (filters.start) constraints.push(where("occurredAt", ">=", Timestamp.fromDate(filters.start)));
      if (filters.end) constraints.push(where("occurredAt", "<=", Timestamp.fromDate(filters.end)));
    }
    constraints.push(orderBy("occurredAt", "desc"));

    return query(transactionsCol(user.uid), ...constraints);
  }, [
    user,
    filters.accountId,
    filters.categoryId,
    filters.eventId,
    filters.noEvent,
    filters.start,
    filters.end,
    filters.includeDeleted,
  ]);

  const map = React.useCallback(
    (snap: QuerySnapshot) => {
      const all = docs(snap) as any[];
      const needsClientFilter = Boolean(filters.eventId) || Boolean(filters.noEvent);
      if (!needsClientFilter) return all;
      return all.filter((t) => {
        if (filters.eventId && t?.eventId !== filters.eventId) return false;
        if (filters.accountId && t?.accountId !== filters.accountId) return false;
        if (filters.categoryId && t?.categoryId !== filters.categoryId) return false;
        if (filters.noEvent && t?.eventId) return false;
        if (filters.start && t?.occurredAt instanceof Timestamp && t.occurredAt.toDate() < filters.start)
          return false;
        if (filters.end && t?.occurredAt instanceof Timestamp && t.occurredAt.toDate() > filters.end)
          return false;
        return true;
      });
    },
    [filters.accountId, filters.categoryId, filters.end, filters.eventId, filters.noEvent, filters.start],
  );
  const state = useRealtimeQuery(q, map);
  return { ...state, transactions: state.data ?? [] };
}

export function useEvents() {
  const { user } = useAuth();
  const q = React.useMemo(() => {
    if (!user) return null;
    return query(eventsCol(user.uid), orderBy("createdAt", "asc"));
  }, [user]);

  const map = React.useCallback((snap: QuerySnapshot) => docs(snap), []);
  const state = useRealtimeQuery(q, map);
  return { ...state, events: state.data ?? [] };
}

export function useBudgets(month: string) {
  const { user } = useAuth();
  // Avoid composite index by ordering only, then filtering client-side by month
  const q = React.useMemo(() => {
    if (!user) return null;
    return query(budgetsCol(user.uid), orderBy("createdAt", "asc"));
  }, [user]);

  const map = React.useCallback(
    (snap: QuerySnapshot) => {
      const all = docs(snap) as any[];
      return all.filter((b) => b?.month === month);
    },
    [month],
  );
  const state = useRealtimeQuery(q, map);
  return { ...state, budgets: state.data ?? [] };
}

export function useSubscriptions() {
  const { user } = useAuth();
  const q = React.useMemo(() => {
    if (!user) return null;
    // Avoid composite indexes: order by nextDueAt and filter client-side if needed later.
    return query(subscriptionsCol(user.uid), orderBy("nextDueAt", "asc"));
  }, [user]);

  const map = React.useCallback((snap: QuerySnapshot) => docs(snap), []);
  const state = useRealtimeQuery(q, map);
  return { ...state, subscriptions: state.data ?? [] };
}


