"use client";

import * as React from "react";
import {
    startOfMonth,
    endOfMonth,
    subMonths,
    differenceInDays,
    eachDayOfInterval,
    format as formatDate
} from "date-fns";
import { Timestamp } from "firebase/firestore";
import { formatMoney } from "@/lib/format";
import { HOME_CURRENCY } from "@/shared/currency";

interface Transaction {
    occurredAt: Date | Timestamp;
    amount: number;
    kind: "income" | "expense" | "transfer";
    currency?: string;
}

interface TrendData {
    currentMonth: {
        income: number;
        expenses: number;
        net: number;
    };
    previousMonth: {
        income: number;
        expenses: number;
        net: number;
    };
    incomeChange: number;
    expenseChange: number;
    netChange: number;
    incomePercentChange: number;
    expensePercentChange: number;
}

interface QuickStats {
    averageDailySpending: number;
    daysRemainingInMonth: number;
    projectedMonthEnd: number;
    currentBalance: number;
}

interface SparklineData {
    dates: string[];
    values: number[];
}

export function useTrends(transactions: Transaction[]) {
    return React.useMemo(() => {
        const now = new Date();
        const currentMonthStart = startOfMonth(now);
        const currentMonthEnd = endOfMonth(now);
        const previousMonthStart = startOfMonth(subMonths(now, 1));
        const previousMonthEnd = endOfMonth(subMonths(now, 1));

        let currentIncome = 0;
        let currentExpenses = 0;
        let previousIncome = 0;
        let previousExpenses = 0;

        transactions.forEach((txn) => {
            const date = txn.occurredAt instanceof Timestamp
                ? txn.occurredAt.toDate()
                : new Date(txn.occurredAt);
            const amount = txn.amount || 0;

            // Current month
            if (date >= currentMonthStart && date <= currentMonthEnd) {
                if (txn.kind === "income") currentIncome += amount;
                if (txn.kind === "expense") currentExpenses += amount;
            }

            // Previous month
            if (date >= previousMonthStart && date <= previousMonthEnd) {
                if (txn.kind === "income") previousIncome += amount;
                if (txn.kind === "expense") previousExpenses += amount;
            }
        });

        const calculatePercentChange = (current: number, previous: number): number => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const trendData: TrendData = {
            currentMonth: {
                income: currentIncome,
                expenses: currentExpenses,
                net: currentIncome - currentExpenses,
            },
            previousMonth: {
                income: previousIncome,
                expenses: previousExpenses,
                net: previousIncome - previousExpenses,
            },
            incomeChange: currentIncome - previousIncome,
            expenseChange: currentExpenses - previousExpenses,
            netChange: (currentIncome - currentExpenses) - (previousIncome - previousExpenses),
            incomePercentChange: calculatePercentChange(currentIncome, previousIncome),
            expensePercentChange: calculatePercentChange(currentExpenses, previousExpenses),
        };

        return trendData;
    }, [transactions]);
}

export function useQuickStats(transactions: Transaction[], currentBalance: number) {
    return React.useMemo(() => {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
        const daysElapsed = differenceInDays(now, monthStart) + 1;
        const daysRemaining = differenceInDays(monthEnd, now);

        let monthExpenses = 0;

        transactions.forEach((txn) => {
            const date = txn.occurredAt instanceof Timestamp
                ? txn.occurredAt.toDate()
                : new Date(txn.occurredAt);

            if (date >= monthStart && date <= now && txn.kind === "expense") {
                monthExpenses += txn.amount || 0;
            }
        });

        const averageDailySpending = daysElapsed > 0 ? monthExpenses / daysElapsed : 0;
        const projectedTotalSpending = averageDailySpending * daysInMonth;
        const projectedMonthEnd = currentBalance - (averageDailySpending * daysRemaining);

        const stats: QuickStats = {
            averageDailySpending,
            daysRemainingInMonth: daysRemaining,
            projectedMonthEnd,
            currentBalance,
        };

        return stats;
    }, [transactions, currentBalance]);
}

export function useSparklineData(transactions: Transaction[], days: number = 30) {
    return React.useMemo(() => {
        const now = new Date();
        const startDate = subMonths(now, 1);
        const dateRange = eachDayOfInterval({ start: startDate, end: now });

        const dailyBalances = new Map<string, number>();
        let runningBalance = 0;

        // Sort transactions by date
        const sortedTxns = [...transactions]
            .filter((t) => {
                const date = t.occurredAt instanceof Timestamp
                    ? t.occurredAt.toDate()
                    : new Date(t.occurredAt);
                return date <= now;
            })
            .sort((a, b) => {
                const dateA = a.occurredAt instanceof Timestamp ? a.occurredAt.toDate() : new Date(a.occurredAt);
                const dateB = b.occurredAt instanceof Timestamp ? b.occurredAt.toDate() : new Date(b.occurredAt);
                return dateA.getTime() - dateB.getTime();
            });

        // Calculate running balance for each day
        dateRange.forEach((date) => {
            const dateKey = formatDate(date, "yyyy-MM-dd");

            // Add transactions for this day
            sortedTxns.forEach((txn) => {
                const txnDate = txn.occurredAt instanceof Timestamp
                    ? txn.occurredAt.toDate()
                    : new Date(txn.occurredAt);
                const txnDateKey = formatDate(txnDate, "yyyy-MM-dd");

                if (txnDateKey === dateKey) {
                    if (txn.kind === "income") runningBalance += txn.amount || 0;
                    if (txn.kind === "expense") runningBalance -= txn.amount || 0;
                }
            });

            dailyBalances.set(dateKey, runningBalance);
        });

        const sparklineData: SparklineData = {
            dates: Array.from(dailyBalances.keys()),
            values: Array.from(dailyBalances.values()),
        };

        return sparklineData;
    }, [transactions, days]);
}
