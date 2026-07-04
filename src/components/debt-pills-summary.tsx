"use client";

import * as React from "react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { ArrowDownLeft, ArrowUpRight, Check, HandCoins } from "lucide-react";
import { useDebts } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="surface-tonal py-3 shadow-sm sm:py-4">
      <CardHeader className="px-3 pb-2 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HandCoins className="h-4 w-4 text-primary" />
            Borrowed Money
          </CardTitle>
          <div className="hidden flex-wrap gap-2 sm:flex">
            {totals.owedToMe > 0 && (
              <Badge variant="secondary" className="rounded-full">
                <ArrowDownLeft className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                Owes me {formatMoney(totals.owedToMe)}
              </Badge>
            )}
            {totals.iOwe > 0 && (
              <Badge variant="outline" className="rounded-full">
                <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-rose-600" />
                I owe {formatMoney(totals.iOwe)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-3 sm:px-4">
        <div className="flex flex-wrap gap-2 sm:hidden">
          {totals.owedToMe > 0 && (
            <Badge variant="secondary" className="rounded-full">
              <ArrowDownLeft className="h-3.5 w-3.5 mr-1 text-emerald-600" />
              Owes me {formatMoney(totals.owedToMe)}
            </Badge>
          )}
          {totals.iOwe > 0 && (
            <Badge variant="outline" className="rounded-full">
              <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-rose-600" />
              I owe {formatMoney(totals.iOwe)}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {activeDebts.slice(0, 8).map((debt: any) => {
            const isReceivable = debt.direction === "owed_to_me";
            const due = toDate(debt.dueAt);
            const cur = formatCurrencyCode(debt.currency);

            return (
              <div
                key={debt.id}
                className={`flex max-w-full items-center gap-2 rounded-full border py-2 pl-3 pr-2 text-sm shadow-sm ${
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
            <Badge variant="outline" className="rounded-full px-3 py-2">
              +{activeDebts.length - 8} more
            </Badge>
          )}
        </div>
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
