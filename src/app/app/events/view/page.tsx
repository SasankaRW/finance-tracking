"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, MapPin, Receipt } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useEvents, useTransactions, useAccounts, useCategories } from "@/lib/finance/hooks";
import { DEFAULT_CURRENCY } from "@/shared/currency";
import { formatMoney } from "@/lib/format";
import { CreateTransactionDialog } from "@/app/app/transactions/create-transaction-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function EventDetailContent() {
    const searchParams = useSearchParams();
    const eventId = searchParams.get("id") ?? "";

    const { events, loading: eventsLoading } = useEvents();
    const event = React.useMemo(() => (events as any[]).find((e) => e.id === eventId) ?? null, [events, eventId]);

    const { accounts } = useAccounts();
    const { categories: expenseCats } = useCategories("expense");
    const { categories: incomeCats } = useCategories("income");
    const allCategories = React.useMemo(() => [...expenseCats, ...incomeCats], [expenseCats, incomeCats]);

    const { transactions, loading: txLoading } = useTransactions({ eventId: eventId || "skip" });

    const summary = React.useMemo(() => {
        let spent = 0;
        let income = 0;
        for (const t of transactions as any[]) {
            if (t?.kind === "expense") spent += t?.amount ?? 0;
            if (t?.kind === "income") income += t?.amount ?? 0;
        }
        return { spent, income, count: transactions.length };
    }, [transactions]);

    if (eventsLoading) {
        return (
            <Card>
                <CardContent className="py-10 text-sm text-muted-foreground text-center">
                    Loading trip…
                </CardContent>
            </Card>
        );
    }

    if (!event) {
        return (
            <Card>
                <CardContent className="py-10 text-center">
                    <div className="text-sm font-medium">Trip not found</div>
                    <Button asChild variant="outline" className="mt-4">
                        <Link href="/app/events">Back to Trips</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const currency = event.currency ?? DEFAULT_CURRENCY;
    const min = event.budgetMin ?? 0;
    const max = event.budgetMax ?? 0;
    const remaining = max - summary.spent;
    const pct = max > 0 ? Math.min(100, Math.round((summary.spent / max) * 100)) : 0;
    const over = max > 0 && summary.spent > max;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-3">
                        <Button asChild variant="ghost" size="sm" className="-ml-2">
                            <Link href="/app/events">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Trips
                            </Link>
                        </Button>
                        <Badge variant="secondary" className="font-mono text-xs">
                            {event.status === "archived" ? "Archived" : "Active"}
                        </Badge>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight truncate mt-2">{event.name}</h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">
                            Budget {formatMoney(min, currency)} – {formatMoney(max, currency)}
                        </span>
                    </p>
                </div>

                <CreateTransactionDialog triggerLabel="Add Trip Expense" defaultEventId={eventId} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border-2 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Spent</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{formatMoney(summary.spent, currency)}</div>
                        <div className={`text-xs mt-1 ${over ? "text-destructive" : "text-muted-foreground"}`}>
                            {over ? "Over budget" : `${formatMoney(Math.max(0, remaining), currency)} remaining`}
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-3">
                            <div
                                className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Income (tagged)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{formatMoney(summary.income, currency)}</div>
                        <div className="text-xs mt-1 text-muted-foreground">Optional: refunds / reimbursements</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tabular-nums">{summary.count}</div>
                        <div className="text-xs mt-1 text-muted-foreground">Tagged to this trip</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Receipt className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Trip Transactions</CardTitle>
                            <CardDescription>Only transactions tagged to this trip</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="pl-6 w-[120px]">Date</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="text-right w-[140px] pr-6">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {txLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                        Loading transactions…
                                    </TableCell>
                                </TableRow>
                            ) : transactions.length ? (
                                (transactions as any[]).map((t) => {
                                    const occurredAt = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date();
                                    const accountName = t.accountId ? accounts.find((a: any) => a.id === t.accountId)?.name : "";
                                    const categoryName = t.categoryId ? allCategories.find((c: any) => c.id === t.categoryId)?.name : "";
                                    return (
                                        <TableRow key={t.id}>
                                            <TableCell className="pl-6">
                                                <div className="font-medium">{format(occurredAt, "MMM d")}</div>
                                                <div className="text-xs text-muted-foreground">{format(occurredAt, "yyyy")}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium truncate max-w-[260px]">{t.note || (t.kind ?? "transaction")}</div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {accountName}
                                                    {categoryName ? ` · ${categoryName}` : ""}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <span
                                                    className={`font-semibold tabular-nums ${t.kind === "income"
                                                            ? "text-emerald-600"
                                                            : t.kind === "expense"
                                                                ? "text-rose-600"
                                                                : ""
                                                        }`}
                                                >
                                                    {t.kind === "expense" ? "-" : t.kind === "income" ? "+" : ""}
                                                    {formatMoney(t.amount ?? 0, currency)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-40 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                                <Receipt className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium">No trip transactions yet</p>
                                                <p className="text-sm text-muted-foreground">Add an expense and tag it to this trip</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default function EventDetailPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <EventDetailContent />
        </React.Suspense>
    );
}
