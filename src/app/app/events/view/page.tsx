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
        <div className="space-y-6">
            {/* Back Button + Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Button asChild variant="outline" size="icon">
                        <Link href="/app/events">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                                {startAt && endAt
                                    ? `${format(startAt, "MMM d")} – ${format(endAt, "MMM d, yyyy")}`
                                    : event.status === "archived"
                                        ? "Archived"
                                        : "Active"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Budget Overview Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Budget Range
                            </CardTitle>
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <PiggyBank className="h-4 w-4 text-blue-600" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold tabular-nums">
                            {formatMoney(budgetMin, currency)} – {formatMoney(budgetMax, currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">planned spending</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Spent
                            </CardTitle>
                            <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                                <TrendingDown className="h-4 w-4 text-rose-600" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${over ? "text-destructive" : "text-rose-600"}`}>
                            {formatMoney(totalSpent, currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{eventTransactions.length} transactions</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Remaining
                            </CardTitle>
                            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${over ? "text-destructive" : "text-emerald-600"}`}>
                            {over ? "-" : ""}{formatMoney(Math.abs(remaining), currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {over ? "over budget" : "from budget max"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Usage
                            </CardTitle>
                            <div className={`h-8 w-8 rounded-full ${over ? "bg-destructive/10" : "bg-primary/10"} flex items-center justify-center`}>
                                <span className={`text-xs font-bold ${over ? "text-destructive" : "text-primary"}`}>
                                    {percent}%
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
                            <div
                                className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">of budget max</p>
                    </CardContent>
                </Card>
            </div>

            {/* Category Breakdown */}
            {categoryBreakdown.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Spending by Category</CardTitle>
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

            {/* Transactions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Event Transactions</CardTitle>
                    <CardDescription>All expenses tagged to this event</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {eventTransactions.length > 0 ? (
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
