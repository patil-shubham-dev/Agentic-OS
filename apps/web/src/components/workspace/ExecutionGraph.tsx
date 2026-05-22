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
  Sparkles,
  Search,
  PenLine,
  Terminal,
  CheckCheck,
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

// Pastel timeline color scheme — peach, mint, blue, lavender, gold
const STAGE_CONFIG: Record<string, { icon: typeof Loader2; bg: string; text: string; border: string }> = {
  thinking: {
    icon: Sparkles,
    bg: "bg-amber-100/10",
    text: "text-amber-300",
    border: "border-amber-400/20",
  },
  planning: {
    icon: BrainCircuit,
    bg: "bg-purple-100/10",
    text: "text-purple-300",
    border: "border-purple-400/20",
  },
  reading: {
    icon: Search,
    bg: "bg-blue-100/10",
    text: "text-blue-300",
    border: "border-blue-400/20",
  },
  grepping: {
    icon: Search,
    bg: "bg-cyan-100/10",
    text: "text-cyan-300",
    border: "border-cyan-400/20",
  },
  editing: {
    icon: PenLine,
    bg: "bg-pink-100/10",
    text: "text-pink-300",
    border: "border-pink-400/20",
  },
  executing: {
    icon: Terminal,
    bg: "bg-emerald-100/10",
    text: "text-emerald-300",
    border: "border-emerald-400/20",
  },
  completed: {
    icon: CheckCheck,
    bg: "bg-emerald-100/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  failed: {
    icon: AlertCircle,
    bg: "bg-rose-100/10",
    text: "text-rose-300",
    border: "border-rose-400/20",
  },
};

const STATUS_CONFIG: Record<string, { icon: typeof Loader2; className: string }> = {
  running: { icon: Loader2, className: "text-[--accent-primary] animate-spin" },
  completed: { icon: CheckCircle2, className: "text-[--status-success]" },
  failed: { icon: AlertCircle, className: "text-[--status-error]" },
  fallback: { icon: AlertCircle, className: "text-[--status-warning]" },
  pending: { icon: Loader2, className: "text-slate-500 animate-pulse" },
};

function getStageKey(role: string, status: string): string {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  const roleLower = role.toLowerCase();
  if (roleLower.includes("think")) return "thinking";
  if (roleLower.includes("plan") || roleLower.includes("manager")) return "planning";
  if (roleLower.includes("read") || roleLower.includes("research")) return "reading";
  if (roleLower.includes("code") || roleLower.includes("edit") || roleLower.includes("design")) return "editing";
  if (roleLower.includes("exec") || roleLower.includes("term") || roleLower.includes("tool")) return "executing";
  return "planning";
}

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
  const graph = useExecutionStore((s) => s.executionGraph);

  const activeExecutions = Object.values(executions).filter(
    (e) => e.status === "running" || e.status === "pending"
  );
  const hasActive = activeExecutions.length > 0;

  useEffect(() => {
    if (hasActive && !expanded) setExpanded(true);
  }, [hasActive, expanded]);

  if (graph.length === 0 && !hasActive) return null;

  return (
    <div className="border-t border-[--border-primary] bg-[--bg-secondary]/60">
      {/* Compact header bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full h-[22px] px-3 text-[9px] text-[--text-muted] hover:text-[--text-secondary] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-[0.12em] text-[9px]">
            Agent Timeline
          </span>
          {hasActive && (
            <span className="flex items-center gap-1 text-[--accent-primary]">
              <span className="w-1 h-1 rounded-full bg-[--accent-primary] animate-pulse shadow-[0_0_6px_var(--glow-primary)]" />
              {activeExecutions.length} active
            </span>
          )}
          <span className="text-[--text-disabled]">{graph.length} total</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-2.5 h-2.5" />
        ) : (
          <ChevronUp className="w-2.5 h-2.5" />
        )}
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className="px-3 pb-2 max-h-[160px] overflow-y-auto space-y-1">
          {/* Active executions — pastel pills */}
          {hasActive && (
            <div className="space-y-1 mb-2">
              <div className="text-[8px] uppercase tracking-[0.12em] text-[--text-disabled] font-semibold">
                Running
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeExecutions.map((ex) => {
                  const stageKey = getStageKey(ex.role, ex.status);
                  const stageStyle = STAGE_CONFIG[stageKey] || STAGE_CONFIG.planning;
                  const Icon = stageStyle.icon;
                  return (
                    <div
                      key={ex.taskId}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium transition-all hover:opacity-80",
                        stageStyle.bg,
                        stageStyle.text,
                        stageStyle.border
                      )}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      <span>{ex.role}</span>
                      {ex.runtime && (
                        <span className="opacity-60">{formatRuntime(ex.runtime)}</span>
                      )}
                      {ex.fallbackChain && ex.fallbackChain.length > 0 && (
                        <ArrowRight className="w-2 h-2 opacity-60" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History */}
          {graph.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[8px] uppercase tracking-[0.12em] text-[--text-disabled] font-semibold mb-1">
                History
              </div>
              <div className="flex flex-wrap gap-1">
                {graph.slice(0, 20).map((node) => {
                  const stageKey = getStageKey(node.role, node.status);
                  const stageStyle = STAGE_CONFIG[stageKey] || STAGE_CONFIG.completed;
                  const Icon = stageStyle.icon;
                  return (
                    <div
                      key={node.taskId}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px]",
                        stageStyle.bg,
                        stageStyle.text,
                        stageStyle.border,
                        "opacity-70 hover:opacity-100 transition-opacity"
                      )}
                    >
                      <Icon className="w-2 h-2" />
                      <span>{node.role}</span>
                      {node.runtime && (
                        <span className="opacity-60 ml-0.5">{formatRuntime(node.runtime)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
