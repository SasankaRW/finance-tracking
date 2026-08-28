"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Calendar, TrendingUp, PiggyBank, Archive } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { useEvents, useTransactions } from "@/lib/finance/hooks";
import { createEvent, deleteEvent } from "@/lib/finance/event-mutations";
import { formatMoney } from "@/lib/format";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY } from "@/shared/currency";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const createSchema = z
  .object({
    name: z.string().min(1).max(64),
    currency: z.string().min(3).max(3),
    budgetMin: z.number().finite().min(0),
    budgetMax: z.number().finite().min(0),
  })
  .superRefine((v, ctx) => {
    if (v.budgetMax < v.budgetMin) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Must be ≥ budget min" });
    }
  });

type CreateValues = z.infer<typeof createSchema>;

export default function EventsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { events, loading: eventsLoading } = useEvents();
  const { transactions } = useTransactions();

  const spentByEvent = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions as any[]) {
      if (t?.kind !== "expense") continue;
      const eid = t?.eventId;
      if (!eid) continue;
      map.set(eid, (map.get(eid) ?? 0) + (t?.amount ?? 0));
    }
    return map;
  }, [transactions]);

  const [open, setOpen] = React.useState(false);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", currency: DEFAULT_CURRENCY, budgetMin: 0, budgetMax: 0 },
  });

  const submitCreate = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      await createEvent(user.uid, {
        name: values.name.trim(),
        currency: values.currency,
        budgetMin: values.budgetMin,
        budgetMax: values.budgetMax,
      });
      toast.success("Event created");
      setOpen(false);
      form.reset({ name: "", currency: values.currency, budgetMin: 0, budgetMax: 0 });
    } catch (e) {
      toast.error("Failed to create event", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Events</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Track event budgets separately while still deducting from real accounts
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
              <DialogDescription>
                Set a budget range and then tag expenses to this event
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitCreate}>
              <DialogBody className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Name
                  </Label>
                  <Input
                    placeholder="e.g. Japan 2026"
                    className="h-11"
                    {...form.register("name")}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2 col-span-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Currency
                    </Label>
                    <Select
                      value={form.watch("currency")}
                      onValueChange={(v) => form.setValue("currency", v, { shouldDirty: true })}
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

                  <div className="space-y-2 col-span-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Budget min
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      className="h-11"
                      {...form.register("budgetMin", { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-2 col-span-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Budget max
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      className="h-11"
                      {...form.register("budgetMax", { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-[2rem] bg-card shadow-sm sm:grid-cols-4 sm:divide-y-0">
        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Events
          </div>
          <p className="mt-2 font-display text-lg font-bold tabular-nums sm:text-2xl">{events.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {events.filter((e: any) => e.status !== "archived").length} active
          </p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <PiggyBank className="h-3.5 w-3.5 text-blue-600" />
            Budget
          </div>
          <p className="mt-2 truncate font-display text-lg font-bold tabular-nums sm:text-2xl">
            {formatMoney(events.reduce((sum: number, e: any) => sum + (e.budgetMax ?? 0), 0))}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">across all events</p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <TrendingUp className="h-3.5 w-3.5 text-rose-600" />
            Spent
          </div>
          <p className="mt-2 truncate font-display text-lg font-bold tabular-nums text-rose-600 sm:text-2xl">
            {formatMoney(Array.from(spentByEvent.values()).reduce((sum, val) => sum + val, 0))}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">from event transactions</p>
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <Archive className="h-3.5 w-3.5 text-amber-600" />
            Archived
          </div>
          <p className="mt-2 font-display text-lg font-bold tabular-nums sm:text-2xl">
            {events.filter((e: any) => e.status === "archived").length}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">completed events</p>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {eventsLoading ? (
          <div className="rounded-[2rem] bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:col-span-2 lg:col-span-3">
            Loading events…
          </div>
        ) : events.length ? (
          (events as any[]).map((e) => {
            const spent = spentByEvent.get(e.id) ?? 0;
            const min = e.budgetMin ?? 0;
            const max = e.budgetMax ?? 0;
            const remaining = max - spent;
            const currency = e.currency ?? DEFAULT_CURRENCY;
            const startAt =
              e.startAt && typeof e.startAt?.toDate === "function" ? e.startAt.toDate() : null;
            const endAt =
              e.endAt && typeof e.endAt?.toDate === "function" ? e.endAt.toDate() : null;

            const pct = max > 0 ? Math.min(100, Math.round((spent / max) * 100)) : 0;
            const over = max > 0 && spent > max;

            return (
              <div
                key={e.id}
                className="motion-expressive rounded-[2rem] bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display truncate text-base font-bold">{e.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {startAt && endAt
                          ? `${format(startAt, "MMM d")} – ${format(endAt, "MMM d, yyyy")}`
                          : e.status === "archived"
                            ? "Archived"
                            : "Active"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Delete event"
                    className="motion-expressive press-expressive flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={async () => {
                      if (!user) return;
                      if (!(await confirm({ title: "Delete this trip?", destructive: true }))) return;
                      try {
                        await deleteEvent(user.uid, e.id);
                        toast.success("Event deleted");
                      } catch (err) {
                        toast.error("Failed to delete", {
                          description: err instanceof Error ? err.message : undefined,
                        });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className="font-display text-xl font-bold tabular-nums">{formatMoney(spent, currency)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Budget range</p>
                    <p className="text-sm font-medium tabular-nums">
                      {formatMoney(min, currency)} – {formatMoney(max, currency)}
                    </p>
                    <p className={`mt-0.5 text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                      {over ? "Over budget" : `${formatMoney(Math.max(0, remaining), currency)} remaining`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <Link
                  href={`/app/events/view?id=${e.id}`}
                  className="motion-expressive press-expressive mt-4 flex h-10 w-full items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                >
                  View Details
                </Link>
              </div>
            );
          })
        ) : (
          <div className="rounded-[2rem] border border-dashed p-8 text-center md:col-span-2 lg:col-span-3">
            <p className="text-sm font-medium">No events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an event and tag expenses to keep them grouped under one budget.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


