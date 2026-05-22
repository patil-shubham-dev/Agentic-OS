"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Coins,
  MessageSquare,
  Plus,
  PlugZap,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { getJson } from "@/lib/client-api";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/skeleton-loader";
import { cn } from "@/lib/utils";

const LazyTokenAreaChart = dynamic(() => import("@/components/charts/Charts").then((m) => ({ default: m.LazyTokenAreaChart })), { ssr: false });
const LazyProviderPieChart = dynamic(() => import("@/components/charts/Charts").then((m) => ({ default: m.LazyProviderPieChart })), { ssr: false });

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

const PROVIDER_PALETTE = ["#F5A524", "#8B5CF6", "#3B82F6", "#10B981", "#EF4444", "#EC4899", "#22D3EE"];

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
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Stat Card ─────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  accent?: "amber" | "emerald" | "purple" | "blue" | "rose";
}) {
  const accentColors = {
    amber: "text-[--accent-primary] bg-[--accent-primary]/10 border-[--border-secondary]",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="agentos-card p-4 group hover:border-[--border-hover] transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[9px] uppercase tracking-[0.15em] text-[--text-muted] font-semibold">
          {label}
        </p>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border",
            accentColors[accent || "amber"]
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-[--text-primary] tracking-tight">{value}</p>
      {hint ? (
        <p className="mt-1 text-[10px] text-[--text-disabled]">{hint}</p>
      ) : null}
    </motion.div>
  );
}

