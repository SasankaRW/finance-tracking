"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Layers, List, LogOut, Settings, Target } from "@/components/icons";
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

// Mobile has no top bar, so the bottom nav also carries Settings.
const shortLabels: Record<string, string> = { "/app": "Home", "/app/transactions": "Activity" };
const mobileNavItems = [
  ...navItems.filter((item) => item.href !== "/app/events"),
  { href: "/app/settings", label: "Settings", icon: Settings },
].map((i) => ({ ...i, short: shortLabels[i.href] ?? i.label }));

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();
  const isActive = (href: string) =>
    pathname === href || (pathname.startsWith(href + "/") && href !== "/app");

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

      <main className="mx-auto w-full max-w-7xl px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(11rem+env(safe-area-inset-bottom))] sm:px-6 md:pt-8 md:pb-10 lg:px-8">
        {children}
      </main>

      <nav className="sn-nav" aria-label="Main">
        {mobileNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-compact
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
