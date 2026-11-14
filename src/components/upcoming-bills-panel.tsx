"use client";

import * as React from "react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Check, CalendarClock } from "@/components/icons";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts, useSubscriptions } from "@/lib/finance/hooks";
import { recordSubscriptionPayment } from "@/lib/finance/subscription-mutations";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { getBillKindIcon, getDueDateInfo } from "@/lib/finance/bill-status";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { useConfirm } from "@/components/confirm-dialog";
import { Pill } from "@/components/sonoma";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { useStaggerReveal } from "@/lib/motion/use-stagger-reveal";

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

export function UpcomingBillsPanel() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { subscriptions, loading } = useSubscriptions();
  const { accounts } = useAccounts();
  const [payingId, setPayingId] = React.useState<string | null>(null);
  const [panelExpanded, setPanelExpanded] = React.useState(false);

  const accountById = React.useMemo(
    () => new Map((accounts as any[]).map((a) => [a.id, a])),
    [accounts],
  );

  const dueBills = React.useMemo(() => {
    const now = new Date();
    return (subscriptions as any[])
      .filter((s) => s.status === "active")
      .map((s) => ({ s, nextDue: toDate(s.nextDueAt) }))
      .filter(({ nextDue }) => differenceInDays(nextDue, now) <= 7)
      .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime());
  }, [subscriptions]);

  // Drives both the header badge and the icon chip's color, so the panel reads
  // as urgent (rose) before you even open it.
  const { overdueCount, dueTodayCount } = React.useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    for (const { nextDue } of dueBills) {
      const variant = getDueDateInfo(nextDue).variant;
      if (variant === "destructive") overdue += 1;
      else if (variant === "default") dueToday += 1;
    }
    return { overdueCount: overdue, dueTodayCount: dueToday };
  }, [dueBills]);

  const handleMarkPaid = async (s: any, cur: string, acctName: string) => {
    if (!user) return;
    const ok = await confirm({
      title: `Mark "${s.name}" as paid?`,
      description: `Records ${formatMoney(s.amount ?? 0, cur)} as an expense from ${acctName}.`,
      confirmLabel: "Mark paid",
    });
    if (!ok) return;

    setPayingId(s.id);
    try {
      await recordSubscriptionPayment(user.uid, s.id);
      void hapticSuccess();
      const isLoan = s.kind === "loan";
      const remaining = isLoan
        ? Math.max((s.loanTotalPayments ?? 0) - (s.loanPaidPayments ?? 0), 0)
        : null;
      toast.success(isLoan && remaining === 1 ? "Loan completed" : "Payment recorded");
    } catch (e) {
      void hapticError();
      toast.error("Failed to record payment", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPayingId(null);
    }
  };

  const pillsRef = useStaggerReveal<HTMLDivElement>("[data-stagger-item]", [dueBills.length, panelExpanded]);

  if (loading || dueBills.length === 0) return null;

  return (
    <CollapsiblePanel
      storageKey="cashly:bills-due-expanded:v1"
      icon={<CalendarClock className="h-4 w-4" />}
      tone={overdueCount > 0 ? "coral" : "amber"}
      title="Bills due"
      onExpandedChange={setPanelExpanded}
      summary={
        overdueCount > 0 ? (
          <Pill tone="coral">{overdueCount} overdue</Pill>
        ) : dueTodayCount > 0 ? (
          <Pill tone="amber">{dueTodayCount} due today</Pill>
        ) : (
          <Pill tone="blue">{dueBills.length} upcoming</Pill>
        )
      }
    >
      <div ref={pillsRef} className="flex flex-wrap gap-2">
        {dueBills.slice(0, 8).map(({ s, nextDue }) => {
          const acct = accountById.get(s.accountId);
          const cur = formatCurrencyCode(s.currency ?? acct?.currency);
          const dueInfo = getDueDateInfo(nextDue);
          const KindIcon = getBillKindIcon(s.kind);
          const isOverdue = dueInfo.variant === "destructive";
          const isDueToday = dueInfo.variant === "default";

          return (
            <div
              key={s.id}
              data-stagger-item
              className={`flex max-w-full items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-sm ${
                isOverdue
                  ? "bg-coral/16"
                  : isDueToday
                    ? "bg-amber/16"
                    : "bg-white/[.07]"
              }`}
            >
              <KindIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{s.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatMoney(s.amount ?? 0, cur)}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {dueInfo.label}
              </span>
              <button
                type="button"
                aria-label="Mark paid"
                disabled={payingId === s.id}
                onClick={() => handleMarkPaid(s, cur, acct?.name ?? "your account")}
                className="motion-expressive press-expressive flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green/16 text-green disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {dueBills.length > 8 && (
          <Pill tone="neutral">+{dueBills.length - 8} more</Pill>
        )}
      </div>
    </CollapsiblePanel>
  );
}
