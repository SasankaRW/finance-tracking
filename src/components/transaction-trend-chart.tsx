"use client";

import * as React from "react";
import {
  format,
  startOfDay,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfWeek,
  startOfMonth,
} from "date-fns";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  LabelList,
} from "recharts";
import { formatMoney } from "@/lib/format";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartContainer } from "@/components/chart-container";

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
  showSummary?: boolean;
}

type AggregationPeriod = "daily" | "weekly" | "monthly";

interface ChartDataPoint {
  date: string;
  dateObj: Date;
  income: number;
  expense: number;
  net: number;
  onTarget: boolean;
}

interface ChartTheme {
  income: string;
  expense: string;
  muted: string;
  border: string;
  card: string;
  foreground: string;
  primary: string;
}

function readChartTheme(): ChartTheme {
  if (typeof window === "undefined") {
    return {
      income: "oklch(0.68 0.14 165)",
      expense: "oklch(0.62 0.18 25)",
      muted: "oklch(0.48 0.025 220)",
      border: "oklch(0.88 0.015 220)",
      card: "oklch(0.995 0.006 220)",
      foreground: "oklch(0.2 0.02 220)",
      primary: "oklch(0.45 0.1 200)",
    };
  }
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    income: read("--chart-1", "oklch(0.68 0.14 165)"),
    expense: read("--chart-2", "oklch(0.62 0.18 25)"),
    muted: read("--muted-foreground", "oklch(0.48 0.025 220)"),
    border: read("--border", "oklch(0.88 0.015 220)"),
    card: read("--card", "oklch(0.995 0.006 220)"),
    foreground: read("--foreground", "oklch(0.2 0.02 220)"),
    primary: read("--primary", "oklch(0.45 0.1 200)"),
  };
}

function useChartTheme(): ChartTheme {
  const [theme, setTheme] = React.useState<ChartTheme>(readChartTheme);

  React.useEffect(() => {
    const refresh = () => setTheme(readChartTheme());
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    window.addEventListener("resize", refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
    };
  }, []);

  return theme;
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
  period: AggregationPeriod,
): Omit<ChartDataPoint, "onTarget">[] {
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

  intervals.forEach((date) => {
    const key =
      period === "monthly"
        ? format(date, "yyyy-MM")
        : format(date, "yyyy-MM-dd");
    dataMap.set(key, { income: 0, expense: 0 });
  });

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
      if (txn.kind === "income") existing.income += txn.amount;
      else if (txn.kind === "expense") existing.expense += txn.amount;
    }
  });

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

  if (period === "daily") {
    return format(date, isMobile ? "EEEEE" : "EEE");
  }

  if (isMobile) {
    switch (period) {
      case "weekly":
        return format(date, "d");
      case "monthly":
        return format(date, "MMM");
    }
  }

  switch (period) {
    case "weekly":
      return format(date, "MMM d");
    case "monthly":
      return format(date, "MMM yy");
  }
}

function formatTooltipDate(dateStr: string, period: AggregationPeriod): string {
  const date = new Date(dateStr);
  switch (period) {
    case "monthly":
      return format(date, "MMMM yyyy");
    case "weekly":
      return `Week of ${format(date, "MMM d, yyyy")}`;
    default:
      return format(date, "EEEE, MMM d");
  }
}

function formatYAxis(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  if (value === 0) return "0";
  return value.toString();
}

