"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
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
  Bot,
  Plus,
  Search,
  Play,
  Trash2,
  Wrench,
  Brain,
  Code2,
  Palette,
  Sparkles,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  Copy,
  Zap,
  Globe,
  HardDrive,
  Layers,
  Terminal,
  FileCode,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, sendJson } from "@/lib/client-api";
import type { ProductAgent } from "@/lib/product-blueprint";
import { useModelRegistry } from "@/stores/model-registry";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";

const agentIcons: Record<string, React.ElementType> = {
  research: Brain,
  coding: Code2,
  design: Palette,
  qa: Bot,
};

const statusConfig: Record<string, { label: string; dotColor: string; pulse: boolean }> = {
  active: { label: "Active", dotColor: "bg-emerald-500", pulse: true },
  idle: { label: "Idle", dotColor: "bg-[--text-disabled]", pulse: false },
  error: { label: "Error", dotColor: "bg-rose-500", pulse: false },
};

const toolIcons: Record<string, React.ElementType> = {
  web_search: Globe,
  terminal: Terminal,
  read_file: FileCode,
  write_file: FileCode,
  execute_code: Zap,
  browser_navigate: Globe,
  memory: HardDrive,
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const AVAILABLE_TOOLS = [
  "web_search",
  "terminal",
  "read_file",
  "write_file",
  "execute_code",
  "browser_navigate",
  "memory",
];


export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<ProductAgent | null>(null);
  const [agents, setAgents] = useState<ProductAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Resolve available models from registry instead of hardcoded list
  const activeModels = useModelRegistry((s) => s.activeModels);
  const availableModels =
    activeModels.length > 0
      ? activeModels.map((m) => ({
          id: m.id,
          name: m.label || m.name.split("/").pop() || m.name,
        }))
      : [{ id: "default", name: "Default Model" }];

  // Create Agent State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newModel, setNewModel] = useState("default");
  const [newTools, setNewTools] = useState<string[]>(["terminal", "read_file"]);
  const [newMemory, setNewMemory] = useState<"project" | "global">("project");

  // Edit Agent State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editTools, setEditTools] = useState<string[]>([]);
  const [editMemory, setEditMemory] = useState<"project" | "global">("project");

  const loadAgents = () => {
    setLoading(true);
    getJson<{ agents: Array<Record<string, unknown>> }>("/api/agents")
      .then((data) => {
        const mapped = data.agents.map((agent) => ({
          id: String(agent.id),
          name: String(agent.name),
          description: String(agent.description ?? ""),
          type: (agent.type as "built-in" | "custom") ?? "custom",
          model: String(agent.model ?? "unknown"),
          status: (agent.status as "active" | "idle" | "error") ?? "idle",
          tools: Array.isArray(agent.tools) ? (agent.tools as string[]) : [],
          memory: ((agent.memory_scope as "project" | "global") ?? "project"),
          runs: Number(agent.runs ?? 0),
          lastRun: agent.last_run_at ? new Date(String(agent.last_run_at)).toLocaleString() : "Never",
          color: String((agent.config as { color?: string } | undefined)?.color ?? "bg-[--accent-primary] text-[--bg-primary]"),
          upstream: ((agent.config as { source?: ProductAgent["upstream"] } | undefined)?.source ?? "agentos"),
        }));
        setAgents(mapped);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load agents");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleCreateAgent = async () => {
    if (!newName.trim() || !newDescription.trim()) {
      toast.error("Please fill in the Name and Description fields.");
      return;
    }

    try {
      await sendJson("/api/agents", "POST", {
        name: newName,
        description: newDescription,
        model: newModel,
        type: "custom",
        status: "idle",
        tools: newTools,
        memoryScope: newMemory,
        config: {
          color: "bg-[--accent-primary] text-[--bg-primary]",
          source: "agentos",
        },
      });

      toast.success("Agent created successfully!");
      setCreateDialogOpen(false);
      setNewName("");
      setNewDescription("");
      setNewModel("default");
      setNewTools(["terminal", "read_file"]);
      loadAgents();
    } catch {
      toast.error("Failed to create agent.");
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      await sendJson(`/api/agents/${agentId}`, "DELETE");
      toast.success("Agent deleted successfully.");
      setSelectedAgent(null);
      loadAgents();
    } catch {
      toast.error("Failed to delete agent.");
    }
  };

  const handleDuplicateAgent = async (agent: ProductAgent) => {
    try {
      await sendJson("/api/agents", "POST", {
        name: `Copy of ${agent.name}`,
        description: agent.description,
        model: agent.model,
        type: "custom",
        status: "idle",
        tools: agent.tools,
        memoryScope: agent.memory,
        config: {
          color: agent.color,
          source: agent.upstream,
        },
      });

      toast.success("Agent duplicated successfully.");
      setSelectedAgent(null);
      loadAgents();
    } catch {
      toast.error("Failed to duplicate agent.");
    }
  };

  const handleOpenEdit = (agent: ProductAgent) => {
    setEditName(agent.name);
    setEditDescription(agent.description);
    setEditModel(agent.model);
    setEditTools(agent.tools);
    setEditMemory(agent.memory);
    setEditDialogOpen(true);
  };

  const handleUpdateAgent = async () => {
    if (!selectedAgent) return;
    try {
      await sendJson(`/api/agents/${selectedAgent.id}`, "PATCH", {
        name: editName,
        description: editDescription,
        model: editModel,
        tools: editTools,
        memoryScope: editMemory,
      });

      toast.success("Agent updated successfully!");
      setEditDialogOpen(false);
      setSelectedAgent(null);
      loadAgents();
    } catch {
      toast.error("Failed to update agent.");
    }
  };

  const toggleTool = (tool: string, editMode = false) => {
    if (editMode) {
      setEditTools((prev) =>
        prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
      );
    } else {
      setNewTools((prev) =>
        prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
      );
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "built-in" && agent.type === "built-in") ||
      (activeTab === "custom" && agent.type === "custom");

    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-6 space-y-6 bg-[--bg-primary] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
            <Bot className="w-5 h-5 text-[--accent-primary]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[--text-primary] tracking-tight">Agents</h1>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Configure and execute custom AI agents for your workflows
            </p>
          </div>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] shadow-sm shadow-[--glow-primary]/30 rounded-lg transition-all">
              <Plus className="w-4 h-4" /> New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl agentos-glass-elevated border-[--border-primary] rounded-2xl shadow-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[--text-primary] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[--accent-primary]" />
                Create New Agent
              </DialogTitle>
              <DialogDescription className="text-xs text-[--text-muted]">
                Configure a specialized AI agent in the local workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[--text-secondary] text-xs font-medium">Name</Label>
                <Input
                  className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] placeholder:text-[--text-disabled] focus-visible:ring-[--accent-primary]/30 rounded-lg"
                  placeholder="e.g., Pull Request reviewer"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[--text-secondary] text-xs font-medium">Description</Label>
                <Input
                  className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] placeholder:text-[--text-disabled] focus-visible:ring-[--accent-primary]/30 rounded-lg"
                  placeholder="What is this specialist's role?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-[--accent-primary]" />
                  LLM Core Model
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {availableModels.map((model) => {
                    const isSelected = newModel === model.id;
                    return (
                      <Button
                        key={model.id}
                        variant="outline"
                        className={cn(
                          "justify-start text-xs border-[--border-primary] rounded-lg h-auto py-2",
                          isSelected
                            ? "bg-[--accent-primary]/10 text-[--accent-primary] border-[--border-secondary] font-semibold"
                            : "bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-elevated] hover:text-[--text-primary]"
                        )}
                        onClick={() => setNewModel(model.id)}
                      >
                        <Cpu className="w-3.5 h-3.5 mr-1.5 shrink-0" /> {model.name}
                      </Button>
                    );
                  })}
                  {availableModels.length === 0 && (
                    <p className="text-xs text-[--text-disabled] italic col-span-3 text-center py-2">
                      No active models found. Configure a provider in Settings first.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 text-[--accent-primary]" />
                  Allowed Tools
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TOOLS.map((tool) => {
                    const ToolIcon = toolIcons[tool] || Wrench;
                    const isSelected = newTools.includes(tool);
                    return (
                      <Badge
                        key={tool}
                        variant="outline"
                        className={cn(
                          "cursor-pointer px-2 py-1 rounded-lg text-[11px] transition-all flex items-center gap-1",
                          isSelected
                            ? "bg-[--accent-primary]/10 text-[--accent-primary] border-[--border-secondary]"
                            : "bg-[--bg-tertiary] text-[--text-disabled] border-[--border-primary] hover:border-[--border-hover] hover:text-[--text-secondary]"
                        )}
                        onClick={() => toggleTool(tool)}
                      >
                        <ToolIcon className="w-3 h-3" /> {tool}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3 text-[--accent-primary]" />
                  Memory Scope
                </Label>
                <div className="flex gap-2">
                  {(["project", "global"] as const).map((scope) => {
                    const isSelected = newMemory === scope;
                    return (
                      <Button
                        key={scope}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "text-xs px-3 border-[--border-primary] rounded-lg",
                          isSelected
                            ? "bg-[--accent-primary]/10 text-[--accent-primary] border-[--border-secondary] font-semibold"
                            : "bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-elevated]"
                        )}
                        onClick={() => setNewMemory(scope)}
                      >
                        <Layers className="w-3 h-3 mr-1" /> {scope} scope
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-tertiary] hover:text-[--text-primary] rounded-lg"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] shadow-sm shadow-[--glow-primary]/30 rounded-lg"
                onClick={handleCreateAgent}
              >
                Create Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[--text-disabled]" />
          <Input
            placeholder="Search agents by name or description..."
            className="pl-9 bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] placeholder:text-[--text-disabled] focus-visible:ring-[--accent-primary]/30 rounded-lg text-xs h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="bg-[--bg-tertiary] border border-[--border-primary] p-0.5 rounded-lg">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] data-[state=active]:shadow-sm rounded text-[11px] text-[--text-muted] px-3 py-1.5 transition-all"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="built-in"
              className="data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] data-[state=active]:shadow-sm rounded text-[11px] text-[--text-muted] px-3 py-1.5 transition-all"
            >
              Built-in
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              className="data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] data-[state=active]:shadow-sm rounded text-[11px] text-[--text-muted] px-3 py-1.5 transition-all"
            >
              Custom
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Loading, Error, Empty states */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-5 h-5 text-[--accent-primary] animate-spin" />
            <span className="text-xs text-[--text-muted]">Loading agents...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3 text-xs text-rose-400">
          {error}
        </div>
      )}
      {!loading && agents.length === 0 && (
        <EmptyState
          title="No agents created yet."
          description="Create your first custom specialist agent to get started."
          icon={Bot}
          action={
            <Button
              className="gap-2 bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] shadow-sm shadow-[--glow-primary]/30 rounded-lg"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4" /> New Agent
            </Button>
          }
        />
      )}
      {!loading && agents.length > 0 && filteredAgents.length === 0 && (
        <div className="text-center py-16">
          <p className="text-xs text-[--text-disabled] italic">
            No agents match your current filters.
          </p>
        </div>
      )}

      {/* Agents Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <AnimatePresence mode="popLayout">
          {filteredAgents.map((agent) => {
            const AgentIcon = agentIcons[agent.id as keyof typeof agentIcons] ?? Bot;
            const status = statusConfig[agent.status] || statusConfig.idle;
            const toolKeys = agent.tools.map((t) => toolIcons[t] || Wrench);

            return (
              <motion.div
                key={agent.id}
                variants={item}
                layout
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div
                  className="agentos-card group cursor-pointer transition-all hover:shadow-lg hover:shadow-[--glow-primary]/5"
                  onClick={() => setSelectedAgent(agent)}
                >
                  <div className="p-4">
                    {/* Top row: Icon + Status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
                        <AgentIcon className="w-5 h-5 text-[--accent-primary]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[--bg-tertiary] border border-[--border-primary]">
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              status.dotColor,
                              status.pulse && "animate-pulse"
                            )}
                          />
                          <span className="text-[9px] font-medium text-[--text-muted]">
                            {status.label}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] border-[--border-primary] bg-[--bg-tertiary] text-[--text-disabled] font-medium px-1.5 py-0.5 rounded"
                        >
                          {agent.type}
                        </Badge>
                      </div>
                    </div>

                    {/* Name + Description */}
                    <h3 className="font-bold text-sm text-[--text-primary] mb-1 tracking-tight">
                      {agent.name}
                    </h3>
                    <p className="text-[11px] text-[--text-muted] leading-relaxed line-clamp-2 mb-3 min-h-[2.5em]">
                      {agent.description}
                    </p>

                    {/* Model + Runs */}
                    <div className="flex items-center gap-3 text-[10px] text-[--text-muted]">
                      <div className="flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-[--accent-primary]" />
                        <span className="font-medium text-[--text-secondary]">{agent.model}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Play className="w-3 h-3 text-[--text-disabled]" />
                        <span>{agent.runs.toLocaleString()} runs</span>
                      </div>
                    </div>

                    <Separator className="my-3 bg-[--border-primary]" />

                    {/* Footer: Last active + Tools */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[--text-disabled]" />
                        <span className="text-[9px] text-[--text-muted]">
                          {agent.lastRun !== "Never" ? `Active ${new Date(agent.lastRun).toLocaleDateString()}` : "Never used"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {agent.tools.slice(0, 2).map((tool, i) => {
                          const ToolIcon = toolIcons[tool] || Wrench;
                          return (
                            <div
                              key={tool}
                              className="w-5 h-5 rounded bg-[--bg-tertiary] border border-[--border-primary] flex items-center justify-center"
                              title={tool}
                            >
                              <ToolIcon className="w-2.5 h-2.5 text-[--text-disabled]" />
                            </div>
                          );
                        })}
                        {agent.tools.length > 2 && (
                          <div className="text-[9px] text-[--text-disabled] font-medium ml-0.5">
                            +{agent.tools.length - 2}
                          </div>
                        )}
                        {agent.tools.length === 0 && (
                          <span className="text-[9px] text-[--text-disabled] italic">
                            No tools
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Agent Detail Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className="max-w-2xl agentos-glass-elevated border-[--border-primary] rounded-2xl shadow-2xl p-6">
          {selectedAgent && (
            <>
              {(() => {
                const AgentIcon = agentIcons[selectedAgent.id as keyof typeof agentIcons] ?? Bot;
                return (
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
                        <AgentIcon className="w-6 h-6 text-[--accent-primary]" />
                      </div>
                      <div>
                        <DialogTitle className="text-lg font-bold text-[--text-primary]">
                          {selectedAgent.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-[--text-muted] mt-0.5">
                          {selectedAgent.description}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                );
              })()}

              <div className="grid grid-cols-2 gap-6 py-4 border-t border-b border-[--border-primary] my-2">
                <div className="space-y-4">
                  <div>
                    <Label className="text-[9px] font-bold text-[--text-muted] uppercase tracking-wider">
                      Model Architecture
                    </Label>
                    <p className="font-semibold text-sm text-[--text-primary] flex items-center gap-2 mt-1">
                      <Cpu className="w-4 h-4 text-[--accent-primary]" /> {selectedAgent.model}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[9px] font-bold text-[--text-muted] uppercase tracking-wider">
                      Operational Status
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedAgent.status === "active" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[--text-disabled]" />
                      )}
                      <span className="font-semibold text-sm text-[--text-primary] capitalize">
                        {selectedAgent.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[9px] font-bold text-[--text-muted] uppercase tracking-wider">
                      Context Memory Scope
                    </Label>
                    <p className="font-semibold text-sm text-[--text-primary] mt-1 capitalize flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-[--accent-primary]" />
                      {selectedAgent.memory}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-[9px] font-bold text-[--text-muted] uppercase tracking-wider">
                      Total Execution Runs
                    </Label>
                    <p className="font-semibold text-sm text-[--text-primary] mt-1">
                      {selectedAgent.runs.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[9px] font-bold text-[--text-muted] uppercase tracking-wider">
                      Last Action Timestamp
                    </Label>
                    <p className="font-semibold text-sm text-[--text-primary] mt-1">
                      {selectedAgent.lastRun}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[9px] font-bold text-[--text-muted] uppercase tracking-wider">
                      Deployment Mode
                    </Label>
                    <div className="mt-1.5">
                      <Badge
                        variant="outline"
                        className="border-[--border-secondary] bg-[--accent-primary]/10 text-[--accent-primary] capitalize font-medium rounded text-[10px]"
                      >
                        {selectedAgent.type}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-[--text-secondary] mb-2 block flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 text-[--accent-primary]" />
                  Allowed Execution Tools
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.tools.map((tool) => {
                    const ToolIcon = toolIcons[tool] || Wrench;
                    return (
                      <Badge
                        key={tool}
                        variant="outline"
                        className="gap-1.5 bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary] font-medium rounded text-[10px] py-1"
                      >
                        <ToolIcon className="w-3 h-3 text-[--text-muted]" /> {tool}
                      </Badge>
                    );
                  })}
                  {selectedAgent.tools.length === 0 && (
                    <p className="text-xs text-[--text-disabled] italic">
                      No tools configured for this agent.
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 mt-4">
                {selectedAgent.type === "custom" && (
                  <Button
                    variant="outline"
                    className="gap-2 border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-tertiary] hover:text-[--text-primary] rounded-lg"
                    onClick={() => handleOpenEdit(selectedAgent)}
                  >
                    <Edit3 className="w-4 h-4" /> Edit
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="gap-2 border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-tertiary] hover:text-[--text-primary] rounded-lg"
                  onClick={() => handleDuplicateAgent(selectedAgent)}
                >
                  <Copy className="w-4 h-4" /> Duplicate
                </Button>
                {selectedAgent.type === "custom" && (
                  <Button
                    variant="outline"
                    className="gap-2 border-[--border-primary] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg"
                    onClick={() => handleDeleteAgent(selectedAgent.id)}
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                )}
                <Button
                  className="gap-2 bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] shadow-sm shadow-[--glow-primary]/30 rounded-lg"
                  onClick={() => {
                    toast.success(`Launching agent '${selectedAgent.name}' inside workspace...`);
                    setSelectedAgent(null);
                    window.location.href = `/workspace?agent=${selectedAgent.id}`;
                  }}
                >
                  <Play className="w-4 h-4" /> Run Agent
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl agentos-glass-elevated border-[--border-primary] rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[--text-primary] flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[--accent-primary]" />
              Edit Agent Configuration
            </DialogTitle>
            <DialogDescription className="text-xs text-[--text-muted]">
              Modify parameter settings for custom specialist agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[--text-secondary] text-xs font-medium">Name</Label>
              <Input
                className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] placeholder:text-[--text-disabled] focus-visible:ring-[--accent-primary]/30 rounded-lg"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[--text-secondary] text-xs font-medium">Description</Label>
              <Input
                className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] placeholder:text-[--text-disabled] focus-visible:ring-[--accent-primary]/30 rounded-lg"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-[--accent-primary]" />
                LLM Core Model
              </Label>
              <div className="grid grid-cols-3 gap-2">                  {availableModels.map((model) => {
                  const isSelected = editModel === model.id;
                  return (
                    <Button
                      key={model.id}
                      variant="outline"
                      className={cn(
                        "justify-start text-xs border-[--border-primary] rounded-lg h-auto py-2",
                        isSelected
                          ? "bg-[--accent-primary]/10 text-[--accent-primary] border-[--border-secondary] font-semibold"
                          : "bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-elevated] hover:text-[--text-primary]"
                      )}
                      onClick={() => setEditModel(model.id)}
                    >
                      <Cpu className="w-3.5 h-3.5 mr-1.5 shrink-0" /> {model.name}
                    </Button>
                  );
                })}
                {availableModels.length === 0 && (
                  <p className="text-xs text-[--text-disabled] italic col-span-3 text-center py-2">
                    No active models found. Configure a provider in Settings first.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1.5">
                <Wrench className="w-3 h-3 text-[--accent-primary]" />
                Allowed Tools
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TOOLS.map((tool) => {
                  const ToolIcon = toolIcons[tool] || Wrench;
                  const isSelected = editTools.includes(tool);
                  return (
                    <Badge
                      key={tool}
                      variant="outline"
                      className={cn(
                        "cursor-pointer px-2 py-1 rounded-lg text-[11px] transition-all flex items-center gap-1",
                        isSelected
                          ? "bg-[--accent-primary]/10 text-[--accent-primary] border-[--border-secondary]"
                          : "bg-[--bg-tertiary] text-[--text-disabled] border-[--border-primary] hover:border-[--border-hover] hover:text-[--text-secondary]"
                      )}
                      onClick={() => toggleTool(tool, true)}
                    >
                      <ToolIcon className="w-3 h-3" /> {tool}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1.5">
                <HardDrive className="w-3 h-3 text-[--accent-primary]" />
                Memory Scope
              </Label>
              <div className="flex gap-2">
                {(["project", "global"] as const).map((scope) => {
                  const isSelected = editMemory === scope;
                  return (
                    <Button
                      key={scope}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "text-xs px-3 border-[--border-primary] rounded-lg",
                        isSelected
                          ? "bg-[--accent-primary]/10 text-[--accent-primary] border-[--border-secondary] font-semibold"
                          : "bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-elevated]"
                      )}
                      onClick={() => setEditMemory(scope)}
                    >
                      <Layers className="w-3 h-3 mr-1" /> {scope} scope
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-[--border-primary] text-[--text-secondary] hover:bg-[--bg-tertiary] hover:text-[--text-primary] rounded-lg"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] shadow-sm shadow-[--glow-primary]/30 rounded-lg"
              onClick={handleUpdateAgent}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
