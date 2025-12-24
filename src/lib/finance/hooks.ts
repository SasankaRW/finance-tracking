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
    const constraints: QueryConstraint[] = [];
    if (kind) constraints.push(where("kind", "==", kind));
    constraints.push(orderBy("name", "asc"));
    return query(base, ...constraints);
  }, [user, kind]);

  const map = React.useCallback((snap: QuerySnapshot) => docs(snap), []);
  const state = useRealtimeQuery(q, map);
  return { ...state, categories: state.data ?? [] };
}

export type TransactionFilters = {
  accountId?: string;
  categoryId?: string;
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
    if (filters.accountId) constraints.push(where("accountId", "==", filters.accountId));
    if (filters.categoryId) constraints.push(where("categoryId", "==", filters.categoryId));
    if (filters.start) constraints.push(where("occurredAt", ">=", Timestamp.fromDate(filters.start)));
    if (filters.end) constraints.push(where("occurredAt", "<=", Timestamp.fromDate(filters.end)));
    constraints.push(orderBy("occurredAt", "desc"));

    return query(transactionsCol(user.uid), ...constraints);
  }, [
    user,
    filters.accountId,
    filters.categoryId,
    filters.start,
    filters.end,
    filters.includeDeleted,
  ]);

  const map = React.useCallback((snap: QuerySnapshot) => docs(snap), []);
  const state = useRealtimeQuery(q, map);
  return { ...state, transactions: state.data ?? [] };
}

export function useBudgets(month: string) {
  const { user } = useAuth();
  const q = React.useMemo(() => {
    if (!user) return null;
    return query(
      budgetsCol(user.uid),
      where("month", "==", month),
      orderBy("createdAt", "asc"),
    );
  }, [user, month]);

  const map = React.useCallback((snap: QuerySnapshot) => docs(snap), []);
  const state = useRealtimeQuery(q, map);
  return { ...state, budgets: state.data ?? [] };
}


