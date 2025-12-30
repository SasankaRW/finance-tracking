"use client";

import * as React from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pie, PieChart, Cell, Legend } from "recharts";
import { Timestamp } from "firebase/firestore";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  PiggyBank,
  Banknote,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { useAccounts, useBudgets, useCategories, useTransactions } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { DEFAULT_CURRENCY, HOME_CURRENCY } from "@/shared/currency";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { accounts } = useAccounts();
  const { data: fxUsd } = useFxRates("USD", [HOME_CURRENCY]);
  const usdToLkr = fxUsd?.rates?.[HOME_CURRENCY] ?? null;
  const start = React.useMemo(() => startOfMonth(new Date()), []);
  const end = React.useMemo(() => endOfMonth(new Date()), []);
  const { transactions } = useTransactions({ start, end });
  const monthKey = React.useMemo(() => format(new Date(), "yyyy-MM"), []);
  const monthName = React.useMemo(() => format(new Date(), "MMMM yyyy"), []);
  const { budgets } = useBudgets(monthKey);
  const { categories: expenseCategories } = useCategories("expense");

  const totalBalance = React.useMemo(
    () =>
      accounts
        .filter((a: any) => a.includeInTotals !== false)
        .reduce((sum, a: any) => sum + (a.balance ?? 0), 0),
    [accounts],
  );

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
  const cashInHand = React.useMemo(
    () =>
      accounts
        .filter((a: any) => a.type === "cash" && a.includeInTotals !== false)
        .reduce((sum, a: any) => sum + (a.balance ?? 0), 0),
    [accounts],
  );

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
    for (const t of transactions as any[]) {
      if (t.kind === "income") income += t.amount ?? 0;
      if (t.kind === "expense") expense += t.amount ?? 0;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  const txCounts = React.useMemo(() => {
    let incomeCount = 0;
    let expenseCount = 0;
    for (const t of transactions as any[]) {
      if (t.kind === "income") incomeCount++;
      if (t.kind === "expense") expenseCount++;
    }
    return { income: incomeCount, expense: expenseCount, total: transactions.length };
  }, [transactions]);

  const expenseByCategory = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions as any[]) {
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
  }, [transactions, expenseCategories]);

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
    for (const t of transactions as any[]) {
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
  }, [budgets, transactions, expenseCategories, monthTotals.expense]);

  const chartData = React.useMemo(
    () => [
      { name: "Income", value: monthTotals.income, fill: "#22c55e" },
      { name: "Expenses", value: monthTotals.expense, fill: "#ef4444" },
    ],
    [monthTotals],
  );

  const pieColors = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6"];

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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {monthName}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Your financial overview at a glance
          </p>
        </div>
        <CreateTransactionDialog triggerLabel="New Transaction" />
      </div>

      {/* Primary Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Balance - Primary Card */}
        <Card className="relative overflow-hidden border-2 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Worth
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-3xl font-bold tracking-tight">
              {missingUsdRate || hasUnsupportedCurrency
                ? "—"
                : formatMoney(totalBalanceLkr, HOME_CURRENCY)}
            </div>
            {balancesByCurrency.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {balancesByCurrency.map(([cur, bal]) => (
                  <Badge key={cur} variant="outline" className="text-xs font-mono">
                    {formatMoney(bal, cur)}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{accountSummary.total} accounts</span>
              {usdToLkr && <span className="opacity-60">• 1 USD ≈ {usdToLkr.toFixed(0)} LKR</span>}
            </div>
          </CardContent>
        </Card>

        {/* Cash in Hand */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cash in Hand
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Banknote className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold">
              {cashMissingUsdRate || cashUnsupportedCurrency
                ? "—"
                : formatMoney(cashInHandLkr, HOME_CURRENCY)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {accountSummary.cash} cash account{accountSummary.cash !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Income Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Income
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold text-emerald-600">
              +{formatMoney(monthTotals.income)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {txCounts.income} transactions
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expenses
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                <ArrowDownRight className="h-4 w-4 text-rose-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold text-rose-600">
              -{formatMoney(monthTotals.expense)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {txCounts.expense} transactions
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net Change Banner */}
      <Card className={`border-l-4 ${monthTotals.net >= 0 ? "border-l-emerald-500" : "border-l-rose-500"}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {monthTotals.net >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-rose-600" />
              )}
              <div>
                <p className="text-sm font-medium">Monthly Net Change</p>
                <p className="text-xs text-muted-foreground">
                  {monthTotals.net >= 0 ? "You're saving money this month" : "Spending exceeds income"}
                </p>
              </div>
            </div>
            <div className={`text-2xl font-bold ${monthTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {monthTotals.net >= 0 ? "+" : ""}{formatMoney(monthTotals.net)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Income vs Expenses */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Money Flow</CardTitle>
                <CardDescription>Income vs Expenses for {monthName}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Income</p>
                    <p className="text-xs text-muted-foreground">{txCounts.income} transactions</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  {formatMoney(monthTotals.income)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Expenses</p>
                    <p className="text-xs text-muted-foreground">{txCounts.expense} transactions</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-rose-600">
                  {formatMoney(monthTotals.expense)}
                </span>
              </div>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" className="text-xs" tickFormatter={(v) => formatMoney(v).replace(/\.00$/, "")} />
                  <YAxis type="category" dataKey="name" className="text-xs" width={70} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => formatMoney(typeof value === "number" ? value : 0)}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Categories */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Spending by Category</CardTitle>
                <CardDescription>Top expense categories this month</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/categories" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  {expenseByCategory.map((cat, idx) => {
                    const pct = monthTotals.expense > 0 
                      ? Math.round((cat.value / monthTotals.expense) * 100) 
                      : 0;
                    return (
                      <div key={cat.categoryId} className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: pieColors[idx % pieColors.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{cat.name}</span>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted mt-1 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ 
                                width: `${pct}%`,
                                backgroundColor: pieColors[idx % pieColors.length]
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoney(cat.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseByCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {expenseByCategory.map((_, idx) => (
                          <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value) => formatMoney(typeof value === "number" ? value : 0)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Wallet className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No expenses yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add some expenses to see the breakdown
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Budget Tracking</CardTitle>
                <CardDescription>Monitor your spending limits for {monthName}</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/budgets" className="text-xs">
                Manage <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {budgetStatus.overallLimit ? (
            <div className="space-y-4">
              {/* Overall Budget */}
              <div className="p-4 rounded-lg border-2 border-dashed">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">Overall Budget</p>
                    <p className="text-xs text-muted-foreground">All categories combined</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">
                      {formatMoney(budgetStatus.totalSpent, budgetStatus.overallCurrency)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}/ {formatMoney(budgetStatus.overallLimit, budgetStatus.overallCurrency)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {budgetStatus.overallLimit - budgetStatus.totalSpent > 0 
                        ? `${formatMoney(budgetStatus.overallLimit - budgetStatus.totalSpent, budgetStatus.overallCurrency)} remaining`
                        : "Budget exceeded"}
                    </p>
                  </div>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetStatus.totalSpent > budgetStatus.overallLimit
                        ? "bg-destructive"
                        : budgetStatus.totalSpent > budgetStatus.overallLimit * 0.8
                          ? "bg-amber-500"
                          : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((budgetStatus.totalSpent / budgetStatus.overallLimit) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{Math.round((budgetStatus.totalSpent / budgetStatus.overallLimit) * 100)}% used</span>
                  <span>{budgetStatus.perCategory.length} category budgets</span>
                </div>
              </div>

              {/* Category Budgets */}
              {budgetStatus.perCategory.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {budgetStatus.perCategory.slice(0, 4).map((b) => {
                    const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
                    const over = b.spent > b.limit;
                    const warning = pct >= 80 && !over;
                    return (
                      <div key={b.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium truncate">{b.name}</span>
                          <span className={`text-xs font-medium ${over ? "text-destructive" : warning ? "text-amber-600" : ""}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              over ? "bg-destructive" : warning ? "bg-amber-500" : "bg-primary"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
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
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Target className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No budgets set</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Set spending limits to track your budget for {monthName}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/budgets">
                  Create Budget <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
