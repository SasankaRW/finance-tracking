"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Calendar, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-provider";
import { useEvents, useTransactions, useCategories } from "@/lib/finance/hooks";
import { formatMoney } from "@/lib/format";
import { DEFAULT_CURRENCY } from "@/shared/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function EventDetailPage() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const eventId = searchParams.get("id");

    const { events, loading: eventsLoading } = useEvents();
    const { transactions } = useTransactions();
    const { categories: expenseCategories } = useCategories("expense");

    const event = React.useMemo(() => {
        return (events as any[]).find((e) => e.id === eventId);
    }, [events, eventId]);

    const eventTransactions = React.useMemo(() => {
        return (transactions as any[]).filter((t) => t.eventId === eventId && t.kind === "expense");
    }, [transactions, eventId]);

    const categoryBreakdown = React.useMemo(() => {
        const map = new Map<string, number>();
        eventTransactions.forEach((t) => {
            const catId = t.categoryId ?? "uncategorized";
            map.set(catId, (map.get(catId) ?? 0) + (t.amount ?? 0));
        });

        const nameById = new Map(expenseCategories.map((c: any) => [c.id, c.name]));
        return Array.from(map.entries())
            .map(([categoryId, amount]) => ({
                categoryId,
                name: nameById.get(categoryId) ?? "Uncategorized",
                amount,
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [eventTransactions, expenseCategories]);

    const totalSpent = React.useMemo(() => {
        return eventTransactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
    }, [eventTransactions]);

    if (eventsLoading) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        Loading event details…
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-sm font-medium">Event not found</p>
                        <Button asChild variant="outline" className="mt-4">
                            <Link href="/app/events">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Events
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const currency = event.currency ?? DEFAULT_CURRENCY;
    const budgetMin = event.budgetMin ?? 0;
    const budgetMax = event.budgetMax ?? 0;
    const remaining = budgetMax - totalSpent;
    const percent = budgetMax > 0 ? Math.min(100, Math.round((totalSpent / budgetMax) * 100)) : 0;
    const over = budgetMax > 0 && totalSpent > budgetMax;

    const startAt = event.startAt && typeof event.startAt?.toDate === "function" ? event.startAt.toDate() : null;
    const endAt = event.endAt && typeof event.endAt?.toDate === "function" ? event.endAt.toDate() : null;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Back Button + Header */}
            <div className="flex items-center gap-3">
                <Button asChild variant="outline" size="icon" className="shrink-0">
                    <Link href="/app/events">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="min-w-0">
                    <h1 className="font-display truncate text-xl font-bold tracking-tight sm:text-2xl">{event.name}</h1>
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                            {startAt && endAt
                                ? `${format(startAt, "MMM d")} – ${format(endAt, "MMM d, yyyy")}`
                                : event.status === "archived"
                                    ? "Archived"
                                    : "Active"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Budget Overview */}
            <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-[2rem] bg-card shadow-sm sm:grid-cols-4 sm:divide-y-0">
                <div className="p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                        <PiggyBank className="h-3.5 w-3.5 text-blue-600" />
                        Budget range
                    </div>
                    <p className="mt-2 truncate font-display text-lg font-bold tabular-nums sm:text-xl">
                        {formatMoney(budgetMin, currency)} – {formatMoney(budgetMax, currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">planned spending</p>
                </div>

                <div className="p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                        <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                        Spent
                    </div>
                    <p className={`mt-2 truncate font-display text-lg font-bold tabular-nums sm:text-2xl ${over ? "text-destructive" : "text-rose-600"}`}>
                        {formatMoney(totalSpent, currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {eventTransactions.length} transaction{eventTransactions.length !== 1 ? "s" : ""}
                    </p>
                </div>

                <div className="p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        Remaining
                    </div>
                    <p className={`mt-2 truncate font-display text-lg font-bold tabular-nums sm:text-2xl ${over ? "text-destructive" : "text-emerald-600"}`}>
                        {over ? "-" : ""}{formatMoney(Math.abs(remaining), currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {over ? "over budget" : "from budget max"}
                    </p>
                </div>

                <div className="p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                        <span className={`font-bold ${over ? "text-destructive" : "text-primary"}`}>{percent}%</span>
                        used
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">of budget max</p>
                </div>
            </div>

            {/* Category Breakdown */}
            {categoryBreakdown.length > 0 && (
                <Card className="surface-tonal">
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">Spending by Category</CardTitle>
                        <CardDescription>Breakdown of expenses for this event</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {categoryBreakdown.map((cat) => {
                                const catPercent = totalSpent > 0 ? Math.round((cat.amount / totalSpent) * 100) : 0;
                                return (
                                    <div key={cat.categoryId} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{cat.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground">{catPercent}%</span>
                                                <span className="font-semibold tabular-nums">{formatMoney(cat.amount, currency)}</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-primary"
                                                style={{ width: `${catPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Transactions */}
            <Card className="surface-tonal gap-0 overflow-hidden py-0">
                <CardHeader className="p-4 pb-3 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Event Transactions</CardTitle>
                    <CardDescription>All expenses tagged to this event</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {eventTransactions.length > 0 ? (
                        <>
                            {/* Mobile list */}
                            <ul className="mx-4 mb-4 overflow-hidden rounded-[2rem] bg-card shadow-sm md:hidden">
                                {eventTransactions.map((t: any, idx: number) => {
                                    const date = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date(t.occurredAt);
                                    const catName = expenseCategories.find((c: any) => c.id === t.categoryId)?.name ?? "Uncategorized";
                                    return (
                                        <li
                                            key={t.id}
                                            className={`flex items-center justify-between gap-3 px-4 py-3.5 ${idx > 0 ? "border-t border-border/60" : ""}`}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">{t.notes || catName}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {catName} · {format(date, "MMM d, h:mm a")}
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-sm font-bold tabular-nums">
                                                {formatMoney(t.amount ?? 0, currency)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>

                            {/* Desktop table */}
                            <div className="hidden border-t md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead className="pl-6">Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right pr-6">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {eventTransactions.map((t: any) => {
                                            const date = t.occurredAt instanceof Timestamp ? t.occurredAt.toDate() : new Date(t.occurredAt);
                                            const catName = expenseCategories.find((c: any) => c.id === t.categoryId)?.name ?? "Uncategorized";

                                            return (
                                                <TableRow key={t.id}>
                                                    <TableCell className="pl-6">
                                                        <div className="text-sm">{format(date, "MMM d, yyyy")}</div>
                                                        <div className="text-xs text-muted-foreground">{format(date, "h:mm a")}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{t.notes || "—"}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="capitalize">
                                                            {catName}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <span className="font-semibold tabular-nums">
                                                            {formatMoney(t.amount ?? 0, currency)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    ) : (
                        <div className="py-12 text-center">
                            <p className="text-sm font-medium">No transactions yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Tag transactions to this event from the Transactions page
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
