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
import { useEvents, useTransactions } from "@/lib/finance/hooks";
import { createEvent, deleteEvent } from "@/lib/finance/event-mutations";
import { formatMoney } from "@/lib/format";
import { COMMON_CURRENCIES, DEFAULT_CURRENCY } from "@/shared/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Events
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {events.filter((e: any) => e.status !== "archived").length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Budget
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(
                events.reduce((sum: number, e: any) => sum + (e.budgetMax ?? 0), 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">across all events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Spent
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-rose-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {formatMoney(
                Array.from(spentByEvent.values()).reduce((sum, val) => sum + val, 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">from event transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Archived
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Archive className="h-4 w-4 text-amber-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter((e: any) => e.status === "archived").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">completed events</p>
          </CardContent>
        </Card>
      </div>

      {/* Events Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {eventsLoading ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground text-center">
              Loading events…
            </CardContent>
          </Card>
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
              <Card key={e.id} className="card-hover relative overflow-hidden transition-smooth">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{e.name}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">
                          {startAt && endAt
                            ? `${format(startAt, "MMM d")} – ${format(endAt, "MMM d, yyyy")}`
                            : e.status === "archived"
                              ? "Archived"
                              : "Active"}
                        </span>
                      </CardDescription>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!user) return;
                        if (!confirm("Delete this trip?")) return;
                        try {
                          await deleteEvent(user.uid, e.id);
                          toast.success("Event deleted");
                        } catch (err) {
                          toast.error("Failed to delete", {
                            description: err instanceof Error ? err.message : undefined,
                          });
                        }
                      }}
                      aria-label="Delete event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Spent</div>
                      <div className="text-lg font-bold tabular-nums">
                        {formatMoney(spent, currency)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Budget range</div>
                      <div className="text-sm font-medium tabular-nums">
                        {formatMoney(min, currency)} – {formatMoney(max, currency)}
                      </div>
                      <div className={`text-xs mt-1 ${over ? "text-destructive" : "text-muted-foreground"}`}>
                        {over ? "Over budget" : `${formatMoney(Math.max(0, remaining), currency)} remaining`}
                      </div>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`progress-animated h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/app/events/view?id=${e.id}`}>View Details</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center">
              <div className="text-sm font-medium">No events yet</div>
              <div className="text-sm text-muted-foreground mt-1">
                Create an event and tag expenses to keep them grouped under one budget.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div >
  );
}


