"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import { useAccounts, useCategories } from "@/lib/finance/hooks";
import { syncWidgetSession } from "@/lib/widget-session";

export function WidgetSessionSync({ user }: { user: User }) {
  const { accounts, loading: accountsLoading } = useAccounts();
  const { categories, loading: categoriesLoading } = useCategories();

  React.useEffect(() => {
    if (accountsLoading || categoriesLoading) return;

    let cancelled = false;
    void syncWidgetSession({ user, accounts, categories }).catch((error) => {
      if (cancelled) return;
      // Widget quick-add should never block the main app.
      console.warn("Failed to sync widget session", error);
    });

    return () => {
      cancelled = true;
    };
  }, [accounts, accountsLoading, categories, categoriesLoading, user]);

  return null;
}
