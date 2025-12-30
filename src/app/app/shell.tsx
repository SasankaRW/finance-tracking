"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark, Layers, List, LogOut, Target, Repeat, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOutEverywhere } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";

const navItems = [
  { href: "/app", label: "Dashboard", icon: Layers },
  { href: "/app/transactions", label: "Transactions", icon: List },
  { href: "/app/accounts", label: "Accounts", icon: Landmark },
  { href: "/app/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/app/budgets", label: "Budgets", icon: Target },
  { href: "/app/events", label: "Trips", icon: MapPin },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link
              href="/app"
              className="flex items-center gap-2 font-bold text-lg tracking-tight"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-sm font-bold">C</span>
              </div>
              <span className="hidden sm:inline">Cashly</span>
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
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
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
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Sign out"
              onClick={() => signOutEverywhere()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-24 md:pb-8 pt-6 md:pt-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-7xl">
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
                  "flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3 text-[10px] transition-colors",
                  active
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}


