"use client";

import * as React from "react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { ArrowDownLeft, ArrowUpRight, Check, HandCoins } from "@/components/icons";
import { useDebts } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { Pill } from "@/components/sonoma";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { SettleDebtDialog } from "@/components/settle-debt-dialog";
import { useStaggerReveal } from "@/lib/motion/use-stagger-reveal";

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

export function DebtPillsSummary() {
  const { debts, loading } = useDebts();
  const [settlingDebt, setSettlingDebt] = React.useState<any | null>(null);
  const [panelExpanded, setPanelExpanded] = React.useState(false);

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

  const pillsRef = useStaggerReveal<HTMLDivElement>("[data-stagger-item]", [activeDebts.length, panelExpanded]);

  if (loading || activeDebts.length === 0) return null;

  const totalPills = (
    <>
      {totals.owedToMe > 0 && (
        <Pill tone="green">
          <ArrowDownLeft className="h-3 w-3" />
          Owes me {formatMoney(totals.owedToMe)}
        </Pill>
      )}
      {totals.iOwe > 0 && (
        <Pill tone="coral">
          <ArrowUpRight className="h-3 w-3" />
          I owe {formatMoney(totals.iOwe)}
        </Pill>
      )}
    </>
  );

  return (
    <>
      <CollapsiblePanel
        storageKey="cashly:borrowed-money-expanded:v1"
        icon={<HandCoins className="h-4 w-4" />}
        tone="coral"
        title="Borrowed money"
        onExpandedChange={setPanelExpanded}
        summary={
          <>
            {totals.owedToMe > 0 && (
              <Pill tone="green">
                <ArrowDownLeft className="h-3 w-3" />
                {formatMoney(totals.owedToMe)}
              </Pill>
            )}
            {totals.iOwe > 0 && (
              <Pill tone="coral">
                <ArrowUpRight className="h-3 w-3" />
                {formatMoney(totals.iOwe)}
              </Pill>
            )}
          </>
        }
      >
        <div ref={pillsRef} className="flex flex-wrap gap-2">
          {activeDebts.slice(0, 8).map((debt: any) => {
            const isReceivable = debt.direction === "owed_to_me";
            const due = toDate(debt.dueAt);
            const cur = formatCurrencyCode(debt.currency);

            return (
              <div
                key={debt.id}
                className={`flex max-w-full items-center gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-sm ${
                  isReceivable ? "bg-green/16" : "bg-coral/16"
                }`}
              >
                <span className="truncate font-medium">{debt.personName}</span>
                <span className={`shrink-0 font-semibold tabular-nums ${isReceivable ? "text-green" : "text-coral"}`}>
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
                  data-compact
                  className={`sn-icon sm !size-7 ${isReceivable ? "!bg-green/16 !text-green" : "!bg-coral/16 !text-coral"}`}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {activeDebts.length > 8 && <Pill tone="neutral">+{activeDebts.length - 8} more</Pill>}
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
