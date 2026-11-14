"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts } from "@/lib/finance/hooks";
import { settleDebt } from "@/lib/finance/debt-mutations";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
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

type SettleDebt = {
  id: string;
  personName: string;
  direction: "owed_to_me" | "i_owe";
  amount: number;
  currency?: string;
};

export function SettleDebtDialog({
  debt,
  open,
  onOpenChange,
}: {
  debt: SettleDebt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const debtCurrency = formatCurrencyCode(debt?.currency);
  const isReceivable = debt?.direction === "owed_to_me";

  React.useEffect(() => {
    if (!open) return;
    const match = (accounts as any[]).find(
      (a) => formatCurrencyCode(a.currency) === debtCurrency,
    );
    setAccountId(match?.id ?? null);
  }, [open, accounts, debtCurrency]);

  const confirm = async () => {
    if (!user || !debt || !accountId) return;
    setSaving(true);
    try {
      await settleDebt(user.uid, debt.id, accountId);
      void hapticSuccess();
      toast.success(
        isReceivable ? `Added to your balance` : `Marked as paid`,
      );
      onOpenChange(false);
    } catch (err) {
      void hapticError();
      toast.error("Couldn't settle this tracker", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReceivable ? "Receive money" : "Pay back"}
          </DialogTitle>
          <DialogDescription>
            {debt
              ? isReceivable
                ? `${debt.personName} paid you back ${formatMoney(debt.amount, debtCurrency)}. Which account should it land in?`
                : `You paid ${debt.personName} back ${formatMoney(debt.amount, debtCurrency)}. Which account did it come from?`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {(accounts as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add an account first to settle this tracker.
            </p>
          ) : (
            <div className="space-y-2">
              {(accounts as any[]).map((account) => {
                const accountCurrency = formatCurrencyCode(account.currency);
                const disabled = accountCurrency !== debtCurrency;
                const selected = accountId === account.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setAccountId(account.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : disabled
                          ? "border-border/50 opacity-40"
                          : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{account.name}</p>
                      {disabled && (
                        <p className="text-xs text-muted-foreground">
                          {accountCurrency} account — pick a {debtCurrency} one
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatMoney(account.balance ?? 0, accountCurrency)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!accountId || saving}
            className="min-w-28"
            onClick={() => void confirm()}
          >
            {saving ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
