"use client";

import * as React from "react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, HandCoins, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { createDebt, deleteDebt } from "@/lib/finance/debt-mutations";
import { useDebts } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { useStaggerReveal } from "@/lib/motion/use-stagger-reveal";
import { COMMON_CURRENCIES } from "@/shared/currency";
import { SettleDebtDialog } from "@/components/settle-debt-dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { Badge } from "@/components/ui/badge";
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

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

export function DebtPillsPanel() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { debts, loading } = useDebts();
  const [open, setOpen] = React.useState(false);
  const [personName, setPersonName] = React.useState("");
  const [direction, setDirection] = React.useState<"owed_to_me" | "i_owe">("owed_to_me");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState<string>(COMMON_CURRENCIES[0]);
  const [dueAt, setDueAt] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [settlingDebt, setSettlingDebt] = React.useState<any | null>(null);

  const activeDebts = React.useMemo(
    () => (debts as any[]).filter((debt) => debt.status !== "settled"),
    [debts],
  );
  const pillsRef = useStaggerReveal<HTMLDivElement>("[data-stagger-item]", [activeDebts.length, loading]);

  const totals = React.useMemo(() => {
    let owedToMe = 0;
    let iOwe = 0;

    for (const debt of activeDebts) {
      if (debt.direction === "owed_to_me") owedToMe += debt.amount ?? 0;
      if (debt.direction === "i_owe") iOwe += debt.amount ?? 0;
    }

    return { owedToMe, iOwe };
  }, [activeDebts]);

  const resetForm = () => {
    setPersonName("");
    setDirection("owed_to_me");
    setAmount("");
    setCurrency(COMMON_CURRENCIES[0]);
    setDueAt("");
    setNote("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      await createDebt(user.uid, {
        personName,
        direction,
        amount: parsedAmount,
        currency,
        dueAt: dueAt ? new Date(`${dueAt}T00:00:00`) : undefined,
        note: note.trim() || undefined,
      });
      toast.success("Money tracker added");
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error("Failed to add tracker", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="surface-tonal">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Borrowed Money</CardTitle>
            <CardDescription>
              Track who owes you and what you need to pay back.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Money
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Borrowed Money</DialogTitle>
                <DialogDescription>
                  Add money someone owes you or money you need to pay back.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submit}>
                <DialogBody className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={personName}
                      onChange={(event) => setPersonName(event.target.value)}
                      placeholder="Person name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={direction} onValueChange={(value) => setDirection(value as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owed_to_me">They owe me</SelectItem>
                        <SelectItem value="i_owe">I owe them</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label>Amount</Label>
                      <Input
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label>Due date optional</Label>
                    <Input
                      value={dueAt}
                      onChange={(event) => setDueAt(event.target.value)}
                      type="date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Note optional</Label>
                    <Input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="e.g., Lunch, fuel, short loan"
                      maxLength={160}
                    />
                  </div>
                </DialogBody>

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="min-w-24">
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            <ArrowDownLeft className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            Owes me {formatMoney(totals.owedToMe)}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-rose-600" />
            I owe {formatMoney(totals.iOwe)}
          </Badge>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading borrowed money...</div>
        ) : activeDebts.length ? (
          <div ref={pillsRef} className="flex flex-wrap gap-2">
            {activeDebts.map((debt: any) => {
              const isReceivable = debt.direction === "owed_to_me";
              const due = toDate(debt.dueAt);
              const cur = formatCurrencyCode(debt.currency);

              return (
                <div
                  key={debt.id}
                  data-stagger-item
                  className={`flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm shadow-sm ${
                    isReceivable
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-rose-500/10 border-rose-500/20"
                  }`}
                >
                  <HandCoins className={`h-4 w-4 shrink-0 ${isReceivable ? "text-emerald-600" : "text-rose-600"}`} />
                  <span className="truncate font-medium">{debt.personName}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMoney(debt.amount ?? 0, cur)}
                  </span>
                  {due && (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      due {format(due, "MMM d")}
                    </span>
                  )}
                  <RowActionsMenu
                    ariaLabel={`${debt.personName} actions`}
                    triggerClassName="-mr-1 shrink-0"
                    actions={[
                      {
                        label: isReceivable ? "Mark received" : "Mark paid",
                        icon: CheckCircle2,
                        onClick: () => setSettlingDebt(debt),
                      },
                      {
                        label: "Delete",
                        icon: Trash2,
                        destructive: true,
                        onClick: async () => {
                          if (!user) return;
                          if (!(await confirm({ title: "Delete this money tracker?", destructive: true }))) return;
                          try {
                            await deleteDebt(user.uid, debt.id);
                            toast.success("Money tracker deleted");
                          } catch (err) {
                            toast.error("Failed to delete tracker", {
                              description: err instanceof Error ? err.message : undefined,
                            });
                          }
                        },
                      },
                    ]}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium">No borrowed money tracked yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add money owed to you or money you need to pay back.
            </p>
          </div>
        )}
      </CardContent>

      <SettleDebtDialog
        debt={settlingDebt}
        open={settlingDebt !== null}
        onOpenChange={(next) => {
          if (!next) setSettlingDebt(null);
        }}
      />
    </Card>
  );
}
