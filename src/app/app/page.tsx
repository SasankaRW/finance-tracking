"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Timestamp } from "firebase/firestore";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  PiggyBank,
  Banknote,
  ArrowRight,
  AlertCircle,
  Plus,
} from "@/components/icons";
import { useAccounts, useBudgets, useCategories, useSubscriptions, useTransactions } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { DEFAULT_CURRENCY, HOME_CURRENCY } from "@/shared/currency";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { AnimatedNumber } from "@/components/animated-number";
import { Meter, PageHeader, Pill, SplitMeter, Tile, topParts } from "@/components/sonoma";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccrualStats, useQuickStats, useSparklineData } from "@/lib/finance/use-trends";
import { SparklineChart } from "@/components/sparkline-chart";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { DebtPillsSummary } from "@/components/debt-pills-summary";
import { DashboardMinusMobile } from "@/app/app/dashboard-minus-mobile";

const MoneyFlowChart = dynamic(
  () => import("@/app/app/dashboard-desktop-charts").then((mod) => mod.MoneyFlowChart),
  { ssr: false, loading: () => null },
);

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

export default function DashboardPage() {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const { accounts, loading: accountsLoading } = useAccounts();
  const { data: fxUsd } = useFxRates("USD", [HOME_CURRENCY]);
  const usdToLkr = fxUsd?.rates?.[HOME_CURRENCY] ?? null;
  const start = React.useMemo(() => startOfMonth(new Date()), []);
  const end = React.useMemo(() => endOfMonth(new Date()), []);
  const { transactions, loading: transactionsLoading } = useTransactions({ start, end });
  const currentMonthTransactions = React.useMemo(() => {
    return (transactions as any[]).filter((t: any) => {
      const date = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date(t.occurredAt);
      return date >= start && date <= end;
    });
  }, [transactions, start, end]);
  const monthKey = React.useMemo(() => format(new Date(), "yyyy-MM"), []);
  const monthName = React.useMemo(() => format(new Date(), "MMMM yyyy"), []);
  const { budgets, loading: budgetsLoading } = useBudgets(monthKey);

  const isLoading = accountsLoading || transactionsLoading || budgetsLoading;
  const { categories: expenseCategories } = useCategories("expense");

  const { totalBalanceLkr, missingUsdRate, hasUnsupportedCurrency } =
    React.useMemo(() => {
      let total = 0;
      let missingRate = false;
      let unsupported = false;
      for (const a of accounts as any[]) {
        if (a.includeInTotals === false) continue;
        const bal = a.balance ?? 0;
        const cur = formatCurrencyCode(a.currency);
        if (cur === HOME_CURRENCY) total += bal;
        else if (cur === "USD") {
          if (typeof usdToLkr === "number") total += bal * usdToLkr;
          else missingRate = true;
        } else {
          unsupported = true;
        }
      }
      return { totalBalanceLkr: total, missingUsdRate: missingRate, hasUnsupportedCurrency: unsupported };
    }, [accounts, usdToLkr]);

  const quickStats = useQuickStats(transactions as any[], totalBalanceLkr);
  const { subscriptions } = useSubscriptions();
  const visibleAccountIds = React.useMemo(
    () =>
      new Set(
        (accounts as any[])
          .filter((a) => a.includeInTotals !== false)
          .map((a) => a.id),
      ),
    [accounts],
  );
  const accrualStats = useAccrualStats(
    currentMonthTransactions as any[],
    subscriptions as any[],
    usdToLkr,
    visibleAccountIds,
  );
  const sparklineData = useSparklineData(isDesktop ? (transactions as any[]) : [], 30);

  const { cashInHandLkr, cashMissingUsdRate, cashUnsupportedCurrency } =
    React.useMemo(() => {
      let total = 0;
      let missingRate = false;
      let unsupported = false;
      for (const a of accounts as any[]) {
        if (a.type !== "cash") continue;
        if (a.includeInTotals === false) continue;
        const bal = a.balance ?? 0;
        const cur = formatCurrencyCode(a.currency);
        if (cur === HOME_CURRENCY) total += bal;
        else if (cur === "USD") {
          if (typeof usdToLkr === "number") total += bal * usdToLkr;
          else missingRate = true;
        } else {
          unsupported = true;
        }
      }
      return {
        cashInHandLkr: total,
        cashMissingUsdRate: missingRate,
        cashUnsupportedCurrency: unsupported,
      };
    }, [accounts, usdToLkr]);

  const balancesByCurrency = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts as any[]) {
      if (a.includeInTotals === false) continue;
      const c = formatCurrencyCode(a.currency ?? DEFAULT_CURRENCY);
      map.set(c, (map.get(c) ?? 0) + (a.balance ?? 0));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [accounts]);

  const monthTotals = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of currentMonthTransactions as any[]) {
      if (t.kind === "income") income += t.amount ?? 0;
      if (t.kind === "expense") expense += t.amount ?? 0;
    }
    return { income, expense, net: income - expense };
  }, [currentMonthTransactions]);

  const txCounts = React.useMemo(() => {
    let incomeCount = 0;
    let expenseCount = 0;
    for (const t of currentMonthTransactions as any[]) {
      if (t.kind === "income") incomeCount++;
      if (t.kind === "expense") expenseCount++;
    }
    return { income: incomeCount, expense: expenseCount, total: currentMonthTransactions.length };
  }, [currentMonthTransactions]);

  const monthStats = React.useMemo(() => {
    let largestExpense = 0;
    const activeDays = new Set<string>();

    for (const t of currentMonthTransactions as any[]) {
      const date = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date(t.occurredAt);
      activeDays.add(format(date, "yyyy-MM-dd"));
      if (t.kind === "expense") {
        largestExpense = Math.max(largestExpense, t.amount ?? 0);
      }
    }

    const averageExpense = txCounts.expense > 0 ? monthTotals.expense / txCounts.expense : 0;
    const savingsRate =
      monthTotals.income > 0 ? Math.round((monthTotals.net / monthTotals.income) * 100) : null;

    return {
      activeDays: activeDays.size,
      averageExpense,
      largestExpense,
      savingsRate,
    };
  }, [currentMonthTransactions, monthTotals.expense, monthTotals.income, monthTotals.net, txCounts.expense]);

  const expenseByCategory = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const t of currentMonthTransactions as any[]) {
      if (t.kind !== "expense") continue;
      const key = t.categoryId ?? "uncategorized";
      map.set(key, (map.get(key) ?? 0) + (t.amount ?? 0));
    }
    const nameById = new Map(expenseCategories.map((c: any) => [c.id, c.name]));
    return Array.from(map.entries())
      .map(([categoryId, value]) => ({
        categoryId,
        name: nameById.get(categoryId) ?? "Uncategorized",
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [currentMonthTransactions, expenseCategories]);

  const budgetStatus = React.useMemo(() => {
    const overallBudget = (budgets as any[]).find((b) => !b.categoryId);
    const overallLimit = overallBudget?.limitAmount ?? null;
    const overallCurrency = overallBudget?.currency ?? DEFAULT_CURRENCY;

    const perCategory: Array<{
      id: string;
      name: string;
      limit: number;
      spent: number;
      currency: string;
    }> = [];

    const spentByCategory = new Map<string, number>();
    for (const t of currentMonthTransactions as any[]) {
      if (t.kind !== "expense") continue;
      const id = t.categoryId ?? "uncategorized";
      spentByCategory.set(id, (spentByCategory.get(id) ?? 0) + (t.amount ?? 0));
    }

    for (const b of budgets as any[]) {
      if (!b.categoryId) continue;
      const name =
        expenseCategories.find((c: any) => c.id === b.categoryId)?.name ??
        "Category";
      perCategory.push({
        id: b.categoryId,
        name,
        limit: b.limitAmount,
        spent: spentByCategory.get(b.categoryId) ?? 0,
        currency: b.currency ?? DEFAULT_CURRENCY,
      });
    }

    return { overallLimit, overallCurrency, perCategory, totalSpent: monthTotals.expense };
  }, [budgets, currentMonthTransactions, expenseCategories, monthTotals.expense]);

  const chartData = React.useMemo(
    () => [
      { name: "Income", value: monthTotals.income, fill: "#8fe3ad" },
      { name: "Expenses", value: monthTotals.expense, fill: "#ff9d94" },
    ],
    [monthTotals],
  );

  const categoryNameById = React.useMemo(
    () => new Map(expenseCategories.map((c: any) => [c.id, c.name])),
    [expenseCategories],
  );

  const recentTransactions = React.useMemo(() => {
    return [...(currentMonthTransactions as any[])]
      .sort((a, b) => toDate(b.occurredAt).getTime() - toDate(a.occurredAt).getTime())
      .slice(0, 30);
  }, [currentMonthTransactions]);

  const accountSummary = React.useMemo(() => {
    let cashCount = 0;
    let bankCount = 0;
    let cardCount = 0;
    for (const a of accounts as any[]) {
      if (a.type === "cash") cashCount++;
      else if (a.type === "bank") bankCount++;
      else if (a.type === "card") cardCount++;
    }
    return { cash: cashCount, bank: bankCount, card: cardCount, total: accounts.length };
  }, [accounts]);

  const budgetPercentUsed = budgetStatus.overallLimit
    ? Math.round((budgetStatus.totalSpent / budgetStatus.overallLimit) * 100)
    : null;
  const budgetOver = budgetStatus.overallLimit
    ? budgetStatus.totalSpent > budgetStatus.overallLimit
    : false;
  const budgetWarning = budgetPercentUsed !== null && budgetPercentUsed >= 80 && !budgetOver;

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardMinusMobile
        isLoading={isLoading}
        budgetOver={budgetOver}
        budgetWarning={budgetWarning}
        budgetPercentUsed={budgetPercentUsed}
        budgetStatus={budgetStatus}
        totalBalance={totalBalanceLkr}
        balanceCurrency={HOME_CURRENCY}
        balanceMissingRate={missingUsdRate}
        accountCount={accountSummary.total}
        dailyAverage={accrualStats.accrualDailyAverage}
        monthlyAverage={accrualStats.accrualMonthlyProjected}
        recentTransactions={recentTransactions}
        categoryNameById={categoryNameById}
        usdToLkr={usdToLkr}
        cashInHand={cashInHandLkr}
        cashMissingRate={cashMissingUsdRate || cashUnsupportedCurrency}
      />

      <div className="hidden space-y-4 md:block sm:space-y-6">
        <PageHeader eyebrow={monthName} title="Overview">
          <div className="flex items-center gap-3">
            {!isLoading && budgetPercentUsed !== null && (
              <Link href="/app/planning" aria-label="Manage budget" data-compact>
                <Pill tone={budgetOver ? "coral" : budgetWarning ? "amber" : "green"}>
                  {budgetOver
                    ? "Budget exhausted"
                    : budgetWarning
                      ? `${budgetPercentUsed}% of budget used`
                      : "Budget on track"}
                </Pill>
              </Link>
            )}
            <CreateTransactionDialog
              triggerLabel="New Transaction"
              trigger={
                <Button className="h-11">
                  <Plus className="h-4 w-4" />
                  Add transaction
                </Button>
              }
            />
          </div>
        </PageHeader>

        <Card className="py-5">
          <CardContent className="space-y-5 px-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="sn-lbl">Total balance</p>
                {isLoading ? (
                  <Skeleton className="h-10 w-48" />
                ) : (
                  <div className="truncate text-4xl font-semibold tracking-[-1px] sm:text-5xl">
                    {missingUsdRate || hasUnsupportedCurrency ? (
                      "-"
                    ) : (
                      <AnimatedNumber
                        value={totalBalanceLkr}
                        formatFn={(v) => formatMoney(v, HOME_CURRENCY)}
                      />
                    )}
                  </div>
                )}
                {!isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Across {accountSummary.total} account{accountSummary.total !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <Tile tone="blue">
                <PiggyBank className="h-5 w-5" />
              </Tile>
            </div>

            {!isLoading && sparklineData.values.length > 0 && isDesktop && (
              <div className="rounded-2xl bg-surface-high p-3 text-blue">
                <SparklineChart data={sparklineData.values} color="currentColor" height={42} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="sn-card p-3 sm:p-4">
                <p className="sn-lbl">In</p>
                <p className="mt-1 truncate text-sm font-semibold text-green sm:text-lg">
                  +{formatMoney(monthTotals.income)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--faint)]">{txCounts.income} entries</p>
              </div>
              <div className="sn-card p-3 sm:p-4">
                <p className="sn-lbl">Out</p>
                <p className="mt-1 truncate text-sm font-semibold text-coral sm:text-lg">
                  -{formatMoney(monthTotals.expense)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--faint)]">{txCounts.expense} entries</p>
              </div>
              <div className="sn-card p-3 sm:p-4">
                <p className="sn-lbl">Net</p>
                <p className={`mt-1 truncate text-sm font-semibold sm:text-lg ${monthTotals.net >= 0 ? "text-green" : "text-coral"}`}>
                  {monthTotals.net >= 0 ? "+" : ""}
                  {formatMoney(monthTotals.net)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--faint)]">
                  {monthStats.savingsRate === null ? "No income yet" : `${monthStats.savingsRate}% of income`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--faint)]">
              <span>{txCounts.total} total transactions</span>
              <span>
                {monthStats.activeDays} active day{monthStats.activeDays !== 1 ? "s" : ""}
              </span>
              {usdToLkr && <span>1 USD = {usdToLkr.toFixed(0)} LKR</span>}
            </div>
          </CardContent>
        </Card>

        <DebtPillsSummary />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Cash",
              icon: Banknote,
              tone: "blue" as const,
              value: isLoading
                ? "-"
                : cashMissingUsdRate || cashUnsupportedCurrency
                  ? "-"
                  : formatMoney(cashInHandLkr, HOME_CURRENCY),
              sub: `${accountSummary.cash} cash account${accountSummary.cash !== 1 ? "s" : ""}`,
            },
            {
              label: "Daily average",
              icon: Target,
              tone: "blue" as const,
              value: isLoading ? "-" : formatMoney(accrualStats.accrualDailyAverage),
              sub: "incl. upcoming bills",
            },
            {
              label: "Average expense",
              icon: AlertCircle,
              tone: "coral" as const,
              value: isLoading ? "-" : formatMoney(monthStats.averageExpense),
              sub: "per entry",
            },
            {
              label: "Biggest",
              icon: ArrowDownRight,
              tone: "coral" as const,
              value: isLoading ? "-" : formatMoney(monthStats.largestExpense),
              sub: "single expense",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="sn-panel rise-in p-4">
                <div className="flex items-center gap-2.5">
                  <Tile tone={stat.tone}>
                    <Icon className="h-5 w-5" />
                  </Tile>
                  <span className="sn-lbl">{stat.label}</span>
                </div>
                <p className="mt-3 truncate text-lg font-semibold tabular-nums tracking-[-0.3px] sm:text-xl">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--faint)]">{stat.sub}</p>
              </div>
            );
          })}
        </div>

        {balancesByCurrency.length > 1 && (
          <Card className="py-4">
            <CardContent className="space-y-3 px-5">
              <p className="sn-lbl">Balances by currency</p>
              <div className="flex flex-wrap gap-2">
                {balancesByCurrency.map(([cur, bal]) => (
                  <Pill key={cur} tone="blue">
                    {formatMoney(bal, cur)}
                  </Pill>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="px-5">
              <CardTitle>Money flow</CardTitle>
              <CardDescription>{monthName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 sm:space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <Skeleton className="hidden h-40 w-full rounded-2xl sm:block" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="sn-card p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Income</p>
                          <p className="text-xs text-muted-foreground">{txCounts.income} transactions</p>
                        </div>
                        <Tile tone="green">
                          <ArrowUpRight className="h-5 w-5" />
                        </Tile>
                      </div>
                      <p className="mt-2 truncate text-lg font-semibold text-green sm:mt-3 sm:text-xl">
                        {formatMoney(monthTotals.income)}
                      </p>
                    </div>
                    <div className="sn-card p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Expenses</p>
                          <p className="text-xs text-muted-foreground">{txCounts.expense} transactions</p>
                        </div>
                        <Tile tone="coral">
                          <ArrowDownRight className="h-5 w-5" />
                        </Tile>
                      </div>
                      <p className="mt-2 truncate text-lg font-semibold text-coral sm:mt-3 sm:text-xl">
                        {formatMoney(monthTotals.expense)}
                      </p>
                    </div>
                  </div>

                  <div className="sn-card flex items-center justify-between gap-3 p-3 sm:p-4">
                    <div>
                      <p className="text-sm font-medium">Monthly net</p>
                      <p className="text-xs text-muted-foreground">
                        {monthTotals.net >= 0 ? "You are saving this month" : "Spending is higher than income"}
                      </p>
                    </div>
                    <p className={`shrink-0 text-lg font-semibold sm:text-xl ${monthTotals.net >= 0 ? "text-green" : "text-coral"}`}>
                      {monthTotals.net >= 0 ? "+" : ""}
                      {formatMoney(monthTotals.net)}
                    </p>
                  </div>

                  {isDesktop && <MoneyFlowChart data={chartData} />}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Top spending</CardTitle>
                  <CardDescription>Largest categories this month</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/categories" className="text-xs">
                    View <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-2 w-full rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : expenseByCategory.length > 0 ? (
                <div className="space-y-5">
                  <SplitMeter
                    parts={topParts(
                      expenseByCategory.map((c: any) => ({ label: c.name, value: c.value })),
                      3,
                    )}
                  />
                  <ul className="space-y-3">
                    {expenseByCategory.map((cat) => {
                      const pct =
                        monthTotals.expense > 0 ? Math.round((cat.value / monthTotals.expense) * 100) : 0;
                      return (
                        <li key={cat.categoryId} className="flex items-center gap-3">
                          <Tile tone="coral">
                            <ArrowDownRight className="h-5 w-5" />
                          </Tile>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{cat.name}</p>
                            <p className="text-xs text-muted-foreground">{pct}% of spending</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {formatMoney(cat.value)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <Tile tone="neutral">
                    <Wallet className="h-5 w-5" />
                  </Tile>
                  <div>
                    <p className="text-sm font-medium">No expenses yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add expenses to see where your money goes.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Budget</CardTitle>
                <CardDescription>Monthly spending limit</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/budgets" className="text-xs">
                  Manage <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                  ))}
                </div>
              </div>
            ) : budgetStatus.overallLimit ? (
              <div className="space-y-4">
                <div className="sn-card p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-2xl font-semibold tabular-nums sm:text-3xl">
                        {formatMoney(budgetStatus.totalSpent, budgetStatus.overallCurrency)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        of {formatMoney(budgetStatus.overallLimit, budgetStatus.overallCurrency)} spent
                      </p>
                    </div>
                    <Pill tone={budgetOver ? "coral" : budgetWarning ? "amber" : "green"}>
                      {budgetPercentUsed}% used
                    </Pill>
                  </div>
                  <Meter className="mt-4" value={budgetStatus.totalSpent} max={budgetStatus.overallLimit} />
                  <p className="mt-3 text-xs text-muted-foreground">
                    {budgetStatus.overallLimit - budgetStatus.totalSpent > 0
                      ? `${formatMoney(budgetStatus.overallLimit - budgetStatus.totalSpent, budgetStatus.overallCurrency)} remaining`
                      : "Budget exceeded"}
                  </p>
                </div>

                {budgetStatus.perCategory.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {budgetStatus.perCategory.slice(0, 4).map((b) => {
                      const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
                      const over = b.spent > b.limit;
                      const warning = pct >= 80 && !over;
                      return (
                        <div key={b.id} className="sn-card p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium">{b.name}</span>
                            <span className={`text-xs font-semibold ${over ? "text-coral" : warning ? "text-amber" : ""}`}>
                              {pct}%
                            </span>
                          </div>
                          <Meter value={b.spent} max={b.limit} />
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatMoney(b.spent, b.currency)}</span>
                            <span>{formatMoney(b.limit, b.currency)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <Tile tone="neutral">
                  <Target className="h-5 w-5" />
                </Tile>
                <div>
                  <p className="text-sm font-medium">No budget set</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a budget to keep spending on track.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/budgets">
                    Create budget <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
