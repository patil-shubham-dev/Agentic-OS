"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { getJson } from "@/lib/client-api";

interface UsageRow {
  id: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  duration_ms: number;
  created_at: string;
}

interface ActivityResponse {
  records: UsageRow[];
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function ActivityPage() {
  const { data, isLoading, isError } = useQuery<ActivityResponse>({
    queryKey: ["activity"],
    queryFn: () => getJson<ActivityResponse>("/api/activity"),
  });

  const records = data?.records ?? [];

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-amber-900">Activity</h1>
        <p className="text-sm text-amber-600/70">
          Every model invocation with tokens, cost, latency, and status.
        </p>
      </header>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load activity.
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-amber-700/70">Loading…</p>
      ) : records.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity recorded."
          description="Agent runs and chat completions will appear here as they happen."
        />
      ) : (
        <div className="agentos-card agentos-border-glow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-amber-50/60 text-amber-700/70">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium">When</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium">Provider</th>
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium">Model</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider font-medium">Tokens in</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider font-medium">Tokens out</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider font-medium">Latency</th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row.id} className="border-t border-amber-200/40 text-amber-900">
                  <td className="px-4 py-2.5 text-xs text-amber-700/70 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700">
                      {row.provider}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.model}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{formatNumber(row.input_tokens)}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{formatNumber(row.output_tokens)}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{row.duration_ms ? `${row.duration_ms} ms` : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-semibold">${Number(row.cost ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
