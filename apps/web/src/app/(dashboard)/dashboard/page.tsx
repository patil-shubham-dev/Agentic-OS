"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Coins,
  Cpu,
  PlugZap,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { getJson } from "@/lib/client-api";
import { EmptyState } from "@/components/empty-state";

interface DashboardResponse {
  agents: Array<{ id: string; name: string; status: string }>;
  automations: Array<{ id: string; name: string; status: string; trigger: { type?: string } }>;
  chats: Array<{ id: string; title: string; model: string; updated_at: string; usage?: { total_tokens?: number } }>;
  providerConfigs: Array<{ provider: string; label: string; enabled: boolean; validation_status?: string | null }>;
  summary: {
    totalTokens: number;
    totalCost: number;
    activeAgents: number;
    activeAutomations: number;
    knowledgeItems: number;
    connectedProviders: number;
  };
  byProvider: Array<{ provider: string; cost: number; tokens: number }>;
  usageTimeline: Array<{ name: string; tokens: number; cost: number }>;
}

const PROVIDER_PALETTE = ["#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#ef4444", "#ec4899", "#06b6d4"];

function StatTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="agentos-card agentos-border-glow p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-600/60">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold text-amber-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-amber-600/60">{hint}</p> : null}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatTimeAgo(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return new Date(ts).toLocaleDateString();
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<DashboardResponse>({
    queryKey: ["dashboard"],
    queryFn: () => getJson<DashboardResponse>("/api/dashboard"),
  });

  const summary = data?.summary;
  const usageTimeline = data?.usageTimeline ?? [];
  const byProvider = (data?.byProvider ?? []).map((entry, index) => ({
    name: entry.provider,
    value: Math.max(1, Math.round(entry.cost * 100) / 100),
    tokens: entry.tokens,
    color: PROVIDER_PALETTE[index % PROVIDER_PALETTE.length],
  }));
  const recentChats = data?.chats?.slice(0, 6) ?? [];
  const automations = data?.automations ?? [];
  const connectedProviders = (data?.providerConfigs ?? []).filter(
    (p: any) => p.enabled && (p.validation_status === "connected" || p.validation_status === null)
  );

  return (
    <div className="px-3 pt-3 pb-6">
      {isError ? (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load dashboard data. Verify Supabase configuration in Settings.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Summary */}
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile
                label="Total Tokens"
                value={isLoading ? "…" : formatTokens(summary?.totalTokens ?? 0)}
                icon={Cpu}
                hint={summary?.totalTokens ? "Across all providers" : "No usage recorded yet"}
              />
              <StatTile
                label="Total Cost"
                value={isLoading ? "…" : `$${(summary?.totalCost ?? 0).toFixed(2)}`}
                icon={Coins}
                hint={summary?.totalCost ? "Lifetime spend" : "$0 spent"}
              />
              <StatTile
                label="Active Agents"
                value={isLoading ? "…" : String(summary?.activeAgents ?? 0)}
                icon={Bot}
                hint={summary?.activeAgents ? "Currently enabled" : "None active"}
              />
              <StatTile
                label="Active Automations"
                value={isLoading ? "…" : String(summary?.activeAutomations ?? 0)}
                icon={Workflow}
                hint={summary?.activeAutomations ? "Scheduled or running" : "None active"}
              />
            </div>
          </motion.section>

          {/* Connected sources */}
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <div className="agentos-card agentos-border-glow p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-amber-600/60">Connected providers</p>
                  <p className="text-sm text-amber-800">
                    {connectedProviders.length === 0
                      ? "No providers connected yet."
                      : `${connectedProviders.length} configured`}
                  </p>
                </div>
                <Link href="/settings">
                  <Button variant="ghost" className="hidden md:inline-flex text-amber-700/70 hover:text-amber-900 hover:bg-amber-100">
                    Manage providers <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {connectedProviders.length === 0 ? (
                <EmptyState
                  className="mt-4"
                  compact
                  icon={PlugZap}
                  title="Connect your first AI provider."
                  description="Add an API key in Settings to start chatting and running agents."
                  action={
                    <Link href="/settings">
                      <Button className="bg-amber-500 text-white hover:bg-amber-600">Open Settings</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {connectedProviders.map((provider: any) => (
                    <div
                      key={provider.provider}
                      className="rounded-xl border border-amber-200/70 bg-white/60 px-3 py-1.5 text-sm text-amber-800 flex items-center gap-2"
                    >
                      <span>{provider.label}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">Connected</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* Activity feed (recent chats) */}
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
            <div className="agentos-card agentos-border-glow p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-amber-600/60">Activity Feed</p>
                  <p className="text-sm text-amber-800">Recent workspace executions</p>
                </div>
                <Link href="/activity">
                  <ArrowRight className="h-4 w-4 text-amber-500/60" />
                </Link>
              </div>
              {recentChats.length === 0 ? (
                <EmptyState
                  compact
                  icon={Activity}
                  title="No activity yet."
                  description="Start a conversation in the workspace to see runs appear here."
                />
              ) : (
                <div className="space-y-2">
                  {recentChats.map((chat: any) => (
                    <div
                      key={chat.id}
                      className="flex items-center gap-3 rounded-xl border border-amber-200/50 bg-white/50 p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-900 truncate">{chat.title}</p>
                        <p className="text-xs text-amber-600/60">
                          {chat.model} · {formatTokens(chat.usage?.total_tokens ?? 0)} tokens
                        </p>
                      </div>
                      <span className="text-xs text-amber-600/50 whitespace-nowrap">{formatTimeAgo(chat.updated_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Usage analytics */}
          <motion.section initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}>
            <div className="agentos-card agentos-border-glow p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-amber-600/60">Usage Analytics</p>
                  <p className="text-sm text-amber-800">Recent activity</p>
                </div>
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100 text-[10px]">
                  {summary?.totalTokens ? "Live" : "No data"}
                </Badge>
              </div>
              {usageTimeline.length === 0 && byProvider.length === 0 ? (
                <EmptyState
                  compact
                  icon={Cpu}
                  title="No usage recorded yet."
                  description="Send a chat or run an agent to populate analytics."
                />
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-amber-200/60 bg-white/50 p-3">
                    <p className="text-[10px] text-amber-600/50 uppercase tracking-wider mb-2">Token Usage</p>
                    {usageTimeline.length === 0 ? (
                      <p className="text-xs text-amber-600/60">No usage yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={130}>
                        <AreaChart data={usageTimeline}>
                          <defs>
                            <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <RechartsTooltip
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
                    )}
                  </div>
                  <div className="rounded-xl border border-amber-200/60 bg-white/50 p-3">
                    <p className="text-[10px] text-amber-600/50 uppercase tracking-wider mb-1">By Provider</p>
                    {byProvider.length === 0 ? (
                      <p className="text-xs text-amber-600/60">No usage yet</p>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={100}>
                          <PieChart>
                            <Pie data={byProvider} dataKey="value" innerRadius={28} outerRadius={44} paddingAngle={3}>
                              {byProvider.map((entry: any) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-1 space-y-1">
                          {byProvider.map((provider: any) => (
                            <div
                              key={provider.name}
                              className="flex items-center justify-between text-[11px] text-amber-700"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: provider.color }} />
                                <span>{provider.name}</span>
                              </div>
                              <span className="font-semibold">${provider.value.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.section>

          {/* Automations summary */}
          <motion.section initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}>
            <div className="agentos-card agentos-border-glow p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-amber-600/60">Automations</p>
                  <p className="text-sm text-amber-800">Configured workflows</p>
                </div>
                <Link href="/automations">
                  <Button variant="ghost" size="sm" className="text-amber-700/60 hover:text-amber-900 hover:bg-amber-100 text-xs">
                    View all
                  </Button>
                </Link>
              </div>
              {automations.length === 0 ? (
                <EmptyState
                  compact
                  icon={Workflow}
                  title="No automations configured."
                  description="Create your first automation to schedule agents and pipelines."
                />
              ) : (
                <div className="space-y-2">
                  {automations.slice(0, 4).map((automation: any) => (
                    <div key={automation.id} className="rounded-xl border border-amber-200/50 bg-white/50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-amber-900 truncate">{automation.name}</p>
                          <p className="text-xs text-amber-600/60">
                            Trigger: {automation.trigger?.type ?? "manual"}
                          </p>
                        </div>
                        <Badge
                          className={
                            automation.status === "active"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]"
                              : automation.status === "paused"
                              ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]"
                              : automation.status === "error"
                              ? "bg-red-100 text-red-600 border-red-200 hover:bg-red-100 text-[10px]"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100 text-[10px]"
                          }
                        >
                          {automation.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
