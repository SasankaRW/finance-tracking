"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths } from "date-fns";
import { toast } from "sonner";
import {
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
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
  Search,
  MailPlus,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";
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
import { transactionFormSchema, type TransactionFormValues } from "@/lib/finance/transaction-form-schema";
import { COMMON_CURRENCIES, HOME_CURRENCY } from "@/shared/currency";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { PendingImportsPanel } from "@/components/pending-imports-panel";
import { PasteMessageDialog } from "@/components/paste-message-dialog";
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
import { Badge } from "@/components/ui/badge";
import { TransactionTrendChart } from "@/components/transaction-trend-chart";

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { accounts } = useAccounts();
  const { categories: expenseCats } = useCategories("expense");
  const { categories: incomeCats } = useCategories("income");
  const { events } = useEvents();
  const { data: fxUsd } = useFxRates("USD", [HOME_CURRENCY]);
  const usdToLkr = fxUsd?.rates?.[HOME_CURRENCY] ?? null;

  // Date range presets
  type DateRangePreset = "today" | "week" | "month" | "30days" | "90days" | "year" | "custom";

  const [dateRangePreset, setDateRangePreset] = React.useState<DateRangePreset>("month");
  const [customDateRange, setCustomDateRange] = React.useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const shouldOpenQuickAdd =
    searchParams.get("quickAdd") === "transaction" || searchParams.get("add") === "transaction";
  const quickAddSignal = searchParams.get("quickAddAt") ?? searchParams.toString();
  const quickAddKindParam = searchParams.get("kind");
  const quickAddKind =
    quickAddKindParam === "income" || quickAddKindParam === "transfer"
      ? quickAddKindParam
      : "expense";
  const [showCustomDatePicker, setShowCustomDatePicker] = React.useState(false);
  const handleCustomRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) return;
    setCustomDateRange({ start: range.from, end: range.to ?? range.from });
    setDateRangePreset("custom");
  };
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
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
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
    if (!(await confirm({ title: "Delete this category?", destructive: true }))) return;
    try {
      await deleteCategory(user.uid, categoryId);
      toast.success("Category deleted");
    } catch (e) {
      toast.error("Failed to delete category", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
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

  async function submitEdit(values: TransactionFormValues) {
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Transactions</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Track and manage your financial activity
          </p>
        </div>

        <div className="grid grid-cols-[auto_auto_1fr] items-center gap-2 sm:flex">
          <PasteMessageDialog
            trigger={
              <Button variant="outline" size="sm" className="h-10 rounded-xl px-3">
                <MailPlus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Add from message</span>
              </Button>
            }
          />

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
            className="h-10 rounded-xl px-3"
          >
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <CreateTransactionDialog
            openOnMount={shouldOpenQuickAdd}
            openSignal={quickAddSignal}
            defaultKind={quickAddKind}
          />
        </div>
      </div>

      <PendingImportsPanel />

      <div className="scrollbar-hide -mx-3 flex gap-2 overflow-x-auto px-3 sm:hidden">
        {([
          ["today", "Today"],
          ["week", "Week"],
          ["month", "Month"],
          ["30days", "30D"],
          ["year", "Year"],
        ] as const).map(([preset, label]) => (
          <Button
            key={preset}
            variant={dateRangePreset === preset ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRangePreset(preset)}
            className="h-9 shrink-0 rounded-full px-4"
          >
            {label}
          </Button>
        ))}
        <Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
          <PopoverTrigger asChild>
            <Button
              variant={dateRangePreset === "custom" ? "default" : "outline"}
              size="sm"
              className="h-9 shrink-0 rounded-full px-4"
            >
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              Custom
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-3">
              <Label className="text-xs">Select a date range</Label>
              <Calendar
                mode="range"
                selected={{ from: customDateRange.start, to: customDateRange.end }}
                onSelect={handleCustomRangeSelect}
                initialFocus
              />
              <p className="text-center text-xs text-muted-foreground">
                {format(customDateRange.start, "MMM d, yyyy")} – {format(customDateRange.end, "MMM d, yyyy")}
              </p>
              <Button size="sm" className="w-full" onClick={() => setShowCustomDatePicker(false)}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-[2rem] bg-card shadow-sm sm:grid-cols-4 sm:divide-y-0">
        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            Income
          </div>
          <p className="mt-2 truncate font-display text-lg font-bold tabular-nums text-emerald-600 sm:text-2xl">
            +{formatMoney(summaryStats.totalIncome)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {summaryStats.incomeCount} transaction{summaryStats.incomeCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
            Expenses
          </div>
          <p className="mt-2 truncate font-display text-lg font-bold tabular-nums text-rose-600 sm:text-2xl">
            -{formatMoney(summaryStats.totalExpense)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {summaryStats.expenseCount} transaction{summaryStats.expenseCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
            Net
          </div>
          <p className={`mt-2 truncate font-display text-lg font-bold tabular-nums sm:text-2xl ${summaryStats.netChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {summaryStats.netChange >= 0 ? "+" : ""}{formatMoney(summaryStats.netChange)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {summaryStats.netChange >= 0 ? "Net savings" : "Net loss"}
          </p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <ArrowLeftRight className="h-3.5 w-3.5 text-blue-600" />
            Transfers
          </div>
          <p className="mt-2 font-display text-lg font-bold tabular-nums sm:text-2xl">{summaryStats.transferCount}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">between accounts</p>
        </div>
      </div>

      {/* Trend Chart */}
      <Card className="surface-tonal expressive-card gap-0 py-0">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Transaction Trends</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Income vs expenses over time
              </CardDescription>
            </div>

            {/* Date Range Filters */}
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
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
              <Button
                variant={dateRangePreset === "year" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRangePreset("year")}
                className="h-8"
              >
                Year
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
                  <div className="space-y-3">
                    <Label className="text-xs">Select a date range</Label>
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={{ from: customDateRange.start, to: customDateRange.end }}
                      onSelect={handleCustomRangeSelect}
                      initialFocus
                    />
                    <p className="text-center text-xs text-muted-foreground">
                      {format(customDateRange.start, "MMM d, yyyy")} – {format(customDateRange.end, "MMM d, yyyy")}
                    </p>
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
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <TransactionTrendChart
            transactions={filteredTransactions.map((t: any) => ({
              date: t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date(t.occurredAt),
              amount: t.amount ?? 0,
              kind: t.kind,
              currency: t.currency,
            }))}
            dateRange={dateRange}
            showSummary={false}
          />
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div className="relative flex gap-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 rounded-full border-0 bg-card pl-11 pr-5 shadow-sm sm:max-w-md"
        />
      </div>

      {/* Transactions Table */}
      <Card className="surface-tonal gap-0 overflow-hidden py-0">
        <CardHeader className="p-4 pb-3 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">History</CardTitle>
              <CardDescription>
                {summaryStats.total} total transaction{summaryStats.total !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => {
                setFilters({});
                setSearchQuery("");
                setDateRangePreset("month");
              }} className="h-8 shrink-0 px-2 text-xs">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Account
              </Label>
              <Select
                value={filters.accountId ?? "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, accountId: v === "all" ? undefined : v }))}
              >
                <SelectTrigger className="h-10 rounded-xl px-3">
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
                <SelectTrigger className="h-10 rounded-xl px-3">
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

            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Category
                </Label>
                <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs">
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
                <SelectTrigger className="h-10 rounded-xl px-3">
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
        <div className="px-4 pb-4 md:hidden">
          {loading ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
              Loading transactions…
            </div>
          ) : filteredTransactions.length ? (
            <ul className="overflow-hidden rounded-[2rem] bg-card shadow-sm">
              {(filteredTransactions as any[]).map((t, idx) => {
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
                  <li
                    key={t.id}
                    className={`motion-expressive flex items-center justify-between gap-3 px-4 py-3.5 transition-colors active:bg-muted/50 ${
                      idx > 0 ? "border-t border-border/60" : ""
                    }`}
                  >
                    {/* Left: Icon, Details, Meta */}
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${t.kind === "income"
                          ? "bg-emerald-500/10"
                          : t.kind === "expense"
                            ? "bg-rose-500/10"
                            : "bg-blue-500/10"
                        }`}>
                        {getTransactionIcon(t.kind)}
                      </div>

                      <div className="min-w-0 flex-1">
                        {t.note ? (
                          <div className="truncate text-sm font-semibold">{t.note}</div>
                        ) : (
                          <div className="text-sm font-semibold capitalize text-muted-foreground">{t.kind}</div>
                        )}
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
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
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {format(occurredAt, "MMM d, HH:mm")}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <div className={`shrink-0 whitespace-nowrap text-sm font-bold tabular-nums ${t.kind === "income"
                          ? "text-emerald-600"
                          : t.kind === "expense"
                            ? "text-rose-600"
                            : ""
                        }`}>
                        {t.kind === "expense" ? "-" : t.kind === "income" ? "+" : ""}
                        {formatMoney(t.amount ?? 0)}
                      </div>

                      <RowActionsMenu
                        ariaLabel={`${t.note || t.kind} actions`}
                        triggerClassName="rounded-full p-0 text-muted-foreground"
                        actions={[
                          {
                            label: "Edit",
                            icon: Pencil,
                            onClick: () => {
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
                            },
                          },
                          {
                            label: "Delete",
                            icon: Trash2,
                            destructive: true,
                            onClick: async () => {
                              if (!user) return;
                              if (!(await confirm({ title: "Delete this transaction?", destructive: true }))) return;
                              try {
                                await deleteTransaction(user.uid, t.id, t.updatedAt);
                                toast.success("Transaction deleted");
                              } catch (e) {
                                toast.error("Failed to delete", {
                                  description: e instanceof Error ? e.message : undefined,
                                });
                              }
                            },
                          },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-[2rem] border border-dashed px-4 py-12">
              <div className="flex flex-col items-center gap-3 max-w-sm mx-auto text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Receipt className="h-6 w-6 text-muted-foreground" />
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
                          <div className={`h-8 w-8 rounded-2xl flex items-center justify-center ${t.kind === "income"
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
                        <RowActionsMenu
                          ariaLabel={`${t.note || t.kind} actions`}
                          triggerClassName="h-8 w-8 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100"
                          actions={[
                            {
                              label: "Edit",
                              icon: Pencil,
                              onClick: () => {
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
                              },
                            },
                            {
                              label: "Delete",
                              icon: Trash2,
                              destructive: true,
                              onClick: async () => {
                                if (!user) return;
                                if (!(await confirm({ title: "Delete this transaction?", destructive: true }))) return;
                                try {
                                  await deleteTransaction(user.uid, t.id, t.updatedAt);
                                  toast.success("Transaction deleted");
                                } catch (e) {
                                  toast.error("Failed to delete", {
                                    description: e instanceof Error ? e.message : undefined,
                                  });
                                }
                              },
                            },
                          ]}
                        />
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
