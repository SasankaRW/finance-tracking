"use client";

import * as React from "react";
import Link from "next/link";
import { format, differenceInDays, endOfMonth } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, Banknote } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import { DebtPillsSummary } from "@/components/debt-pills-summary";
import { AnimatedNumber } from "@/components/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Pill, Tile, Meter } from "@/components/sonoma";

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
  dailyAverage,
  monthlyAverage,
  recentTransactions,
  categoryNameById,
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
  dailyAverage: number;
  monthlyAverage: number;
  recentTransactions: Tx[];
  categoryNameById: Map<string, string>;
  usdToLkr?: number | null;
  cashInHand?: number;
  cashMissingRate?: boolean;
}) {
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

  const status =
    budgetPercentUsed === null
      ? { tone: "neutral" as const, text: "No budget set" }
      : budgetOver
        ? { tone: "coral" as const, text: "Budget exhausted" }
        : budgetWarning
          ? { tone: "amber" as const, text: `${budgetPercentUsed}% of budget used` }
          : { tone: "green" as const, text: "Budget on track" };

  return (
    <div className="space-y-4 md:hidden">
      <PageHeader eyebrow={format(new Date(), "MMMM yyyy")} title="Overview">
        <Link href="/app/budgets" className="sn-icon" aria-label="Budget stats" data-compact>
          <BarChart3 className="h-5 w-5" />
        </Link>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-[24px]" />
          <Skeleton className="h-24 w-full rounded-[24px]" />
        </div>
      ) : (
        <>
          <section className="sn-panel rise-in p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="sn-lbl">Total balance</p>
              <Pill tone={status.tone}>{status.text}</Pill>
            </div>
            <p className="mt-2 truncate text-[2.4rem] leading-tight font-semibold tracking-[-1px]">
              {balanceMissingRate ? (
                "—"
              ) : (
                <AnimatedNumber value={totalBalance} formatFn={(v) => formatMoney(v, balanceCurrency)} />
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {balanceMissingRate
                ? "USD rate unavailable"
                : `Across ${accountCount} account${accountCount !== 1 ? "s" : ""}${
                    availablePct !== null ? ` · ${availablePct}% budget left` : ""
                  }`}
            </p>
            {budgetStatus.overallLimit ? (
              <Meter className="mt-4" value={budgetStatus.totalSpent} max={budgetStatus.overallLimit} />
            ) : null}
            {typeof usdToLkr === "number" && (
              <p className="mt-2 text-xs text-[var(--faint)]">
                1 USD = {usdToLkr.toFixed(2)} {balanceCurrency}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <Pill tone="blue">
                <Banknote className="h-3.5 w-3.5" />
                Cash {cashMissingRate ? "—" : formatMoney(cashInHand ?? 0, balanceCurrency)}
              </Pill>
              <Pill tone="neutral">
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
              </Pill>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <div className="sn-panel rise-in p-4">
              <p className="sn-lbl">Daily average</p>
              <p className="mt-2 truncate text-xl font-semibold tabular-nums tracking-[-0.3px]">
                {formatMoney(dailyAverage, budgetStatus.overallCurrency)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--faint)]">incl. upcoming bills</p>
            </div>
            <div className="sn-panel rise-in p-4">
              <p className="sn-lbl">Monthly average</p>
              <p className="mt-2 truncate text-xl font-semibold tabular-nums tracking-[-0.3px]">
                {formatMoney(monthlyAverage, budgetStatus.overallCurrency)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--faint)]">projected this month</p>
            </div>
          </div>
        </>
      )}

      <DebtPillsSummary />

      <section className="sn-panel rise-in p-4">
        <div className="flex items-center justify-between px-1">
          <span className="sn-lbl">Today</span>
          {todayTx.length > 0 && <Pill tone="coral">{formatMoney(todayTotal)}</Pill>}
        </div>

        {isLoading ? (
          <div className="mt-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : todayTx.length ? (
          <ul className="mt-3 space-y-3">
            {todayTx.map((t) => {
              const name =
                t.note?.trim() ||
                categoryNameById.get(t.categoryId ?? "") ||
                (t.kind === "income" ? "Income" : "Expense");
              const time = format(toDate(t.occurredAt), "HH:mm");
              const tone = t.kind === "income" ? "green" : t.kind === "transfer" ? "blue" : "coral";
              const Icon = t.kind === "income" ? ArrowDownLeft : t.kind === "transfer" ? ArrowLeftRight : ArrowUpRight;
              return (
                <li key={t.id} className="flex items-center gap-3">
                  <Tile tone={tone}>
                    <Icon className="h-5 w-5" />
                  </Tile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{time}</p>
                  </div>
                  <p
                    className={`shrink-0 font-semibold tabular-nums ${
                      tone === "green" ? "text-green" : tone === "coral" ? "text-coral" : ""
                    }`}
                  >
                    {formatMoney(t.amount ?? 0)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing yet today.
          </div>
        )}
      </section>
    </div>
  );
}
