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
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface TokenChartProps {
  data: Array<{ name: string; tokens: number; cost: number }>;
}

const TokenTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="agentos-glass-elevated border border-[--border-primary] rounded-lg px-3 py-2 shadow-xl backdrop-blur-xl">
      <p className="text-[10px] font-medium text-[--text-muted] mb-1">{label}</p>
      <p className="text-xs font-semibold text-[--accent-primary]">
        {payload[0].value.toLocaleString()} tokens
      </p>
    </div>
  );
};

export const LazyTokenAreaChart = memo(function LazyTokenAreaChart({ data }: TokenChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[130px] text-[10px] text-[--text-disabled]">
        No usage data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="tokenGradientDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A524" stopOpacity={0.35} />
            <stop offset="60%" stopColor="#F5A524" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#F5A524" stopOpacity={0} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--text-disabled)", fontSize: 9, fontFamily: "monospace" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--text-disabled)", fontSize: 9, fontFamily: "monospace" }}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
        />
        <Tooltip content={<TokenTooltip />} />
        <Area
          type="monotone"
          dataKey="tokens"
          stroke="#F5A524"
          strokeWidth={2}
          fill="url(#tokenGradientDark)"
          filter="url(#glow)"
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

interface ProviderPieChartProps {
  data: Array<{ name: string; value: number; tokens: number; color: string }>;
}

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="agentos-glass-elevated border border-[--border-primary] rounded-lg px-3 py-2 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
        <p className="text-[10px] font-medium text-[--text-muted]">{entry.name}</p>
      </div>
      <p className="text-xs font-semibold text-[--text-primary]">
        ${entry.value.toFixed(2)} cost
      </p>
      <p className="text-[9px] text-[--text-disabled]">{entry.tokens.toLocaleString()} tokens</p>
    </div>
  );
};

export const LazyProviderPieChart = memo(function LazyProviderPieChart({ data }: ProviderPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[100px] text-[10px] text-[--text-disabled]">
        No provider data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={110}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={28}
          outerRadius={46}
          paddingAngle={3}
          strokeWidth={0}
          animationDuration={800}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.color}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
});
