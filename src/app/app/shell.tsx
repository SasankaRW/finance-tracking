"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Layers, List, LogOut, Settings, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
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

// Mobile's bottom nav drops Events to save space (still reachable from desktop's
// top nav) and carries Settings instead, since mobile has no top bar.
const mobileNavItems = [
  ...navItems.filter((item) => item.href !== "/app/events"),
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();

  // Below md there's no header to anchor scrolled content under the status
  // bar (that's the "Transaction Trends" overlapping the clock bug) — this
  // scrim keeps that strip opaque no matter how far the page scrolls.
  //
  // The floating nav + FAB hide on scroll-down and reappear on scroll-up (or
  // near the top), the standard modern-app pattern for reclaiming space.
  const [navHidden, setNavHidden] = React.useState(false);

  React.useEffect(() => {
    setNavHidden(false);
  }, [pathname]);

  React.useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < 40) setNavHidden(false);
        else if (delta > 8) setNavHidden(true);
        else if (delta < -8) setNavHidden(false);
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="app-ambient-bg min-h-dvh">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-background/85 backdrop-blur-md md:hidden"
      />

      <header className="sticky top-0 z-20 hidden bg-background/90 backdrop-blur-xl supports-backdrop-filter:bg-background/75 pt-[env(safe-area-inset-top)] md:block">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/app" className="group flex items-center gap-2.5">
              <CashlyLogo className="motion-expressive h-9 w-9 drop-shadow-sm group-active:scale-90" />
              <span className="font-display text-lg font-bold tracking-tight">Cashly</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (pathname.startsWith(item.href + "/") && item.href !== "/app");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "motion-expressive press-expressive flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      active
                        ? "bg-secondary text-secondary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-sm text-muted-foreground lg:block truncate max-w-[200px]">
              {user?.email}
            </div>
            <Link
              href="/app/settings"
              aria-label="Settings"
              className="motion-expressive press-expressive flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:rounded-xl"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => signOutEverywhere()}
              className="motion-expressive press-expressive flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:rounded-xl"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Keyed on the route so each page cross-fades in like a tab switch.
          Plain CSS, not Motion: an AnimatePresence exit here previously
          animated transform/opacity across the *entire* page subtree (every
          child layer needs recompositing) and its "wait" mode delayed the
          next page's mount until the old one finished exiting — a real,
          felt latency hit on every navigation, worst on heavy pages like
          transactions. A GPU-composited CSS fade has none of that cost. */}
      <main
        key={pathname}
        className="animate-ios-fade mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 pb-28 md:pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] md:pt-8"
      >
        {children}
      </main>

      {/* Floating pill nav: inset from the edges and lifted off the bottom so it
          reads as a control sitting over the content rather than a bar cut into it. */}
      <nav
        className={cn(
          "motion-expressive fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 md:hidden",
          navHidden ? "pointer-events-none translate-y-24 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <div className="elevation-2 flex gap-1 rounded-full bg-card/85 px-2 py-1.5 ring-1 ring-border/60 backdrop-blur-xl supports-backdrop-filter:bg-card/75">
          {mobileNavItems.map((item) => {
            const active =
              pathname === item.href ||
              (pathname.startsWith(item.href + "/") && item.href !== "/app");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => void hapticLight()}
                className="group flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px]"
              >
                {/* Plain class swap, not a layoutId shared-layout slide: this
                    pill sits inside the nav's backdrop-blur-xl surface, and
                    animating anything near a backdrop-filter forces the
                    browser to re-sample the blur every frame — the exact
                    mobile WebView jank dialog.tsx's own comments warn about,
                    here firing on every navigation instead of just a dialog
                    open. Not worth it for a tab indicator. */}
                <span
                  className={cn(
                    "motion-expressive flex h-8 w-14 items-center justify-center rounded-full group-active:scale-90",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground group-hover:bg-muted/60",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                </span>
                <span
                  className={cn(
                    "max-w-full truncate",
                    active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <SpeedDialFab hidden={navHidden} />
    </div>
  );
}


