"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Layers, List, LogOut, Plus, Settings, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { CashlyLogo } from "@/components/cashly-logo";
import { signOutEverywhere } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/app", label: "Dashboard", icon: Layers },
  { href: "/app/transactions", label: "Transactions", icon: List },
  { href: "/app/planning", label: "Planning", icon: Target },
  { href: "/app/events", label: "Events", icon: Calendar },
];

// Mobile has no top bar, so the bottom nav also carries Settings.
const mobileNavItems = [
  ...navItems,
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();

  return (
    <div className="min-h-dvh bg-background">
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

      <main className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 pb-28 md:pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] md:pt-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 bg-background/90 backdrop-blur-xl supports-backdrop-filter:bg-background/75 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-7xl gap-1 px-2 pb-2 pt-2.5">
          {mobileNavItems.map((item) => {
            const active =
              pathname === item.href ||
              (pathname.startsWith(item.href + "/") && item.href !== "/app");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-1 flex-col items-center gap-1 py-1 text-[11px]"
              >
                <span
                  className={cn(
                    "motion-expressive flex h-8 w-14 items-center justify-center rounded-full transition-colors group-active:scale-90",
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

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 md:hidden">
        <CreateTransactionDialog
          trigger={
            <Button
              size="icon-lg"
              className="motion-expressive h-16 w-16 rounded-[1.4rem] shadow-xl active:scale-90 active:rounded-full"
              aria-label="Add transaction"
            >
              <Plus className="h-7 w-7" />
            </Button>
          }
        />
      </div>
    </div>
  );
}


