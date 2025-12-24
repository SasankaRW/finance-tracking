"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark, Layers, List, LogOut, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOutEverywhere } from "@/lib/auth/auth-actions";
import { useAuth } from "@/lib/auth/auth-provider";

const navItems = [
  { href: "/app", label: "Dashboard", icon: Layers },
  { href: "/app/transactions", label: "Transactions", icon: List },
  { href: "/app/accounts", label: "Accounts", icon: Landmark },
  { href: "/app/categories", label: "Categories", icon: Layers },
  { href: "/app/budgets", label: "Budgets", icon: Target },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/app" className="font-semibold tracking-tight">
              Cashly
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-xs text-muted-foreground sm:block">
              {user?.email}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => signOutEverywhere()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background sm:hidden">
        <div className="mx-auto flex max-w-5xl">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 px-3 py-3 text-xs",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}


