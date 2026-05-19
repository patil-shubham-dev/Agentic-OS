"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ArrowRight,
  CheckCircle2,
  Cpu,
  FolderKanban,
  GitBranch,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Telescope,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  automations,
  costByProvider,
  dashboardStats,
  provenanceMatrix,
  recentActivities,
  usageData,
} from "@/lib/product-blueprint";
import { getJson } from "@/lib/client-api";

const skillCards: Array<{
  id: string;
  title: string;
  subtitle: string;
  invocations: number;
  impact: string;
  icon: LucideIcon;
  tone: string;
}> = [
  { id: "01", title: "Applications", subtitle: "Build full-stack apps & APIs", invocations: 132, impact: "$8.41", icon: FolderKanban, tone: "from-emerald-500/20 to-teal-500/5" },
  { id: "02", title: "Agents", subtitle: "Autonomous task execution", invocations: 184, impact: "$6.72", icon: Sparkles, tone: "from-amber-500/20 to-orange-500/5" },
  { id: "03", title: "Search", subtitle: "Web research & synthesis", invocations: 243, impact: "$4.21", icon: Search, tone: "from-violet-500/20 to-fuchsia-500/5" },
  { id: "04", title: "Data Analysis", subtitle: "Analyze & visualize", invocations: 167, impact: "$5.31", icon: Cpu, tone: "from-sky-500/20 to-blue-500/5" },
  { id: "05", title: "DevOps", subtitle: "Deploy & monitor", invocations: 98, impact: "$3.14", icon: ShieldCheck, tone: "from-emerald-500/20 to-cyan-500/5" },
  { id: "06", title: "Diagramming", subtitle: "UML, flows, architecture", invocations: 76, impact: "$2.71", icon: GitBranch, tone: "from-indigo-500/20 to-violet-500/5" },
  { id: "07", title: "Email", subtitle: "Compose & automate", invocations: 64, impact: "$1.12", icon: Mail, tone: "from-pink-500/20 to-rose-500/5" },
  { id: "08", title: "GitHub", subtitle: "Repo analysis & automation", invocations: 211, impact: "$6.81", icon: Wrench, tone: "from-slate-500/20 to-slate-700/5" },
];

