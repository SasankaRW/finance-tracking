"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { differenceInDays, format, isPast, isToday, isTomorrow } from "date-fns";
import { toast } from "sonner";
import { Timestamp } from "firebase/firestore";
import {
  Banknote,
  CalendarIcon,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts, useCategories, useSalaryProfiles } from "@/lib/finance/hooks";
import {
  createSalaryProfile,
  deleteSalaryProfile,
  recordSalaryPayment,
  setSalaryProfileStatus,
  updateSalaryProfile,
} from "@/lib/finance/salary-mutations";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { COMMON_CURRENCIES, HOME_CURRENCY } from "@/shared/currency";
import { Badge } from "@/components/ui/badge";
import { SettingsStatTile } from "@/app/app/settings/settings-stat-tile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const salarySchema = z.object({
  employerName: z.string().min(1).max(64),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  depositMode: z.enum(["keep_salary_currency", "convert_to_account_currency"]),
  nextPaydayAt: z.date(),
});

type SalaryValues = z.infer<typeof salarySchema>;

const editSalarySchema = salarySchema.extend({
  salaryProfileId: z.string().min(1),
  status: z.enum(["active", "paused"]),
});

type EditSalaryValues = z.infer<typeof editSalarySchema>;

function getPaydayInfo(date: Date) {
  if (isToday(date)) {
    return { label: "Payday today", variant: "default" as const, icon: CheckCircle2 };
  }
  if (isTomorrow(date)) {
    return { label: "Tomorrow", variant: "secondary" as const, icon: Clock };
  }
  if (isPast(date)) {
    const days = differenceInDays(new Date(), date);
    return { label: `${days}d overdue`, variant: "destructive" as const, icon: Clock };
  }

  const days = differenceInDays(date, new Date());
  if (days <= 7) {
    return { label: `In ${days}d`, variant: "secondary" as const, icon: Clock };
  }

  return { label: format(date, "MMM d"), variant: "outline" as const, icon: CalendarIcon };
}

function estimateDepositAmount(
  amount: number,
  salaryCurrency: string,
  accountCurrency: string,
  usdToLkr: number | null,
) {
  const source = formatCurrencyCode(salaryCurrency);
  const target = formatCurrencyCode(accountCurrency);
  if (source === target) return amount;
  if (source === "USD" && target === HOME_CURRENCY && typeof usdToLkr === "number") {
    return Math.round(amount * usdToLkr * 100) / 100;
  }
  return null;
}

