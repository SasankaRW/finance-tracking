"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon,
  Plus,
  StickyNote,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts, useCategories, useEvents } from "@/lib/finance/hooks";
import { createIncomeOrExpense, createTransfer } from "@/lib/finance/mutations";
import { transactionFormSchema, type TransactionFormValues } from "@/lib/finance/transaction-form-schema";
import { getCurrencySymbol, formatMoney, formatCurrencyCode } from "@/lib/format";
import {
  AccountSelect,
  CategorySelect,
  round2,
  transactionTypes,
} from "@/app/app/transactions/transaction-form-fields";
import { useFxRates } from "@/lib/fx/use-fx-rates";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY } from "@/shared/currency";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Numpad,
  appendNumpadDigit,
  backspaceNumpad,
} from "@/components/numpad";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export function CreateTransactionDialog({
  triggerLabel = "Add Transaction",
  defaultEventId,
  defaultKind = "expense",
  trigger,
  openOnMount = false,
  openSignal,
}: {
  triggerLabel?: string;
  defaultEventId?: string;
  defaultKind?: TransactionFormValues["kind"];
  trigger?: React.ReactNode;
  openOnMount?: boolean;
  openSignal?: string | null;
}) {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { categories: expenseCats } = useCategories("expense");
  const { categories: incomeCats } = useCategories("income");
  const { events } = useEvents();
  const isMobile = !useMediaQuery("(min-width: 640px)");

  const [open, setOpen] = React.useState(false);
  const [amountText, setAmountText] = React.useState("");
  const [currency, setCurrency] = React.useState<string>(DEFAULT_CURRENCY);

  React.useEffect(() => {
    if (openOnMount) setOpen(true);
  }, [openOnMount, openSignal]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      kind: defaultKind,
      occurredAt: new Date(),
      note: "",
      ...(defaultEventId ? { eventId: defaultEventId } : {}),
    },
  });

  React.useEffect(() => {
    form.setValue("kind", defaultKind, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [defaultKind, form]);

  React.useEffect(() => {
    if (!open) {
      setAmountText("");
      return;
    }
    if (accounts.length && !form.getValues("accountId")) {
      form.setValue("accountId", (accounts[0] as any).id, { shouldValidate: true });
    }
    if (accounts.length >= 2 && !form.getValues("fromAccountId")) {
      form.setValue("fromAccountId", (accounts[0] as any).id);
      form.setValue("toAccountId", (accounts[1] as any)?.id ?? (accounts[0] as any).id);
    }
  }, [open, accounts, form]);

  React.useEffect(() => {
    const parsed = amountText ? Number.parseFloat(amountText) : Number.NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      form.setValue("amount", parsed, { shouldValidate: true, shouldDirty: true });
    } else {
      form.setValue("amount", Number.NaN, { shouldValidate: false, shouldDirty: true });
    }
  }, [amountText, form]);

  const kind = form.watch("kind");
  const categories = kind === "income" ? incomeCats : expenseCats;
  const currentType = transactionTypes.find((t) => t.value === kind)!;
  const parsedAmount = amountText ? Number.parseFloat(amountText) : 0;
  const selectedAccountId = form.watch("accountId");
  const fromAccountId = form.watch("fromAccountId");
  const toAccountId = form.watch("toAccountId");
  const occurredAt = form.watch("occurredAt");

  const targetAccountId = kind === "transfer" ? fromAccountId : selectedAccountId;
  const targetAccount = React.useMemo(
    () => (accounts as any[]).find((a) => a.id === targetAccountId),
    [accounts, targetAccountId],
  );
  const targetCurrency = formatCurrencyCode(targetAccount?.currency ?? DEFAULT_CURRENCY);
  const needsConversion = kind !== "transfer" && currency !== targetCurrency;

  // Reset the entry currency to the target account's currency whenever the account changes.
  React.useEffect(() => {
    setCurrency(targetCurrency);
  }, [targetAccountId, targetCurrency]);

  const { data: fxData, isFetching: fxFetching } = useFxRates(
    currency,
    needsConversion ? [targetCurrency] : [],
  );
  const fxRate = needsConversion ? fxData?.rates?.[targetCurrency] : undefined;
  const convertedAmount =
    needsConversion && typeof fxRate === "number" ? round2(parsedAmount * fxRate) : null;

  const symbol = getCurrencySymbol(currency);

  const accountLabel =
    kind === "transfer" ? null : kind === "income" ? "Receive to" : "Pay from";
  const canSave =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    (kind === "transfer"
      ? Boolean(form.watch("fromAccountId") && form.watch("toAccountId"))
      : Boolean(form.watch("accountId") && form.watch("categoryId"))) &&
    (!needsConversion || typeof convertedAmount === "number");

  const saveTransaction = async () => {
    const valid = await form.trigger();
    if (!valid) {
      if (kind !== "transfer" && !form.getValues("categoryId")) {
        toast.error("Pick a category");
      } else if (!form.getValues("accountId") && kind !== "transfer") {
        toast.error("Pick an account");
      }
      return;
    }
    if (needsConversion && typeof convertedAmount !== "number") {
      toast.error("Exchange rate unavailable", {
        description: `Couldn't convert ${currency} to ${targetCurrency}. Try again in a moment.`,
      });
      return;
    }

    const values = form.getValues();
    if (!user) return;
    const amountInAccountCurrency = needsConversion ? convertedAmount! : values.amount;

    try {
      if (values.kind === "transfer") {
        await createTransfer(user.uid, {
          amount: values.amount,
          fromAccountId: values.fromAccountId!,
          toAccountId: values.toAccountId!,
          occurredAt: values.occurredAt,
          note: values.note?.trim() || undefined,
        });
      } else {
        await createIncomeOrExpense(user.uid, {
          kind: values.kind,
          amount: amountInAccountCurrency,
          accountId: values.accountId!,
          categoryId: values.categoryId!,
          eventId: values.eventId?.trim() || undefined,
          occurredAt: values.occurredAt,
          note: values.note?.trim() || undefined,
        });
      }
      toast.success("Transaction saved");
      setOpen(false);
      setAmountText("");
      form.reset({
        kind: values.kind,
        occurredAt: new Date(),
        note: "",
        eventId: defaultEventId ?? undefined,
      });
    } catch (e) {
      toast.error("Failed to save transaction", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="!flex max-h-[96dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {transactionTypes.map((type) => {
              const Icon = type.icon;
              const selected = kind === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    form.setValue("kind", type.value, { shouldValidate: true });
                    form.setValue("categoryId", undefined);
                  }}
                  className={`motion-expressive press-expressive inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    selected ? type.pill : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {type.label}
                </button>
              );
            })}
          </div>

          <div className="relative mt-4 rounded-[1.75rem] bg-muted/40 px-4 py-4 text-center">
            {kind !== "transfer" && (
              <div className="absolute right-3 top-3">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-7 w-auto gap-1 rounded-full border-0 bg-card px-2.5 text-xs font-semibold shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {COMMON_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isMobile ? (
              <p className={`text-4xl font-bold tabular-nums tracking-tight ${currentType.color}`}>
                {symbol} {amountText || "0"}
              </p>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span className={`text-3xl font-bold ${currentType.color}`}>{symbol}</span>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  className="h-14 max-w-[200px] border-0 bg-transparent text-center text-4xl font-bold shadow-none focus-visible:ring-0"
                />
              </div>
            )}

            {needsConversion && parsedAmount > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {typeof convertedAmount === "number"
                  ? `= ${formatMoney(convertedAmount, targetCurrency)}`
                  : fxFetching
                    ? "Fetching rate…"
                    : "Rate unavailable"}
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {kind === "transfer" ? (
              <>
                <AccountSelect
                  accounts={accounts as any[]}
                  value={fromAccountId}
                  onChange={(id) => form.setValue("fromAccountId", id, { shouldValidate: true })}
                  label="From"
                  excludeId={toAccountId}
                />
                <AccountSelect
                  accounts={accounts as any[]}
                  value={toAccountId}
                  onChange={(id) => form.setValue("toAccountId", id, { shouldValidate: true })}
                  label="To"
                  excludeId={fromAccountId}
                />
              </>
            ) : (
              <>
                <CategorySelect
                  categories={categories}
                  value={form.watch("categoryId")}
                  onChange={(id) =>
                    form.setValue("categoryId", id, { shouldDirty: true, shouldValidate: true })
                  }
                />
                <AccountSelect
                  accounts={accounts as any[]}
                  value={selectedAccountId}
                  onChange={(id) => form.setValue("accountId", id, { shouldValidate: true })}
                  label={accountLabel ?? "Account"}
                />
              </>
            )}
          </div>

          <div className={`mt-2 grid gap-2 ${kind === "transfer" ? "grid-cols-1" : "grid-cols-2"}`}>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-start gap-2 rounded-2xl px-3 font-normal"
                >
                  <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{format(occurredAt, "MMM d, yyyy")}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={occurredAt}
                  onSelect={(d) => d && form.setValue("occurredAt", d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {kind !== "transfer" && (
              <Select
                value={form.watch("eventId") ?? "none"}
                onValueChange={(v) => form.setValue("eventId", v === "none" ? undefined : v)}
              >
                <SelectTrigger className="h-11 w-full gap-2 rounded-2xl px-3">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Trip">
                    {events.find((e: any) => e.id === form.watch("eventId"))?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No trip</SelectItem>
                  {events
                    .filter((e: any) => e?.status !== "archived")
                    .map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="relative mt-2">
            <StickyNote className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Add a note (optional)"
              className="h-11 rounded-2xl pl-10"
              {...form.register("note")}
            />
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isMobile ? (
            <Numpad
              onDigit={(d) => setAmountText((prev) => appendNumpadDigit(prev, d))}
              onBackspace={() => setAmountText((prev) => backspaceNumpad(prev))}
              onConfirm={() => void saveTransaction()}
              confirmDisabled={!canSave}
              confirmLoading={form.formState.isSubmitting}
            />
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!canSave || form.formState.isSubmitting}
                onClick={() => void saveTransaction()}
              >
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
