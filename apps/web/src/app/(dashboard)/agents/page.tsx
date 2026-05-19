"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
  Settings,
  Copy,
  Trash2,
  Wrench,
  Brain,
  Code2,
  Palette,
  FileSearch,
  Bug,
  BookOpen,
  Rocket,
  BarChart3,
  Sparkles,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Edit3,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/client-api";
import type { ProductAgent } from "@/lib/product-blueprint";

const agentIcons = {
  research: Brain,
  coding: Code2,
  design: Palette,
  qa: Bug,
  docs: BookOpen,
  deployment: Rocket,
  analytics: BarChart3,
} as const;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<ProductAgent | null>(null);
  const [agents, setAgents] = useState<ProductAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJson<{ agents: Array<Record<string, unknown>> }>("/api/agents")
      .then((data) => {
        if (!active) return;
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
          color: String((agent.config as { color?: string } | undefined)?.color ?? "bg-slate-500/10 text-slate-300"),
          upstream: ((agent.config as { source?: ProductAgent["upstream"] } | undefined)?.source ?? "agentos"),
        }));
        setAgents(mapped);
      })
      .catch((fetchError) => {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load agents");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground">Manage and configure your AI specialist agents</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>Configure a custom AI agent for your specific needs</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="e.g., Security Review Agent" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="What does this agent do?" />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["Claude Opus", "GPT-4o", "Gemini Pro", "Llama 3.3", "DeepSeek", "Groq"].map((model) => (
                    <Button key={model} variant="outline" className="justify-start">
                      <Cpu className="w-4 h-4 mr-2" /> {model}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allowed Tools</Label>
                <div className="flex flex-wrap gap-2">
                  {["web_search", "terminal", "read_file", "write_file", "execute_code", "browser_navigate", "memory"].map((tool) => (
                    <Badge key={tool} variant="outline" className="cursor-pointer hover:bg-primary/10">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Create Agent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs defaultValue="all" className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="built-in">Built-in</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Agents Grid */}
      {loading && <p className="text-sm text-muted-foreground">Loading agents...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
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
            <Card className="group hover:shadow-md transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-primary"
              onClick={() => setSelectedAgent(agent)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", agent.color)}>
                    <AgentIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        agent.status === "active" && "bg-green-500 animate-pulse",
                        agent.status === "idle" && "bg-muted-foreground",
                        agent.status === "error" && "bg-destructive"
                      )}
                    />
                    <Badge variant="outline" className="text-[10px]">
                      {agent.type}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-semibold mb-1">{agent.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{agent.description}</p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    <span>{agent.model}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    <span>{agent.runs.toLocaleString()} runs</span>
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{agent.lastRun}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {agent.tools.slice(0, 3).map((tool) => (
                      <Badge key={tool} variant="secondary" className="text-[10px]">
                        {tool}
                      </Badge>
                    ))}
                    {agent.tools.length > 3 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{agent.tools.length - 3}
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
        <DialogContent className="max-w-3xl">
          {selectedAgent && (
            <>
              {(() => {
                const AgentIcon = agentIcons[selectedAgent.id as keyof typeof agentIcons] ?? Bot;
                return (
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", selectedAgent.color)}>
                    <AgentIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">{selectedAgent.name}</DialogTitle>
                    <DialogDescription>{selectedAgent.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
                );
              })()}

              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Model</Label>
                    <p className="font-medium flex items-center gap-2 mt-1">
                      <Cpu className="w-4 h-4" /> {selectedAgent.model}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedAgent.status === "active" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-medium capitalize">{selectedAgent.status}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Memory Scope</Label>
                    <p className="font-medium mt-1 capitalize">{selectedAgent.memory}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Total Runs</Label>
                    <p className="font-medium mt-1">{selectedAgent.runs.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Run</Label>
                    <p className="font-medium mt-1">{selectedAgent.lastRun}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <Badge variant="outline" className="mt-1">
                      {selectedAgent.type}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block">Allowed Tools</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.tools.map((tool) => (
                    <Badge key={tool} variant="secondary" className="gap-1">
                      <Wrench className="w-3 h-3" /> {tool}
                    </Badge>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" className="gap-2">
                  <Edit3 className="w-4 h-4" /> Edit
                </Button>
                <Button variant="outline" className="gap-2">
                  <Copy className="w-4 h-4" /> Duplicate
                </Button>
                <Button variant="outline" className="gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
                <Button className="gap-2">
                  <Play className="w-4 h-4" /> Run Agent
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
