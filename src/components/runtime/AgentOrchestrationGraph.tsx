import { useState, useEffect, useRef, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { AgentGraphRuntime } from "@/runtime/observability/AgentGraphRuntime"
import type { AgentGraphNode, DelegationEdge } from "@/runtime/observability/ObservabilityTypes"
import {
  Cpu,
  Brain,
  Network,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Clock,
  Users,
  GitBranch,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Timer,
} from "lucide-react"

interface AgentOrchestrationGraphProps {
  className?: string
  maxHeight?: string
}

// ── Agent Node Card ──

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-white/30", bg: "bg-white/[0.03]", border: "border-white/[0.06]", pulse: false },
  running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/[0.06]", border: "border-blue-500/20", pulse: true },
  completed: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/[0.06]", border: "border-green-500/20", pulse: false },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/[0.06]", border: "border-red-500/20", pulse: false },
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—"
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

interface AgentNodeCardProps {
  node: AgentGraphNode
  isSelected: boolean
  onClick: () => void
  onExpand: () => void
  isExpanded: boolean
}

const AgentNodeCard = memo(function AgentNodeCard({
  node, isSelected, onClick, onExpand, isExpanded,
}: AgentNodeCardProps) {
  const status = STATUS_CONFIG[node.status] ?? STATUS_CONFIG.pending
  const Icon = status.icon

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-2 transition-all cursor-pointer",
        status.border,
        status.bg,
        isSelected && "ring-1 ring-blue-500/40",
        node.status === "running" && "animate-glow",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className={cn(
          "flex items-center justify-center h-5 w-5 rounded shrink-0",
          node.status === "running" ? "bg-blue-500/15" : "bg-white/[0.04]",
        )}>
          <Icon className={cn("h-3 w-3", status.color, status.pulse && "animate-spin")} />
        </div>
        <span className="text-[10px] font-medium text-white/70 truncate flex-1">{node.name}</span>
        <span className={cn("text-[8px] font-medium", status.color)}>{node.status}</span>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-2 text-[8px] text-white/30">
        <span className="truncate max-w-[80px]">{node.model}</span>
        <span className="text-white/15">·</span>
        <span className="truncate max-w-[60px]">{node.provider}</span>
        {node.tokensUsed > 0 && (
          <>
            <span className="text-white/15">·</span>
            <span>{node.tokensUsed} tok</span>
          </>
        )}
      </div>

      {/* Duration */}
      {node.duration !== null && (
        <div className="flex items-center gap-1 mt-1 text-[8px] text-white/25">
          <Timer className="h-2 w-2" />
          <span>{formatDuration(node.duration)}</span>
        </div>
      )}

      {/* Task description */}
      {node.taskDescription && (
        <div className="mt-1 text-[8px] text-white/35 line-clamp-2 leading-relaxed">
          {node.taskDescription}
        </div>
      )}

      {/* Delegation reason */}
      {node.delegationReason && isExpanded && (
        <div className="mt-1 pt-1 border-t border-white/[0.04]">
          <span className="text-[7px] text-white/20 uppercase tracking-wider block mb-0.5">Why delegated</span>
          <span className="text-[8px] text-white/35">{node.delegationReason}</span>
        </div>
      )}

      {/* Stats row */}
      {isExpanded && (
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/[0.04] text-[8px] text-white/25">
          <span>{node.toolCalls} tools</span>
          <span>{node.fileEdits} edits</span>
        </div>
      )}

      {/* Expand */}
      <button
        onClick={(e) => { e.stopPropagation(); onExpand() }}
        className="flex items-center gap-0.5 mt-1 text-[7px] text-white/20 hover:text-white/40 transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-2 w-2" /> : <ChevronRight className="h-2 w-2" />}
        {isExpanded ? "Less" : "More"}
      </button>
    </div>
  )
})

// ── Delegation Edge Line ──

function DelegationEdgeLine({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-0.5">
      <div className="flex items-center gap-1 text-white/20">
        <div className="h-px w-8 bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
        <ArrowRight className="h-2.5 w-2.5" />
        <div className="h-px w-8 bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
      </div>
      {label && (
        <span className="absolute text-[7px] text-white/20 bg-[#0a0a0b] px-1">{label}</span>
      )}
    </div>
  )
}

// ── Agent Tree View ──

function renderAgentTree(
  nodes: AgentGraphNode[],
  depth: number,
  selectedId: string | null,
  expandedIds: Set<string>,
  onSelect: (id: string) => void,
  onToggle: (id: string) => void,
): React.ReactNode {
  return nodes.map((node) => {
    const isExpanded = expandedIds.has(node.agentId)
    const children = node.children ?? []

    return (
      <div key={node.agentId} className="relative">
        {/* Indent line */}
        {depth > 0 && (
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
        )}

        <div className={depth > 0 ? "ml-4" : ""}>
          <AgentNodeCard
            node={node}
            isSelected={selectedId === node.agentId}
            onClick={() => onSelect(node.agentId)}
            onExpand={() => onToggle(node.agentId)}
            isExpanded={isExpanded}
          />
        </div>

        {/* Delegation arrow */}
        {children.length > 0 && (
          <div className="ml-6 my-1">
            <DelegationEdgeLine label={node.status === "completed" ? "delegated to" : node.status === "running" ? "delegating..." : undefined} />
          </div>
        )}

        {/* Children */}
        {isExpanded && children.length > 0 && (
          <div>
            {renderAgentTree(children, depth + 1, selectedId, expandedIds, onSelect, onToggle)}
          </div>
        )}
      </div>
    )
  })
}

// ── Statistics Panel ──