// ─── Section Header ─────────────────────────────────────
function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-[--text-muted] font-semibold">
          {title}
        </p>
        {subtitle ? (
          <p className="text-[11px] text-[--text-disabled] mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// ─── Provider Badge ──────────────────────────────────────
function ProviderBadge({
  label,
  status,
}: {
  label: string;
  status: "connected" | "error" | "disabled";
}) {
  const statusConfig = {
    connected: {
      dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]",
      text: "text-emerald-400/80",
    },
    error: {
      dot: "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.4)]",
      text: "text-rose-400/80",
    },
    disabled: {
      dot: "bg-[--text-disabled]",
      text: "text-[--text-disabled]",
    },
  };

  const cfg = statusConfig[status];
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[--bg-tertiary] border border-[--border-primary]">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      <span className="text-[10px] text-[--text-secondary] font-medium">{label}</span>
      <span className={cn("text-[9px] ml-auto", cfg.text)}>
        {status === "connected" ? "Active" : status === "error" ? "Error" : "Off"}
      </span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────
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
  const recentChats = data?.chats?.slice(0, 5) ?? [];
  const automations = data?.automations ?? [];
  const connectedProviders = (data?.providerConfigs ?? []).filter(
    (p: any) => p.enabled && (p.validation_status === "connected" || p.validation_status === null)
  );
  const errorProviders = (data?.providerConfigs ?? []).filter(
    (p: any) => p.enabled && p.validation_status === "error"
  );
  const agents = data?.agents ?? [];

  if (isLoading) {
    return (
      <div className="agentos-shell p-4">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="agentos-shell overflow-y-auto">
      <div className="px-4 pt-4 pb-8 max-w-[1440px] mx-auto">
        {/* Error banner */}
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-[--border-primary] bg-[--bg-tertiary] p-3 text-[11px] text-rose-400"
          >
            Failed to load dashboard data. Verify database configuration.
          </motion.div>
        )}

        {/* ─── Quick Actions Row ───────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-sm font-bold text-[--text-primary] tracking-tight">
              Command Center
            </h1>
            <p className="text-[10px] text-[--text-disabled] mt-0.5">
              Overview of your AI workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 bg-[--accent-primary]/10 text-[--accent-primary] hover:bg-[--accent-primary]/20 border border-[--border-secondary] text-[10px] rounded-lg px-3 transition-all"
              asChild
            >
              <Link href="/workspace">
                <MessageSquare className="w-3 h-3 mr-1" />
                New Chat
              </Link>
            </Button>
            <Button
              size="sm"
              className="h-7 bg-[--accent-primary] text-[--bg-primary] hover:bg-[--accent-hover] text-[10px] rounded-lg px-3 shadow-sm shadow-[--glow-primary]/30 transition-all"
              asChild
            >
              <Link href="/agents">
                <Plus className="w-3 h-3 mr-1" />
                New Agent
              </Link>
            </Button>
          </div>
        </div>

        {/* ─── Stat Cards Grid ─────────────────── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6"
        >
          <StatCard
            label="Total Tokens"
            value={formatTokens(summary?.totalTokens ?? 0)}
            icon={Cpu}
            hint={summary?.totalTokens ? "Across all providers" : "No usage recorded"}
            accent="amber"
          />
          <StatCard
            label="Total Cost"
            value={`$${(summary?.totalCost ?? 0).toFixed(2)}`}
            icon={Coins}
            hint={summary?.totalCost ? "Lifetime spend" : "No spend yet"}
            accent="emerald"
          />
          <StatCard
            label="Active Agents"
            value={String(summary?.activeAgents ?? 0)}
            icon={Bot}
            hint={`${agents.length} total configured`}
            accent="purple"
          />
          <StatCard
            label="Automations"
            value={String(summary?.activeAutomations ?? 0)}
            icon={Workflow}
            hint={`${automations.length} total workflows`}
            accent="blue"
          />
          <StatCard
            label="Providers"
            value={String(connectedProviders.length)}
            icon={PlugZap}
            hint={`${errorProviders.length > 0 ? `${errorProviders.length} with errors` : "All healthy"}`}
            accent={errorProviders.length > 0 ? "rose" : "amber"}
          />
        </motion.section>

        {/* ─── Two-Column Analytics ────────────── */}
        <div className="grid xl:grid-cols-[1.6fr_1fr] gap-4 mb-6">
          {/* Token Usage Chart */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="agentos-card p-4">
              <SectionHeader
                title="Token Usage"
                subtitle="Daily token consumption across all providers"
                action={
                  <Badge
                    variant="outline"
                    className="border-[--border-primary] text-[--text-muted] text-[9px] px-2 py-0 font-mono"
                  >
                    {summary?.totalTokens ? "Live" : "No data"}
                  </Badge>
                }
              />
              {usageTimeline.length === 0 && byProvider.length === 0 ? (
                <EmptyState
                  compact
                  icon={Cpu}
                  title="No usage recorded yet"
                  description="Send a message or run an agent to populate analytics"
                  className="mt-1"
                />
              ) : (
                <div className="mt-1">
                  <LazyTokenAreaChart data={usageTimeline} />
                </div>
              )}
            </div>
          </motion.section>

          {/* Provider Cost Breakdown */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <div className="agentos-card p-4 h-full">
              <SectionHeader
                title="Provider Breakdown"
                subtitle="Cost distribution by provider"
              />
              {byProvider.length === 0 ? (
                <EmptyState
                  compact
                  icon={PlugZap}
                  title="No provider data"
                  description="Configure a provider in Settings to see breakdowns"
                  className="mt-1"
                />
              ) : (
                <div className="flex items-start gap-4 mt-1">
                  <div className="shrink-0">
                    <LazyProviderPieChart data={byProvider} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5 pt-2">
                    {byProvider.map((provider: any) => (
                      <div
                        key={provider.name}
                        className="flex items-center justify-between py-1 border-b border-[--border-primary] last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: provider.color }}
                          />
                          <span className="text-[10px] text-[--text-secondary] truncate">
                            {provider.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[9px] text-[--text-disabled] font-mono">
                            {provider.tokens.toLocaleString()} tok
                          </span>
                          <span className="text-[11px] font-semibold text-[--text-primary]">
                            ${provider.value.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        </div>

        {/* ─── Bottom: Provider Health + Activity + Quick Actions ── */}
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-4 mb-6">
          {/* Provider Health */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="agentos-card p-4">
              <SectionHeader
                title="Provider Health"
                subtitle="Connected AI providers"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[--text-muted] hover:text-[--accent-primary] text-[9px] px-2"
                    asChild
                  >
                    <Link href="/settings">
                      Manage <ArrowRight className="w-2.5 h-2.5 ml-1" />
                    </Link>
                  </Button>
                }
              />
              {connectedProviders.length === 0 ? (
                <EmptyState
                  compact
                  icon={PlugZap}
                  title="No providers connected"
                  description="Add an API key in Settings to get started"
                  action={
                    <Link href="/settings">
                      <Button
                        size="sm"
                        className="h-7 bg-[--accent-primary] text-[--bg-primary] hover:bg-[--accent-hover] text-[10px] rounded-lg px-3"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Open Settings
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {connectedProviders.map((provider: any) => (
                    <ProviderBadge
                      key={provider.provider}
                      label={provider.label}
                      status="connected"
                    />
                  ))}
                  {errorProviders.map((provider: any) => (
                    <ProviderBadge
                      key={provider.provider}
                      label={provider.label}
                      status="error"
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* Recent Activity */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <div className="agentos-card p-4">
              <SectionHeader
                title="Recent Activity"
                subtitle="Latest workspace executions"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[--text-muted] hover:text-[--accent-primary] text-[9px] px-2"
                    asChild
                  >
                    <Link href="/activity">
                      View all <ArrowRight className="w-2.5 h-2.5 ml-1" />
                    </Link>
                  </Button>
                }
              />
              {recentChats.length === 0 ? (
                <EmptyState
                  compact
                  icon={Activity}
                  title="No activity yet"
                  description="Start a conversation in the workspace to see runs here"
                />
              ) : (
                <div className="space-y-1.5">
                  {recentChats.map((chat: any, idx: number) => (
                    <motion.div
                      key={chat.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.03 }}
                      className="flex items-center gap-3 rounded-lg border border-[--border-primary] bg-[--bg-tertiary]/40 p-2.5 hover:bg-[--bg-tertiary] hover:border-[--border-hover] transition-all duration-200 group cursor-pointer"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-[--text-primary] truncate">
                          {chat.title}
                        </p>
                        <p className="text-[9px] text-[--text-disabled] mt-0.5">
                          {chat.model} &middot; {formatTokens(chat.usage?.total_tokens ?? 0)} tokens
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Clock className="w-3 h-3 text-[--text-disabled]" />
                        <span className="text-[9px] text-[--text-disabled] whitespace-nowrap">
                          {formatTimeAgo(chat.updated_at)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        </div>

        {/* ─── Quick Actions Grid ─────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <SectionHeader
            title="Quick Actions"
            subtitle="Common tasks to boost productivity"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { icon: MessageSquare, label: "New Chat", href: "/workspace", desc: "Start a conversation" },
              { icon: Bot, label: "Create Agent", href: "/agents", desc: "Configure a new agent" },
              { icon: Workflow, label: "Build Workflow", href: "/automations", desc: "Automate tasks" },
              { icon: PlugZap, label: "Add Provider", href: "/settings", desc: "Connect an AI provider" },
              { icon: BookOpen, label: "Browse Knowledge", href: "/knowledge", desc: "Search your docs" },
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="agentos-card p-3 flex items-center gap-3 hover:border-[--border-hover] hover:bg-[--bg-elevated]/40 transition-all duration-200 cursor-pointer group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--accent-primary]/10 border border-[--border-secondary] text-[--accent-primary] group-hover:bg-[--accent-primary]/15 transition-colors">
                    <action.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-[--text-primary]">{action.label}</p>
                    <p className="text-[8px] text-[--text-disabled] mt-0.5">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-3 h-3 text-[--text-disabled] ml-auto shrink-0 group-hover:text-[--accent-primary] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
