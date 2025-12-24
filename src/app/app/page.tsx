"use client";

import * as React from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pie, PieChart, Cell, Legend } from "recharts";
import { Timestamp } from "firebase/firestore";
import { useAccounts, useBudgets, useCategories, useTransactions } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { DEFAULT_CURRENCY } from "@/shared/currency";

export default function DashboardPage() {
  const { accounts } = useAccounts();
  const start = React.useMemo(() => startOfMonth(new Date()), []);
  const end = React.useMemo(() => endOfMonth(new Date()), []);
  const { transactions } = useTransactions({ start, end });
  const monthKey = React.useMemo(() => format(new Date(), "yyyy-MM"), []);
  const { budgets } = useBudgets(monthKey);
  const { categories: expenseCategories } = useCategories("expense");

  const totalBalance = React.useMemo(
    () => accounts.reduce((sum, a: any) => sum + (a.balance ?? 0), 0),
    [accounts],
  );
  const cashInHand = React.useMemo(
    () =>
      accounts
        .filter((a: any) => a.type === "cash")
        .reduce((sum, a: any) => sum + (a.balance ?? 0), 0),
    [accounts],
  );

  const balancesByCurrency = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts as any[]) {
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
    return { income, expense };
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
      .slice(0, 8);
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

    return { overallLimit, overallCurrency, perCategory };
  }, [budgets, transactions, expenseCategories]);

  const chartData = React.useMemo(
    () => [
      { name: "Income", value: monthTotals.income },
      { name: "Expenses", value: monthTotals.expense },
    ],
    [monthTotals],
  );

  const pieColors = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#6366f1"];

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total balance</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tracking-tight">
            {balancesByCurrency.length === 1
              ? formatMoney(totalBalance, balancesByCurrency[0][0])
              : "—"}
          </CardContent>
          {balancesByCurrency.length > 1 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              Totals are shown per currency:
              <div className="mt-2 grid gap-1">
                {balancesByCurrency.map(([c, v]) => (
                  <div key={c} className="flex items-center justify-between">
                    <div>{c}</div>
                    <div className="font-medium tabular-nums">
                      {formatMoney(v, c)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cash in hand</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tracking-tight">
            {formatMoney(
              cashInHand,
              balancesByCurrency.length ? balancesByCurrency[0][0] : DEFAULT_CURRENCY,
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>This month income</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tracking-tight text-emerald-600">
            {formatMoney(monthTotals.income)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>This month expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tracking-tight text-rose-600">
            {formatMoney(monthTotals.expense)}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>This month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Income</div>
            <div className="font-medium">{formatMoney(monthTotals.income)}</div>
          </div>
          <div className="mb-6 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Expenses</div>
            <div className="font-medium">{formatMoney(monthTotals.expense)}</div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top expense categories</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={95}
                  label
                >
                  {expenseByCategory.map((_, idx) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budgets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {budgetStatus.overallLimit ? (
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Overall</div>
              <div className="font-medium">
                {formatMoney(monthTotals.expense, budgetStatus.overallCurrency)} /{" "}
                {formatMoney(budgetStatus.overallLimit, budgetStatus.overallCurrency)}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              No budgets set for {monthKey}. Add one in Budgets.
            </div>
          )}

          {budgetStatus.perCategory.length ? (
            <div className="grid gap-2">
              {budgetStatus.perCategory.map((b) => {
                const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
                const over = b.spent > b.limit;
                return (
                  <div key={b.id} className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <div className={over ? "font-medium text-destructive" : ""}>
                        {b.name}
                      </div>
                      <div className="tabular-nums">
                        {formatMoney(b.spent, b.currency)} / {formatMoney(b.limit, b.currency)}
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={over ? "h-2 rounded-full bg-destructive" : "h-2 rounded-full bg-primary"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


