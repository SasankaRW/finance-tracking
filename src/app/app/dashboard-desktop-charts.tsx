"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "@/components/chart-container";
import { formatMoney } from "@/lib/format";

export function MoneyFlowChart({
  data,
}: {
  data: Array<{ name: string; value: number; fill: string }>;
}) {
  return (
    <ChartContainer height={192}>
      <BarChart data={data} layout="vertical" barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
        <XAxis
          type="number"
          className="text-xs"
          tickFormatter={(value) => formatMoney(value).replace(/\.00$/, "")}
        />
        <YAxis type="category" dataKey="name" className="text-xs" width={68} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
          }}
          formatter={(value) => formatMoney(typeof value === "number" ? value : 0)}
        />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function TopSpendingPie({
  data,
  colors,
}: {
  data: Array<{ name: string; value: number }>;
  colors: string[];
}) {
  return (
    <ChartContainer height={176}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={42}
          outerRadius={72}
          paddingAngle={2}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={colors[idx % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
          }}
          formatter={(value) => formatMoney(typeof value === "number" ? value : 0)}
        />
      </PieChart>
    </ChartContainer>
  );
}
