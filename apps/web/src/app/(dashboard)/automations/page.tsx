"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  Calendar,
  Bot,
  ArrowRight,
  Settings,
  Bell,
  Mail,
  Slack,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/client-api";
import type { ProductAutomation } from "@/lib/product-blueprint";

const initialNodes: Node[] = [
  { id: "trigger", type: "input", position: { x: 250, y: 0 }, data: { label: "Trigger: Schedule" } },
  { id: "agent1", position: { x: 250, y: 100 }, data: { label: "Research Agent" } },
  { id: "tool1", position: { x: 250, y: 200 }, data: { label: "Write File" } },
  { id: "approval", position: { x: 250, y: 300 }, data: { label: "Human Approval" } },
  { id: "notify", position: { x: 250, y: 400 }, data: { label: "Send Notification" } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "trigger", target: "agent1" },
  { id: "e2", source: "agent1", target: "tool1" },
  { id: "e3", source: "tool1", target: "approval" },
  { id: "e4", source: "approval", target: "notify" },
];


const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function AutomationsPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedAutomation, setSelectedAutomation] = useState<ProductAutomation | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "builder">("list");
  const [automations, setAutomations] = useState<ProductAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onConnect = (params: Connection) => setEdges((eds) => addEdge(params, eds));

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-muted-foreground">Build trigger-based workflows with AI agents</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="builder">Builder</TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> New Automation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Automation</DialogTitle>
                <DialogDescription>Build a workflow that runs automatically</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="e.g., Daily Report Generation" />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="schedule">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Schedule (Cron)
                        </div>
                      </SelectItem>
                      <SelectItem value="webhook">
                        <div className="flex items-center gap-2">
                          <Webhook className="w-4 h-4" /> Webhook
                        </div>
                      </SelectItem>
                      <SelectItem value="manual">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" /> Manual
                        </div>
                      </SelectItem>
                      <SelectItem value="file">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" /> File Change
                        </div>
                      </SelectItem>
                      <SelectItem value="git">
                        <div className="flex items-center gap-2">
                          <GitCommit className="w-4 h-4" /> Git Commit
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Agent</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="research">Research Agent</SelectItem>
                      <SelectItem value="coding">Coding Agent</SelectItem>
                      <SelectItem value="design">Design Agent</SelectItem>
                      <SelectItem value="qa">QA Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create Automation</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {viewMode === "list" ? (
        <>
          {loading && <p className="text-sm text-muted-foreground">Loading automations...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Active", value: String(automations.filter((item) => item.status === "active").length), icon: CheckCircle2, color: "text-green-500" },
              { label: "Paused", value: String(automations.filter((item) => item.status === "paused").length), icon: Pause, color: "text-yellow-500" },
              { label: "Error", value: String(automations.filter((item) => item.status === "error").length), icon: XCircle, color: "text-destructive" },
              { label: "Total Runs", value: String(automations.reduce((sum, item) => sum + item.runs, 0)), icon: Zap, color: "text-primary" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Automations List */}
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
            {automations.map((auto) => (
              <motion.div key={auto.id} variants={item}>
                <Card
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setSelectedAutomation(auto)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            auto.status === "active" && "bg-green-500/10",
                            auto.status === "paused" && "bg-yellow-500/10",
                            auto.status === "error" && "bg-destructive/10",
                            auto.status === "draft" && "bg-muted"
                          )}
                        >
                          {auto.trigger.type === "schedule" && <Clock className={cn("w-5 h-5", auto.status === "active" ? "text-green-500" : auto.status === "error" ? "text-destructive" : "text-yellow-500")} />}
                          {auto.trigger.type === "webhook" && <Webhook className={cn("w-5 h-5", auto.status === "active" ? "text-green-500" : auto.status === "error" ? "text-destructive" : "text-yellow-500")} />}
                          {auto.trigger.type === "file_change" && <FileText className={cn("w-5 h-5", auto.status === "active" ? "text-green-500" : auto.status === "error" ? "text-destructive" : "text-yellow-500")} />}
                          {auto.trigger.type === "git_commit" && <GitCommit className={cn("w-5 h-5", auto.status === "active" ? "text-green-500" : auto.status === "error" ? "text-destructive" : "text-yellow-500")} />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{auto.name}</h3>
                          <p className="text-sm text-muted-foreground">{auto.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-[10px]">
                              {auto.trigger.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {auto.steps.length} steps
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {auto.runs} runs
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {auto.successRate}% success
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          className={cn(
                            auto.status === "active" && "bg-green-500/10 text-green-500 hover:bg-green-500/20",
                            auto.status === "paused" && "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
                            auto.status === "error" && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                            auto.status === "draft" && "bg-muted text-muted-foreground"
                          )}
                        >
                          {auto.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">Last: {auto.lastRun}</p>
                        <p className="text-xs text-muted-foreground">Next: {auto.nextRun}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </>
      ) : (
        /* Workflow Builder */
        <Card className="h-[calc(100vh-16rem)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workflow Builder</CardTitle>
                <CardDescription>Drag and drop nodes to build automations</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Bot className="w-4 h-4" /> Add Agent
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Zap className="w-4 h-4" /> Add Tool
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Bell className="w-4 h-4" /> Add Notification
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-5rem)]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedAutomation} onOpenChange={() => setSelectedAutomation(null)}>
        <DialogContent className="max-w-3xl">
          {selectedAutomation && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>{selectedAutomation.name}</DialogTitle>
                  <Badge
                    className={cn(
                      selectedAutomation.status === "active" && "bg-green-500/10 text-green-500",
                      selectedAutomation.status === "paused" && "bg-yellow-500/10 text-yellow-500",
                      selectedAutomation.status === "error" && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {selectedAutomation.status}
                  </Badge>
                </div>
                <DialogDescription>{selectedAutomation.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Trigger</h4>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    {selectedAutomation.trigger.type === "schedule" && <Clock className="w-4 h-4" />}
                    {selectedAutomation.trigger.type === "webhook" && <Webhook className="w-4 h-4" />}
                    {selectedAutomation.trigger.type === "file_change" && <FileText className="w-4 h-4" />}
                    {selectedAutomation.trigger.type === "git_commit" && <GitCommit className="w-4 h-4" />}
                    <span className="text-sm capitalize">{selectedAutomation.trigger.type}</span>
                    <code className="ml-auto text-xs bg-muted px-2 py-1 rounded">
                      {JSON.stringify(selectedAutomation.trigger.config)}
                    </code>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Steps</h4>
                  <div className="space-y-2">
                    {selectedAutomation.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {i + 1}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          {step.type === "agent" && <Bot className="w-4 h-4 text-primary" />}
                          {step.type === "tool" && <Zap className="w-4 h-4 text-primary" />}
                          {step.type === "approval" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                          {step.type === "notification" && <Bell className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{step.name}</p>
                          <p className="text-xs text-muted-foreground">{step.type}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{selectedAutomation.runs}</p>
                    <p className="text-xs text-muted-foreground">Total Runs</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{selectedAutomation.successRate}%</p>
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{selectedAutomation.steps.length}</p>
                    <p className="text-xs text-muted-foreground">Steps</p>
                  </div>
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
                {selectedAutomation.status === "active" ? (
                  <Button variant="outline" className="gap-2">
                    <Pause className="w-4 h-4" /> Pause
                  </Button>
                ) : (
                  <Button className="gap-2">
                    <Play className="w-4 h-4" /> Activate
                  </Button>
                )}
                <Button className="gap-2">
                  <Play className="w-4 h-4" /> Run Now
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
