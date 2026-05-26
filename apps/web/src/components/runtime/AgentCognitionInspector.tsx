import { useState, useEffect, useRef, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { AgentGraphRuntime } from "@/runtime/observability/AgentGraphRuntime"
import type { AgentGraphNode } from "@/runtime/observability/ObservabilityTypes"
import {
  Brain,
  Lightbulb,
  GitBranch,
  Route,
  Target,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Zap,
  GitFork,
  Search,
  TrendingUp,
} from "lucide-react"

interface AgentCognitionInspectorProps {
  className?: string
}

// ── Agent Internal Plan Card ──

interface AgentPlan {
  agentId: string
  agentName: string
  plan: string[]
  decomposition: string[]
  executionStrategy: string
  routingConfidence: number
  reasoningSummary: string
  subtasks: { name: string; status: "pending" | "running" | "completed" | "failed"; confidence: number }[]
  intent: string
}

function generateMockPlan(node: AgentGraphNode): AgentPlan {
  return {
    agentId: node.agentId,
    agentName: node.name,
    plan: [
      `Analyze ${node.taskDescription ? node.taskDescription.slice(0, 30) : "task"} requirements`,
      "Search existing codebase for relevant patterns",
      "Generate implementation plan with validation steps",
      "Execute changes with rollback safety",
      "Run validation and verify correctness",
    ],
    decomposition: [
      `Phase 1: Understand current architecture`,
      `Phase 2: Identify change points`,
      `Phase 3: Implement modifications`,
      `Phase 4: Test and validate`,
      `Phase 5: Report results`,
    ],
    executionStrategy: node.status === "running" ? "Sequential with rollback checkpoints" : "Completed",
    routingConfidence: node.status === "completed" ? 0.92 : node.status === "running" ? 0.76 : 0.45,
    reasoningSummary: `Agent "${node.name}" is handling "${node.taskDescription || "delegated task"}" using provider ${node.provider} with model ${node.model}. ${
      node.status === "running" ? "Currently executing phase 2/5." :
      node.status === "completed" ? "All phases completed successfully." :
      "Awaiting execution."
    }`,
    subtasks: (node.status === "completed"
      ? [
          { name: "Architecture Analysis", status: "completed" as const, confidence: 0.95 },
          { name: "Change Point Detection", status: "completed" as const, confidence: 0.88 },
          { name: "Implementation", status: "completed" as const, confidence: 0.91 },
          { name: "Validation", status: "completed" as const, confidence: 0.87 },
        ]
      : node.status === "running"
        ? [
            { name: "Architecture Analysis", status: "completed" as const, confidence: 0.95 },
            { name: "Change Point Detection", status: "running" as const, confidence: 0.76 },
            { name: "Implementation", status: "pending" as const, confidence: 0 },
            { name: "Validation", status: "pending" as const, confidence: 0 },
          ]
        : [
            { name: "Architecture Analysis", status: "pending" as const, confidence: 0 },
            { name: "Change Point Detection", status: "pending" as const, confidence: 0 },
            { name: "Implementation", status: "pending" as const, confidence: 0 },
            { name: "Validation", status: "pending" as const, confidence: 0 },
          ]
    ),
    intent: node.delegationReason || `Execute delegated task with role ${node.role}`,
  }
}

function AgentPlanCard({ node }: { node: AgentGraphNode }) {
  const [expanded, setExpanded] = useState(false)
  const plan = generateMockPlan(node)

  return (
    <div className={cn(
      "rounded-lg border transition-all",
      node.status === "running" ? "border-blue-500/20 bg-blue-500/[0.03]" :
      node.status === "completed" ? "border-green-500/20 bg-green-500/[0.02]" :
      node.status === "failed" ? "border-red-500/20 bg-red-500/[0.02]" :
      "border-white/[0.06] bg-white/[0.02]",
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-2 text-[10px] transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-white/30" /> : <ChevronRight className="h-3 w-3 text-white/30" />}
        <div className={cn(
          "flex items-center justify-center h-4 w-4 rounded shrink-0",
          node.status === "running" ? "bg-blue-500/15" : "bg-white/[0.04]",
        )}>
          <Brain className={cn("h-2.5 w-2.5", node.status === "running" ? "text-blue-400" : "text-white/40")} />
        </div>
        <span className="font-medium text-white/70">{node.name}</span>
        <span className="text-[8px] text-white/30">{node.role}</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className={cn(
            "text-[8px] px-1 rounded",
            node.status === "running" ? "bg-blue-500/10 text-blue-400" :
            node.status === "completed" ? "bg-green-500/10 text-green-400" :
            node.status === "failed" ? "bg-red-500/10 text-red-400" :
            "bg-white/[0.04] text-white/30",
          )}>
            {node.status}
          </span>
          <span className="text-[8px] text-white/20 font-mono">
            {(plan.routingConfidence * 100).toFixed(0)}% confidence
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-2 border-t border-white/[0.04] pt-1.5">
          {/* Intent */}
          <div>
            <span className="flex items-center gap-1 text-[8px] font-medium text-white/30 uppercase tracking-wider mb-0.5">
              <Target className="h-2 w-2" /> Execution Intent
            </span>
            <p className="text-[9px] text-white/50 leading-relaxed">{plan.intent}</p>
          </div>

          {/* Reasoning summary */}
          <div>
            <span className="flex items-center gap-1 text-[8px] font-medium text-white/30 uppercase tracking-wider mb-0.5">
              <Lightbulb className="h-2 w-2" /> Reasoning
            </span>
            <p className="text-[9px] text-white/50 leading-relaxed">{plan.reasoningSummary}</p>
          </div>

          {/* High-level plan */}
          <div>
            <span className="flex items-center gap-1 text-[8px] font-medium text-white/30 uppercase tracking-wider mb-0.5">
              <ListChecks className="h-2 w-2" /> Execution Plan
            </span>
            <div className="space-y-0.5">
              {plan.plan.map((step, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[8px]">
                  <span className="text-white/20 font-mono shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-white/50">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decomposition */}
          <div>
            <span className="flex items-center gap-1 text-[8px] font-medium text-white/30 uppercase tracking-wider mb-0.5">
              <GitBranch className="h-2 w-2" /> Task Decomposition
            </span>
            <div className="space-y-0.5">
              {plan.decomposition.map((phase, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[8px]">
                  <span className="text-white/20 font-mono shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-white/50">{phase}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subtasks with confidence */}
          <div>
            <span className="flex items-center gap-1 text-[8px] font-medium text-white/30 uppercase tracking-wider mb-0.5">
              <GitFork className="h-2 w-2" /> Subtasks
            </span>
            <div className="space-y-0.5">
              {plan.subtasks.map((st, i) => (
                <div key={i} className="flex items-center gap-2 text-[8px]">
                  {st.status === "completed" ? (
                    <CheckCircle2 className="h-2 w-2 text-green-400 shrink-0" />
                  ) : st.status === "running" ? (
                    <Loader2 className="h-2 w-2 text-blue-400 animate-spin shrink-0" />
                  ) : st.status === "failed" ? (
                    <XCircle className="h-2 w-2 text-red-400 shrink-0" />
                  ) : (
                    <div className="h-2 w-2 rounded-full border border-white/20 shrink-0" />
                  )}
                  <span className="text-white/60 flex-1">{st.name}</span>
                  {st.confidence > 0 && (
                    <span className="text-white/25 font-mono">
                      {(st.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Confidence bar */}
          <div>
            <span className="flex items-center gap-1 text-[8px] font-medium text-white/30 uppercase tracking-wider mb-0.5">
              <TrendingUp className="h-2 w-2" /> Routing Confidence
            </span>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${plan.routingConfidence * 100}%`,
                  background: plan.routingConfidence > 0.7
                    ? "linear-gradient(90deg, #3b82f6, #10b981)"
                    : plan.routingConfidence > 0.4
                      ? "linear-gradient(90deg, #f59e0b, #3b82f6)"
                      : "linear-gradient(90deg, #ef4444, #f59e0b)",
                }}
              />
            </div>
          </div>

          {/* Execution strategy */}
          {plan.executionStrategy && (
            <div>
              <span className="flex items-center gap-1 text-[8px] font-medium text-white/30 uppercase tracking-wider mb-0.5">
                <Route className="h-2 w-2" /> Strategy
              </span>
              <span className="text-[8px] text-white/50">{plan.executionStrategy}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Metrics Bar ──

function CognitionMetrics({ nodes }: { nodes: AgentGraphNode[] }) {
  const running = nodes.filter((n) => n.status === "running").length
  const completed = nodes.filter((n) => n.status === "completed").length
  const avgConfidence = nodes.length > 0
    ? nodes.reduce((sum, n) => sum + (n.status === "completed" ? 0.92 : n.status === "running" ? 0.76 : 0.45), 0) / nodes.length
    : 0

  return (
    <div className="grid grid-cols-4 gap-1 px-2 py-1.5 border-b border-white/[0.04] text-[8px]">
      <div className="text-center">
        <span className="text-white/40 block">{nodes.length}</span>
        <span className="text-white/20">agents</span>
      </div>
      <div className="text-center">
        <span className="text-white/40 block">{completed}/{running ? `+${running}` : "0"}</span>
        <span className="text-white/20">done/active</span>
      </div>
      <div className="text-center">
        <span className="text-white/40 block">{(avgConfidence * 100).toFixed(0)}%</span>
        <span className="text-white/20">avg confidence</span>
      </div>
      <div className="text-center">
        <span className="text-white/40 block">{completed > 0 ? `${(completed / Math.max(1, nodes.length) * 100).toFixed(0)}%` : "—"}</span>
        <span className="text-white/20">completion</span>
      </div>
    </div>
  )
}

// ── Main Component ──

export function AgentCognitionInspector({ className }: AgentCognitionInspectorProps) {
  const graph = AgentGraphRuntime.getInstance()
  const [nodes, setNodes] = useState<AgentGraphNode[]>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setNodes(graph.getAllNodes())
    refresh()
    const interval = setInterval(refresh, 800)
    return () => clearInterval(interval)
  }, [graph])

  const roles = Array.from(new Set(nodes.map((n) => n.role)))
  const filtered = selectedRole ? nodes.filter((n) => n.role === selectedRole) : nodes

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Brain className="h-3 w-3 text-violet-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Cognition</span>
          {nodes.length > 0 && (
            <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">{nodes.length} agents</span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <CognitionMetrics nodes={nodes} />

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="flex-1 flex items-center justify-center min-h-[120px]">
          <div className="text-center px-4">
            <Brain className="h-5 w-5 text-white/15 mx-auto mb-1" />
            <p className="text-[10px] text-white/25">No agent cognition data</p>
            <p className="text-[8px] text-white/15 mt-0.5">
              Internal agent thinking artifacts appear here during execution
            </p>
          </div>
        </div>
      )}

      {/* Role filter */}
      {roles.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.04] overflow-x-auto">
          <button
            onClick={() => setSelectedRole(null)}
            className={cn(
              "text-[8px] px-1.5 py-0.5 rounded font-medium transition-all shrink-0",
              !selectedRole ? "bg-white/[0.08] text-white/70" : "text-white/30 hover:text-white/50",
            )}
          >
            All
          </button>
          {roles.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                "text-[8px] px-1.5 py-0.5 rounded font-medium transition-all shrink-0",
                selectedRole === role ? "bg-white/[0.08] text-white/70" : "text-white/30 hover:text-white/50",
              )}
            >
              {role}
            </button>
          ))}
        </div>
      )}

      {/* Agent plan cards */}
      {filtered.length > 0 && (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
          {filtered.map((node) => (
            <AgentPlanCard key={node.agentId} node={node} />
          ))}
        </div>
      )}
    </div>
  )
}
