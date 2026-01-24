"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { toast } from "sonner";
import {
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Plus,
  Tag,
  Settings2,
  CalendarIcon,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts, useCategories, useEvents, useTransactions } from "@/lib/finance/hooks";
import {
  deleteTransaction,
  editTransaction,
} from "@/lib/finance/mutations";
import {
  createCategory,
  deleteCategory,
} from "@/lib/finance/category-mutations";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { downloadTextFile, toCsv } from "@/lib/export/csv";
import { COMMON_CURRENCIES, HOME_CURRENCY } from "@/shared/currency";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { TransactionTrendChart } from "@/components/transaction-trend-chart";

const kindSchema = z.enum(["expense", "income", "transfer"]);

const createSchema = z
  .object({
    kind: kindSchema,
    amount: z.number().positive().finite(),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    eventId: z.string().optional(),
    fromAccountId: z.string().optional(),
    toAccountId: z.string().optional(),
    occurredAt: z.date(),
    note: z.string().max(280).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "transfer") {
      if (!v.fromAccountId) ctx.addIssue({ code: "custom", path: ["fromAccountId"], message: "Required" });
      if (!v.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Required" });
      if (v.fromAccountId && v.toAccountId && v.fromAccountId === v.toAccountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Must be different" });
      }
    } else {
      if (!v.accountId) ctx.addIssue({ code: "custom", path: ["accountId"], message: "Required" });
      if (!v.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Required" });
    }
  });

type CreateValues = z.infer<typeof createSchema>;

export default function TransactionsPage() {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { categories: expenseCats } = useCategories("expense");
  const { categories: incomeCats } = useCategories("income");
  const { events } = useEvents();
  const { data: fxUsd } = useFxRates("USD", [HOME_CURRENCY]);
  const usdToLkr = fxUsd?.rates?.[HOME_CURRENCY] ?? null;

  // Date range presets
  type DateRangePreset = "today" | "week" | "month" | "30days" | "90days" | "custom";

  const [dateRangePreset, setDateRangePreset] = React.useState<DateRangePreset>("month");
  const [customDateRange, setCustomDateRange] = React.useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate date range based on preset
  const dateRange = React.useMemo(() => {
    const now = new Date();
    switch (dateRangePreset) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "30days":
        return { start: subDays(now, 30), end: now };
      case "90days":
        return { start: subDays(now, 90), end: now };
      case "custom":
        return customDateRange;
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [dateRangePreset, customDateRange]);

  const [filters, setFilters] = React.useState<{
    accountId?: string;
    categoryId?: string;
    eventId?: string;
    noEvent?: boolean;
  }>({});
  const { transactions, loading } = useTransactions(filters);

  const [edit, setEdit] = React.useState<any | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryKind, setNewCategoryKind] = React.useState<"expense" | "income">("expense");
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);

  const allCategories = React.useMemo(
    () => [...expenseCats, ...incomeCats],
    [expenseCats, incomeCats]
  );
  const eventById = React.useMemo(
    () => new Map((events as any[]).map((e: any) => [e.id, e.name])),
    [events],
  );

  const handleCreateCategory = async () => {
    if (!user || !newCategoryName.trim()) return;
    setIsCreatingCategory(true);
    try {
      await createCategory(user.uid, {
        kind: newCategoryKind,
        name: newCategoryName.trim(),
      });
      toast.success("Category created");
      setNewCategoryName("");
    } catch (e) {
      toast.error("Failed to create category", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!user) return;
    if (!confirm("Delete this category?")) return;
    try {
      await deleteCategory(user.uid, categoryId);
      toast.success("Category deleted");
    } catch (e) {
      toast.error("Failed to delete category", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      kind: "expense",
      amount: 0,
      occurredAt: new Date(),
      note: "",
    },
  });

  const kind = form.watch("kind");
  const categories = kind === "income" ? incomeCats : expenseCats;
  const selectedAccountCurrency = React.useMemo(() => {
    const id = form.getValues("accountId");
    const a = id ? accounts.find((x: any) => x.id === id) : null;
    return a ? formatCurrencyCode(a.currency) : "";
  }, [accounts, form]);

  async function submitEdit(values: CreateValues) {
    if (!user || !edit) return;
    try {
      await editTransaction(user.uid, {
        transactionId: edit.id,
        expectedUpdatedAt: edit.updatedAt,
        amount: values.amount,
        occurredAt: values.occurredAt,
        note: values.note?.trim() ? values.note.trim() : null,
        categoryId: values.kind === "income" || values.kind === "expense" ? values.categoryId : undefined,
        eventId:
          values.kind === "income" || values.kind === "expense"
            ? values.eventId?.trim()
              ? values.eventId.trim()
              : null
            : undefined,
      });
      toast.success("Transaction updated");
      setEdit(null);
    } catch (e) {
      toast.error("Failed to update transaction", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const getTransactionIcon = (txKind: string) => {
    switch (txKind) {
      case "income":
        return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
      case "expense":
        return <ArrowDownRight className="h-4 w-4 text-rose-600" />;
      case "transfer":
        return <ArrowLeftRight className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  // Apply client-side filtering for date range and search
  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions as any[];

    // Apply date range filter
    filtered = filtered.filter((t: any) => {
      if (!t.occurredAt) return false;
      const txnDate = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date(t.occurredAt);
      return txnDate >= dateRange.start && txnDate <= dateRange.end;
    });

    // Apply search filter
    if (debouncedSearch.trim()) {
      const search = debouncedSearch.toLowerCase();
      filtered = filtered.filter((t: any) => {
        const note = (t.note || "").toLowerCase();
        const categoryName = t.categoryId
          ? (allCategories.find((c: any) => c.id === t.categoryId)?.name || "").toLowerCase()
          : "";
        const accountName = t.accountId
          ? (accounts.find((a: any) => a.id === t.accountId)?.name || "").toLowerCase()
          : "";
        return note.includes(search) || categoryName.includes(search) || accountName.includes(search);
      });
    }

    return filtered;
  }, [transactions, dateRange, debouncedSearch, allCategories, accounts]);

  const summaryStats = React.useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let transferCount = 0;
    let missingUsdRate = false;
    let unsupportedCurrency = false;

    const toLkr = (amount: number, currency: string) => {
      const c = formatCurrencyCode(currency);
      if (c === HOME_CURRENCY) return amount;
      if (c === "USD") {
        if (typeof usdToLkr === "number") return amount * usdToLkr;
        missingUsdRate = true;
        return 0;
      }
      unsupportedCurrency = true;
      return 0;
    };

    for (const t of filteredTransactions as any[]) {
      const amt = t.amount ?? 0;
      const cur = t.currency ?? HOME_CURRENCY;
      if (t.kind === "income") {
        totalIncome += toLkr(amt, cur);
        incomeCount++;
      }
      if (t.kind === "expense") {
        totalExpense += toLkr(amt, cur);
        expenseCount++;
      }
      if (t.kind === "transfer") {
        transferCount++;
      }
    }
    return {
      totalIncome,
      totalExpense,
      netChange: totalIncome - totalExpense,
      incomeCount,
      expenseCount,
      transferCount,
      total: filteredTransactions.length,
      missingUsdRate,
      unsupportedCurrency,
    };
  }, [filteredTransactions, usdToLkr]);

  const hasFilters = filters.accountId || filters.categoryId || filters.eventId || filters.noEvent || debouncedSearch.trim() || dateRangePreset !== "month";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage your financial activity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const accountById = new Map(accounts.map((a: any) => [a.id, a.name]));
              const categoryById = new Map(allCategories.map((c: any) => [c.id, c.name]));

              const rows = (filteredTransactions as any[]).map((t) => {
                const occurredAt = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate().toISOString() : "";
                return {
                  id: t.id,
                  kind: t.kind,
                  status: t.status,
                  occurredAt,
                  amount: t.amount,
                  currency: t.currency ?? "",
                  account: t.accountId ? accountById.get(t.accountId) ?? "" : "",
                  category: t.categoryId ? categoryById.get(t.categoryId) ?? "" : "",
                  trip: t.eventId ? eventById.get(t.eventId) ?? "" : "",
                  fromAccount: t.fromAccountId ? accountById.get(t.fromAccountId) ?? "" : "",
                  toAccount: t.toAccountId ? accountById.get(t.toAccountId) ?? "" : "",
                  note: t.note ?? "",
                };
              });

              const csv = toCsv(rows);
              downloadTextFile(`cashly-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
              toast.success("CSV exported");
            }}
            disabled={loading || !(filteredTransactions as any[]).length}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>

          <CreateTransactionDialog />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              +{formatMoney(summaryStats.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.incomeCount} transaction{summaryStats.incomeCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

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
              -{formatMoney(summaryStats.totalExpense)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.expenseCount} transaction{summaryStats.expenseCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Change
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowLeftRight className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summaryStats.netChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {summaryStats.netChange >= 0 ? "+" : ""}{formatMoney(summaryStats.netChange)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.netChange >= 0 ? "Net savings" : "Net loss"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Transfers
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ArrowLeftRight className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.transferCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              between accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Transaction Trends</CardTitle>
              <CardDescription>
                Income vs expenses over time
              </CardDescription>
            </div>

            {/* Date Range Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={dateRangePreset === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRangePreset("today")}
                className="h-8"
              >
                Today
              </Button>
              <Button
                variant={dateRangePreset === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRangePreset("week")}
                className="h-8"
              >
                Week
              </Button>
              <Button
                variant={dateRangePreset === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRangePreset("month")}
                className="h-8"
              >
                Month
              </Button>
              <Button
                variant={dateRangePreset === "30days" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRangePreset("30days")}
                className="hidden sm:flex h-8"
              >
                30 Days
              </Button>
              <Button
                variant={dateRangePreset === "90days" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRangePreset("90days")}
                className="hidden sm:flex h-8"
              >
                90 Days
              </Button>
              <Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateRangePreset === "custom" ? "default" : "outline"}
                    size="sm"
                    className="h-8 gap-1"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateRangePreset === "custom" ? "Custom" : "Custom"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Start Date</Label>
                      <Calendar
                        mode="single"
                        selected={customDateRange.start}
                        onSelect={(date) => {
                          if (date) {
                            setCustomDateRange((prev) => ({ ...prev, start: date }));
                            setDateRangePreset("custom");
                          }
                        }}
                        initialFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">End Date</Label>
                      <Calendar
                        mode="single"
                        selected={customDateRange.end}
                        onSelect={(date) => {
                          if (date) {
                            setCustomDateRange((prev) => ({ ...prev, end: date }));
                            setDateRangePreset("custom");
                          }
                        }}
                        initialFocus
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => setShowCustomDatePicker(false)}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TransactionTrendChart
            transactions={filteredTransactions.map((t: any) => ({
              date: t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date(t.occurredAt),
              amount: t.amount ?? 0,
              kind: t.kind,
              currency: t.currency,
            }))}
            dateRange={dateRange}
          />
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div className="flex gap-3">
        <Input
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  {summaryStats.total} total transaction{summaryStats.total !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Account
              </Label>
              <Select
                value={filters.accountId ?? "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, accountId: v === "all" ? undefined : v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Trip
              </Label>
              <Select
                value={filters.noEvent ? "none" : (filters.eventId ?? "all")}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    eventId: v === "all" || v === "none" ? undefined : v,
                    noEvent: v === "none" ? true : undefined,
                  }))
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trips</SelectItem>
                  <SelectItem value="none">No Trip</SelectItem>
                  {(events as any[])
                    .filter((e: any) => e?.status !== "archived")
                    .map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Category
                </Label>
                <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                      <Settings2 className="h-3 w-3" />
                      Manage
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Manage Categories</DialogTitle>
                      <DialogDescription>
                        Add or remove categories for your transactions
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      {/* Add new category */}
                      <div className="flex gap-2">
                        <Select
                          value={newCategoryKind}
                          onValueChange={(v) => setNewCategoryKind(v as "expense" | "income")}
                        >
                          <SelectTrigger className="w-[110px] h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="income">Income</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Category name..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="h-10 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateCategory();
                            }
                          }}
                        />
                        <Button
                          onClick={handleCreateCategory}
                          disabled={isCreatingCategory || !newCategoryName.trim()}
                          className="h-10"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Category Lists */}
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {/* Expense Categories */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="h-4 w-4 text-rose-600" />
                            <span className="text-sm font-medium">Expenses</span>
                            <Badge variant="secondary" className="text-xs">{expenseCats.length}</Badge>
                          </div>
                          <div className="space-y-1">
                            {expenseCats.length ? (
                              expenseCats.map((c: any) => (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted group"
                                >
                                  <div className="flex items-center gap-2">
                                    <Tag className="h-3.5 w-3.5 text-rose-600" />
                                    <span className="text-sm">{c.name}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteCategory(c.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground py-2">No expense categories</p>
                            )}
                          </div>
                        </div>

                        {/* Income Categories */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            <span className="text-sm font-medium">Income</span>
                            <Badge variant="secondary" className="text-xs">{incomeCats.length}</Badge>
                          </div>
                          <div className="space-y-1">
                            {incomeCats.length ? (
                              incomeCats.map((c: any) => (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted group"
                                >
                                  <div className="flex items-center gap-2">
                                    <Tag className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-sm">{c.name}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteCategory(c.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground py-2">No income categories</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </DialogBody>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setCategoryDialogOpen(false)}>
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <Select
                value={filters.categoryId ?? "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v === "all" ? undefined : v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>

        {/* Mobile Card View */}
        <div className="md:hidden">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              Loading transactions…
            </div>
          ) : filteredTransactions.length ? (
            <div className="divide-y">
              {(filteredTransactions as any[]).map((t) => {
                const occurredAt = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date();
                const accountName = t.accountId ? accounts.find((a: any) => a.id === t.accountId)?.name : null;
                const categoryName = t.categoryId
                  ? allCategories.find((c: any) => c.id === t.categoryId)?.name
                  : null;
                const eventName = t.eventId ? eventById.get(t.eventId) ?? null : null;
                const fromAccountName = t.fromAccountId
                  ? accounts.find((a: any) => a.id === t.fromAccountId)?.name
                  : null;
                const toAccountName = t.toAccountId
                  ? accounts.find((a: any) => a.id === t.toAccountId)?.name
                  : null;

                return (
                  <div key={t.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Icon, Details, Meta */}
                      <div className="flex gap-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${t.kind === "income"
                            ? "bg-emerald-500/10"
                            : t.kind === "expense"
                              ? "bg-rose-500/10"
                              : "bg-blue-500/10"
                          }`}>
                          {getTransactionIcon(t.kind)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {t.note ? (
                                <div className="font-semibold truncate">{t.note}</div>
                              ) : (
                                <div className="font-semibold capitalize text-muted-foreground">{t.kind}</div>
                              )}
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {t.kind === "transfer" ? (
                                  <span>{fromAccountName} → {toAccountName}</span>
                                ) : (
                                  <span>
                                    {accountName}
                                    {categoryName && <span> · {categoryName}</span>}
                                    {eventName && <span> · {eventName}</span>}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground/70 mt-1">
                                {format(occurredAt, "MMM d, yyyy")}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-start gap-2 shrink-0">
                        <div className="text-right">
                          <div className={`font-bold tabular-nums text-base ${t.kind === "income"
                              ? "text-emerald-600"
                              : t.kind === "expense"
                                ? "text-rose-600"
                                : ""
                            }`}>
                            {t.kind === "expense" ? "-" : t.kind === "income" ? "+" : ""}
                            {formatMoney(t.amount ?? 0)}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEdit(t);
                                form.reset({
                                  kind: t.kind,
                                  amount: t.amount ?? 0,
                                  occurredAt,
                                  note: t.note ?? "",
                                  accountId: t.accountId,
                                  categoryId: t.categoryId,
                                  eventId: t.eventId,
                                  fromAccountId: t.fromAccountId,
                                  toAccountId: t.toAccountId,
                                });
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                if (!user) return;
                                if (!confirm("Delete this transaction?")) return;
                                try {
                                  await deleteTransaction(user.uid, t.id, t.updatedAt);
                                  toast.success("Transaction deleted");
                                } catch (e) {
                                  toast.error("Failed to delete", {
                                    description: e instanceof Error ? e.message : undefined,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 px-4">
              <div className="flex flex-col items-center gap-3 max-w-sm mx-auto text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Receipt className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No transactions found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasFilters ? "Try clearing your filters" : "Add your first transaction"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="border-t hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6 w-[120px]">Date</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right w-[160px] pr-4">Amount</TableHead>
                <TableHead className="w-[60px] pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Loading transactions…
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.length ? (
                (filteredTransactions as any[]).map((t) => {
                  const occurredAt = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date();

                  const accountName = t.accountId ? accounts.find((a: any) => a.id === t.accountId)?.name : null;
                  const categoryName = t.categoryId
                    ? allCategories.find((c: any) => c.id === t.categoryId)?.name
                    : null;
                  const eventName = t.eventId ? eventById.get(t.eventId) ?? null : null;
                  const fromAccountName = t.fromAccountId
                    ? accounts.find((a: any) => a.id === t.fromAccountId)?.name
                    : null;
                  const toAccountName = t.toAccountId
                    ? accounts.find((a: any) => a.id === t.toAccountId)?.name
                    : null;

                  return (
                    <TableRow key={t.id} className="group">
                      <TableCell className="pl-6">
                        <div className="font-medium">{format(occurredAt, "MMM d")}</div>
                        <div className="text-xs text-muted-foreground">{format(occurredAt, "yyyy")}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.kind === "income"
                            ? "bg-emerald-500/10"
                            : t.kind === "expense"
                              ? "bg-rose-500/10"
                              : "bg-blue-500/10"
                            }`}>
                            {getTransactionIcon(t.kind)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {t.note ? (
                            <div className="font-medium truncate max-w-[200px]">{t.note}</div>
                          ) : (
                            <div className="font-medium capitalize text-muted-foreground">{t.kind}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {t.kind === "transfer" ? (
                              <span>{fromAccountName} → {toAccountName}</span>
                            ) : (
                              <span>
                                {accountName}
                                {categoryName && <span> · {categoryName}</span>}
                                {eventName && <span> · {eventName}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold tabular-nums ${t.kind === "income"
                          ? "text-emerald-600"
                          : t.kind === "expense"
                            ? "text-rose-600"
                            : ""
                          }`}>
                          {t.kind === "expense" ? "-" : t.kind === "income" ? "+" : ""}
                          {formatMoney(t.amount ?? 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEdit(t);
                                form.reset({
                                  kind: t.kind,
                                  amount: t.amount ?? 0,
                                  occurredAt,
                                  note: t.note ?? "",
                                  accountId: t.accountId,
                                  categoryId: t.categoryId,
                                  eventId: t.eventId,
                                  fromAccountId: t.fromAccountId,
                                  toAccountId: t.toAccountId,
                                });
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                if (!user) return;
                                if (!confirm("Delete this transaction?")) return;
                                try {
                                  await deleteTransaction(user.uid, t.id, t.updatedAt);
                                  toast.success("Transaction deleted");
                                } catch (e) {
                                  toast.error("Failed to delete", {
                                    description: e instanceof Error ? e.message : undefined,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Receipt className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">No transactions found</p>
                        <p className="text-sm text-muted-foreground">
                          {hasFilters ? "Try clearing your filters" : "Add your first transaction"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update transaction details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => submitEdit(v))}>
            <DialogBody className="space-y-5">
              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Amount
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="h-11 text-lg font-semibold"
                  {...form.register("amount", { valueAsNumber: true })}
                />
              </div>

              {/* Category (for non-transfers) */}
              {form.watch("kind") !== "transfer" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Category
                    </Label>
                    <Select
                      value={form.watch("categoryId") ?? ""}
                      onValueChange={(v) =>
                        form.setValue("categoryId", v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Trip <span className="normal-case font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={form.watch("eventId") ?? "none"}
                      onValueChange={(v) =>
                        form.setValue("eventId", v === "none" ? undefined : v, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="No trip" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No trip</SelectItem>
                        {(events as any[])
                          .filter((e: any) => e?.status !== "archived")
                          .map((e: any) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Note */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Note <span className="normal-case font-normal">(optional)</span>
                </Label>
                <Input
                  placeholder="Add a description..."
                  className="h-11"
                  {...form.register("note")}
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting} className="min-w-24">
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
