"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LazyFlowBuilder = dynamic(() => import("@/components/flow/FlowBuilder").then((m) => ({ default: m.LazyFlowBuilder })), { ssr: false });
import {
  Plus,
  Play,
  Pause,
  Clock,
  Webhook,
  FileText,
  GitCommit,
  Zap,
  Trash2,
  Edit3,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bot,
  ArrowRight,
  Settings,
  Bell,
  Workflow,
  Sparkles,
  Layers,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/client-api";
import type { ProductAutomation } from "@/lib/product-blueprint";
import { EmptyState } from "@/components/empty-state";

const initialNodes = [
  { id: "trigger", type: "input", position: { x: 250, y: 0 }, data: { label: "Trigger: Schedule" } },
  { id: "agent1", position: { x: 250, y: 100 }, data: { label: "Research Agent" } },
  { id: "tool1", position: { x: 250, y: 200 }, data: { label: "Write File" } },
  { id: "approval", position: { x: 250, y: 300 }, data: { label: "Human Approval" } },
  { id: "notify", position: { x: 250, y: 400 }, data: { label: "Send Notification" } },
];

const initialEdges = [
  { id: "e1", source: "trigger", target: "agent1" },
  { id: "e2", source: "agent1", target: "tool1" },
  { id: "e3", source: "tool1", target: "approval" },
  { id: "e4", source: "approval", target: "notify" },
];

const TRIGGER_CONFIG: Record<string, { icon: any; label: string }> = {
  schedule: { icon: Clock, label: "Schedule" },
  webhook: { icon: Webhook, label: "Webhook" },
  manual: { icon: Zap, label: "Manual" },
  file_change: { icon: FileText, label: "File Change" },
  git_commit: { icon: GitCommit, label: "Git Commit" },
};

const STEP_ICONS: Record<string, any> = {
  agent: Bot,
  tool: Zap,
  approval: CheckCircle2,
  notification: Bell,
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function AutomationsPage() {
  const [selectedAutomation, setSelectedAutomation] = useState<ProductAutomation | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "builder">("list");
  const [automations, setAutomations] = useState<ProductAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJson<{ automations: Array<Record<string, unknown>> }>("/api/automations")
      .then((data) => {
        if (!active) return;
        const mapped = data.automations.map((automation) => ({
          id: String(automation.id),
          name: String(automation.name),
          description: String(automation.description ?? ""),
          status: (automation.status as ProductAutomation["status"]) ?? "draft",
          trigger: (automation.trigger as ProductAutomation["trigger"]) ?? { type: "manual", config: {} },
          steps: Array.isArray(automation.steps) ? (automation.steps as ProductAutomation["steps"]) : [],
          lastRun: automation.last_run_at ? new Date(String(automation.last_run_at)).toLocaleString() : "Never",
          nextRun: automation.next_run_at ? new Date(String(automation.next_run_at)).toLocaleString() : "Not scheduled",
          runs: Number(automation.runs ?? 0),
          successRate: Number(automation.success_rate ?? 0),
        }));
        setAutomations(mapped);
      })
      .catch((fetchError) => {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load automations");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const statusConfig = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "bg-emerald-950/30", text: "text-emerald-400", dot: "bg-emerald-400" };
      case "paused":
        return { bg: "bg-amber-950/30", text: "text-amber-400", dot: "bg-amber-400" };
      case "error":
        return { bg: "bg-red-950/30", text: "text-red-400", dot: "bg-red-400" };
      default:
        return { bg: "bg-[--bg-elevated]", text: "text-[--text-muted]", dot: "bg-[--text-disabled]" };
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col agentos-shell">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
              <Workflow className="w-5 h-5 text-[--accent-primary]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[--text-primary]">Automations</h1>
              <p className="text-[13px] text-[--text-muted]">Build trigger-based workflows with AI agents</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList className="bg-[--bg-tertiary] border border-[--border-primary]">
                <TabsTrigger value="list" className="text-xs data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] data-[state=active]:shadow-none">List</TabsTrigger>
                <TabsTrigger value="builder" className="text-xs data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] data-[state=active]:shadow-none">Builder</TabsTrigger>
              </TabsList>
            </Tabs>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="h-9 gap-2 bg-[--accent-primary] text-[--accent-soft] hover:bg-[--accent-hover] shadow-[0_0_20px_var(--glow-soft)]">
                  <Plus className="w-4 h-4" /> New Automation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl agentos-glass-elevated border-[--border-primary]">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[--accent-primary]" />
                    </div>
                    <div>
                      <DialogTitle className="text-[--text-primary]">Create Automation</DialogTitle>
                      <DialogDescription className="text-[--text-muted] text-[13px]">Build a workflow that runs automatically</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  <div className="space-y-2">
                    <Label className="text-[13px] text-[--text-secondary] font-medium">Name</Label>
                    <Input
                      placeholder="e.g., Daily Report Generation"
                      className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] placeholder:text-[--text-disabled] focus-visible:ring-[--accent-primary] focus-visible:ring-1 focus-visible:border-[--accent-primary]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] text-[--text-secondary] font-medium">Trigger Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { type: "schedule", icon: Clock, label: "Schedule" },
                        { type: "webhook", icon: Webhook, label: "Webhook" },
                        { type: "manual", icon: Zap, label: "Manual" },
                        { type: "file_change", icon: FileText, label: "File Change" },
                        { type: "git_commit", icon: GitCommit, label: "Git Commit" },
                      ].map((t) => (
                        <button
                          key={t.type}
                          type="button"
                          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[--bg-tertiary] border border-[--border-primary] hover:border-[--accent-primary]/40 hover:bg-[--accent-primary]/5 transition-all text-[--text-primary]"
                        >
                          <t.icon className="w-5 h-5 text-[--accent-primary]" />
                          <span className="text-[12px] font-medium">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] text-[--text-secondary] font-medium">Agent</Label>
                    <Select>
                      <SelectTrigger className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary]">
                        <SelectValue placeholder="Select agent" className="text-[--text-disabled]" />
                      </SelectTrigger>
                      <SelectContent className="bg-[--bg-secondary] border-[--border-primary]">
                        <SelectItem value="research" className="text-[--text-primary] focus:bg-[--bg-elevated]">Research Agent</SelectItem>
                        <SelectItem value="coding" className="text-[--text-primary] focus:bg-[--bg-elevated]">Coding Agent</SelectItem>
                        <SelectItem value="design" className="text-[--text-primary] focus:bg-[--bg-elevated]">Design Agent</SelectItem>
                        <SelectItem value="qa" className="text-[--text-primary] focus:bg-[--bg-elevated]">QA Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="border-t border-[--border-primary] pt-4">
                  <Button variant="outline" className="border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated]">Cancel</Button>
                  <Button className="bg-[--accent-primary] text-[--accent-soft] hover:bg-[--accent-hover]">Create Automation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {viewMode === "list" ? (
          <>
            {/* Loading / Error states */}
            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[--accent-primary]" />
                  <p className="text-[13px] text-[--text-muted]">Loading automations...</p>
                </div>
              </div>
            )}
            {error && !loading && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Stats */}
            {!loading && !error && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Active", value: String(automations.filter((item) => item.status === "active").length), icon: CheckCircle2, accent: "emerald" },
                  { label: "Paused", value: String(automations.filter((item) => item.status === "paused").length), icon: Pause, accent: "amber" },
                  { label: "Error", value: String(automations.filter((item) => item.status === "error").length), icon: XCircle, accent: "red" },
                  { label: "Total Runs", value: String(automations.reduce((sum, item) => sum + item.runs, 0)), icon: Zap, accent: "amber" },
                ].map((stat) => {
                  const accentColors: Record<string, string> = {
                    emerald: "text-emerald-400",
                    amber: "text-[--accent-primary]",
                    red: "text-red-400",
                  };
                  return (
                    <div key={stat.label} className="agentos-card p-4 flex items-center gap-3">
                      <stat.icon className={cn("w-5 h-5", accentColors[stat.accent])} />
                      <div>
                        <p className="text-2xl font-bold text-[--text-primary]">{stat.value}</p>
                        <p className="text-[12px] text-[--text-muted]">{stat.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Automations List */}
            {!loading && automations.length === 0 ? (
              <EmptyState
                title="No automations configured."
                description="Create your first automated trigger-based workflow to run specialist agents."
                icon={Zap}
              />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {automations.map((auto) => {
                    const sc = statusConfig(auto.status);
                    const TriggerIcon = TRIGGER_CONFIG[auto.trigger.type]?.icon || Zap;
                    return (
                      <motion.div
                        key={auto.id}
                        layout
                        variants={item}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <div
                          className="agentos-card p-5 cursor-pointer hover:border-[--border-hover] transition-all"
                          onClick={() => setSelectedAutomation(auto)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", sc.bg)}>
                                <TriggerIcon className={cn("w-5 h-5", sc.text)} />
                              </div>
                              <div>
                                <h3 className="font-semibold text-[--text-primary]">{auto.name}</h3>
                                <p className="text-[13px] text-[--text-muted] mt-0.5">{auto.description}</p>
                                <div className="flex items-center gap-3 mt-2.5">
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-[--border-secondary] text-[--text-secondary]">
                                    {auto.trigger.type.replace("_", " ")}
                                  </Badge>
                                  <span className="text-[12px] text-[--text-muted] flex items-center gap-1">
                                    <Layers className="w-3 h-3" /> {auto.steps.length} steps
                                  </span>
                                  <span className="text-[12px] text-[--text-muted]">{auto.runs} runs</span>
                                  <span className={cn(
                                    "text-[12px]",
                                    auto.successRate >= 80 ? "text-emerald-400" : auto.successRate >= 50 ? "text-amber-400" : "text-red-400"
                                  )}>
                                    {auto.successRate}% success
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="text-right">
                                <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium", sc.bg, sc.text)}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                                  {auto.status}
                                </div>
                                <p className="text-[11px] text-[--text-muted] mt-2">Last: {auto.lastRun}</p>
                                <p className="text-[11px] text-[--text-muted]">Next: {auto.nextRun}</p>
                              </div>
                              <div className="w-5 h-5 flex items-center justify-center text-[--text-disabled] transition-colors mt-1">
                                <ArrowRight className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        ) : (
          /* Workflow Builder */
          <div className="h-[calc(100vh-14rem)] agentos-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[--border-primary]">
              <div>
                <h2 className="text-sm font-semibold text-[--text-primary]">Workflow Builder</h2>
                <p className="text-[12px] text-[--text-muted]">Drag and drop nodes to build automations</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2 border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated]">
                  <Bot className="w-4 h-4" /> Add Agent
                </Button>
                <Button variant="outline" size="sm" className="gap-2 border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated]">
                  <Zap className="w-4 h-4" /> Add Tool
                </Button>
                <Button variant="outline" size="sm" className="gap-2 border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated]">
                  <Bell className="w-4 h-4" /> Add Notification
                </Button>
              </div>
            </div>
            <div className="flex-1">
              <LazyFlowBuilder
                initialNodes={initialNodes}
                initialEdges={initialEdges}
                className="h-full"
              />
            </div>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selectedAutomation} onOpenChange={() => setSelectedAutomation(null)}>
          <DialogContent className="max-w-3xl agentos-glass-elevated border-[--border-primary]">
            {selectedAutomation && (() => {
              const sc = statusConfig(selectedAutomation.status);
              const TriggerIcon = TRIGGER_CONFIG[selectedAutomation.trigger.type]?.icon || Zap;
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", sc.bg)}>
                          <TriggerIcon className={cn("w-4 h-4", sc.text)} />
                        </div>
                        <div>
                          <DialogTitle className="text-[--text-primary]">{selectedAutomation.name}</DialogTitle>
                          <DialogDescription className="text-[--text-muted] text-[13px]">{selectedAutomation.description}</DialogDescription>
                        </div>
                      </div>
                      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium", sc.bg, sc.text)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                        {selectedAutomation.status}
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-5">
                    {/* Trigger Section */}
                    <div>
                      <h4 className="text-[13px] font-medium text-[--text-secondary] mb-2.5 flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5" /> Trigger
                      </h4>
                      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[--bg-tertiary] border border-[--border-primary]">
                        <TriggerIcon className="w-4 h-4 text-[--accent-primary]" />
                        <span className="text-sm text-[--text-primary] capitalize">{selectedAutomation.trigger.type.replace("_", " ")}</span>
                        <code className="ml-auto text-[11px] bg-[--bg-elevated] text-[--text-muted] px-2.5 py-1 rounded-lg border border-[--border-primary]">
                          {JSON.stringify(selectedAutomation.trigger.config)}
                        </code>
                      </div>
                    </div>

                    {/* Steps Timeline */}
                    <div>
                      <h4 className="text-[13px] font-medium text-[--text-secondary] mb-2.5 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" /> Steps ({selectedAutomation.steps.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedAutomation.steps.map((step, i) => {
                          const StepIcon = STEP_ICONS[step.type] || Bot;
                          return (
                            <div key={step.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-[--bg-tertiary] border border-[--border-primary]">
                              {/* Step number bubble */}
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-7 h-7 rounded-full bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center text-[11px] font-bold text-[--accent-primary]">
                                  {i + 1}
                                </div>
                                {i < selectedAutomation.steps.length - 1 && (
                                  <div className="w-px flex-1 min-h-[8px] bg-[--border-primary]" />
                                )}
                              </div>
                              {/* Step icon */}
                              <div className="w-8 h-8 rounded-lg bg-[--accent-primary]/10 flex items-center justify-center shrink-0 mt-0.5">
                                <StepIcon className="w-4 h-4 text-[--accent-primary]" />
                              </div>
                              {/* Step details */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[--text-primary]">{step.name}</p>
                                <p className="text-[12px] text-[--text-muted] capitalize">{step.type}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-[--text-disabled] mt-1.5 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Total Runs", value: selectedAutomation.runs, accent: "text-[--accent-primary]" },
                        { label: "Success Rate", value: `${selectedAutomation.successRate}%`, accent: selectedAutomation.successRate >= 80 ? "text-emerald-400" : selectedAutomation.successRate >= 50 ? "text-amber-400" : "text-red-400" },
                        { label: "Steps", value: selectedAutomation.steps.length, accent: "text-[--accent-primary]" },
                      ].map((s) => (
                        <div key={s.label} className="p-3.5 rounded-xl bg-[--bg-tertiary] border border-[--border-primary] text-center">
                          <p className={cn("text-xl font-bold", s.accent)}>{s.value}</p>
                          <p className="text-[11px] text-[--text-muted] mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <DialogFooter className="border-t border-[--border-primary] pt-4 gap-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2 border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated]">
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2 border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated]">
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2 border-[--border-primary] text-red-400 hover:bg-red-950/20 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedAutomation.status === "active" ? (
                        <Button variant="outline" size="sm" className="gap-2 border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-elevated]">
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </Button>
                      ) : (
                        <Button size="sm" className="gap-2 bg-[--accent-primary] text-[--accent-soft] hover:bg-[--accent-hover]">
                          <Play className="w-3.5 h-3.5" /> Activate
                        </Button>
                      )}
                      <Button size="sm" className="gap-2 bg-[--accent-primary] text-[--accent-soft] hover:bg-[--accent-hover]">
                        <Play className="w-3.5 h-3.5" /> Run Now
                      </Button>
                    </div>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
