"use client";

import { useQuery } from "@tanstack/react-query";
import { BrainCircuit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { getJson } from "@/lib/client-api";

interface MemoryRow {
  id: string;
  scope: "project" | "global";
  key: string;
  value: string;
  updated_at: string;
}

interface MemoryResponse {
  memories: MemoryRow[];
}

export default function MemoryPage() {
  const { data, isLoading, isError } = useQuery<MemoryResponse>({
    queryKey: ["memories"],
    queryFn: () => getJson<MemoryResponse>("/api/memory"),
  });

  const memories = data?.memories ?? [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-900">Memory</h1>
          <p className="text-sm text-amber-600/70">
            Long-term context that agents can read and write across runs.
          </p>
        </div>
      </header>

      {isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load memories.
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-amber-700/70">Loading…</p>
      ) : memories.length === 0 ? (
        <EmptyState
          icon={BrainCircuit}
          title="No memories stored."
          description="Agents will populate this list as they save context, preferences, and learnings."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {memories.map((memory: MemoryRow) => (
            <div
              key={memory.id}
              className="agentos-card agentos-border-glow p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-amber-900">{memory.key}</p>
                <Badge
                  variant="outline"
                  className="text-[10px] capitalize border-amber-200 bg-amber-50 text-amber-700"
                >
                  {memory.scope}
                </Badge>
              </div>
              <p className="text-xs text-amber-700/80 line-clamp-4 whitespace-pre-wrap">
                {memory.value}
              </p>
              <p className="mt-auto text-[10px] text-amber-600/50">
                Updated {new Date(memory.updated_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
