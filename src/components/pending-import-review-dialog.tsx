"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { CalendarIcon, ChevronDown, MessageSquareText } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { useAccounts, useCategories } from "@/lib/finance/hooks";
import { approvePendingImport, dismissPendingImport } from "@/lib/finance/sms-import-mutations";
import { formatCurrencyCode } from "@/lib/format";
import {
  AccountSelect,
  CategorySelect,
  transactionTypes,
} from "@/app/app/transactions/transaction-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

function toDate(value: unknown, fallback: Date) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return fallback;
}

export function PendingImportReviewDialog({
  pendingImport,
  onClose,
}: {
  pendingImport: any | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { accounts } = useAccounts();
  const [kind, setKind] = React.useState<"income" | "expense">("expense");
  const [accountId, setAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [amountText, setAmountText] = React.useState("");
  const [occurredAt, setOccurredAt] = React.useState(new Date());
  const [note, setNote] = React.useState("");
  const [showRaw, setShowRaw] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const { categories } = useCategories(kind);

  React.useEffect(() => {
    if (!pendingImport) return;
    const receivedAt = toDate(pendingImport.receivedAt, new Date());
    setKind(pendingImport.kind === "income" ? "income" : "expense");
    setAccountId(pendingImport.accountId ?? "");
    setCategoryId("");
    setAmountText(typeof pendingImport.amount === "number" ? String(pendingImport.amount) : "");
    setOccurredAt(toDate(pendingImport.occurredAt, receivedAt));
    setNote(pendingImport.suggestedNote ?? "");
    setShowRaw(false);
  }, [pendingImport]);

  const account = (accounts as any[]).find((a) => a.id === accountId);
  const currency = formatCurrencyCode(account?.currency);
  const parsedAmount = amountText ? Number.parseFloat(amountText) : 0;
  const canApprove =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && Boolean(accountId) && Boolean(categoryId);

  const handleApprove = async () => {
    if (!user || !pendingImport || !canApprove) return;
    setSubmitting(true);
    try {
      await approvePendingImport(user.uid, pendingImport.id, {
        kind,
        amount: parsedAmount,
        accountId,
        categoryId,
        occurredAt,
        note: note.trim() || undefined,
      });
      toast.success("Transaction added");
      onClose();
    } catch (e) {
      toast.error("Failed to add transaction", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (!user || !pendingImport) return;
    const ok = await confirm({
      title: "Dismiss this message?",
      description: "It won't be added as a transaction. This can't be undone.",
      confirmLabel: "Dismiss",
      destructive: true,
    });
    if (!ok) return;
    try {
      await dismissPendingImport(user.uid, pendingImport.id);
      toast.success("Message dismissed");
      onClose();
    } catch (e) {
      toast.error("Failed to dismiss message", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <Dialog open={Boolean(pendingImport)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Message</DialogTitle>
          <DialogDescription>
            Confirm the details before adding this as a transaction.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {transactionTypes
              .filter((t) => t.value !== "transfer")
              .map((type) => {
                const Icon = type.icon;
                const selected = kind === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setKind(type.value as "income" | "expense");
                      setCategoryId("");
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

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Amount {currency ? `(${currency})` : ""}
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              className="h-12 text-lg font-semibold"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Account
              </Label>
              <AccountSelect
                accounts={accounts as any[]}
                value={accountId}
                onChange={setAccountId}
                label="Account"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Category
              </Label>
              <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
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
                <Calendar mode="single" selected={occurredAt} onSelect={(d) => d && setOccurredAt(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Note (optional)
            </Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" />
          </div>

          <div className="rounded-2xl border bg-muted/30">
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <MessageSquareText className="h-3.5 w-3.5" />
                Original message
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRaw ? "rotate-180" : ""}`} />
            </button>
            {showRaw && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                {pendingImport?.rawMessage}
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => void handleDismiss()}>
            Dismiss
          </Button>
          <Button disabled={!canApprove || submitting} onClick={() => void handleApprove()} className="min-w-24">
            {submitting ? "Adding..." : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
