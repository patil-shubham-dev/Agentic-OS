"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Pause,
  Trash2,
  Wrench,
  Brain,
  Code2,
  Palette,
  BookOpen,
  Rocket,
  BarChart3,
  Sparkles,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, sendJson } from "@/lib/client-api";
import type { ProductAgent } from "@/lib/product-blueprint";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";

const agentIcons = {
  research: Brain,
  coding: Code2,
  design: Palette,
  qa: Bot,
} as const;

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

const AVAILABLE_MODELS = [
  { id: "gpt-5", name: "GPT-5" },
  { id: "claude-opus-4.1", name: "Claude Opus" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "llama-3.3-70b", name: "Llama 3.3" },
  { id: "deepseek", name: "DeepSeek" },
];

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<ProductAgent | null>(null);
  const [agents, setAgents] = useState<ProductAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Create Agent State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newModel, setNewModel] = useState("gpt-5");
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
          color: String((agent.config as { color?: string } | undefined)?.color ?? "bg-amber-100 text-amber-700"),
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
          color: "bg-orange-100 text-orange-700",
          source: "agentos",
        },
      });

      toast.success("Agent created successfully!");
      setCreateDialogOpen(false);
      // Reset state
      setNewName("");
      setNewDescription("");
      setNewModel("gpt-5");
      setNewTools(["terminal", "read_file"]);
      loadAgents();
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-900">Agents</h1>
          <p className="text-sm text-amber-600/70">Configure and execute custom AI agents for your workflows</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="w-4 h-4" /> New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-white border border-amber-200 rounded-2xl shadow-xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-amber-900">Create New Agent</DialogTitle>
              <DialogDescription className="text-amber-600/70">Configure a specialized AI agent in the local workspace.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-amber-800 font-medium">Name</Label>
                <Input
                  className="bg-amber-50/30 border-amber-200 text-amber-900"
                  placeholder="e.g., Pull Request reviewer"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-amber-800 font-medium">Description</Label>
                <Input
                  className="bg-amber-50/30 border-amber-200 text-amber-900"
                  placeholder="What is this specialist's role?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-amber-800 font-medium">LLM Core Model</Label>
                <div className="grid grid-cols-3 gap-2">
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = newModel === model.id;
                    return (
                      <Button
                        key={model.id}
                        variant="outline"
                        className={cn(
                          "justify-start text-xs border-amber-200",
                          isSelected
                            ? "bg-amber-100 text-amber-900 border-amber-500 font-semibold"
                            : "hover:bg-amber-50 text-amber-700"
                        )}
                        onClick={() => setNewModel(model.id)}
                      >
                        <Cpu className="w-3.5 h-3.5 mr-1.5" /> {model.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-amber-800 font-medium">Allowed Tools</Label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TOOLS.map((tool) => {
                    const isSelected = newTools.includes(tool);
                    return (
                      <Badge
                        key={tool}
                        variant="outline"
                        className={cn(
                          "cursor-pointer px-2 py-0.5 rounded border border-amber-200 font-medium text-[11px]",
                          isSelected
                            ? "bg-amber-100 text-amber-900 border-amber-400"
                            : "bg-white text-amber-600/70 hover:bg-amber-50"
                        )}
                        onClick={() => toggleTool(tool)}
                      >
                        <Wrench className="w-3 h-3 mr-1 inline" /> {tool}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-amber-800 font-medium">Memory Scope</Label>
                <div className="flex gap-2">
                  {(["project", "global"] as const).map((scope) => {
                    const isSelected = newMemory === scope;
                    return (
                      <Button
                        key={scope}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "text-xs px-3 border-amber-200",
                          isSelected
                            ? "bg-amber-100 text-amber-900 border-amber-500 font-semibold"
                            : "text-amber-700 hover:bg-amber-50"
                        )}
                        onClick={() => setNewMemory(scope)}
                      >
                        {scope} scope
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-amber-600 text-white hover:bg-amber-700" onClick={handleCreateAgent}>
                Create Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600/60" />
          <Input
            placeholder="Search agents..."
            className="pl-9 bg-white border-amber-200 text-amber-950 focus-visible:ring-amber-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="bg-amber-100/50 border border-amber-200/50 p-1 rounded-xl">
            <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-lg text-amber-700/80">All</TabsTrigger>
            <TabsTrigger value="built-in" className="data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-lg text-amber-700/80">Built-in</TabsTrigger>
            <TabsTrigger value="custom" className="data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-lg text-amber-700/80">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Agents Grid */}
      {loading && <p className="text-sm text-amber-700">Loading agents...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && agents.length === 0 && (
        <EmptyState
          title="No agents created yet."
          description="Create your first custom specialist agent to get started."
          icon={Bot}
          action={
            <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4" /> New Agent
            </Button>
          }
        />
      )}
      {!loading && agents.length > 0 && filteredAgents.length === 0 && (
        <p className="text-sm text-amber-600/70 italic">No agents match your filters.</p>
      )}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredAgents.map((agent) => {
          const AgentIcon = agentIcons[agent.id as keyof typeof agentIcons] ?? Bot;
          return (
            <motion.div key={agent.id} variants={item}>
              <Card
                className="agentos-card agentos-border-glow border-none group hover:shadow-md transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-amber-500"
                onClick={() => setSelectedAgent(agent)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-700")}>
                      <AgentIcon className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          agent.status === "active" && "bg-emerald-500 animate-pulse",
                          agent.status === "idle" && "bg-amber-400",
                          agent.status === "error" && "bg-red-500"
                        )}
                      />
                      <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700 capitalize font-medium">
                        {agent.type}
                      </Badge>
                    </div>
                  </div>

                  <h3 className="font-semibold text-amber-900 mb-1">{agent.name}</h3>
                  <p className="text-xs text-amber-600/80 line-clamp-2 mb-4 h-8">{agent.description}</p>

                  <div className="flex items-center gap-4 text-xs text-amber-700/70">
                    <div className="flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-amber-600" />
                      <span>{agent.model}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Play className="w-3.5 h-3.5 text-amber-600" />
                      <span>{agent.runs.toLocaleString()} runs</span>
                    </div>
                  </div>

                  <Separator className="my-3 border-amber-200/50" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[10px] text-amber-600/60 font-medium">Last active {agent.lastRun !== "Never" ? "recently" : "never"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {agent.tools.slice(0, 2).map((tool) => (
                        <Badge key={tool} variant="secondary" className="text-[9px] bg-amber-100 text-amber-800 rounded font-medium">
                          {tool}
                        </Badge>
                      ))}
                      {agent.tools.length > 2 && (
                        <Badge variant="secondary" className="text-[9px] bg-amber-200 text-amber-900 rounded font-medium">
                          +{agent.tools.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Agent Detail Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className="max-w-2xl bg-white border border-amber-200 rounded-2xl shadow-xl p-6">
          {selectedAgent && (
            <>
              {(() => {
                const AgentIcon = agentIcons[selectedAgent.id as keyof typeof agentIcons] ?? Bot;
                return (
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-amber-100 text-amber-700")}>
                        <AgentIcon className="w-6 h-6 text-amber-700" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-bold text-amber-900">{selectedAgent.name}</DialogTitle>
                        <DialogDescription className="text-amber-600/70">{selectedAgent.description}</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                );
              })()}

              <div className="grid grid-cols-2 gap-6 py-4 border-t border-b border-amber-200/50 my-2">
                <div className="space-y-4">
                  <div>
                    <Label className="text-amber-600/70 text-xs">Model Architecture</Label>
                    <p className="font-semibold text-amber-900 flex items-center gap-2 mt-1">
                      <Cpu className="w-4 h-4 text-amber-600" /> {selectedAgent.model}
                    </p>
                  </div>
                  <div>
                    <Label className="text-amber-600/70 text-xs">Operational Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedAgent.status === "active" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-600/60" />
                      )}
                      <span className="font-semibold text-amber-900 capitalize">{selectedAgent.status}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-600/70 text-xs">Context Memory Scope</Label>
                    <p className="font-semibold text-amber-900 mt-1 capitalize">{selectedAgent.memory}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-amber-600/70 text-xs">Total Execution Runs</Label>
                    <p className="font-semibold text-amber-900 mt-1">{selectedAgent.runs.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-amber-600/70 text-xs">Last Action Timestamp</Label>
                    <p className="font-semibold text-amber-900 mt-1 text-sm">{selectedAgent.lastRun}</p>
                  </div>
                  <div>
                    <Label className="text-amber-600/70 text-xs">Deployment Mode</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 capitalize font-medium">
                        {selectedAgent.type}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-amber-800 mb-2 block font-medium">Allowed Execution Tools</Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.tools.map((tool) => (
                    <Badge key={tool} variant="secondary" className="gap-1 bg-amber-100 text-amber-900 border-none font-medium">
                      <Wrench className="w-3 h-3 text-amber-600" /> {tool}
                    </Badge>
                  ))}
                  {selectedAgent.tools.length === 0 && (
                    <p className="text-xs text-amber-600/60 italic">No tools configured for this agent.</p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 mt-4">
                {selectedAgent.type === "custom" && (
                  <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => handleOpenEdit(selectedAgent)}>
                    <Edit3 className="w-4 h-4" /> Edit
                  </Button>
                )}
                <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => handleDuplicateAgent(selectedAgent)}>
                  <Copy className="w-4 h-4" /> Duplicate
                </Button>
                {selectedAgent.type === "custom" && (
                  <Button variant="outline" className="gap-2 border-amber-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleDeleteAgent(selectedAgent.id)}>
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                )}
                <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
                  toast.success(`Launching agent '${selectedAgent.name}' inside workspace...`);
                  setSelectedAgent(null);
                  window.location.href = `/workspace?agent=${selectedAgent.id}`;
                }}>
                  <Play className="w-4 h-4" /> Run Agent
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl bg-white border border-amber-200 rounded-2xl shadow-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-amber-900">Edit Agent Configuration</DialogTitle>
            <DialogDescription className="text-amber-600/70">Modify parameter settings for custom specialist agent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-amber-800 font-medium">Name</Label>
              <Input
                className="bg-amber-50/30 border-amber-200 text-amber-900"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-amber-800 font-medium">Description</Label>
              <Input
                className="bg-amber-50/30 border-amber-200 text-amber-900"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-amber-800 font-medium">LLM Core Model</Label>
              <div className="grid grid-cols-3 gap-2">
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = editModel === model.id;
                  return (
                    <Button
                      key={model.id}
                      variant="outline"
                      className={cn(
                        "justify-start text-xs border-amber-200",
                        isSelected
                          ? "bg-amber-100 text-amber-900 border-amber-500 font-semibold"
                          : "hover:bg-amber-50 text-amber-700"
                      )}
                      onClick={() => setEditModel(model.id)}
                    >
                      <Cpu className="w-3.5 h-3.5 mr-1.5" /> {model.name}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-amber-800 font-medium">Allowed Tools</Label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TOOLS.map((tool) => {
                  const isSelected = editTools.includes(tool);
                  return (
                    <Badge
                      key={tool}
                      variant="outline"
                      className={cn(
                        "cursor-pointer px-2 py-0.5 rounded border border-amber-200 font-medium text-[11px]",
                        isSelected
                          ? "bg-amber-100 text-amber-900 border-amber-400"
                          : "bg-white text-amber-600/70 hover:bg-amber-50"
                      )}
                      onClick={() => toggleTool(tool, true)}
                    >
                      <Wrench className="w-3 h-3 mr-1 inline" /> {tool}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-amber-800 font-medium">Memory Scope</Label>
              <div className="flex gap-2">
                {(["project", "global"] as const).map((scope) => {
                  const isSelected = editMemory === scope;
                  return (
                    <Button
                      key={scope}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "text-xs px-3 border-amber-200",
                        isSelected
                          ? "bg-amber-100 text-amber-900 border-amber-500 font-semibold"
                          : "text-amber-700 hover:bg-amber-50"
                      )}
                      onClick={() => setEditMemory(scope)}
                    >
                      {scope} scope
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-amber-600 text-white hover:bg-amber-700" onClick={handleUpdateAgent}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
