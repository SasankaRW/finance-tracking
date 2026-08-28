"use client";

import * as React from "react";
import { Timestamp } from "firebase/firestore";
import { ArrowDownRight, ArrowUpRight, MessageSquareText } from "lucide-react";
import { useAccounts, usePendingImports } from "@/lib/finance/hooks";
import { formatCurrencyCode, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingImportReviewDialog } from "@/components/pending-import-review-dialog";

function toDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

export function PendingImportsPanel() {
  const { pendingImports, loading } = usePendingImports();
  const { accounts } = useAccounts();
  const [selected, setSelected] = React.useState<any | null>(null);

  const accountById = React.useMemo(
    () => new Map((accounts as any[]).map((a) => [a.id, a])),
    [accounts],
  );

  if (loading || (pendingImports as any[]).length === 0) return null;

  return (
    <>
      <Card className="surface-tonal py-3 shadow-sm sm:py-4">
        <CardHeader className="px-3 pb-2 sm:px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4 text-primary" />
            Messages Waiting for Review
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4">
          <div className="flex flex-wrap gap-2">
            {(pendingImports as any[]).slice(0, 8).map((item) => {
              const account = item.accountId ? accountById.get(item.accountId) : null;
              const currency = formatCurrencyCode(item.currency ?? account?.currency);
              const isIncome = item.kind === "income";
              const Icon = isIncome ? ArrowUpRight : ArrowDownRight;
              const matched = typeof item.amount === "number";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`motion-expressive press-expressive flex max-w-full items-center gap-2 rounded-full border py-2 pl-3 pr-3 text-left text-sm shadow-sm ${
                    matched
                      ? isIncome
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
                    {account?.name ?? (matched ? "Unknown account" : "Unrecognized message")}
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
              <Badge variant="outline" className="rounded-full px-3 py-2">
                +{(pendingImports as any[]).length - 8} more
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <PendingImportReviewDialog pendingImport={selected} onClose={() => setSelected(null)} />
    </>
  );
}