function SalaryFormFields({
  form,
  accounts,
  incomeCats,
  usdToLkr,
}: {
  form: any;
  accounts: any[];
  incomeCats: any[];
  usdToLkr: number | null;
}) {
  const accountId = form.watch("accountId");
  const selectedAccount = accounts.find((a: any) => a.id === accountId);
  const amount = Number(form.watch("amount") ?? 0);
  const salaryCurrency = formatCurrencyCode(form.watch("currency"));
  const accountCurrency = formatCurrencyCode(selectedAccount?.currency);
  const depositMode = form.watch("depositMode") ?? "convert_to_account_currency";
  const estimatedDeposit = selectedAccount
    ? estimateDepositAmount(amount, salaryCurrency, accountCurrency, usdToLkr)
    : null;
  const currentHomeValue = estimateDepositAmount(amount, salaryCurrency, HOME_CURRENCY, usdToLkr);

  return (
    <DialogBody className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
          Salary Source
        </Label>
        <Input
          placeholder="e.g., Main job, Freelance retainer"
          className="h-11"
          {...form.register("employerName")}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Amount
          </Label>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            className="h-12 text-lg font-semibold"
            {...form.register("amount", { valueAsNumber: true })}
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
            <SelectTrigger className="h-12">
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Deposit Account
          </Label>
          <Select
            value={accountId ?? ""}
            onValueChange={(v) => {
              form.setValue("accountId", v, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Income Category
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
              {incomeCats.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
          Deposit Option
        </Label>
        <Select
          value={depositMode}
          onValueChange={(v) =>
            form.setValue("depositMode", v, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keep_salary_currency">
              Keep salary in {salaryCurrency}
            </SelectItem>
            <SelectItem value="convert_to_account_currency">
              Convert to {accountCurrency} on payday
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedAccount && (
        <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {depositMode === "keep_salary_currency" ? (
            <p>
              Keeps the salary as {salaryCurrency}. Its LKR value changes with the current exchange rate.
            </p>
          ) : (
            <p>
              Converts {salaryCurrency} to {accountCurrency} on payday and saves that fixed deposit amount.
            </p>
          )}
          {depositMode === "keep_salary_currency" && salaryCurrency !== accountCurrency && (
            <p className="font-medium text-destructive">
              Choose a {salaryCurrency} account to keep the salary in {salaryCurrency}.
            </p>
          )}
          {depositMode === "keep_salary_currency" && salaryCurrency !== HOME_CURRENCY && currentHomeValue !== null && (
            <p className="font-medium text-foreground">
              Current LKR value: {formatMoney(amount, salaryCurrency)} = {formatMoney(currentHomeValue, HOME_CURRENCY)}
              {salaryCurrency === "USD" && usdToLkr
                ? ` at 1 USD = ${usdToLkr.toFixed(2)} ${HOME_CURRENCY}`
                : ""}
            </p>
          )}
          {depositMode === "convert_to_account_currency" && salaryCurrency !== accountCurrency && estimatedDeposit !== null && (
            <p className="font-medium text-foreground">
              Payday estimate: {formatMoney(amount, salaryCurrency)} = {formatMoney(estimatedDeposit, accountCurrency)}
              {salaryCurrency === "USD" && accountCurrency === HOME_CURRENCY && usdToLkr
                ? ` at 1 USD = ${usdToLkr.toFixed(2)} ${HOME_CURRENCY}`
                : ""}
            </p>
          )}
          {salaryCurrency !== accountCurrency && estimatedDeposit === null && currentHomeValue === null && (
            <p>
              Live conversion is currently supported for USD to {HOME_CURRENCY}.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
          Next Payday
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start h-11 font-normal">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {format(form.watch("nextPaydayAt"), "EEEE, MMMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto" align="start">
            <Calendar
              mode="single"
              selected={form.watch("nextPaydayAt")}
              onSelect={(d) =>
                d &&
                form.setValue("nextPaydayAt", d, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </DialogBody>
  );
}

export function SalaryPanel() {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { categories: incomeCats } = useCategories("income");
  const { salaryProfiles, loading, error } = useSalaryProfiles();
  const { data: fxUsd } = useFxRates("USD", [HOME_CURRENCY]);
  const usdToLkr = fxUsd?.rates?.[HOME_CURRENCY] ?? null;
  const [createOpen, setCreateOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<any | null>(null);

  const salaryCategory = React.useMemo(
    () => incomeCats.find((c: any) => c.name?.toLowerCase() === "salary") ?? incomeCats[0],
    [incomeCats],
  );
  const firstAccount = accounts[0];
  const firstCurrency = formatCurrencyCode(firstAccount?.currency);

  const createForm = useForm<SalaryValues>({
    resolver: zodResolver(salarySchema),
    defaultValues: {
      employerName: "",
      amount: 0,
      currency: firstCurrency,
      accountId: "",
      categoryId: "",
      depositMode: "convert_to_account_currency",
      nextPaydayAt: new Date(),
    },
  });

  const editForm = useForm<EditSalaryValues>({
    resolver: zodResolver(editSalarySchema),
    defaultValues: {
      salaryProfileId: "",
      employerName: "",
      amount: 0,
      currency: firstCurrency,
      accountId: "",
      categoryId: "",
      depositMode: "convert_to_account_currency",
      nextPaydayAt: new Date(),
      status: "active",
    },
  });

  React.useEffect(() => {
    if (!createOpen) return;
    if (!createForm.getValues("accountId") && firstAccount?.id) {
      createForm.setValue("accountId", firstAccount.id);
    }
    if (!createForm.getValues("categoryId") && salaryCategory?.id) {
      createForm.setValue("categoryId", salaryCategory.id);
    }
  }, [createOpen, createForm, firstAccount, salaryCategory]);

  const accountById = React.useMemo(
    () => new Map(accounts.map((a: any) => [a.id, a])),
    [accounts],
  );
  const categoryById = React.useMemo(
    () => new Map(incomeCats.map((c: any) => [c.id, c])),
    [incomeCats],
  );

  const stats = React.useMemo(() => {
    let active = 0;
    let paused = 0;
    let monthly = 0;
    let dueSoon = 0;
    let unsupportedConversions = 0;
    const now = new Date();

    for (const salary of salaryProfiles as any[]) {
      if (salary.status === "active") {
        active++;
        const sourceCurrency = formatCurrencyCode(salary.currency);
        const estimated = estimateDepositAmount(
          salary.amount ?? 0,
          sourceCurrency,
          HOME_CURRENCY,
          usdToLkr,
        );
        if (estimated !== null) {
          monthly += estimated;
        } else {
          unsupportedConversions++;
        }
        const nextPayday =
          salary.nextPaydayAt instanceof Timestamp ? salary.nextPaydayAt.toDate() : now;
        const days = differenceInDays(nextPayday, now);
        if (days <= 7) dueSoon++;
      } else {
        paused++;
      }
    }

    return { active, paused, monthly, dueSoon, unsupportedConversions };
  }, [salaryProfiles, usdToLkr]);

  const submitCreate = createForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createSalaryProfile(user.uid, values);
      toast.success("Salary source added");
      setCreateOpen(false);
      createForm.reset({
        employerName: "",
        amount: 0,
        currency: firstCurrency,
        accountId: firstAccount?.id ?? "",
        categoryId: salaryCategory?.id ?? "",
        depositMode: "convert_to_account_currency",
        nextPaydayAt: new Date(),
      });
    } catch (e) {
      toast.error("Failed to add salary", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  const submitEdit = editForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await updateSalaryProfile(user.uid, values);
      toast.success("Salary updated");
      setEdit(null);
    } catch (e) {
      toast.error("Failed to update salary", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Salary
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Salary Source</DialogTitle>
              <DialogDescription>
                Add your monthly salary or recurring income.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitCreate}>
              <SalaryFormFields
                form={createForm}
                accounts={accounts}
                incomeCats={incomeCats}
                usdToLkr={usdToLkr}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createForm.formState.isSubmitting} className="min-w-24">
                  {createForm.formState.isSubmitting ? "Adding..." : "Add"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <SettingsStatTile
          label="Est. Monthly Deposit"
          highlighted
          icon={Banknote}
          iconWrapClassName="bg-primary/10"
          iconClassName="text-primary"
          value={formatMoney(stats.monthly, HOME_CURRENCY)}
          sub={`using today's USD rate${stats.unsupportedConversions ? " where available" : ""}`}
        />
        <SettingsStatTile
          label="Active"
          icon={CheckCircle2}
          iconWrapClassName="bg-emerald-500/10"
          iconClassName="text-emerald-600"
          value={stats.active}
          sub="salary sources"
        />
        <SettingsStatTile
          label="Due Soon"
          icon={Clock}
          iconWrapClassName="bg-amber-500/10"
          iconClassName="text-amber-600"
          value={stats.dueSoon}
          sub="within 7 days or overdue"
        />
        <SettingsStatTile
          label="Paused"
          icon={Pause}
          iconWrapClassName="bg-muted"
          iconClassName="text-muted-foreground"
          value={stats.paused}
          sub="not counted in monthly salary"
        />
      </div>

      <Card className="surface-tonal">
        <CardHeader>
          <CardTitle>Salary Sources</CardTitle>
          <CardDescription>
            Record salary when you get paid. It creates an income transaction automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading salary sources...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-destructive">
              Failed to load salaries{error?.message ? `: ${error.message}` : ""}
            </div>
          ) : salaryProfiles.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {(salaryProfiles as any[]).map((salary) => {
                const account = accountById.get(salary.accountId);
                const category = categoryById.get(salary.categoryId);
                const currency = formatCurrencyCode(salary.currency ?? account?.currency);
                const accountCurrency = formatCurrencyCode(account?.currency);
                const depositMode =
                  salary.depositMode === "keep_salary_currency"
                    ? "keep_salary_currency"
                    : "convert_to_account_currency";
                const estimatedDeposit = estimateDepositAmount(
                  salary.amount ?? 0,
                  currency,
                  accountCurrency,
                  usdToLkr,
                );
                const currentHomeValue = estimateDepositAmount(
                  salary.amount ?? 0,
                  currency,
                  HOME_CURRENCY,
                  usdToLkr,
                );
                const nextPayday =
                  salary.nextPaydayAt instanceof Timestamp ? salary.nextPaydayAt.toDate() : new Date();
                const lastPaid =
                  salary.lastPaidAt instanceof Timestamp ? salary.lastPaidAt.toDate() : null;
                const paydayInfo = getPaydayInfo(nextPayday);
                const PayIcon = paydayInfo.icon;
                const isPaused = salary.status === "paused";
                const keepModeNeedsMatchingAccount =
                  depositMode === "keep_salary_currency" && currency !== accountCurrency;

                return (
                  <div
                    key={salary.id}
                    className={`motion-expressive press-expressive rounded-3xl border bg-card/80 p-4 shadow-sm ${isPaused ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10">
                          <Wallet className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold">{salary.employerName}</h3>
                            <Badge variant={isPaused ? "secondary" : "default"} className="capitalize">
                              {salary.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {account?.name ?? "No account"} · {category?.name ?? "No category"} · {depositMode === "keep_salary_currency" ? "Keeps currency" : "Converts on payday"}
                          </p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEdit(salary);
                              editForm.reset({
                                salaryProfileId: salary.id,
                                employerName: salary.employerName ?? "",
                                amount: salary.amount ?? 0,
                                currency,
                                accountId: salary.accountId ?? "",
                                categoryId: salary.categoryId ?? "",
                                depositMode,
                                nextPaydayAt: nextPayday,
                                status: isPaused ? "paused" : "active",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              if (!user) return;
                              const nextStatus = isPaused ? "active" : "paused";
                              try {
                                await setSalaryProfileStatus(user.uid, salary.id, nextStatus);
                                toast.success(nextStatus === "active" ? "Salary resumed" : "Salary paused");
                              } catch (e) {
                                toast.error("Failed to update salary", {
                                  description: e instanceof Error ? e.message : undefined,
                                });
                              }
                            }}
                          >
                            {isPaused ? (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Resume
                              </>
                            ) : (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              if (!user) return;
                              if (!confirm("Delete this salary source?")) return;
                              try {
                                await deleteSalaryProfile(user.uid, salary.id);
                                toast.success("Salary deleted");
                              } catch (e) {
                                toast.error("Failed to delete salary", {
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

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="mt-1 text-lg font-bold tabular-nums">
                          {formatMoney(salary.amount ?? 0, currency)}
                        </p>
                      </div>
                      {depositMode === "convert_to_account_currency" && currency !== accountCurrency && (
                        <div className="rounded-2xl bg-emerald-500/10 p-3">
                          <p className="text-xs text-muted-foreground">Today&apos;s Deposit</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            {estimatedDeposit !== null
                              ? formatMoney(estimatedDeposit, accountCurrency)
                              : "Rate unavailable"}
                          </p>
                          {currency === "USD" && accountCurrency === HOME_CURRENCY && usdToLkr && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              1 USD = {usdToLkr.toFixed(2)} {HOME_CURRENCY}
                            </p>
                          )}
                        </div>
                      )}
                      {depositMode === "keep_salary_currency" && currency !== HOME_CURRENCY && (
                        <div className="rounded-2xl bg-blue-500/10 p-3">
                          <p className="text-xs text-muted-foreground">Current LKR Value</p>
                          <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-400">
                            {currentHomeValue !== null
                              ? formatMoney(currentHomeValue, HOME_CURRENCY)
                              : "Rate unavailable"}
                          </p>
                          {currency === "USD" && usdToLkr && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              1 USD = {usdToLkr.toFixed(2)} {HOME_CURRENCY}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="rounded-2xl bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Next Payday</p>
                        <Badge variant={paydayInfo.variant} className="mt-2 gap-1">
                          <PayIcon className="h-3 w-3" />
                          {paydayInfo.label}
                        </Badge>
                      </div>
                      <div className="rounded-2xl bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Last Paid</p>
                        <p className="mt-1 text-sm font-medium">
                          {lastPaid ? format(lastPaid, "MMM d, yyyy") : "Not recorded"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {keepModeNeedsMatchingAccount
                          ? `Choose a ${currency} account before recording this salary.`
                          : depositMode === "keep_salary_currency"
                            ? `Records in ${currency}; LKR value follows the current rate.`
                            : `Records a fixed ${accountCurrency} transaction at the rate on deposit day.`}
                      </p>
                      <Button
                        disabled={isPaused || keepModeNeedsMatchingAccount}
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          if (!user) return;
                          try {
                            await recordSalaryPayment(user.uid, salary.id);
                            toast.success("Salary recorded", {
                              description:
                                depositMode === "convert_to_account_currency" && currency !== accountCurrency
                                  ? "Converted using today's exchange rate and saved as a fixed deposit."
                                  : undefined,
                            });
                          } catch (e) {
                            toast.error("Failed to record salary", {
                              description: e instanceof Error ? e.message : undefined,
                            });
                          }
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Record Salary
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Banknote className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No salary added yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add your salary once, then record it each payday without filling the transaction form.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Salary
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Salary</DialogTitle>
            <DialogDescription>
              Update amount, account, status, or next payday.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit}>
            <SalaryFormFields
              form={editForm}
              accounts={accounts}
              incomeCats={incomeCats}
              usdToLkr={usdToLkr}
            />
            <DialogBody className="pt-0">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Status
                </Label>
                <Select
                  value={editForm.watch("status")}
                  onValueChange={(v) =>
                    editForm.setValue("status", v as "active" | "paused", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting} className="min-w-24">
                {editForm.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
