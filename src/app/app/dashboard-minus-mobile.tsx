"use client";

import * as React from "react";
import Link from "next/link";
import { format, differenceInDays, endOfMonth } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { BarChart3, Banknote, ChevronRight, Pencil } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { DebtPillsSummary } from "@/components/debt-pills-summary";
import { UpcomingBillsPanel } from "@/components/upcoming-bills-panel";
import { PendingImportsPanel } from "@/components/pending-imports-panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6"];

type CategorySpend = {
  categoryId: string;
  name: string;
  value: number;
};

type Tx = {
  id: string;
  kind: string;
  amount?: number;
  note?: string;
  occurredAt?: unknown;
  categoryId?: string;
};

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

export function DashboardMinusMobile({
  isLoading,
  budgetOver,
  budgetWarning,
  budgetPercentUsed,
  budgetStatus,
  totalBalance,
  balanceCurrency,
  balanceMissingRate,
  accountCount,
  recentTransactions,
  categoryNameById,
  expenseByCategory,
  usdToLkr,
  cashInHand,
  cashMissingRate,
}: {
  isLoading: boolean;
  budgetOver: boolean;
  budgetWarning: boolean;
  budgetPercentUsed: number | null;
  budgetStatus: {
    overallLimit: number | null;
    overallCurrency: string;
    totalSpent: number;
  };
  totalBalance: number;
  balanceCurrency: string;
  balanceMissingRate: boolean;
  accountCount: number;
  recentTransactions: Tx[];
  categoryNameById: Map<string, string>;
  expenseByCategory: CategorySpend[];
  usdToLkr?: number | null;
  cashInHand?: number;
  cashMissingRate?: boolean;
}) {
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const daysLeft = differenceInDays(endOfMonth(new Date()), new Date()) + 1;
  const availablePct =
    budgetStatus.overallLimit && budgetPercentUsed !== null
      ? Math.max(0, 100 - budgetPercentUsed)
      : null;

  const todayTotal = React.useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    let total = 0;
    for (const t of recentTransactions) {
      const d = format(toDate(t.occurredAt), "yyyy-MM-dd");
      if (d === today && t.kind === "expense") total += t.amount ?? 0;
    }
    return total;
  }, [recentTransactions]);

  const todayTx = React.useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return recentTransactions
      .filter((t) => format(toDate(t.occurredAt), "yyyy-MM-dd") === today)
      .slice(0, 8);
  }, [recentTransactions]);

  return (
    <div className="space-y-4 md:hidden">
      <div className="flex items-center justify-between gap-3">
        {isLoading ? (
          <Skeleton className="h-10 flex-1 rounded-full" />
        ) : budgetPercentUsed !== null ? (
          <div
            className={`flex flex-1 items-center rounded-full px-4 py-2.5 ${
              budgetOver
                ? "bg-rose-200/80 text-rose-900"
                : budgetWarning
                  ? "bg-amber-200/80 text-amber-900"
                  : "bg-emerald-200/80 text-emerald-900"
            }`}
          >
            <span className="text-sm font-bold">
              {budgetOver
                ? "Budget exhausted"
                : budgetWarning
                  ? `${budgetPercentUsed}% used`
                  : "Budget on track"}
            </span>
          </div>
        ) : (
          <div className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground">
            No budget set
          </div>
        )}
        <Link
          href="/app/budgets"
          className="motion-expressive press-expressive flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground hover:rounded-full"
          aria-label="Budget stats"
        >
          <BarChart3 className="h-5 w-5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-[2rem]" />
          <Skeleton className="h-24 w-full rounded-[1.75rem]" />
        </div>
      ) : (
        <>
          <div className="hero-card motion-expressive relative overflow-hidden rounded-[2.25rem] p-5 shadow-lg">
            <div className="hero-card-glow absolute -right-10 -top-14 h-36 w-36 rounded-full blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/75">Balance</p>
                <p className="mt-1 truncate font-display text-[2.6rem] font-bold leading-tight tracking-tight text-white">
                  {balanceMissingRate ? "—" : formatMoney(totalBalance, balanceCurrency)}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {balanceMissingRate
                    ? "USD rate unavailable"
                    : `Across ${accountCount} account${accountCount !== 1 ? "s" : ""}${
                        availablePct !== null ? ` · ${availablePct}% budget left` : ""
                      }`}
                </p>
                {typeof usdToLkr === "number" && (
                  <p className="mt-0.5 text-xs text-white/60">
                    1 USD = {usdToLkr.toFixed(2)} {balanceCurrency}
                  </p>
                )}
              </div>
              <Link
                href="/app/budgets"
                aria-label="Edit budget"
                className="motion-expressive press-expressive flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 hover:rounded-full"
              >
                <Pencil className="h-4 w-4 text-white" />
              </Link>
            </div>

            <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-white/15 pt-3">
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 py-1.5 pl-2.5 pr-3.5 text-xs text-white">
                <Banknote className="h-3.5 w-3.5 text-white/80" />
                <span className="text-white/75">Cash</span>
                <span className="font-display font-bold tabular-nums">
                  {cashMissingRate ? "—" : formatMoney(cashInHand ?? 0, balanceCurrency)}
                </span>
              </span>
              <span className="rounded-full bg-white/20 px-3.5 py-1.5 font-display text-xs font-bold text-white">
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="motion-expressive min-w-0 rounded-[2rem] rounded-br-lg bg-secondary p-4 text-secondary-foreground">
              <p className="truncate font-display text-2xl font-bold tabular-nums">
                {formatMoney(todayTotal)}
              </p>
              <p className="mt-1 text-sm font-semibold">Daily spend</p>
              <p className="mt-0.5 text-[11px] opacity-70">{format(new Date(), "MMM d")}</p>
            </div>
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="tonal-primary motion-expressive press-expressive relative min-w-0 w-full rounded-[2rem] rounded-bl-lg p-4 text-left"
                >
                  <ChevronRight className="absolute right-3.5 top-3.5 h-4 w-4 opacity-50" />
                  <p className="truncate font-display text-2xl font-bold tabular-nums">
                    {formatMoney(budgetStatus.totalSpent)}
                  </p>
                  <p className="mt-1 text-sm font-semibold">Monthly spend</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">tap for breakdown</p>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Spending by category</DialogTitle>
                  <DialogDescription>
                    {format(new Date(), "MMMM yyyy")} · {formatMoney(budgetStatus.totalSpent)} spent
                  </DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-3">
                  {expenseByCategory.length > 0 ? (
                    expenseByCategory.map((cat, idx) => {
                      const pct =
                        budgetStatus.totalSpent > 0
                          ? Math.round((cat.value / budgetStatus.totalSpent) * 100)
                          : 0;
                      return (
                        <div key={cat.categoryId} className="rounded-2xl border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                              />
                              <span className="truncate text-sm font-medium">{cat.name}</span>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">
                              {formatMoney(cat.value)}
                            </span>
                          </div>
                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{pct}% of spending</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No expenses recorded yet this month.
                    </div>
                  )}
                </DialogBody>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}

      <PendingImportsPanel />

      <UpcomingBillsPanel />

      <DebtPillsSummary />

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="font-display text-base font-bold">Today</span>
          {todayTx.length > 0 && (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground tabular-nums">
              {formatMoney(todayTotal)}
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-[2rem] bg-card shadow-sm">
          {isLoading ? (
            <div className="space-y-0 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="mb-3 h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : todayTx.length ? (
            <ul>
              {todayTx.map((t, idx) => {
                const name =
                  t.note?.trim() ||
                  categoryNameById.get(t.categoryId ?? "") ||
                  (t.kind === "income" ? "Income" : "Expense");
                const time = format(toDate(t.occurredAt), "HH:mm");
                return (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3.5 ${
                      idx > 0 ? "border-t border-border/60" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">{time}</p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums">
                      {formatMoney(t.amount ?? 0)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No transactions today yet.
            </div>
          )}
        </div>

      </div>

      <div className="pb-24" />
    </div>
  );
}
