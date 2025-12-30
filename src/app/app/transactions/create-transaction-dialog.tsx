"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts, useCategories, useEvents } from "@/lib/finance/hooks";
import { createIncomeOrExpense, createTransfer } from "@/lib/finance/mutations";
import { Button } from "@/components/ui/button";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      if (!v.fromAccountId)
        ctx.addIssue({ code: "custom", path: ["fromAccountId"], message: "Required" });
      if (!v.toAccountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Required" });
      if (v.fromAccountId && v.toAccountId && v.fromAccountId === v.toAccountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Must be different" });
      }
    } else {
      if (!v.accountId)
        ctx.addIssue({ code: "custom", path: ["accountId"], message: "Required" });
      if (!v.categoryId)
        ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Required" });
    }
  });

type CreateValues = z.infer<typeof createSchema>;

const transactionTypes = [
  { value: "expense", label: "Expense", icon: ArrowDownRight, color: "text-rose-600", bg: "bg-rose-500/10" },
  { value: "income", label: "Income", icon: ArrowUpRight, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "text-blue-600", bg: "bg-blue-500/10" },
] as const;

export function CreateTransactionDialog({
  triggerLabel = "Add Transaction",
  defaultEventId,
  trigger,
}: {
  triggerLabel?: string;
  defaultEventId?: string;
  trigger?: React.ReactNode;
}) {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { categories: expenseCats } = useCategories("expense");
  const { categories: incomeCats } = useCategories("income");
  const { events } = useEvents();

  const [open, setOpen] = React.useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      kind: "expense",
      amount: 0,
      occurredAt: new Date(),
      note: "",
      ...(defaultEventId ? { eventId: defaultEventId } : {}),
    },
  });

  const kind = form.watch("kind");
  const categories = kind === "income" ? incomeCats : expenseCats;
  const currentType = transactionTypes.find((t) => t.value === kind)!;

  const submitCreate = form.handleSubmit(async (values) => {
    if (!user) return;
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
          amount: values.amount,
          accountId: values.accountId!,
          categoryId: values.categoryId!,
          eventId: values.eventId?.trim() || undefined,
          occurredAt: values.occurredAt,
          note: values.note?.trim() || undefined,
        });
      }
      toast.success("Transaction saved");
      setOpen(false);
      form.reset({
        kind: values.kind,
        amount: 0,
        occurredAt: new Date(),
        note: "",
        eventId: defaultEventId ?? undefined,
      });
    } catch (e) {
      toast.error("Failed to save transaction", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogDescription>
            Record a new income, expense, or transfer
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitCreate}>
          <DialogBody className="space-y-5">
            {/* Transaction Type Selector */}
            <div className="grid grid-cols-3 gap-2">
              {transactionTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = kind === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      form.setValue("kind", type.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      form.setValue("categoryId", undefined);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${isSelected
                        ? `border-current ${type.color} ${type.bg}`
                        : "border-transparent bg-muted/50 hover:bg-muted"
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? type.color : "text-muted-foreground"}`} />
                    <span className={`text-xs font-medium ${isSelected ? type.color : "text-muted-foreground"}`}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Amount Input - Prominent */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs text-muted-foreground uppercase tracking-wider">
                Amount
              </Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-2xl h-14 font-semibold text-center pr-4"
                  {...form.register("amount", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start h-11 font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {format(form.watch("occurredAt"), "EEEE, MMMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("occurredAt")}
                    onSelect={(d) =>
                      d &&
                      form.setValue("occurredAt", d, {
                        shouldDirty: true,
                      })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Account & Category / From & To */}
            {kind === "transfer" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    From Account
                  </Label>
                  <Select
                    value={form.watch("fromAccountId") ?? ""}
                    onValueChange={(v) =>
                      form.setValue("fromAccountId", v, {
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
                    To Account
                  </Label>
                  <Select
                    value={form.watch("toAccountId") ?? ""}
                    onValueChange={(v) =>
                      form.setValue("toAccountId", v, {
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
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Account
                  </Label>
                  <Select
                    value={form.watch("accountId") ?? ""}
                    onValueChange={(v) =>
                      form.setValue("accountId", v, {
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
                    value={form.watch("categoryId") ?? ""}
                    onValueChange={(v) =>
                      form.setValue("categoryId", v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select" />
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
              </div>
            )}

            {/* Trip / Event (optional) */}
            {kind !== "transfer" && (
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
                    {events
                      .filter((e: any) => e?.status !== "archived")
                      .map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note" className="text-xs text-muted-foreground uppercase tracking-wider">
                Note <span className="normal-case font-normal">(optional)</span>
              </Label>
              <Input
                id="note"
                placeholder="Add a description..."
                className="h-11"
                {...form.register("note")}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="min-w-24"
            >
              {form.formState.isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
