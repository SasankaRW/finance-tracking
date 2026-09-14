"use client";

import * as React from "react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { ArrowDownLeft, ArrowUpRight, Check, HandCoins } from "lucide-react";
import { useDebts } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { SettleDebtDialog } from "@/components/settle-debt-dialog";

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

export function DebtPillsSummary() {
  const { debts, loading } = useDebts();
  const [settlingDebt, setSettlingDebt] = React.useState<any | null>(null);

  const activeDebts = React.useMemo(
    () => (debts as any[]).filter((debt) => debt.status !== "settled"),
    [debts],
  );

  const totals = React.useMemo(() => {
    let owedToMe = 0;
    let iOwe = 0;

    for (const debt of activeDebts) {
      if (debt.direction === "owed_to_me") owedToMe += debt.amount ?? 0;
      if (debt.direction === "i_owe") iOwe += debt.amount ?? 0;
    }

    return { owedToMe, iOwe };
  }, [activeDebts]);

  if (loading || activeDebts.length === 0) return null;

  return (
    <>
      <CollapsiblePanel
        storageKey="cashly:borrowed-money-expanded:v1"
        icon={<HandCoins className="h-4 w-4" />}
        iconClassName="bg-primary/12 text-primary"
        title="Borrowed"
        summary={
          <>
            {totals.owedToMe > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                <ArrowDownLeft className="h-3 w-3" />
                {formatMoney(totals.owedToMe)}
              </span>
            )}
            {totals.iOwe > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-rose-500/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                <ArrowUpRight className="h-3 w-3" />
                {formatMoney(totals.iOwe)}
              </span>
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {activeDebts.slice(0, 8).map((debt: any) => {
            const isReceivable = debt.direction === "owed_to_me";
            const due = toDate(debt.dueAt);
            const cur = formatCurrencyCode(debt.currency);

            return (
              <div
                key={debt.id}
                className={`flex max-w-full items-center gap-2 rounded-full border py-1.5 pl-3 pr-1.5 text-sm ${
                  isReceivable
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-rose-500/10 border-rose-500/20"
                }`}
              >
                <span className="truncate font-medium">{debt.personName}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(debt.amount ?? 0, cur)}
                </span>
                {due && (
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    due {format(due, "MMM d")}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={isReceivable ? "Mark received" : "Mark paid"}
                  onClick={() => setSettlingDebt(debt)}
                  className={`motion-expressive press-expressive flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    isReceivable
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {activeDebts.length > 8 && (
            <Badge variant="outline" className="rounded-full px-3 py-1.5">
              +{activeDebts.length - 8} more
            </Badge>
          )}
        </div>
      </CollapsiblePanel>

      <SettleDebtDialog
        debt={settlingDebt}
        open={settlingDebt !== null}
        onOpenChange={(next) => {
          if (!next) setSettlingDebt(null);
        }}
      />
    </>
  );
}
