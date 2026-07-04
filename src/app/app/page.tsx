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
} from "lucide-react";
import { useAccounts, useBudgets, useCategories, useSubscriptions, useTransactions } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { DEFAULT_CURRENCY, HOME_CURRENCY } from "@/shared/currency";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { Badge } from "@/components/ui/badge";
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

const TopSpendingPie = dynamic(
  () => import("@/app/app/dashboard-desktop-charts").then((mod) => mod.TopSpendingPie),
  { ssr: false, loading: () => null },
);

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

export default function DashboardPage() {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const isLargeDesktop = useMediaQuery("(min-width: 1024px)");
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
      { name: "Income", value: monthTotals.income, fill: "#22c55e" },
      { name: "Expenses", value: monthTotals.expense, fill: "#ef4444" },
    ],
    [monthTotals],
  );

  const pieColors = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6"];

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

      <div className="hidden md:block space-y-4 sm:space-y-6">
      {!isLoading && budgetPercentUsed !== null && (
        <div
          className={`flex items-center justify-between gap-3 rounded-full px-4 py-2.5 shadow-sm sm:px-5 sm:py-3 ${
            budgetOver
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              : budgetWarning
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <span className="truncate text-sm font-bold sm:text-base">
            {budgetOver
              ? "Budget exhausted"
              : budgetWarning
                ? `${budgetPercentUsed}% of budget used`
                : "Budget on track"}
          </span>
          <Link
            href="/app/planning"
            className="motion-expressive press-expressive flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/50 dark:bg-black/20"
            aria-label="Manage budget"
          >
            <Target className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Overview</h1>
            <Badge variant="secondary" className="font-mono text-[11px]">
              {monthName}
            </Badge>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            A clear snapshot of balances, cash flow, and spending for this month.
          </p>
        </div>
        <CreateTransactionDialog
          triggerLabel="New Transaction"
          trigger={
            <Button className="h-11 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          }
        />
      </div>

      <Card className="hero-card relative overflow-hidden shadow-lg">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/8 blur-2xl" />
        <div className="hero-card-glow absolute -bottom-16 left-8 h-28 w-28 rounded-full blur-2xl" />
        <CardContent className="relative space-y-4 p-4 sm:space-y-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-white/80">Total balance</p>
              {isLoading ? (
                <Skeleton className="h-10 w-48 bg-white/20" />
              ) : (
                <div className="font-display truncate text-3xl font-bold tracking-tight text-white sm:text-5xl">
                  {missingUsdRate || hasUnsupportedCurrency
                    ? "-"
                    : formatMoney(totalBalanceLkr, HOME_CURRENCY)}
                </div>
              )}
              {!isLoading && (
                <p className="text-sm text-white/75">
                  Across {accountSummary.total} account{accountSummary.total !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:h-12 sm:w-12">
              <PiggyBank className="h-5 w-5 text-white" />
            </div>
          </div>

          {!isLoading && sparklineData.values.length > 0 && isDesktop && (
            <div className="rounded-2xl bg-white/10 p-3">
              <SparklineChart
                data={sparklineData.values}
                color="currentColor"
                height={42}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/12 p-2.5 sm:p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/75 sm:text-[11px]">In</p>
              <p className="mt-1 truncate text-sm font-bold text-white sm:text-base">
                +{formatMoney(monthTotals.income)}
              </p>
              <p className="mt-0.5 text-[10px] text-white/70 sm:mt-1 sm:text-[11px]">{txCounts.income} entries</p>
            </div>
            <div className="rounded-xl bg-white/12 p-2.5 sm:p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/75 sm:text-[11px]">Out</p>
              <p className="mt-1 truncate text-sm font-bold text-white sm:text-base">
                -{formatMoney(monthTotals.expense)}
              </p>
              <p className="mt-0.5 text-[10px] text-white/70 sm:mt-1 sm:text-[11px]">{txCounts.expense} entries</p>
            </div>
            <div className="rounded-xl bg-white/12 p-2.5 sm:p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/75 sm:text-[11px]">Net</p>
              <p className="mt-1 truncate text-sm font-bold text-white sm:text-base">
                {monthTotals.net >= 0 ? "+" : ""}{formatMoney(monthTotals.net)}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-white/70 sm:mt-1 sm:text-[11px]">
                {monthStats.savingsRate === null ? "No income yet" : `${monthStats.savingsRate}% of income`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/75">
            <span>{txCounts.total} total transactions</span>
            <span>{monthStats.activeDays} active day{monthStats.activeDays !== 1 ? "s" : ""}</span>
            {usdToLkr && <span>1 USD = {usdToLkr.toFixed(0)} LKR</span>}
          </div>
        </CardContent>
      </Card>

      <DebtPillsSummary />

      <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-[2rem] bg-card shadow-sm sm:grid-cols-4 sm:divide-y-0">
        {[
          {
            label: "Cash",
            icon: Banknote,
            iconClass: "text-emerald-600",
            value: isLoading
              ? "-"
              : cashMissingUsdRate || cashUnsupportedCurrency
                ? "-"
                : formatMoney(cashInHandLkr, HOME_CURRENCY),
            sub: `${accountSummary.cash} cash account${accountSummary.cash !== 1 ? "s" : ""}`,
          },
          {
            label: "Daily Avg",
            icon: Target,
            iconClass: "text-sky-600",
            value: isLoading ? "-" : formatMoney(accrualStats.accrualDailyAverage),
            sub: "incl. upcoming bills",
          },
          {
            label: "Avg Expense",
            icon: AlertCircle,
            iconClass: "text-amber-600",
            value: isLoading ? "-" : formatMoney(monthStats.averageExpense),
            sub: "per entry",
          },
          {
            label: "Biggest",
            icon: ArrowDownRight,
            iconClass: "text-rose-600",
            value: isLoading ? "-" : formatMoney(monthStats.largestExpense),
            sub: "single expense",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-3 sm:p-4"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${stat.iconClass}`} />
                {stat.label}
              </div>
              <p className="mt-2 truncate font-display text-lg font-bold tabular-nums sm:text-2xl">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {stat.sub}
              </p>
            </div>
          );
        })}
      </div>

      {balancesByCurrency.length > 1 && (
        <Card className="surface-container py-3 sm:py-4">
          <CardContent className="space-y-3 px-3 sm:px-4">
            <p className="text-sm font-medium">Balances by Currency</p>
            <div className="flex flex-wrap gap-2">
              {balancesByCurrency.map(([cur, bal]) => (
                <Badge key={cur} variant="outline" className="rounded-full px-3 py-1 font-mono text-xs">
                  {formatMoney(bal, cur)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Card className="surface-tonal shadow-sm">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-base">Money Flow</CardTitle>
            <CardDescription>{monthName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="hidden h-40 w-full rounded-2xl sm:block" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-xl border bg-emerald-500/5 p-3 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Income</p>
                        <p className="text-xs text-muted-foreground">{txCounts.income} transactions</p>
                      </div>
                      <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="mt-2 truncate text-lg font-bold text-emerald-600 sm:mt-3 sm:text-xl">
                      {formatMoney(monthTotals.income)}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-rose-500/5 p-3 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Expenses</p>
                        <p className="text-xs text-muted-foreground">{txCounts.expense} transactions</p>
                      </div>
                      <ArrowDownRight className="h-5 w-5 text-rose-600" />
                    </div>
                    <p className="mt-2 truncate text-lg font-bold text-rose-600 sm:mt-3 sm:text-xl">
                      {formatMoney(monthTotals.expense)}
                    </p>
                  </div>
                </div>

                <div className={`rounded-xl border p-3 sm:rounded-2xl sm:p-4 ${monthTotals.net >= 0 ? "bg-emerald-500/5" : "bg-rose-500/5"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Monthly Net</p>
                      <p className="text-xs text-muted-foreground">
                        {monthTotals.net >= 0 ? "You are saving this month" : "Spending is higher than income"}
                      </p>
                    </div>
                    <p className={`shrink-0 text-lg font-bold sm:text-xl ${monthTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {monthTotals.net >= 0 ? "+" : ""}{formatMoney(monthTotals.net)}
                    </p>
                  </div>
                </div>

                {isDesktop && (
                  <MoneyFlowChart data={chartData} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="surface-tonal shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Top Spending</CardTitle>
                <CardDescription>Largest categories this month</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/categories" className="text-xs">
                  View <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : expenseByCategory.length > 0 ? (
              <div className="grid gap-5 lg:grid-cols-[1fr_180px]">
                <div className="space-y-3">
                  {expenseByCategory.map((cat, idx) => {
                    const pct = monthTotals.expense > 0
                      ? Math.round((cat.value / monthTotals.expense) * 100)
                      : 0;
                    return (
                      <div key={cat.categoryId} className="rounded-2xl border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: pieColors[idx % pieColors.length] }}
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
                              backgroundColor: pieColors[idx % pieColors.length],
                            }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{pct}% of spending</p>
                      </div>
                    );
                  })}
                </div>
                {isLargeDesktop && (
                  <TopSpendingPie data={expenseByCategory} colors={pieColors} />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Wallet className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No expenses yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add expenses to see where your money goes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-tonal shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Budget</CardTitle>
              <CardDescription>Monthly spending limit</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/budgets" className="text-xs">
                Manage <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
              <div className="rounded-3xl bg-neutral-900 p-4 text-white dark:bg-black/40 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-bold tabular-nums sm:text-3xl">
                      {formatMoney(budgetStatus.totalSpent, budgetStatus.overallCurrency)}
                    </p>
                    <p className="mt-0.5 text-xs text-white/60">
                      of {formatMoney(budgetStatus.overallLimit, budgetStatus.overallCurrency)} spent
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm ${
                      budgetOver
                        ? "bg-rose-500/25 text-rose-200"
                        : budgetWarning
                          ? "bg-amber-500/25 text-amber-200"
                          : "bg-white/15 text-white"
                    }`}
                  >
                    {budgetPercentUsed}% used
                  </div>
                </div>
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className={`h-full rounded-full transition-all ${budgetOver
                      ? "bg-rose-400"
                      : budgetWarning
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                      }`}
                    style={{
                      width: `${Math.min(100, budgetPercentUsed ?? 0)}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-xs text-white/70">
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
                      <div key={b.id} className="rounded-2xl border p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium">{b.name}</span>
                          <span className={`text-xs font-semibold ${over ? "text-destructive" : warning ? "text-amber-600" : ""}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${over ? "bg-destructive" : warning ? "bg-amber-500" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
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
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Target className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No budget set</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a budget to keep spending on track.
              </p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/app/budgets">
                  Create Budget <ArrowRight className="h-3 w-3 ml-1" />
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
