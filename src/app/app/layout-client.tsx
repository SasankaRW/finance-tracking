"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { AppLockGate } from "@/components/app-lock-gate";
import { WidgetSessionSync } from "@/components/widget-session-sync";
import { SmsImportSync } from "@/components/sms-import-sync";
import { AppShell } from "@/app/app/shell";

const PENDING_ROUTE_KEY = "cashly:pending-route";

export function AppLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [widgetSyncReady, setWidgetSyncReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || typeof window === "undefined") return;

    const pendingRoute = sessionStorage.getItem(PENDING_ROUTE_KEY);
    if (!pendingRoute?.startsWith("/app")) return;

    sessionStorage.removeItem(PENDING_ROUTE_KEY);
    const currentRoute = `${window.location.pathname}${window.location.search}`;
    if (currentRoute !== pendingRoute) {
      router.replace(pendingRoute);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user) {
      setWidgetSyncReady(false);
      return;
    }

    const timer = window.setTimeout(() => setWidgetSyncReady(true), 2_500);
    return () => window.clearTimeout(timer);
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLockGate user={user}>
      {widgetSyncReady && <WidgetSessionSync user={user} />}
      <SmsImportSync user={user} />
      <AppShell>{children}</AppShell>
    </AppLockGate>
  );
}






