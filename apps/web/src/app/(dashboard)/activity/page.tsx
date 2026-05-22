"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Search,
  Clock,
  Cpu,
  Coins,
  Timer,
  AlertCircle,
  Loader2,
  Bot,
  MessageSquare,
  Zap,
  Layers,
  BarChart3,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/client-api";
import { EmptyState } from "@/components/empty-state";

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

type TimeFilter = "all" | "24h" | "7d" | "30d";
type TypeFilter = "all" | "chat" | "agent" | "tool";

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string; icon: any }[] = [
  { value: "all", label: "All Types", icon: Layers },
  { value: "chat", label: "Chat", icon: MessageSquare },
  { value: "agent", label: "Agent", icon: Bot },
  { value: "tool", label: "Tool", icon: Zap },
];

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatTimeAgo(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemAnim = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

function getEventType(model: string): "chat" | "agent" | "tool" {
  const m = model.toLowerCase();
  if (m.includes("agent") || m.includes("hermes") || m.includes("claude")) return "agent";
  if (m.includes("tool") || m.includes("function") || m.includes("embed")) return "tool";
  return "chat";
}

function formatLatency(ms: number): string {
  if (!ms) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export default function ActivityPage() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError } = useQuery<ActivityResponse>({
    queryKey: ["activity"],
    queryFn: () => getJson<ActivityResponse>("/api/activity"),
  });

  const records = data?.records ?? [];

  const filtered = useMemo(() => {
    let result = records;

    // Time filter
    const now = Date.now();
    if (timeFilter === "24h") {
      result = result.filter((r) => now - Date.parse(r.created_at) < 86_400_000);
    } else if (timeFilter === "7d") {
      result = result.filter((r) => now - Date.parse(r.created_at) < 604_800_000);
    } else if (timeFilter === "30d") {
      result = result.filter((r) => now - Date.parse(r.created_at) < 2_592_000_000);
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((r) => getEventType(r.model) === typeFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.model.toLowerCase().includes(q) ||
          r.provider.toLowerCase().includes(q)
      );
    }

    return result;
  }, [records, timeFilter, typeFilter, searchQuery]);

  const totalTokens = useMemo(
    () => filtered.reduce((sum, r) => sum + r.input_tokens + r.output_tokens, 0),
    [filtered]
  );
  const totalCost = useMemo(
    () => filtered.reduce((sum, r) => sum + (r.cost ?? 0), 0),
    [filtered]
  );
  const avgLatency = useMemo(() => {
    const withLatency = filtered.filter((r) => r.duration_ms);
    if (withLatency.length === 0) return 0;
    return withLatency.reduce((sum, r) => sum + r.duration_ms, 0) / withLatency.length;
  }, [filtered]);

  const hasActiveFilters = timeFilter !== "all" || typeFilter !== "all" || searchQuery.trim().length > 0;

  const clearFilters = () => {
    setTimeFilter("all");
    setTypeFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="h-full overflow-hidden flex flex-col agentos-shell">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
              <Activity className="w-5 h-5 text-[--accent-primary]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[--text-primary]">Activity</h1>
              <p className="text-[13px] text-[--text-muted]">
                Every model invocation with tokens, cost, latency, and status.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        {!isLoading && !isError && records.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-4"
          >
            {[
              {
                label: "Total Tokens",
                value: formatNumber(totalTokens),
                icon: Cpu,
                accent: "text-[--accent-primary]",
              },
              {
                label: "Total Cost",
                value: `$${totalCost.toFixed(4)}`,
                icon: Coins,
                accent: "text-emerald-400",
              },
              {
                label: "Avg Latency",
                value: avgLatency ? formatLatency(Math.round(avgLatency)) : "—",
                icon: Timer,
                accent: "text-blue-400",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="agentos-card p-3.5 flex items-center gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--bg-tertiary] border border-[--border-primary] shrink-0">
                  <stat.icon className={cn("w-4 h-4", stat.accent)} />
                </div>
                <div>
                  <p className="text-lg font-bold text-[--text-primary]">{stat.value}</p>
                  <p className="text-[10px] text-[--text-muted]">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Error Banner */}
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to load activity.</span>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[--accent-primary]" />
              <p className="text-[13px] text-[--text-muted]">Loading activity data...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && records.length === 0 && (
          <EmptyState
            icon={Activity}
            title="No activity recorded."
            description="Agent runs and chat completions will appear here as they happen."
          />
        )}

        {/* Filters + Results */}
        {!isLoading && !isError && records.length > 0 && (
          <>
            {/* Filter Bar */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Time filter chips */}
              <div className="flex items-center gap-1.5 bg-[--bg-tertiary] rounded-lg border border-[--border-primary] p-1">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTimeFilter(opt.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                      timeFilter === opt.value
                        ? "bg-[--bg-elevated] text-[--text-primary] shadow-sm border border-[--border-primary]"
                        : "text-[--text-muted] hover:text-[--text-secondary]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Type filter chips */}
              <div className="flex items-center gap-1.5 bg-[--bg-tertiary] rounded-lg border border-[--border-primary] p-1">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTypeFilter(opt.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                        typeFilter === opt.value
                          ? "bg-[--bg-elevated] text-[--text-primary] shadow-sm border border-[--border-primary]"
                          : "text-[--text-muted] hover:text-[--text-secondary]"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[--text-disabled]" />
                <Input
                  placeholder="Search model or provider..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-8 bg-[--bg-tertiary] border-[--border-primary] text-[12px] text-[--text-primary] placeholder:text-[--text-disabled] focus-visible:ring-[--accent-primary] focus-visible:ring-1 focus-visible:border-[--accent-primary] rounded-lg"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[--text-disabled] hover:text-[--text-muted]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Active filters indicator */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-[--text-muted] hover:text-[--accent-primary] text-[11px] transition-colors"
                >
                  <Filter className="w-3 h-3" />
                  Clear filters
                </button>
              )}
            </div>

            {/* Results count */}
            <motion.div
              key={`${timeFilter}-${typeFilter}-${searchQuery}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] text-[--text-muted] flex items-center gap-1.5"
            >
              <BarChart3 className="w-3 h-3" />
              {filtered.length} of {records.length} records
              {hasActiveFilters && (
                <>
                  <span className="text-[--text-disabled]">&middot;</span>
                  <button
                    onClick={clearFilters}
                    className="text-[--accent-primary] hover:underline"
                  >
                    Clear all filters
                  </button>
                </>
              )}
            </motion.div>

            {/* Timeline */}
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <EmptyState
                    compact
                    icon={Search}
                    title="No matching records"
                    description="Try adjusting your filters or search query."
                  />
                </motion.div>
              ) : (
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  {/* Timeline header row */}
                  <div className="flex items-center gap-3 px-4 py-2 text-[9px] uppercase tracking-[0.12em] text-[--text-disabled] font-semibold border-b border-[--border-primary]">
                    <span className="w-[130px] shrink-0">When</span>
                    <span className="w-[100px] shrink-0">Provider</span>
                    <span className="flex-1 min-w-0">Model</span>
                    <span className="w-[80px] text-right shrink-0">Tokens</span>
                    <span className="w-[70px] text-right shrink-0">Latency</span>
                    <span className="w-[80px] text-right shrink-0">Cost</span>
                  </div>

                  {filtered.map((row, idx) => {
                    const eventType = getEventType(row.model);
                    const typeColors: Record<string, string> = {
                      chat: "border-l-[--accent-primary]",
                      agent: "border-l-emerald-400",
                      tool: "border-l-blue-400",
                    };
                    const typeAccents: Record<string, string> = {
                      chat: "bg-[--accent-primary]/10 text-[--accent-primary] border-[--border-secondary]",
                      agent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      tool: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                    };
                    return (
                      <motion.div
                        key={row.id}
                        layout
                        variants={itemAnim}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className={cn(
                          "agentos-card p-0 overflow-hidden border-l-[3px] transition-all hover:border-[--border-hover]",
                          typeColors[eventType]
                        )}
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          {/* Timestamp */}
                          <div className="w-[130px] shrink-0 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-[--text-disabled]" />
                            <span className="text-[11px] text-[--text-muted] whitespace-nowrap">
                              {formatTimeAgo(row.created_at)}
                            </span>
                          </div>

                          {/* Provider badge */}
                          <div className="w-[100px] shrink-0">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-[--border-secondary] bg-[--bg-tertiary] text-[--text-secondary]"
                            >
                              {row.provider}
                            </Badge>
                          </div>

                          {/* Model name */}
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-[12px] font-medium text-[--text-primary] truncate font-mono">
                              {row.model}
                            </span>
                            <div className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium border", typeAccents[eventType])}>
                              {eventType}
                            </div>
                          </div>

                          {/* Tokens */}
                          <div className="w-[80px] shrink-0 text-right">
                            <span className="text-[12px] font-semibold text-[--text-primary] font-mono">
                              {formatNumber(row.input_tokens + row.output_tokens)}
                            </span>
                            <div className="text-[9px] text-[--text-disabled]">
                              {formatNumber(row.input_tokens)} in
                            </div>
                          </div>

                          {/* Latency */}
                          <div className="w-[70px] shrink-0 text-right">
                            <span className="text-[11px] text-[--text-muted] font-mono">
                              {formatLatency(row.duration_ms)}
                            </span>
                          </div>

                          {/* Cost */}
                          <div className="w-[80px] shrink-0 text-right">
                            <span className="text-[12px] font-semibold text-emerald-400 font-mono">
                              ${Number(row.cost ?? 0).toFixed(4)}
                            </span>
                          </div>

                          {/* Status dot */}
                          <div className="w-2 shrink-0">
                            <span className="block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.3)]" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
