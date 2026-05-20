"use client";

import { memo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

// Recharts components are heavy but this module is already code-split via dynamic() in the dashboard page

interface TokenChartProps {
  data: Array<{ name: string; tokens: number; cost: number }>;
}

export const LazyTokenAreaChart = memo(function LazyTokenAreaChart({ data }: TokenChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-amber-600/60">No usage yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={130}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{
            backgroundColor: "#fffbf0",
            border: "1px solid rgba(200,150,40,0.2)",
            borderRadius: "12px",
            fontSize: "12px",
            color: "#78350f",
          }}
        />
        <Area type="monotone" dataKey="tokens" stroke="#f59e0b" strokeWidth={2} fill="url(#tokenGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
});

interface ProviderPieChartProps {
  data: Array<{ name: string; value: number; tokens: number; color: string }>;
}

export const LazyProviderPieChart = memo(function LazyProviderPieChart({ data }: ProviderPieChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-amber-600/60">No usage yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={100}>
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={28} outerRadius={44} paddingAngle={3}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
});