function AgentStats({ nodes }: { nodes: AgentGraphNode[] }) {
  const completed = nodes.filter((n) => n.status === "completed").length
  const running = nodes.filter((n) => n.status === "running").length
  const failed = nodes.filter((n) => n.status === "failed").length
  const totalTools = nodes.reduce((a, n) => a + n.toolCalls, 0)
  const totalTokens = nodes.reduce((a, n) => a + n.tokensUsed, 0)
  const avgDuration = nodes
    .filter((n) => n.duration !== null)
    .reduce((a, n) => a + (n.duration ?? 0), 0) / Math.max(1, nodes.filter((n) => n.duration !== null).length)

  return (
    <div className="grid grid-cols-4 gap-1 px-2 py-1.5 border-b border-white/[0.04] text-[8px]">
      <div className="text-center">
        <span className="text-white/40 block">{nodes.length}</span>
        <span className="text-white/20">agents</span>
      </div>
      <div className="text-center">
        <span className="text-white/40 block">{completed}/{running ? `+${running}` : ""}{failed ? `/${failed}❌` : ""}</span>
        <span className="text-white/20">status</span>
      </div>
      <div className="text-center">
        <span className="text-white/40 block">{totalTools}</span>
        <span className="text-white/20">tools</span>
      </div>
      <div className="text-center">
        <span className="text-white/40 block">{totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k` : "—"}</span>
        <span className="text-white/20">tokens</span>
      </div>
    </div>
  )
}

// ── Role Configuration Legend ──

function RoleLegend() {
  const graph = AgentGraphRuntime.getInstance()
  const nodes = graph.getAllNodes()
  const roles = new Set(nodes.map((n) => n.role))

  if (roles.size === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-2 py-1.5 border-t border-white/[0.04]">
      {Array.from(roles).map((role) => {
        const roleNodes = nodes.filter((n) => n.role === role)
        const running = roleNodes.filter((n) => n.status === "running").length
        return (
          <div key={role} className="flex items-center gap-1 text-[8px]">
            <span className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              running > 0 ? "bg-blue-400 animate-pulse" : "bg-white/20",
            )} />
            <span className="text-white/40">{role}</span>
            <span className="text-white/20">({roleNodes.length})</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ──

export function AgentOrchestrationGraph({ className, maxHeight }: AgentOrchestrationGraphProps) {
  const graph = AgentGraphRuntime.getInstance()

  const [nodes, setNodes] = useState<AgentGraphNode[]>(graph.getAllNodes())
  const [delegations, setDelegations] = useState<DelegationEdge[]>(graph.getDelegations())
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree")
  const [showLegend, setShowLegend] = useState(true)

  // Refresh from store
  useEffect(() => {
    const refresh = () => {
      setNodes(graph.getAllNodes())
      setDelegations(graph.getDelegations())
    }

    refresh()
    const interval = setInterval(refresh, 800)
    return () => clearInterval(interval)
  }, [graph])

  // Auto-expand running nodes
  useEffect(() => {
    const running = nodes.filter((n) => n.status === "running")
    if (running.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        for (const r of running) {
          // Expand ancestors
          let current = r
          while (current) {
            next.add(current.agentId)
            current = nodes.find((n) => n.agentId === current.parentId) as AgentGraphNode
          }
        }
        return next
      })
    }
  }, [nodes])

  const handleSelect = useCallback((agentId: string) => {
    setSelectedAgentId(agentId === selectedAgentId ? null : agentId)
  }, [selectedAgentId])

  const handleToggle = useCallback((agentId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else {
        next.add(agentId)
      }
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    setExpandedIds(new Set(nodes.map((n) => n.agentId)))
  }, [nodes])

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  const tree = graph.buildExecutionTree()

  const runningCount = nodes.filter((n) => n.status === "running").length
  const failedCount = nodes.filter((n) => n.status === "failed").length

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Network className="h-3 w-3 text-blue-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Agent Graph</span>
          {nodes.length > 0 && (
            <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">{nodes.length} agents</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExpandAll}
            className="rounded p-0.5 text-white/20 hover:text-white/50 transition-all"
            title="Expand all"
          >
            <Maximize2 className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={handleCollapseAll}
            className="rounded p-0.5 text-white/20 hover:text-white/50 transition-all"
            title="Collapse all"
          >
            <Minimize2 className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => setViewMode(viewMode === "tree" ? "list" : "tree")}
            className={cn(
              "rounded p-0.5 transition-all",
              viewMode === "tree" ? "text-white/20 hover:text-white/50" : "text-blue-400",
            )}
            title="Toggle view mode"
          >
            {viewMode === "tree" ? <GitBranch className="h-2.5 w-2.5" /> : <Layers className="h-2.5 w-2.5" />}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <AgentStats nodes={nodes} />

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="flex-1 flex items-center justify-center min-h-[120px]">
          <div className="text-center px-4">
            <Users className="h-5 w-5 text-white/15 mx-auto mb-1" />
            <p className="text-[10px] text-white/25">No agent delegations</p>
            <p className="text-[8px] text-white/15 mt-0.5">
              Multi-agent orchestration tree appears here
            </p>
          </div>
        </div>
      )}

      {/* Node list */}
      {nodes.length > 0 && (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {viewMode === "tree" ? (
            renderAgentTree(tree, 0, selectedAgentId, expandedIds, handleSelect, handleToggle)
          ) : (
            /* Flat list mode */
            <div className="space-y-1">
              {nodes.map((node) => (
                <AgentNodeCard
                  key={node.agentId}
                  node={{
                    ...node,
                    children: graph.getChildren(node.agentId),
                  }}
                  isSelected={selectedAgentId === node.agentId}
                  onClick={() => handleSelect(node.agentId)}
                  onExpand={() => handleToggle(node.agentId)}
                  isExpanded={expandedIds.has(node.agentId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {showLegend && <RoleLegend />}
    </div>
  )
}