const sourceChips = ["GitHub", "Notion", "Supabase", "Linear", "Vercel", "Postgres", "Sentry", "Docs"];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const [providerData, setProviderData] = useState(costByProvider);
  const [timelineData, setTimelineData] = useState(usageData);
  const [activityData, setActivityData] = useState(recentActivities);
  const [summaryStats, setSummaryStats] = useState(dashboardStats);

  useEffect(() => {
    getJson<{
      summary: {
        totalTokens: number;
        totalCost: number;
        activeAgents: number;
        activeAutomations: number;
      };
      byProvider: Array<{ provider: string; cost: number }>;
      usageTimeline: Array<{ name: string; tokens: number; cost: number }>;
      recentActivities: Array<{ id: string; title: string; model: string; time: string; tokens: number }>;
    }>("/api/dashboard")
      .then((data) => {
        setSummaryStats([
          { ...dashboardStats[0], value: data.summary.totalTokens ? data.summary.totalTokens.toLocaleString() : "0" },
          { ...dashboardStats[1], value: `$${data.summary.totalCost.toFixed(2)}` },
          { ...dashboardStats[2], value: String(data.summary.activeAgents) },
          { ...dashboardStats[3], label: "Active Automations", value: String(data.summary.activeAutomations) },
        ]);

        if (data.byProvider.length > 0) {
          const total = data.byProvider.reduce((sum, item) => sum + item.cost, 0) || 1;
          setProviderData(
            data.byProvider.map((item, index) => ({
              name: item.provider,
              value: Math.max(1, Math.round((item.cost / total) * 100)),
              color: ["#45d196", "#8b5cf6", "#3b82f6", "#f59e0b", "#ef4444"][index % 5],
            }))
          );
        }

        if (data.usageTimeline.length > 0) {
          setTimelineData(data.usageTimeline);
        }

        if (data.recentActivities.length > 0) {
          setActivityData(
            data.recentActivities.map((activity, index) => ({
              id: index + 1,
              type: "chat" as const,
              title: activity.title,
              model: activity.model,
              tokens: activity.tokens,
              time: new Date(activity.time).toLocaleString(),
              status: "success" as const,
            }))
          );
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="px-3 pt-3 pb-6">
      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-4">
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="agentos-card agentos-border-glow overflow-hidden p-4">
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <div className="relative min-h-[280px] overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.55),transparent_32%),linear-gradient(180deg,rgba(18,24,55,1),rgba(7,10,23,1))]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(255,255,255,0.55),transparent_6%),radial-gradient(circle_at_72%_18%,rgba(255,255,255,0.18),transparent_22%)] opacity-80" />
                  <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-amber-300/15 bg-black/25 px-4 py-3 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Dream Review</p>
                    <p className="mt-2 text-sm text-slate-200">Nightly orchestration snapshot generated from the manager lane.</p>
                  </div>
                </div>
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-violet-500/15 text-violet-200 hover:bg-violet-500/15">Strategy</Badge>
                        <Badge className="bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/15">High Impact</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">12 May 23:59</span>
                    </div>
                    <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white">
                      4 improvements found overnight
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Pattern analysis across 7 days. Generated by the manager model after scanning cost, latency, and delegation behavior.
                    </p>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Insight #1</p>
                        <p className="mt-3 text-xl font-medium text-slate-100">87% of work is routed to Opus</p>
                        <p className="mt-2 text-sm text-muted-foreground">Offload low-complexity tasks to Haiku or Llama for cheaper extraction and summarization.</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Projected Savings</p>
                        <p className="mt-3 text-xl font-medium text-slate-100">$18.4/day</p>
                        <p className="mt-2 text-sm text-muted-foreground">Estimated 32% cost reduction with an 11% latency improvement across routine flows.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-slate-300">1.2M tokens can be offloaded to Haiku</span>
                    <span className="text-sm text-red-300">2.1s avg latency improvement</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" className="border-white/10 bg-white/[0.03]">Skip</Button>
                      <Button className="border border-emerald-500/20 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20">Apply Changes</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="agentos-card agentos-border-glow p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sources</p>
                  <p className="text-sm text-slate-300">8 skill streams live · 14 data sources connected</p>
                </div>
                <Button variant="ghost" className="hidden md:inline-flex text-muted-foreground">Manage sources</Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {sourceChips.map((source) => (
                  <div key={source} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                    <span>{source}</span>
                    <span className="ml-2 text-emerald-300">Live</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div className="agentos-card agentos-border-glow p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Memory</p>
                  <p className="text-sm text-slate-300">Everything AgentOS remembers about you and your workspace.</p>
                </div>
                <span className="text-xs text-muted-foreground">Memory used 68%</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  {
                    title: "User Profile",
                    body: ["You are a technical founder building AI tools.", "You prefer concise, actionable answers.", "You prioritize shipping over perfection."],
                  },
                  {
                    title: "Agent Memory",
                    body: ["Prefers TypeScript over Python.", "Uses Vercel for deployments.", "Likes dark, premium enterprise UIs."],
                  },
                  {
                    title: "Soul",
                    body: ["Be precise, honest, and useful.", "Optimize for long-term leverage.", "Protect operator time and focus."],
                  },
                ].map((memoryCard) => (
                  <div key={memoryCard.title} className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,29,54,0.86),rgba(9,11,24,0.86))] p-4">
                    <div className="absolute inset-y-0 right-0 w-24 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.12),transparent_60%)] opacity-60" />
                    <p className="text-lg font-medium text-slate-50">{memoryCard.title}</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-300">
                      {memoryCard.body.map((line) => (
                        <p key={line}>• {line}</p>
                      ))}
                    </div>
                    <Button variant="outline" className="mt-5 border-white/10 bg-white/[0.03]">Edit</Button>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        </div>

        <div className="space-y-4">
          <motion.section initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
            <div className="agentos-card agentos-border-glow p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Skills Overview</p>
                  <p className="text-sm text-slate-300">All systems operational</p>
                </div>
                <span className="text-xs text-emerald-300">Operational</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {skillCards.map((skill) => (
                  <div key={skill.id} className={`rounded-[20px] border border-white/10 bg-gradient-to-br ${skill.tone} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/15">
                        <skill.icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-sm text-slate-300">{skill.id}</span>
                    </div>
                    <p className="mt-4 text-xl font-medium text-white">{skill.title}</p>
                    <p className="mt-1 text-sm text-slate-300">{skill.subtitle}</p>
                    <div className="mt-5 flex items-end justify-between text-sm">
                      <div>
                        <p className="text-slate-300">{skill.invocations}</p>
                        <p className="text-xs text-muted-foreground">Invocations</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-300">{skill.impact}</p>
                        <p className="text-xs text-muted-foreground">Impact</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}>
            <div className="agentos-card agentos-border-glow p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Automations</p>
                  <p className="text-sm text-slate-300">AI-powered workflows currently active</p>
                </div>
                <Button variant="ghost" className="text-muted-foreground">All automations</Button>
              </div>
              <div className="grid gap-2">
                {automations.slice(0, 4).map((automation) => (
                  <div key={automation.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-100">{automation.name}</p>
                        <p className="text-xs text-muted-foreground">Trigger: {automation.trigger.type}</p>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">Active</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="agentos-card agentos-border-glow p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Activity Feed</p>
                    <p className="text-sm text-slate-300">Live workspace execution</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  {activityData.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-100">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.model} · {activity.tokens.toLocaleString()} tokens</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="agentos-card agentos-border-glow p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Usage Analytics</p>
                    <p className="text-sm text-slate-300">This week</p>
                  </div>
                  <Badge className="bg-white/[0.06] text-slate-200 hover:bg-white/[0.06]">Live</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {summaryStats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                      <p className="mt-1 text-xs text-emerald-300">{stat.change}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={timelineData}>
                        <defs>
                          <linearGradient id="dashboardUsage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#45d196" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#45d196" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#0f1224",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "14px",
                          }}
                        />
                        <Area type="monotone" dataKey="tokens" stroke="#45d196" strokeWidth={2} fill="url(#dashboardUsage)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={providerData} dataKey="value" innerRadius={36} outerRadius={56} paddingAngle={4}>
                          {providerData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {providerData.map((provider) => (
                        <div key={provider.name} className="flex items-center justify-between text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: provider.color }} />
                            <span>{provider.name}</span>
                          </div>
                          <span>{provider.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      <motion.section variants={container} initial="hidden" animate="show" className="mt-4 grid gap-4 lg:grid-cols-3">
        {provenanceMatrix.map((itemData) => (
          <motion.div key={itemData.name} variants={item}>
            <Card className="agentos-card agentos-border-glow border-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <Badge className="bg-white/[0.06] text-slate-200 hover:bg-white/[0.06]">{itemData.upstream}</Badge>
                  <Telescope className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-4 text-lg font-medium text-slate-50">{itemData.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {itemData.adoptedPatterns.map((pattern) => (
                    <span key={pattern} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                      {pattern}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{itemData.customLayer}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.section>
    </div>
  );
}