function GoalBadge(props: {
  x?: number;
  y?: number;
  width?: number;
  payload?: ChartDataPoint;
  accent: string;
  surface: string;
}) {
  const { x = 0, y = 0, width = 0, payload, accent, surface } = props;
  if (!payload?.onTarget) return null;

  const cx = x + width / 2;
  const cy = y - 14;

  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill={accent} opacity={0.18} />
      <circle cx={cx} cy={cy} r={10} fill={surface} stroke={accent} strokeWidth={1.5} />
      <path
        d={`M ${cx - 4} ${cy} l 2.8 2.8 5.6 -5.8`}
        fill="none"
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

export function TransactionTrendChart({
  transactions,
  dateRange,
  className = "",
  showSummary = true,
}: TransactionTrendChartProps) {
  const theme = useChartTheme();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const period = getAggregationPeriod(dateRange.start, dateRange.end);
  const rawChartData = aggregateTransactions(
    transactions,
    dateRange.start,
    dateRange.end,
    period,
  );

  const totalIncome = rawChartData.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = rawChartData.reduce((sum, d) => sum + d.expense, 0);
  const netChange = totalIncome - totalExpense;
  const avgIncome = rawChartData.length > 0 ? totalIncome / rawChartData.length : 0;
  const avgExpense = rawChartData.length > 0 ? totalExpense / rawChartData.length : 0;
  const hasActivity = totalIncome > 0 || totalExpense > 0;

  const chartData: ChartDataPoint[] = rawChartData.map((point) => ({
    ...point,
    onTarget: point.expense > 0 && point.expense <= avgExpense,
  }));

  const chartHeight = isMobile ? 200 : 280;
  const barSize = isMobile ? 10 : 16;
  const margins = {
    top: 28,
    right: isMobile ? 36 : 44,
    left: 4,
    bottom: 4,
  };

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      {showSummary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="elevation-1 rounded-2xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                Total income
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="mt-2 truncate text-base font-bold tabular-nums text-emerald-600 sm:text-lg">
              +{formatMoney(totalIncome)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
              Avg {formatMoney(avgIncome)}/period
            </p>
          </div>

          <div className="elevation-1 rounded-2xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                Total expense
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10">
                <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
              </div>
            </div>
            <p className="mt-2 truncate text-base font-bold tabular-nums text-rose-600 sm:text-lg">
              -{formatMoney(totalExpense)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
              Avg {formatMoney(avgExpense)}/period
            </p>
          </div>

          <div
            className={cn(
              "col-span-2 elevation-1 rounded-2xl border bg-card p-3 sm:col-span-1",
              netChange >= 0 ? "border-emerald-500/20" : "border-rose-500/20",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                Net change
              </span>
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-xl",
                  netChange >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10",
                )}
              >
                <Scale
                  className={cn(
                    "h-3.5 w-3.5",
                    netChange >= 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                />
              </div>
            </div>
            <p
              className={cn(
                "mt-2 truncate text-base font-bold tabular-nums sm:text-lg",
                netChange >= 0 ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {netChange >= 0 ? "+" : ""}
              {formatMoney(netChange)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
              {netChange >= 0 ? "Net savings" : "Net deficit"} this period
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-muted/20 p-3 sm:rounded-3xl sm:p-5">
        {!hasActivity ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center sm:h-[280px]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">No trend data yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Add income or expense transactions in this range to see the chart.
            </p>
          </div>
        ) : (
          <ChartContainer height={chartHeight}>
            <BarChart
              data={chartData}
              margin={margins}
              barCategoryGap={isMobile ? "18%" : "24%"}
              barGap={4}
            >
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatXAxis(value, period, isMobile)}
                fontSize={isMobile ? 11 : 12}
                tickLine={false}
                axisLine={false}
                interval={isMobile ? "preserveEnd" : 0}
                tick={{ fill: theme.muted }}
                dy={8}
              />

              <YAxis
                orientation="right"
                fontSize={isMobile ? 10 : 11}
                tickLine={false}
                axisLine={false}
                width={isMobile ? 32 : 40}
                domain={[0, "auto"]}
                tickFormatter={formatYAxis}
                tick={{ fill: theme.muted }}
              />

              {avgExpense > 0 && (
                <ReferenceLine
                  y={avgExpense}
                  stroke={theme.expense}
                  strokeWidth={2}
                  strokeOpacity={0.45}
                />
              )}

              <Tooltip
                cursor={{ fill: theme.muted, opacity: 0.08 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload as ChartDataPoint;
                  return (
                    <div
                      className="min-w-38 elevation-2 rounded-2xl border p-3"
                      style={{
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                        color: theme.foreground,
                      }}
                    >
                      <p className="mb-2 text-xs font-semibold">
                        {formatTooltipDate(data.date, period)}
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-muted-foreground">Income</span>
                          <span
                            className="text-xs font-bold tabular-nums"
                            style={{ color: theme.income }}
                          >
                            +{formatMoney(data.income)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-muted-foreground">Expense</span>
                          <span
                            className="text-xs font-bold tabular-nums"
                            style={{ color: theme.expense }}
                          >
                            -{formatMoney(data.expense)}
                          </span>
                        </div>
                        <div
                          className="mt-1 border-t pt-2"
                          style={{ borderColor: theme.border }}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-medium">Net</span>
                            <span
                              className="text-xs font-bold tabular-nums"
                              style={{
                                color: data.net >= 0 ? theme.income : theme.expense,
                              }}
                            >
                              {data.net >= 0 ? "+" : ""}
                              {formatMoney(data.net)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />

              <Bar
                dataKey="income"
                fill={theme.income}
                barSize={barSize}
                radius={[999, 999, 999, 999]}
                animationDuration={650}
                animationEasing="ease-out"
              />

              <Bar
                dataKey="expense"
                fill={theme.expense}
                barSize={barSize}
                radius={[999, 999, 999, 999]}
                animationDuration={650}
                animationEasing="ease-out"
                animationBegin={80}
              >
                <LabelList
                  dataKey="expense"
                  content={(rawProps) => {
                    const props = rawProps as {
                      x?: number;
                      y?: number;
                      width?: number;
                      payload?: ChartDataPoint;
                    };
                    return (
                      <GoalBadge
                        x={typeof props.x === "number" ? props.x : undefined}
                        y={typeof props.y === "number" ? props.y : undefined}
                        width={typeof props.width === "number" ? props.width : undefined}
                        payload={props.payload}
                        accent={theme.income}
                        surface={theme.card}
                      />
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}

        {hasActivity && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px]">
            <div className="expressive-pill flex items-center gap-1.5 px-3 py-1 font-medium">
              <span
                className="h-2.5 w-5 rounded-full"
                style={{ backgroundColor: theme.expense }}
              />
              Spending
            </div>
            <div className="expressive-pill flex items-center gap-1.5 px-3 py-1 font-medium">
              <span
                className="h-2.5 w-5 rounded-full"
                style={{ backgroundColor: theme.income }}
              />
              Income
            </div>
            <div className="expressive-pill flex items-center gap-1.5 px-3 py-1 font-medium">
              <span
                className="h-0.5 w-5 rounded-full"
                style={{ backgroundColor: theme.expense }}
              />
              Avg spend
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
