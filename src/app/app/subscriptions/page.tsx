"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Repeat,
  Pencil,
  Trash2,
  Pause,
  Play,
  CheckCircle2,
  CalendarIcon,
  Clock,
  HandCoins,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { RowActionsMenu, type RowAction } from "@/components/row-actions-menu";
import { useAccounts, useCategories, useSubscriptions } from "@/lib/finance/hooks";
import {
  createSubscription,
  deleteSubscription,
  recordSubscriptionPayment,
  setSubscriptionStatus,
  updateSubscription,
} from "@/lib/finance/subscription-mutations";
import { getBillKindIcon, getBillKindLabel, getDueDateInfo } from "@/lib/finance/bill-status";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { COMMON_CURRENCIES } from "@/shared/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DebtPillsPanel } from "@/app/app/subscriptions/debt-pills-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const monthlyBillSchema = z.object({
  name: z.string().min(1).max(64),
  kind: z.enum(["subscription", "loan", "rent"]),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  nextDueAt: z.date(),
  interval: z.literal("monthly"),
  loanTotalPayments: z.number().int().positive().optional(),
  loanPaidPayments: z.number().int().min(0).optional(),
});

function validateLoanProgress(values: z.infer<typeof monthlyBillSchema>, ctx: z.RefinementCtx) {
  if (values.kind !== "loan") return;

  if (!values.loanTotalPayments) {
    ctx.addIssue({
      code: "custom",
      path: ["loanTotalPayments"],
      message: "Loan needs total months",
    });
  }

  if ((values.loanPaidPayments ?? 0) > (values.loanTotalPayments ?? 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["loanPaidPayments"],
      message: "Paid months cannot be greater than total months",
    });
  }
}

const createSchema = monthlyBillSchema.superRefine(validateLoanProgress);
type CreateValues = z.infer<typeof createSchema>;

const updateSchema = monthlyBillSchema.extend({
  subscriptionId: z.string().min(1),
  status: z.enum(["active", "paused", "completed"]),
}).superRefine(validateLoanProgress);
type UpdateValues = z.infer<typeof updateSchema>;

function getLoanProgress(item: any) {
  const total = typeof item.loanTotalPayments === "number" ? item.loanTotalPayments : 0;
  const paid = typeof item.loanPaidPayments === "number" ? item.loanPaidPayments : 0;
  const safePaid = Math.min(Math.max(paid, 0), total);
  const remaining = Math.max(total - safePaid, 0);
  const percent = total > 0 ? Math.round((safePaid / total) * 100) : 0;

  return { total, paid: safePaid, remaining, percent };
}

function editValuesFor(s: any, acct: any, nextDue: Date): UpdateValues {
  return {
    subscriptionId: s.id,
    name: s.name ?? "",
    kind: s.kind === "loan" ? "loan" : s.kind === "rent" ? "rent" : "subscription",
    amount: s.amount ?? 0,
    currency: formatCurrencyCode(s.currency ?? acct?.currency),
    accountId: s.accountId ?? "",
    categoryId: s.categoryId ?? "",
    nextDueAt: nextDue,
    interval: "monthly",
    loanTotalPayments: s.loanTotalPayments ?? 12,
    loanPaidPayments: s.loanPaidPayments ?? 0,
    status: s.status === "completed" ? "completed" : s.status === "paused" ? "paused" : "active",
  };
}

