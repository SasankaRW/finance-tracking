"use client";

import * as React from "react";
import { format, startOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { formatMoney } from "@/lib/format";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface TransactionData {
  date: Date;
  amount: number;
  kind: "income" | "expense" | "transfer";
  currency?: string;
}

interface TransactionTrendChartProps {
  transactions: TransactionData[];
  dateRange: { start: Date; end: Date };
  className?: string;
}

type AggregationPeriod = "daily" | "weekly" | "monthly";

interface ChartDataPoint {
  date: string;
  dateObj: Date;
  income: number;
  expense: number;
  net: number;
}

function getAggregationPeriod(start: Date, end: Date): AggregationPeriod {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 31) return "daily";
  if (days <= 90) return "weekly";
  return "monthly";
}

function aggregateTransactions(
  transactions: TransactionData[],
  start: Date,
  end: Date,
  period: AggregationPeriod
): ChartDataPoint[] {
  let intervals: Date[];

  switch (period) {
    case "daily":
      intervals = eachDayOfInterval({ start, end });
      break;
    case "weekly":
      intervals = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      break;
    case "monthly":
      intervals = eachMonthOfInterval({ start, end });
      break;
  }

  const dataMap = new Map<string, { income: number; expense: number }>();

  // Initialize all intervals with zero
  intervals.forEach((date) => {
    const key = period === "daily"
      ? format(date, "yyyy-MM-dd")
      : period === "weekly"
        ? format(date, "yyyy-MM-dd")
        : format(date, "yyyy-MM");

    dataMap.set(key, { income: 0, expense: 0 });
  });

  // Aggregate transactions
  transactions.forEach((txn) => {
    let key: string;
    const txnDate = startOfDay(txn.date);

    switch (period) {
      case "daily":
        key = format(txnDate, "yyyy-MM-dd");
        break;
      case "weekly":
        key = format(startOfWeek(txnDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
        break;
      case "monthly":
        key = format(startOfMonth(txnDate), "yyyy-MM");
        break;
    }

    const existing = dataMap.get(key);
    if (existing) {
      if (txn.kind === "income") {
        existing.income += txn.amount;
      } else if (txn.kind === "expense") {
        existing.expense += txn.amount;
      }
    }
  });

  // Convert to array with net calculation
  return Array.from(dataMap.entries()).map(([dateStr, values]) => ({
    date: dateStr,
    dateObj: new Date(dateStr),
    income: values.income,
    expense: values.expense,
    net: values.income - values.expense,
  }));
}

function formatXAxis(dateStr: string, period: AggregationPeriod, isMobile: boolean): string {
  const date = new Date(dateStr);

  if (isMobile) {
    switch (period) {
      case "daily":
        return format(date, "d");
      case "weekly":
        return format(date, "d");
      case "monthly":
        return format(date, "MMM");
    }
  }

  switch (period) {
    case "daily":
      return format(date, "MMM d");
    case "weekly":
      return format(date, "MMM d");
    case "monthly":
      return format(date, "MMM yy");
  }
}

export function TransactionTrendChart({
  transactions,
  dateRange,
  className = "",
}: TransactionTrendChartProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const period = getAggregationPeriod(dateRange.start, dateRange.end);
  const chartData = aggregateTransactions(transactions, dateRange.start, dateRange.end, period);

  // Calculate summary stats
  const totalIncome = chartData.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = chartData.reduce((sum, d) => sum + d.expense, 0);
  const netChange = totalIncome - totalExpense;
  const avgIncome = chartData.length > 0 ? totalIncome / chartData.length : 0;
  const avgExpense = chartData.length > 0 ? totalExpense / chartData.length : 0;

  const chartHeight = isMobile ? 220 : 280;
  const margins = isMobile
    ? { top: 5, right: 5, left: 0, bottom: 0 }
    : { top: 10, right: 10, left: 0, bottom: 0 };

  return (
    <div className={`space-y-4 animate-fade-in ${className}`}>
      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Total Income */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Total Income</span>
          </div>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">
            +{formatMoney(totalIncome)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Avg {formatMoney(avgIncome)}/period
          </p>
        </div>

        {/* Total Expense */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500/10 to-rose-500/5 border border-rose-500/20">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Total Expense</span>
          </div>
          <p className="text-lg font-bold text-rose-600 tabular-nums">
            -{formatMoney(totalExpense)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Avg {formatMoney(avgExpense)}/period
          </p>
        </div>

        {/* Net Change */}
        <div className={`p-3 rounded-xl bg-gradient-to-br col-span-2 lg:col-span-1 ${netChange >= 0
          ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
          : 'from-rose-500/10 to-rose-500/5 border-rose-500/20'
          } border`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`h-6 w-6 rounded-lg flex items-center justify-center ${netChange >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
              }`}>
              <DollarSign className={`h-3.5 w-3.5 ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Net Change</span>
          </div>
          <p className={`text-lg font-bold tabular-nums ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netChange >= 0 ? '+' : ''}{formatMoney(netChange)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {netChange >= 0 ? 'Net savings' : 'Net deficit'} this period
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart
            data={chartData}
            margin={margins}
          >
            <defs>
              {/* Income gradient */}
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(168, 76%, 42%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(168, 76%, 42%)" stopOpacity={0} />
              </linearGradient>

              {/* Expense gradient */}
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.15}
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatXAxis(value, period, isMobile)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
              axisLine={false}
              interval={isMobile ? "preserveEnd" : "preserveStartEnd"}
              tick={{ fill: "#ffffff" }}
              dy={5}
            />

            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 32 : 45}
              domain={[0, 'auto']}
              tickFormatter={(value) => {
                if (value >= 1000) return `${Math.round(value / 1000)}k`;
                if (value === 0) return '0';
                return value.toString();
              }}
              tick={{ fill: "#ffffff" }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;

                const data = payload[0].payload;
                return (
                  <div className="rounded-xl border bg-background/95 backdrop-blur-md p-3 shadow-2xl">
                    <p className="mb-2 text-xs font-semibold">
                      {formatXAxis(data.date, period, false)}
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-xs text-muted-foreground">Income</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 tabular-nums">
                          +{formatMoney(data.income)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-rose-500" />
                          <span className="text-xs text-muted-foreground">Expense</span>
                        </div>
                        <span className="text-xs font-bold text-rose-600 tabular-nums">
                          -{formatMoney(data.expense)}
                        </span>
                      </div>

                      <div className="pt-1.5 mt-1.5 border-t">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium">Net</span>
                          <span className={`text-xs font-bold tabular-nums ${data.net >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}>
                            {data.net >= 0 ? "+" : ""}{formatMoney(data.net)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
              cursor={{
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "5 5",
                opacity: 0.3
              }}
            />

            {/* Expense Area */}
            <Area
              type="monotone"
              dataKey="expense"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              fill="url(#expenseGradient)"
              animationDuration={1000}
              animationBegin={0}
            />

            {/* Income Area */}
            <Area
              type="monotone"
              dataKey="income"
              stroke="hsl(168, 76%, 42%)"
              strokeWidth={2}
              fill="url(#incomeGradient)"
              animationDuration={1000}
              animationBegin={200}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-muted-foreground">Expense</span>
          </div>
        </div>
      </div>
    </div>
  );
}
