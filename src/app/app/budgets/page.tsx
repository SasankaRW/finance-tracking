"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Target,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useBudgets, useCategories, useTransactions } from "@/lib/finance/hooks";
import { createBudget, deleteBudget } from "@/lib/finance/budget-mutations";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY, HOME_CURRENCY } from "@/shared/currency";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function currentMonth() {
  return format(new Date(), "yyyy-MM");
}

const createSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.string().optional(),
  limitAmount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
});
type CreateValues = z.infer<typeof createSchema>;

type SummaryMode = "all" | "monthly" | "weekly" | "yearly";

function monthToDate(month: string) {
  const [year, monthNum] = month.split("-");
  return new Date(parseInt(year), parseInt(monthNum) - 1, 1);
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const [mode, setMode] = React.useState<SummaryMode>("monthly");
  const [month, setMonth] = React.useState(currentMonth());
  const { budgets, loading, error } = useBudgets(month);
  const { categories: expenseCategories } = useCategories("expense");
  const { data: fxUsd } = useFxRates("USD", [HOME_CURRENCY]);
  const usdToLkr = fxUsd?.rates?.[HOME_CURRENCY] ?? null;

  const [weekAnchor, setWeekAnchor] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [yearAnchor, setYearAnchor] = React.useState(() => new Date(new Date().getFullYear(), 0, 1));

  const monthName = React.useMemo(() => {
    const date = monthToDate(month);
    return format(date, "MMMM yyyy");
  }, [month]);

  const period = React.useMemo(() => {
    if (mode === "all") return { start: undefined as Date | undefined, end: undefined as Date | undefined, label: "All Time" };
    if (mode === "weekly") {
      const start = startOfWeek(weekAnchor, { weekStartsOn: 1 });
      const end = endOfWeek(weekAnchor, { weekStartsOn: 1 });
      return { start, end, label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` };
    }
    if (mode === "yearly") {
      const start = startOfYear(yearAnchor);
      const end = endOfYear(yearAnchor);
      return { start, end, label: format(start, "yyyy") };
    }
    const start = startOfMonth(monthToDate(month));
    const end = endOfMonth(monthToDate(month));
    return { start, end, label: monthName };
  }, [mode, weekAnchor, yearAnchor, month, monthName]);

  const { transactions } = useTransactions({
    start: period.start,
    end: period.end,
  });

  const convert = React.useCallback(
    (amount: number, from: string, to: string) => {
      const f = formatCurrencyCode(from);
      const t = formatCurrencyCode(to);
      if (f === t) return amount;
      if (f === "USD" && t === "LKR" && typeof usdToLkr === "number") return amount * usdToLkr;
      if (f === "LKR" && t === "USD" && typeof usdToLkr === "number" && usdToLkr !== 0) return amount / usdToLkr;
      return null;
    },
    [usdToLkr],
  );

  const summary = React.useMemo(() => {
    let incomeLkr = 0;
    let expenseLkr = 0;
    let missingUsdRate = false;
    let unsupportedCurrency = false;
    let incomeCount = 0;
    let expenseCount = 0;

    const expenseByCategory = new Map<string, number>();

    for (const t of transactions as any[]) {
      if (t.status && t.status !== "active") continue;
      const amt = t.amount ?? 0;
      const cur = t.currency ?? HOME_CURRENCY;
      const lkr = convert(amt, cur, HOME_CURRENCY);
      if (lkr == null) {
        if (formatCurrencyCode(cur) === "USD") missingUsdRate = true;
        else unsupportedCurrency = true;
        continue;
      }
      if (t.kind === "income") {
        incomeLkr += lkr;
        incomeCount++;
      }
      if (t.kind === "expense") {
        expenseLkr += lkr;
        expenseCount++;
        const catId = t.categoryId ?? "uncategorized";
        expenseByCategory.set(catId, (expenseByCategory.get(catId) ?? 0) + lkr);
      }
    }

    return {
      incomeLkr,
      expenseLkr,
      netLkr: incomeLkr - expenseLkr,
      incomeCount,
      expenseCount,
      missingUsdRate,
      unsupportedCurrency,
      expenseByCategory,
    };
  }, [transactions, convert]);

  const budgetRows = React.useMemo(() => {
    if (mode !== "monthly") return [];

    const nameById = new Map(expenseCategories.map((c: any) => [c.id, c.name]));

    return (budgets as any[]).map((b) => {
      const currency = formatCurrencyCode(b.currency ?? HOME_CURRENCY);
      const scopeName = b.categoryId ? nameById.get(b.categoryId) ?? "Category" : "Overall";

      let spentInBudgetCurrency = 0;
      let missingUsdRate = false;
      let unsupportedCurrency = false;

      const addSpent = (amount: number, txCurrency: string) => {
        const v = convert(amount, txCurrency, currency);
        if (v == null) {
          if (formatCurrencyCode(txCurrency) === "USD" || currency === "USD") missingUsdRate = true;
          else unsupportedCurrency = true;
          return;
        }
        spentInBudgetCurrency += v;
      };

      for (const t of transactions as any[]) {
        if (t.status && t.status !== "active") continue;
        if (t.kind !== "expense") continue;
        if (b.categoryId && t.categoryId !== b.categoryId) continue;
        addSpent(t.amount ?? 0, t.currency ?? HOME_CURRENCY);
      }

      const limit = b.limitAmount ?? 0;
      const remaining = limit - spentInBudgetCurrency;
      const percent = limit > 0 ? Math.min(100, Math.round((spentInBudgetCurrency / limit) * 100)) : 0;

      return {
        ...b,
        scopeName,
        currency,
        spentInBudgetCurrency,
        remaining,
        percent,
        missingUsdRate,
        unsupportedCurrency,
      };
    });
  }, [mode, budgets, expenseCategories, transactions, convert]);

  const navigateMonth = (direction: "prev" | "next") => {
    const [year, monthNum] = month.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    if (direction === "prev") {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    setMonth(format(date, "yyyy-MM"));
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setWeekAnchor((prev) => (direction === "prev" ? addWeeks(prev, -1) : addWeeks(prev, 1)));
  };

  const navigateYear = (direction: "prev" | "next") => {
    setYearAnchor((prev) => (direction === "prev" ? addYears(prev, -1) : addYears(prev, 1)));
  };

  const [open, setOpen] = React.useState(false);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      month,
      categoryId: "overall",
      limitAmount: 10000,
      currency: DEFAULT_CURRENCY,
    },
  });

  React.useEffect(() => {
    form.setValue("month", month);
  }, [month, form]);

  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createBudget(user.uid, {
        month: values.month,
        categoryId: values.categoryId && values.categoryId !== "overall" ? values.categoryId : undefined,
        limitAmount: values.limitAmount,
        currency: values.currency,
      });
      toast.success("Budget created");
      setOpen(false);
    } catch (e) {
      toast.error("Failed to create budget", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your spending and manage budget limits
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Budget</DialogTitle>
              <DialogDescription>
                Set a spending limit for a month
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit}>
              <DialogBody className="space-y-5">
                {/* Month & Currency */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Month
                    </Label>
                    <Input
                      type="month"
                      value={form.watch("month")}
                      onChange={(e) => form.setValue("month", e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Currency
                    </Label>
                    <Select
                      value={form.watch("currency")}
                      onValueChange={(v) =>
                        form.setValue("currency", v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Category
                  </Label>
                  <Select
                    value={form.watch("categoryId") ?? "overall"}
                    onValueChange={(v) =>
                      form.setValue("categoryId", v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overall">Overall (all expenses)</SelectItem>
                      {expenseCategories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Limit Amount */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Spending Limit
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-11 text-lg font-semibold"
                    {...form.register("limitAmount", { valueAsNumber: true })}
                  />
                </div>
              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting} className="min-w-24">
                  {form.formState.isSubmitting ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Period Selector Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as SummaryMode)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">All Time</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
          </TabsList>

          {/* Period Navigation */}
          {mode !== "all" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (mode === "weekly") navigateWeek("prev");
                  else if (mode === "yearly") navigateYear("prev");
                  else navigateMonth("prev");
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Badge variant="secondary" className="font-mono px-3 py-1.5 text-sm">
                {period.label}
              </Badge>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (mode === "weekly") navigateWeek("next");
                  else if (mode === "yearly") navigateYear("next");
                  else navigateMonth("next");
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <TabsContent value={mode} className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Income */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Income
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {summary.missingUsdRate || summary.unsupportedCurrency
                    ? "—"
                    : `+${formatMoney(summary.incomeLkr, HOME_CURRENCY)}`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.incomeCount} transaction{summary.incomeCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Expenses
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4 text-rose-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">
                  {summary.missingUsdRate || summary.unsupportedCurrency
                    ? "—"
                    : `-${formatMoney(summary.expenseLkr, HOME_CURRENCY)}`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.expenseCount} transaction{summary.expenseCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            {/* Net */}
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Net Change
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <PiggyBank className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${summary.netLkr >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {summary.missingUsdRate || summary.unsupportedCurrency
                    ? "—"
                    : `${summary.netLkr >= 0 ? "+" : ""}${formatMoney(summary.netLkr, HOME_CURRENCY)}`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.netLkr >= 0 ? "Saved this period" : "Overspent this period"}
                </p>
              </CardContent>
            </Card>

            {/* Budgets Summary */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Budgets
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{budgetRows.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === "monthly" ? `active for ${monthName}` : "view monthly tab"}
                </p>
              </CardContent>
            </Card>
          </div>

          {(summary.missingUsdRate || summary.unsupportedCurrency) && (
            <p className="text-sm text-muted-foreground mt-4">
              {summary.missingUsdRate ? "Waiting for USD→LKR rate…" : ""}
              {summary.missingUsdRate && summary.unsupportedCurrency ? " " : ""}
              {summary.unsupportedCurrency ? "Some currencies cannot be converted yet." : ""}
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Budgets Table - Only in Monthly View */}
      {mode === "monthly" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Monthly Budgets</CardTitle>
                  <CardDescription>Spending limits for {monthName}</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-6">Budget</TableHead>
                  <TableHead className="w-[100px]">Currency</TableHead>
                  <TableHead className="text-right w-[140px]">Limit</TableHead>
                  <TableHead className="w-[200px]">Progress</TableHead>
                  <TableHead className="text-right w-[140px]">Remaining</TableHead>
                  <TableHead className="w-[60px] pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Loading budgets…
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-destructive">
                      Failed to load budgets{error?.message ? `: ${error.message}` : ""}
                    </TableCell>
                  </TableRow>
                ) : budgetRows.length ? (
                  budgetRows.map((b) => {
                    const isOverall = !b.categoryId;
                    const over = b.remaining < 0;
                    const warning = b.percent >= 80 && !over;
                    return (
                      <TableRow key={b.id} className="group">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                              over ? "bg-destructive/10" : warning ? "bg-amber-500/10" : "bg-primary/10"
                            }`}>
                              <Target className={`h-4 w-4 ${
                                over ? "text-destructive" : warning ? "text-amber-600" : "text-primary"
                              }`} />
                            </div>
                            <div>
                              <div className="font-medium">{b.scopeName}</div>
                              {isOverall && (
                                <div className="text-xs text-muted-foreground">All expenses</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">
                            {b.currency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold tabular-nums">
                            {formatMoney(b.limitAmount, b.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {b.missingUsdRate || b.unsupportedCurrency
                                  ? "—"
                                  : formatMoney(b.spentInBudgetCurrency, b.currency)}
                              </span>
                              <span className={`font-medium ${over ? "text-destructive" : warning ? "text-amber-600" : ""}`}>
                                {b.percent}%
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  over ? "bg-destructive" : warning ? "bg-amber-500" : "bg-primary"
                                }`}
                                style={{ width: `${b.percent}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold tabular-nums ${over ? "text-destructive" : ""}`}>
                            {b.missingUsdRate || b.unsupportedCurrency
                              ? "—"
                              : formatMoney(b.remaining, b.currency)}
                          </span>
                          {over && (
                            <div className="text-xs text-destructive">over budget</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-destructive hover:text-destructive"
                            onClick={async () => {
                              if (!user) return;
                              if (!confirm("Delete this budget?")) return;
                              try {
                                await deleteBudget(user.uid, b.id);
                                toast.success("Budget deleted");
                              } catch (e) {
                                toast.error("Failed to delete budget", {
                                  description: e instanceof Error ? e.message : undefined,
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <Target className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">No budgets for {monthName}</p>
                          <p className="text-sm text-muted-foreground">
                            Set a budget to track your spending
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Budget
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