// Shared by the mobile card and desktop table row menus so "mark paid"/"pause"/"delete" behave
// (and read) identically everywhere they appear.
function buildBillActions({
  s,
  isCompleted,
  isLoan,
  loanProgress,
  user,
  confirm,
  onEdit,
}: {
  s: any;
  isCompleted: boolean;
  isLoan: boolean;
  loanProgress: ReturnType<typeof getLoanProgress> | null;
  user: { uid: string } | null | undefined;
  confirm: ReturnType<typeof useConfirm>;
  onEdit: () => void;
}): RowAction[] {
  const actions: RowAction[] = [];

  if (!isCompleted) {
    actions.push({
      label: "Mark paid",
      icon: CheckCircle2,
      onClick: async () => {
        if (!user) return;
        try {
          await recordSubscriptionPayment(user.uid, s.id);
          toast.success(isLoan && loanProgress?.remaining === 1 ? "Loan completed" : "Payment recorded");
        } catch (e) {
          toast.error("Failed to record payment", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      },
    });
  }

  actions.push({ label: "Edit", icon: Pencil, onClick: onEdit });

  if (!isCompleted) {
    actions.push({
      label: s.status === "active" ? "Pause" : "Resume",
      icon: s.status === "active" ? Pause : Play,
      onClick: async () => {
        if (!user) return;
        const nextStatus = s.status === "active" ? "paused" : "active";
        try {
          await setSubscriptionStatus(user.uid, s.id, nextStatus);
          toast.success(nextStatus === "paused" ? "Monthly bill paused" : "Monthly bill resumed");
        } catch (e) {
          toast.error("Failed to update status", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      },
    });
  }

  actions.push({
    label: "Delete",
    icon: Trash2,
    destructive: true,
    onClick: async () => {
      if (!user) return;
      if (!(await confirm({ title: "Delete this monthly bill?", destructive: true }))) return;
      try {
        await deleteSubscription(user.uid, s.id);
        toast.success("Monthly bill deleted");
      } catch (e) {
        toast.error("Failed to delete monthly bill", {
          description: e instanceof Error ? e.message : undefined,
        });
      }
    },
  });

  return actions;
}

export default function SubscriptionsPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { accounts } = useAccounts();
  const { categories: expenseCats } = useCategories("expense");
  const { subscriptions, loading, error } = useSubscriptions();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<any | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      kind: "subscription",
      amount: 0,
      currency: COMMON_CURRENCIES[0],
      accountId: "",
      categoryId: "",
      nextDueAt: new Date(),
      interval: "monthly",
      loanTotalPayments: 12,
      loanPaidPayments: 0,
    },
  });

  const editForm = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      subscriptionId: "",
      name: "",
      kind: "subscription",
      amount: 0,
      currency: COMMON_CURRENCIES[0],
      accountId: "",
      categoryId: "",
      nextDueAt: new Date(),
      interval: "monthly",
      loanTotalPayments: 12,
      loanPaidPayments: 0,
      status: "active",
    },
  });

  const submitCreate = createForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createSubscription(user.uid, values);
      toast.success("Subscription created");
      setCreateOpen(false);
      createForm.reset({
        name: "",
        kind: "subscription",
        amount: 0,
        currency: COMMON_CURRENCIES[0],
        accountId: "",
        categoryId: "",
        nextDueAt: new Date(),
        interval: "monthly",
        loanTotalPayments: 12,
        loanPaidPayments: 0,
      });
    } catch (e) {
      toast.error("Failed to create subscription", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  const submitEdit = editForm.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await updateSubscription(user.uid, values);
      toast.success("Subscription updated");
      setEdit(null);
    } catch (e) {
      toast.error("Failed to update subscription", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  const accountById = React.useMemo(
    () => new Map(accounts.map((a: any) => [a.id, a])),
    [accounts],
  );
  const categoryById = React.useMemo(
    () => new Map(expenseCats.map((c: any) => [c.id, c])),
    [expenseCats],
  );

  // Precomputed once and shared by both the mobile card list and the desktop table below,
  // instead of each view re-deriving the same fields per row.
  const billRows = React.useMemo(() => {
    return (subscriptions as any[]).map((s) => {
      const nextDue = s.nextDueAt instanceof Timestamp ? s.nextDueAt.toDate() : new Date();
      const acct = accountById.get(s.accountId);
      const cat = categoryById.get(s.categoryId);
      const cur = formatCurrencyCode(s.currency ?? acct?.currency);
      const dueInfo = s.status === "active" ? getDueDateInfo(nextDue) : null;
      const isPaused = s.status === "paused";
      const isLoan = s.kind === "loan";
      const isCompleted = s.status === "completed";
      const loanProgress = isLoan ? getLoanProgress(s) : null;
      const KindIcon = getBillKindIcon(s.kind);
      return { s, nextDue, acct, cat, cur, dueInfo, isPaused, isLoan, isCompleted, loanProgress, KindIcon };
    });
  }, [subscriptions, accountById, categoryById]);

  const { active, paused, loans, totalMonthly, dueThisWeek } = React.useMemo(() => {
    let activeCount = 0;
    let pausedCount = 0;
    let loanCount = 0;
    let monthly = 0;
    let dueCount = 0;
    const now = new Date();

    for (const s of subscriptions as any[]) {
      if (s.status === "active") {
        activeCount++;
        if (s.kind === "loan") loanCount++;
        monthly += s.amount ?? 0;
        const nextDue = s.nextDueAt instanceof Timestamp ? s.nextDueAt.toDate() : new Date();
        const days = differenceInDays(nextDue, now);
        if (days <= 7 && days >= 0) dueCount++;
      } else {
        pausedCount++;
      }
    }
    return { active: activeCount, paused: pausedCount, loans: loanCount, totalMonthly: monthly, dueThisWeek: dueCount };
  }, [subscriptions]);

  const createAccountCurrency = React.useMemo(() => {
    const id = createForm.watch("accountId");
    const a = id ? accountById.get(id) : null;
    return a ? formatCurrencyCode(a.currency) : "";
  }, [accountById, createForm.watch("accountId")]);

  const editAccountCurrency = React.useMemo(() => {
    const id = editForm.watch("accountId");
    const a = id ? accountById.get(id) : null;
    return a ? formatCurrencyCode(a.currency) : "";
  }, [accountById, editForm.watch("accountId")]);

  React.useEffect(() => {
    const accCur = createAccountCurrency;
    if (!accCur) return;
    const cur = createForm.getValues("currency");
    if (!cur) {
      createForm.setValue("currency", accCur, { shouldDirty: true, shouldValidate: true });
    }
  }, [createAccountCurrency, createForm]);

  React.useEffect(() => {
    const accCur = editAccountCurrency;
    if (!accCur) return;
    const cur = editForm.getValues("currency");
    if (!cur) {
      editForm.setValue("currency", accCur, { shouldDirty: true, shouldValidate: true });
    }
  }, [editAccountCurrency, editForm]);

  const createKind = createForm.watch("kind");
  const editKind = editForm.watch("kind");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${embedded ? "items-stretch sm:items-center" : ""}`}>
        {!embedded && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Bills & Loans</h1>
              <Badge variant="secondary" className="font-mono text-[11px]">
                Monthly
              </Badge>
            </div>
            <p className="hidden text-sm text-muted-foreground sm:block">
              Track subscriptions, monthly loan payments, and borrowed money
            </p>
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Monthly Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Monthly Bill</DialogTitle>
              <DialogDescription>
                Add a subscription or monthly loan payment to track
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitCreate}>
              <DialogBody className="space-y-5">
                {/* Type */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Type
                  </Label>
                  <Select
                    value={createForm.watch("kind")}
                    onValueChange={(v) =>
                      createForm.setValue("kind", v as CreateValues["kind"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscription">Subscription</SelectItem>
                      <SelectItem value="loan">Loan payment</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Name
                  </Label>
                  <Input
                    placeholder="e.g., Netflix, Car loan, Apartment rent"
                    className="h-11"
                    {...createForm.register("name")}
                  />
                </div>

                {/* Amount & Currency */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      {createKind === "loan" ? "Monthly Payment" : createKind === "rent" ? "Monthly Rent" : "Amount"}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-11 text-lg font-semibold"
                      {...createForm.register("amount", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Currency
                    </Label>
                    <Select
                      value={createForm.watch("currency")}
                      onValueChange={(v) =>
                        createForm.setValue("currency", v, {
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
                {createAccountCurrency && createAccountCurrency !== createForm.watch("currency") && (
                  <p className="text-xs text-muted-foreground -mt-3">
                    Will be converted to {createAccountCurrency} when marked as paid
                  </p>
                )}

                {createKind === "loan" && (
                  <div className="grid grid-cols-2 gap-3 rounded-3xl border bg-muted/30 p-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Total Months
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        className="h-11"
                        {...createForm.register("loanTotalPayments", { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Already Paid
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        className="h-11"
                        {...createForm.register("loanPaidPayments", { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                )}

                {/* Account & Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Account
                    </Label>
                    <Select
                      value={createForm.watch("accountId") ?? ""}
                      onValueChange={(v) =>
                        createForm.setValue("accountId", v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select" />
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
                      Category
                    </Label>
                    <Select
                      value={createForm.watch("categoryId") ?? ""}
                      onValueChange={(v) =>
                        createForm.setValue("categoryId", v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCats.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Next Due Date */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Next Due Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start h-11 font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {format(createForm.watch("nextDueAt"), "EEEE, MMMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-auto" align="start">
                      <Calendar
                        mode="single"
                        selected={createForm.watch("nextDueAt")}
                        onSelect={(d) =>
                          d &&
                          createForm.setValue("nextDueAt", d, {
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

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createForm.formState.isSubmitting} className="min-w-24">
                  {createForm.formState.isSubmitting ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="elevation-1 grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-[2rem] bg-card sm:grid-cols-4 sm:divide-y-0">
        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <Repeat className="h-3.5 w-3.5 text-primary" />
            Monthly Total
          </div>
          <p className="mt-2 truncate font-display text-lg font-bold tabular-nums sm:text-2xl">
            {formatMoney(totalMonthly)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">from active monthly bills</p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <Play className="h-3.5 w-3.5 text-emerald-600" />
            Active
          </div>
          <p className="mt-2 font-display text-lg font-bold tabular-nums sm:text-2xl">{active}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">active monthly bills</p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <HandCoins className="h-3.5 w-3.5 text-amber-600" />
            Monthly Loans
          </div>
          <p className="mt-2 font-display text-lg font-bold tabular-nums sm:text-2xl">{loans}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{paused} paused</p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <Clock className="h-3.5 w-3.5 text-sky-600" />
            Due This Week
          </div>
          <p className="mt-2 font-display text-lg font-bold tabular-nums sm:text-2xl">{dueThisWeek}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">payments upcoming</p>
        </div>
      </div>

      {/* Monthly Bills Table */}
      <Card className="surface-tonal">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="text-base">Monthly Bills</CardTitle>
          <CardDescription>Manage subscriptions and loan payments</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 p-4 md:hidden">
            {loading ? (
              <div className="rounded-3xl border p-6 text-center text-sm text-muted-foreground">
                Loading monthly bills...
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
                Failed to load monthly bills{error?.message ? `: ${error.message}` : ""}
              </div>
            ) : subscriptions.length ? (
              billRows.map(({ s, nextDue, acct, cat, cur, dueInfo, isPaused, isLoan, isCompleted, loanProgress, KindIcon }) => {
                return (
                  <Card key={s.id} className={`surface-container-high py-0 ${isPaused ? "opacity-70" : ""}`}>
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                            isPaused ? "bg-muted" : "bg-primary/10"
                          }`}>
                            <KindIcon className={`h-4 w-4 ${isPaused ? "text-muted-foreground" : "text-primary"}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {getBillKindLabel(s.kind)} · {acct?.name ?? "-"} · {cat?.name ?? "-"}
                            </p>
                          </div>
                        </div>

                        <RowActionsMenu
                          ariaLabel={`${s.name} actions`}
                          triggerClassName="-mr-3 -mt-2 p-0"
                          actions={buildBillActions({
                            s,
                            isCompleted,
                            isLoan,
                            loanProgress,
                            user,
                            confirm,
                            onEdit: () => {
                              setEdit(s);
                              editForm.reset(editValuesFor(s, acct, nextDue));
                            },
                          })}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">
                          {s.status}
                        </Badge>
                        {dueInfo && (
                          <Badge variant={dueInfo.variant} className="gap-1">
                            <dueInfo.icon className="h-3 w-3" />
                            {dueInfo.label}
                          </Badge>
                        )}
                      </div>

                      {loanProgress && loanProgress.total > 0 && (
                        <div className="space-y-1">
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${loanProgress.percent}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {loanProgress.paid}/{loanProgress.total} paid · {loanProgress.remaining} month{loanProgress.remaining !== 1 ? "s" : ""} left
                          </p>
                        </div>
                      )}

                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Monthly amount</p>
                          <p className="truncate text-lg font-bold tabular-nums">
                            {formatMoney(s.amount ?? 0, cur)}
                          </p>
                        </div>
                        {loanProgress && loanProgress.total > 0 && (
                          <div className="min-w-0 text-right">
                            <p className="text-xs text-muted-foreground">Remaining</p>
                            <p className="truncate font-semibold tabular-nums">
                              {formatMoney((s.amount ?? 0) * loanProgress.remaining, cur)}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="rounded-3xl border border-dashed p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Repeat className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No monthly bills yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first subscription or loan payment.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Monthly Bill
                </Button>
              </div>
            )}
          </div>

          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6">Bill</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Due Date</TableHead>
                <TableHead className="text-right w-[140px]">Amount</TableHead>
                <TableHead className="w-[60px] pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Loading monthly bills…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-destructive">
                    Failed to load monthly bills{error?.message ? `: ${error.message}` : ""}
                  </TableCell>
                </TableRow>
              ) : subscriptions.length ? (
                billRows.map(({ s, nextDue, acct, cat, cur, dueInfo, isPaused, isLoan, isCompleted, loanProgress, KindIcon }) => {
                  return (
                    <TableRow key={s.id} className={`group ${isPaused ? "opacity-60" : ""}`}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                            isPaused ? "bg-muted" : "bg-primary/10"
                          }`}>
                            <KindIcon className={`h-4 w-4 ${isPaused ? "text-muted-foreground" : "text-primary"}`} />
                          </div>
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {getBillKindLabel(s.kind)} · {acct?.name ?? "—"} · {cat?.name ?? "—"}
                            </div>
                            {loanProgress && loanProgress.total > 0 && (
                              <div className="mt-2 max-w-[260px] space-y-1">
                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${loanProgress.percent}%` }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {loanProgress.paid}/{loanProgress.total} paid · {loanProgress.remaining} month{loanProgress.remaining !== 1 ? "s" : ""} left
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={s.status === "active" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {dueInfo ? (
                          <Badge variant={dueInfo.variant} className="gap-1">
                            <dueInfo.icon className="h-3 w-3" />
                            {dueInfo.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold tabular-nums">
                          {formatMoney(s.amount ?? 0, cur)}
                        </span>
                        <span className="text-xs text-muted-foreground block">/month</span>
                        {loanProgress && loanProgress.total > 0 && (
                          <span className="text-xs text-muted-foreground block">
                            {formatMoney((s.amount ?? 0) * loanProgress.remaining, cur)} left
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <RowActionsMenu
                          ariaLabel={`${s.name} actions`}
                          triggerClassName="h-8 w-8 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100"
                          actions={buildBillActions({
                            s,
                            isCompleted,
                            isLoan,
                            loanProgress,
                            user,
                            confirm,
                            onEdit: () => {
                              setEdit(s);
                              editForm.reset(editValuesFor(s, acct, nextDue));
                            },
                          })}
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
                        <Repeat className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">No monthly bills yet</p>
                        <p className="text-sm text-muted-foreground">
                          Add your first subscription or loan payment
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Monthly Bill
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <DebtPillsPanel />

      {/* Edit Dialog */}
      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Monthly Bill</DialogTitle>
            <DialogDescription>
              Update subscription or loan payment details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit}>
            <DialogBody className="space-y-5">
              {/* Type */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Type
                </Label>
                <Select
                  value={editForm.watch("kind")}
                  onValueChange={(v) =>
                    editForm.setValue("kind", v as UpdateValues["kind"], {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="loan">Loan payment</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Name
                </Label>
                <Input className="h-11" {...editForm.register("name")} />
              </div>

              {/* Amount & Currency & Status */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    {editKind === "loan" ? "Monthly Payment" : editKind === "rent" ? "Monthly Rent" : "Amount"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="h-11"
                    {...editForm.register("amount", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Currency
                  </Label>
                  <Select
                    value={editForm.watch("currency")}
                    onValueChange={(v) =>
                      editForm.setValue("currency", v, {
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
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Status
                  </Label>
                  <Select
                    value={editForm.watch("status")}
                    onValueChange={(v) =>
                      editForm.setValue("status", v as any, {
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
                      {editKind === "loan" && (
                        <SelectItem value="completed">Completed</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editAccountCurrency && editAccountCurrency !== editForm.watch("currency") && (
                <p className="text-xs text-muted-foreground -mt-3">
                  Will be converted to {editAccountCurrency} when marked as paid
                </p>
              )}

              {editKind === "loan" && (
                <div className="grid grid-cols-2 gap-3 rounded-3xl border bg-muted/30 p-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Total Months
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className="h-11"
                      {...editForm.register("loanTotalPayments", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Paid Months
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className="h-11"
                      {...editForm.register("loanPaidPayments", { valueAsNumber: true })}
                    />
                  </div>
                </div>
              )}

              {/* Account & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Account
                  </Label>
                  <Select
                    value={editForm.watch("accountId") ?? ""}
                    onValueChange={(v) =>
                      editForm.setValue("accountId", v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select" />
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
                    Category
                  </Label>
                  <Select
                    value={editForm.watch("categoryId") ?? ""}
                    onValueChange={(v) =>
                      editForm.setValue("categoryId", v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCats.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Next Due Date */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Next Due Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-11 font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {format(editForm.watch("nextDueAt"), "EEEE, MMMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={editForm.watch("nextDueAt")}
                      onSelect={(d) =>
                        d &&
                        editForm.setValue("nextDueAt", d, {
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

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting} className="min-w-24">
                {editForm.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
