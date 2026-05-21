"use client";

import { useState, useEffect } from "react";
import { useExecutionStore } from "@/stores/execution-store";
import { cn } from "@/lib/utils";
import {
  ChevronUp,
  ChevronDown,
  BrainCircuit,
  FileCode,
  Layers,
  BookOpen,
  Zap,
  Eye,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

const ROLE_ICONS: Record<string, typeof BrainCircuit> = {
  Manager: BrainCircuit,
  Coding: FileCode,
  Design: Layers,
  Research: BookOpen,
  "Fast Inference": Zap,
  Vision: Eye,
};

const ROLE_COLORS: Record<string, string> = {
  Manager: "text-purple-400",
  Coding: "text-blue-400",
  Design: "text-pink-400",
  Research: "text-cyan-400",
  "Fast Inference": "text-amber-400",
  Vision: "text-emerald-400",
};

const STATUS_CONFIG: Record<string, { icon: typeof Loader2; className: string }> = {
  running: { icon: Loader2, className: "text-amber-400 animate-spin" },
  completed: { icon: CheckCircle2, className: "text-emerald-400" },
  failed: { icon: AlertCircle, className: "text-red-400" },
  fallback: { icon: AlertCircle, className: "text-amber-500" },
  pending: { icon: Loader2, className: "text-slate-500 animate-pulse" },
};

function formatRuntime(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export function ExecutionGraph() {
  const [expanded, setExpanded] = useState(false);
  const executions = useExecutionStore((s) => s.executions);
  const activeId = useExecutionStore((s) => s.activeExecutionId);
  const graph = useExecutionStore((s) => s.executionGraph);

  const activeExecutions = Object.values(executions).filter(
    (e) => e.status === "running" || e.status === "pending"
  );
  const hasActive = activeExecutions.length > 0;

  useEffect(() => {
    if (hasActive && !expanded) setExpanded(true);
  }, [hasActive]);

  if (graph.length === 0 && !hasActive) return null;

  return (
    <div className="border-t border-slate-800 bg-slate-900/95">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-1 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-[9px]">
            Execution Graph
          </span>
          {hasActive && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {activeExecutions.length} active
            </span>
          )}
          <span className="text-slate-600">{graph.length} total</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-2 max-h-[160px] overflow-y-auto space-y-1">
          {hasActive && (
            <div className="space-y-1 mb-2">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
                Running
              </div>
              {activeExecutions.map((ex) => {
                const Icon = ROLE_ICONS[ex.role] || BrainCircuit;
                const StatusIcon = STATUS_CONFIG[ex.status]?.icon || Loader2;
                return (
                  <div
                    key={ex.taskId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/60 border border-slate-700/50 text-[10px]"
                  >
                    <StatusIcon
                      className={cn(
                        "w-3 h-3 shrink-0",
                        STATUS_CONFIG[ex.status]?.className || "text-slate-400"
                      )}
                    />
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        ROLE_COLORS[ex.role] || "text-slate-400"
                      )}
                    />
                    <span className="font-medium text-slate-200 min-w-[60px]">
                      {ex.role}
                    </span>
                    <span className="text-slate-400 truncate max-w-[100px]">
                      {ex.modelId}
                    </span>
                    <span className="text-slate-500">{ex.providerId}</span>
                    {ex.runtime ? (
                      <span className="text-slate-500 ml-auto">
                        {formatRuntime(ex.runtime)}
                      </span>
                    ) : null}
                    {ex.tokensPerSecond ? (
                      <span className="text-slate-500">
                        {ex.tokensPerSecond} t/s
                      </span>
                    ) : null}
                    {ex.fallbackChain && ex.fallbackChain.length > 0 && (
                      <span className="text-amber-500 text-[9px] flex items-center gap-0.5">
                        <ArrowRight className="w-2.5 h-2.5" />
                        fallback
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {graph.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
                History
              </div>
              {graph.slice(0, 15).map((node) => {
                const Icon = ROLE_ICONS[node.role] || BrainCircuit;
                const StatusIcon = STATUS_CONFIG[node.status]?.icon || CheckCircle2;
                return (
                  <div
                    key={node.taskId}
                    className="flex items-center gap-2 px-2 py-1 rounded text-[10px] text-slate-500"
                  >
                    <StatusIcon
                      className={cn(
                        "w-2.5 h-2.5 shrink-0",
                        STATUS_CONFIG[node.status]?.className || "text-slate-600"
                      )}
                    />
                    <Icon
                      className={cn(
                        "w-3 h-3 shrink-0",
                        ROLE_COLORS[node.role] || "text-slate-500"
                      )}
                    />
                    <span className="text-slate-400 min-w-[60px]">
                      {node.role}
                    </span>
                    <span className="truncate max-w-[80px]">
                      {node.modelId}
                    </span>
                    {node.runtime ? (
                      <span className="ml-auto">{formatRuntime(node.runtime)}</span>
                    ) : null}
                    {node.tokensUsed ? (
                      <span>{node.tokensUsed} tok</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
