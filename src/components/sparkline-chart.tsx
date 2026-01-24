"use client";

import * as React from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
    data: number[];
    color?: string;
    height?: number;
    className?: string;
}

export function SparklineChart({
    data,
    color = "hsl(var(--primary))",
    height = 40,
    className = "",
}: SparklineChartProps) {
    const chartData = data.map((value, index) => ({
        index,
        value,
    }));

    return (
        <div className={className}>
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
