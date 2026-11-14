"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Layers, List, LogOut, Settings, Target } from "@/components/icons";
import { cn } from "@/lib/utils";
import { hapticTick } from "@/lib/haptics";
import { CashlyLogo } from "@/components/cashly-logo";
import { signOutEverywhere } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";
import { SpeedDialFab } from "@/components/speed-dial-fab";

const navItems = [
  { href: "/app", label: "Dashboard", icon: Layers },
  { href: "/app/transactions", label: "Transactions", icon: List },
  { href: "/app/planning", label: "Planning", icon: Target },
  { href: "/app/events", label: "Events", icon: Calendar },
];

// Mobile has no top bar, so the bottom nav also carries Settings.
const shortLabels: Record<string, string> = { "/app": "Home", "/app/transactions": "Activity" };
const mobileNavItems = [
  ...navItems.filter((item) => item.href !== "/app/events"),
  { href: "/app/settings", label: "Settings", icon: Settings },
].map((i) => ({ ...i, short: shortLabels[i.href] ?? i.label }));

// Order of travel for the shared-axis page slide (Events lives under Planning on phones).
const ROUTE_ORDER = ["/app", "/app/transactions", "/app/planning", "/app/events", "/app/settings"];
function routeIndex(path: string) {
  let best = -1;
  ROUTE_ORDER.forEach((r, i) => {
    if (path === r || (r !== "/app" && path.startsWith(r + "/"))) best = i;
  });
  return best;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const prevPath = React.useRef<string | null>(null);
  const direction = React.useMemo(() => {
    const prev = prevPath.current;
    if (prev === null || prev === pathname) return "";
    return routeIndex(pathname) >= routeIndex(prev) ? "sn-route-fwd" : "sn-route-back";
  }, [pathname]);
  React.useEffect(() => {
    prevPath.current = pathname;
  }, [pathname]);

  // The nav indicator is one pill that springs under the active tab.
  const navRef = React.useRef<HTMLElement>(null);
  const [pill, setPill] = React.useState<{ x: number; y: number } | null>(null);
  const [pillReady, setPillReady] = React.useState(false);
  const { user } = useAuth();
  const isActive = (href: string) =>
    pathname === href || (pathname.startsWith(href + "/") && href !== "/app");

  const activeHref = mobileNavItems.find((i) => isActive(i.href))?.href ?? null;
  React.useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const ind = activeHref
        ? nav.querySelector<HTMLElement>(`[data-nav-href="${activeHref}"] .sn-ind`)
        : null;
      if (!ind || ind.offsetParent === null) return setPill(null);
      setPill({ x: ind.offsetLeft, y: ind.offsetTop });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeHref]);
  React.useEffect(() => {
    if (pill && !pillReady) {
      const id = window.requestAnimationFrame(() => setPillReady(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, [pill, pillReady]);

  // Below md there's no header to anchor scrolled content under the status
  // bar (that's the "Transaction Trends" overlapping the clock bug) — this
  // scrim keeps that strip opaque no matter how far the page scrolls.
  //
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 hidden bg-background pt-[env(safe-area-inset-top)] md:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-6 lg:px-8">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/app" className="flex items-center gap-2.5">
              <CashlyLogo className="h-9 w-9" />
              <span className="text-lg font-semibold tracking-[-0.3px]">Cashly</span>
            </Link>

            <nav className="hidden items-center gap-1.5 md:flex" aria-label="Main">
              {navItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-compact
                    className={cn(
                      "sn-btn flex h-9 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium",
                      active
                        ? "bg-[#34405a] font-semibold text-[#d9e3f8]"
                        : "text-[#c4c6d0]",
                    )}
                  >
                    <Icon className="h-4 w-4" filled={active} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden max-w-[200px] truncate text-sm text-muted-foreground lg:block">
              {user?.email}
            </div>
            <Link href="/app/settings" aria-label="Settings" data-compact className="sn-icon sm">
              <Settings className="h-4 w-4" />
            </Link>
            <button
              type="button"
              aria-label="Sign out"
              data-compact
              onClick={() => signOutEverywhere()}
              className="sn-icon sm"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main
        key={pathname}
        className={cn("mx-auto w-full max-w-7xl px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(11rem+env(safe-area-inset-bottom))] sm:px-6 md:pt-8 md:pb-10 lg:px-8", direction)}
      >
        {children}
      </main>

      <nav className="sn-nav" aria-label="Main" ref={navRef}>
        <span
          aria-hidden="true"
          className="sn-nav-pill"
          style={{
            transform: pill ? `translate3d(${pill.x}px, ${pill.y}px, 0)` : "translate3d(0, 0, 0)",
            opacity: pill ? 1 : 0,
            transitionDuration: pillReady ? undefined : "0ms",
          }}
        />
        {mobileNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-compact
              data-nav-href={item.href}
              onClick={() => hapticTick(10)}
              className={cn("sn-tab", active && "on")}
            >
              <span className="sn-ind">
                <Icon className="h-6 w-6" filled={active} />
              </span>
              <span className="max-w-full truncate">{item.short}</span>
            </Link>
          );
        })}
      </nav>

      <SpeedDialFab />
    </div>
  );
}
