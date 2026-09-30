"use client";

import * as React from "react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, MessageSquareText, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAccounts, usePendingImports } from "@/lib/finance/hooks";
import { retryMatchPendingImport } from "@/lib/finance/sms-import-mutations";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { PendingImportReviewDialog } from "@/components/pending-import-review-dialog";
import { useStaggerReveal } from "@/lib/motion/use-stagger-reveal";

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

export function PendingImportsPanel() {
  const { user } = useAuth();
  const { pendingImports, loading } = usePendingImports();
  const { accounts } = useAccounts();
  const [selected, setSelected] = React.useState<any | null>(null);
  const [recheckingAll, setRecheckingAll] = React.useState(false);
  const [panelExpanded, setPanelExpanded] = React.useState(false);

  const accountById = React.useMemo(
    () => new Map((accounts as any[]).map((a) => [a.id, a])),
    [accounts],
  );

  const unmatched = (pendingImports as any[]).filter((item) => !item.accountId);

  const handleRecheckAll = async () => {
    if (!user || unmatched.length === 0) return;
    setRecheckingAll(true);
    try {
      let matchedCount = 0;
      for (const item of unmatched) {
        try {
          if (await retryMatchPendingImport(user.uid, item.id)) matchedCount += 1;
        } catch {
          // Keep going — one bad doc shouldn't block the rest of the backlog.
        }
      }
      if (matchedCount > 0) {
        toast.success(`Matched ${matchedCount} message${matchedCount !== 1 ? "s" : ""}`);
      } else {
        toast.info("No matches yet", {
          description: "Add or fix a message rule in Settings, then try again.",
        });
      }
    } finally {
      setRecheckingAll(false);
    }
  };

  const pillsRef = useStaggerReveal<HTMLDivElement>("[data-stagger-item]", [
    (pendingImports as any[]).length,
    panelExpanded,
  ]);

  if (loading || (pendingImports as any[]).length === 0) return null;

  return (
    <>
      <CollapsiblePanel
        storageKey="cashly:messages-waiting-expanded:v1"
        icon={<MessageSquareText className="h-4 w-4" />}
        iconClassName="bg-sky-500/12 text-sky-600 dark:text-sky-400"
        title="Messages"
        onExpandedChange={setPanelExpanded}
        summary={
          unmatched.length > 0 ? (
            <span className="rounded-full bg-sky-500/12 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
              {unmatched.length} need review
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {(pendingImports as any[]).length} waiting
            </span>
          )
        }
      >
        <div className="space-y-2">
          {unmatched.length > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-xs"
                disabled={recheckingAll}
                onClick={() => void handleRecheckAll()}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {recheckingAll ? "Checking…" : "Re-check all"}
              </Button>
            </div>
          )}

          <div ref={pillsRef} className="flex flex-wrap gap-2">
            {(pendingImports as any[]).slice(0, 8).map((item) => {
              const account = item.accountId ? accountById.get(item.accountId) : null;
              const toAccount = item.toAccountId ? accountById.get(item.toAccountId) : null;
              const currency = formatCurrencyCode(item.currency ?? account?.currency);
              const isIncome = item.kind === "income";
              const isTransfer = item.kind === "transfer";
              const Icon = isTransfer ? ArrowLeftRight : isIncome ? ArrowUpRight : ArrowDownRight;
              const matched = typeof item.amount === "number";

              return (
                <button
                  key={item.id}
                  type="button"
                  data-stagger-item
                  onClick={() => setSelected(item)}
                  className={`motion-expressive press-expressive flex max-w-full items-center gap-2 rounded-full border py-1.5 pl-3 pr-3 text-left text-sm ${
                    matched
                      ? isTransfer
                        ? "bg-sky-500/10 border-sky-500/20"
                        : isIncome
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : "bg-rose-500/10 border-rose-500/20"
                      : "bg-muted/40 border-border"
                  }`}
                >
                  {matched ? (
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium">
                    {matched
                      ? isTransfer
                        ? `${account?.name ?? "Unknown"} → ${toAccount?.name ?? "Unknown"}`
                        : (account?.name ?? "Unknown account")
                      : "Unrecognized message"}
                  </span>
                  {matched && (
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatMoney(item.amount, currency)}
                    </span>
                  )}
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {toDate(item.receivedAt).toLocaleDateString()}
                  </span>
                </button>
              );
            })}
            {(pendingImports as any[]).length > 8 && (
              <Badge variant="outline" className="rounded-full px-3 py-1.5">
                +{(pendingImports as any[]).length - 8} more
              </Badge>
            )}
          </div>
        </div>
      </CollapsiblePanel>

      <PendingImportReviewDialog pendingImport={selected} onClose={() => setSelected(null)} />
    </>
  );
}
