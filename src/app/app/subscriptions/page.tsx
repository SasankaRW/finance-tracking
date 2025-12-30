"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Repeat,
  MoreHorizontal,
  Pencil,
  Trash2,
  Pause,
  Play,
  CheckCircle2,
  CalendarIcon,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts, useCategories, useSubscriptions } from "@/lib/finance/hooks";
import {
  createSubscription,
  deleteSubscription,
  recordSubscriptionPayment,
  setSubscriptionStatus,
  updateSubscription,
} from "@/lib/finance/subscription-mutations";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  amount: z.number().positive().finite(),
  currency: z.string().min(3).max(3),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  nextDueAt: z.date(),
  interval: z.literal("monthly"),
});
type CreateValues = z.infer<typeof createSchema>;

const updateSchema = createSchema.extend({
  subscriptionId: z.string().min(1),
  status: z.enum(["active", "paused"]),
});
type UpdateValues = z.infer<typeof updateSchema>;

function getDueDateInfo(date: Date) {
  if (isPast(date) && !isToday(date)) {
    const days = differenceInDays(new Date(), date);
    return { label: `${days}d overdue`, variant: "destructive" as const, icon: AlertTriangle };
  }
  if (isToday(date)) {
    return { label: "Due today", variant: "default" as const, icon: Clock };
  }
  if (isTomorrow(date)) {
    return { label: "Tomorrow", variant: "secondary" as const, icon: Clock };
  }
  const days = differenceInDays(date, new Date());
  if (days <= 7) {
    return { label: `In ${days}d`, variant: "secondary" as const, icon: Clock };
  }
  return { label: format(date, "MMM d"), variant: "outline" as const, icon: CalendarIcon };
}

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { categories: expenseCats } = useCategories("expense");
  const { subscriptions, loading, error } = useSubscriptions();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<any | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      amount: 0,
      currency: COMMON_CURRENCIES[0],
      accountId: "",
      categoryId: "",
      nextDueAt: new Date(),
      interval: "monthly",
    },
  });

  const editForm = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      subscriptionId: "",
      name: "",
      amount: 0,
      currency: COMMON_CURRENCIES[0],
      accountId: "",
      categoryId: "",
      nextDueAt: new Date(),
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
        amount: 0,
        currency: COMMON_CURRENCIES[0],
        accountId: "",
        categoryId: "",
        nextDueAt: new Date(),
        interval: "monthly",
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

  const { active, paused, totalMonthly, dueThisWeek } = React.useMemo(() => {
    let activeCount = 0;
    let pausedCount = 0;
    let monthly = 0;
    let dueCount = 0;
    const now = new Date();

    for (const s of subscriptions as any[]) {
      if (s.status === "active") {
        activeCount++;
        monthly += s.amount ?? 0;
        const nextDue = s.nextDueAt instanceof Timestamp ? s.nextDueAt.toDate() : new Date();
        const days = differenceInDays(nextDue, now);
        if (days <= 7 && days >= 0) dueCount++;
      } else {
        pausedCount++;
      }
    }
    return { active: activeCount, paused: pausedCount, totalMonthly: monthly, dueThisWeek: dueCount };
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track recurring expenses and never miss a payment
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Subscription</DialogTitle>
              <DialogDescription>
                Add a recurring expense to track
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitCreate}>
              <DialogBody className="space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Service Name
                  </Label>
                  <Input
                    placeholder="e.g., Netflix, Spotify, Gym"
                    className="h-11"
                    {...createForm.register("name")}
                  />
                </div>

                {/* Amount & Currency */}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Total
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Repeat className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalMonthly)}</div>
            <p className="text-xs text-muted-foreground mt-1">from active subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Play className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{active}</div>
            <p className="text-xs text-muted-foreground mt-1">running subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paused
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Pause className="h-4 w-4 text-amber-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paused}</div>
            <p className="text-xs text-muted-foreground mt-1">on hold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Due This Week
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dueThisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">payments upcoming</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>Manage your recurring payments</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6">Subscription</TableHead>
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
                    Loading subscriptions…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-destructive">
                    Failed to load subscriptions{error?.message ? `: ${error.message}` : ""}
                  </TableCell>
                </TableRow>
              ) : subscriptions.length ? (
                (subscriptions as any[]).map((s) => {
                  const nextDue = s.nextDueAt instanceof Timestamp ? s.nextDueAt.toDate() : new Date();
                  const acct = accountById.get(s.accountId);
                  const cat = categoryById.get(s.categoryId);
                  const cur = formatCurrencyCode(s.currency ?? acct?.currency);
                  const dueInfo = s.status === "active" ? getDueDateInfo(nextDue) : null;
                  const isPaused = s.status === "paused";

                  return (
                    <TableRow key={s.id} className={`group ${isPaused ? "opacity-60" : ""}`}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            isPaused ? "bg-muted" : "bg-primary/10"
                          }`}>
                            <Repeat className={`h-4 w-4 ${isPaused ? "text-muted-foreground" : "text-primary"}`} />
                          </div>
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {acct?.name ?? "—"} · {cat?.name ?? "—"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">
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
                              onClick={async () => {
                                if (!user) return;
                                try {
                                  await recordSubscriptionPayment(user.uid, s.id);
                                  toast.success("Payment recorded");
                                } catch (e) {
                                  toast.error("Failed to record payment", {
                                    description: e instanceof Error ? e.message : undefined,
                                  });
                                }
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Mark paid
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEdit(s);
                                editForm.reset({
                                  subscriptionId: s.id,
                                  name: s.name ?? "",
                                  amount: s.amount ?? 0,
                                  currency: formatCurrencyCode(s.currency ?? acct?.currency),
                                  accountId: s.accountId ?? "",
                                  categoryId: s.categoryId ?? "",
                                  nextDueAt: nextDue,
                                  status: s.status === "paused" ? "paused" : "active",
                                });
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                if (!user) return;
                                const nextStatus = s.status === "active" ? "paused" : "active";
                                try {
                                  await setSubscriptionStatus(user.uid, s.id, nextStatus);
                                  toast.success(
                                    nextStatus === "paused" ? "Subscription paused" : "Subscription resumed",
                                  );
                                } catch (e) {
                                  toast.error("Failed to update status", {
                                    description: e instanceof Error ? e.message : undefined,
                                  });
                                }
                              }}
                            >
                              {s.status === "active" ? (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Resume
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                if (!user) return;
                                if (!confirm("Delete this subscription?")) return;
                                try {
                                  await deleteSubscription(user.uid, s.id);
                                  toast.success("Subscription deleted");
                                } catch (e) {
                                  toast.error("Failed to delete subscription", {
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
                        <Repeat className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">No subscriptions yet</p>
                        <p className="text-sm text-muted-foreground">
                          Add your first subscription to track recurring expenses
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Subscription
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={Boolean(edit)} onOpenChange={(v) => (!v ? setEdit(null) : v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Update subscription details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit}>
            <DialogBody className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Service Name
                </Label>
                <Input className="h-11" {...editForm.register("name")} />
              </div>

              {/* Amount & Currency & Status */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Amount
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
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editAccountCurrency && editAccountCurrency !== editForm.watch("currency") && (
                <p className="text-xs text-muted-foreground -mt-3">
                  Will be converted to {editAccountCurrency} when marked as paid
                </p>
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
