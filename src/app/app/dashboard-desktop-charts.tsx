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
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <ChartContainer height={192}>
      <BarChart data={data} layout="vertical" barCategoryGap="24%">
        <CartesianGrid strokeDasharray="0" horizontal={false} stroke="rgba(255,255,255,0.07)" />
        <XAxis
          type="number"
          tick={{ fill: "rgba(255,255,255,0.68)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatMoney(value).replace(/\.00$/, "")}
        />
        <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.68)", fontSize: 12 }} axisLine={false} tickLine={false} width={68} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#26262c",
            border: "0",
            borderRadius: "16px",
            color: "#fff",
          }}
          formatter={(value) => formatMoney(typeof value === "number" ? value : 0)}
        />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive={!reduce} />
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
            backgroundColor: "#26262c",
            border: "0",
            borderRadius: "16px",
            color: "#fff",
          }}
          formatter={(value) => formatMoney(typeof value === "number" ? value : 0)}
        />
      </PieChart>
    </ChartContainer>
  );
}
