import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ExecutionCausalityEngine } from "@/runtime/observability/ExecutionCausalityEngine"
import type { CausalChain, CausalLink, CausalitySnapshot } from "@/runtime/observability/ExecutionCausalityEngine"
import {
  Network,
  Activity,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  BarChart3,
  Search,
  CircleDot,
  Loader2,
  Link2,
  GitBranch,
  Target,
  TrendingUp,
  TrendingDown,
  Filter,
  Play,
  Square,
  RefreshCw,
} from "lucide-react"

interface CausalityGraphPanelProps {
  className?: string
}

// ── Relationship Colors ──

const RELATIONSHIP_COLORS: Record<string, string> = {
  causes: "text-red-400 border-red-500/30",
  depends_on: "text-amber-400 border-amber-500/30",
  triggers: "text-blue-400 border-blue-500/30",
  resolves: "text-green-400 border-green-500/30",
  blocks: "text-rose-400 border-rose-500/30",
  amplifies: "text-purple-400 border-purple-500/30",
  suppresses: "text-slate-400 border-slate-500/30",
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  causes: "Causes",
  depends_on: "Depends On",
  triggers: "Triggers",
  resolves: "Resolves",
  blocks: "Blocks",
  amplifies: "Amplifies",
  suppresses: "Suppresses",
}

// ── Stats Bar ──

function StatsBar({ stats }: { stats: CausalitySnapshot["stats"] }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      <div className="bg-white/[0.03] rounded px-1.5 py-1">
        <span className="text-[7px] text-white/25 uppercase block">Chains</span>
        <span className="text-[10px] font-mono text-white/70 tabular-nums">{stats.totalChains}</span>
      </div>
      <div className="bg-white/[0.03] rounded px-1.5 py-1">
        <span className="text-[7px] text-white/25 uppercase block">Links</span>
        <span className="text-[10px] font-mono text-white/70 tabular-nums">{stats.totalLinks}</span>
      </div>
      <div className="bg-white/[0.03] rounded px-1.5 py-1">
        <span className="text-[7px] text-white/25 uppercase block">Avg Duration</span>
        <span className="text-[10px] font-mono text-white/70 tabular-nums">{stats.avgChainDuration.toFixed(0)}ms</span>
      </div>
      <div className="bg-white/[0.03] rounded px-1.5 py-1">
        <span className="text-[7px] text-white/25 uppercase block">Recovery</span>
        <span className="text-[10px] font-mono text-white/70 tabular-nums">
          {stats.totalChains > 0
            ? `${((stats.successfulChains / stats.totalChains) * 100).toFixed(0)}%`
            : "—"}
        </span>
      </div>
    </div>
  )
}

// ── Outcome Badge ──

function OutcomeBadge({ outcome }: { outcome: CausalChain["outcome"] }) {
  return (
    <span className={cn(
      "text-[7px] font-medium px-1 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-0.5",
      outcome === "success" ? "text-green-400 bg-green-500/10" :
      outcome === "failure" ? "text-red-400 bg-red-500/10" :
      "text-amber-400 bg-amber-500/10",
    )}>
      {outcome === "success" && <CheckCircle2 className="h-2 w-2" />}
      {outcome === "failure" && <AlertTriangle className="h-2 w-2" />}
      {outcome === "in_progress" && <Loader2 className="h-2 w-2 animate-spin" />}
      {outcome === "success" ? "Success" : outcome === "failure" ? "Failed" : "In Progress"}
    </span>
  )
}

// ── Link Edge ──

function LinkEdge({ link, depth }: { link: CausalLink; depth: number }) {
  const color = RELATIONSHIP_COLORS[link.relationship] ?? "text-white/30 border-white/20"
  return (
    <div className="flex items-start gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
      <div className="flex flex-col items-center shrink-0">
        <CircleDot className={cn("h-2 w-2", color.split(" ")[0])} />
        {depth < 5 && <div className="w-px h-3 bg-white/[0.04]" />}
      </div>
      <div className="flex-1 min-w-0 pb-0.5">
        <div className="flex items-center gap-1">
          <span className={cn("text-[7px] font-medium px-0.5 rounded", color.split(" ")[0], color.split(" ")[1])}>
            {RELATIONSHIP_LABELS[link.relationship] ?? link.relationship}
          </span>
          <ArrowRight className="h-2 w-2 text-white/20" />
          <span className="text-[7px] font-mono text-white/20 truncate">{link.toEventId.slice(0, 12)}…</span>
        </div>
        <p className="text-[7px] text-white/40 truncate">{link.description}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[6px] text-white/15">{link.fromEventId.slice(0, 8)}→</span>
          <span className="text-[6px] text-white/15">{link.toEventId.slice(0, 8)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Chain Card ──

function ChainCard({
  chain,
  expanded,
  onToggle,
  onViewCriticalPath,
}: {
  chain: CausalChain
  expanded: boolean
  onToggle: () => void
  onViewCriticalPath: () => void
}) {
  return (
    <div className="bg-white/[0.02] rounded border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1 w-full px-2 py-1.5 hover:bg-white/[0.02] transition-all"
      >
        {expanded ? <ChevronDown className="h-2.5 w-2.5 text-white/30 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 text-white/30 shrink-0" />}
        <GitBranch className="h-2.5 w-2.5 text-white/30 shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <span className="text-[8px] font-medium text-white/60 truncate block">{chain.rootLabel}</span>
        </div>
        <OutcomeBadge outcome={chain.outcome} />
      </button>

      {/* Quick stats row */}
      <div className="flex items-center gap-2 px-2 py-0.5 border-t border-white/[0.04] text-[7px] text-white/20">
        <span>{chain.links.length} links</span>
        <span>{chain.nodeIds.length} nodes</span>
        {chain.duration > 0 && <span className="ml-auto">{chain.duration.toFixed(0)}ms</span>}
        {chain.tags.length > 0 && (
          <div className="flex gap-0.5 ml-1">
            {chain.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[6px] bg-white/5 rounded px-0.5">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded content: Link edges */}
      {expanded && (
        <div className="px-2 py-1 space-y-0.5 border-t border-white/[0.04]">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[7px] text-white/25 uppercase tracking-wider">Causal Chain</span>
            <button
              onClick={(e) => { e.stopPropagation(); onViewCriticalPath() }}
              className="text-[7px] text-blue-400/60 hover:text-blue-400 transition-all"
            >
              View Critical Path
            </button>
          </div>
          {chain.links.length === 0 ? (
            <div className="text-[7px] text-white/15 py-1 text-center">No links recorded yet</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {chain.links.map((link) => (
                <LinkEdge key={link.id} link={link} depth={0} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Critical Path View ──

function CriticalPathView({
  links,
  chainLabel,
  onClose,
}: {
  links: CausalLink[]
  chainLabel: string
  onClose: () => void
}) {
  return (
    <div className="bg-white/[0.03] rounded border border-blue-500/20 px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Target className="h-2.5 w-2.5 text-blue-400" />
          <span className="text-[8px] font-medium text-white/40 uppercase tracking-wider">Critical Path</span>
          <span className="text-[7px] text-white/20">— {chainLabel}</span>
        </div>
        <button onClick={onClose} className="text-[7px] text-white/20 hover:text-white/50 transition-all">Close</button>
      </div>
      <div className="flex items-center gap-0.5 overflow-x-auto py-1">
        {links.length === 0 ? (
          <span className="text-[7px] text-white/15">No causal path found</span>
        ) : (
          links.map((link, i) => (
            <div key={link.id} className="flex items-center gap-0.5 shrink-0">
              <div className={cn(
                "px-1 py-0.5 rounded text-[6px] font-mono border whitespace-nowrap",
                RELATIONSHIP_COLORS[link.relationship] ?? "text-white/30 border-white/20",
              )}>
                {RELATIONSHIP_LABELS[link.relationship] ?? link.relationship}
              </div>
              {i < links.length - 1 && (
                <ArrowRight className="h-2 w-2 text-white/20 shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
      {links.length > 0 && (
        <div className="flex items-center justify-between text-[6px] text-white/15 mt-0.5">
          <span>Root: {links[0]?.fromEventId.slice(0, 8) ?? "—"}</span>
          <span>{links.length} steps</span>
          <span>Leaf: {links[links.length - 1]?.toEventId.slice(0, 8) ?? "—"}</span>
        </div>
      )}
    </div>
  )
}

// ── Empty State ──

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[160px]">
      <div className="text-center px-6">
        <Network className="h-6 w-6 text-white/15 mx-auto mb-2" />
        <p className="text-[10px] text-white/25">No causal chains recorded</p>
        <p className="text-[8px] text-white/15 mt-1 leading-relaxed">
          Causal links between events appear here as execution progresses.<br />
          Each chain traces the cause-and-effect relationships between events.
        </p>
        <div className="flex items-center justify-center gap-3 mt-2 text-[7px] text-white/20">
          <span className="flex items-center gap-0.5"><span className="text-green-400">●</span> Success</span>
          <span className="flex items-center gap-0.5"><span className="text-red-400">●</span> Failure</span>
          <span className="flex items-center gap-0.5"><span className="text-amber-400">●</span> In Progress</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──

export function CausalityGraphPanel({ className }: CausalityGraphPanelProps) {
  const engine = ExecutionCausalityEngine.getInstance()
  const [snapshot, setSnapshot] = useState<CausalitySnapshot>(engine.snapshot())
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set())
  const [criticalPathChainId, setCriticalPathChainId] = useState<string | null>(null)
  const [outcomeFilter, setOutcomeFilter] = useState<CausalChain["outcome"] | "all">("all")
  const [showCriticalPath, setShowCriticalPath] = useState(false)

  useEffect(() => {
    const refresh = () => setSnapshot(engine.snapshot())
    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [engine])

  const filteredChains = outcomeFilter === "all"
    ? snapshot.chains
    : snapshot.chains.filter((c) => c.outcome === outcomeFilter)

  const criticalPathLinks = criticalPathChainId
    ? engine.getCriticalPath(criticalPathChainId)
    : []

  const criticalChain = criticalPathChainId
    ? snapshot.chains.find((c) => c.id === criticalPathChainId)
    : null

  const toggleChain = (id: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleViewCriticalPath = (chainId: string) => {
    setCriticalPathChainId(chainId)
    setShowCriticalPath(true)
    setExpandedChains((prev) => {
      const next = new Set(prev)
      next.add(chainId)
      return next
    })
  }

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Network className="h-3 w-3 text-blue-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Execution Causality</span>
          {snapshot.chains.length > 0 && (
            <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">{snapshot.chains.length}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-2 py-1.5 border-b border-white/[0.04]">
        <StatsBar stats={snapshot.stats} />
      </div>

      {/* Outcome filter */}
      {snapshot.chains.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.04] overflow-x-auto">
          {(["all", "success", "failure", "in_progress"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setOutcomeFilter(filter)}
              className={cn(
                "text-[7px] px-1.5 py-0.5 rounded-full transition-all",
                outcomeFilter === filter
                  ? "bg-white/10 text-white/60"
                  : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]",
              )}
            >
              {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
          <span className="text-[7px] text-white/15 ml-auto">{filteredChains.length} chains</span>
        </div>
      )}

      {/* Critical path banner */}
      {showCriticalPath && criticalPathLinks.length > 0 && (
        <div className="px-2 py-1 border-b border-white/[0.04]">
          <CriticalPathView
            links={criticalPathLinks}
            chainLabel={criticalChain?.rootLabel ?? ""}
            onClose={() => { setShowCriticalPath(false); setCriticalPathChainId(null) }}
          />
        </div>
      )}

      {/* Empty state */}
      {snapshot.chains.length === 0 && <EmptyState />}

      {/* Chains list */}
      {snapshot.chains.length > 0 && (
        <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
          {filteredChains.length === 0 ? (
            <div className="text-[8px] text-white/20 py-4 text-center">No chains match the selected filter</div>
          ) : (
            filteredChains.map((chain) => (
              <ChainCard
                key={chain.id}
                chain={chain}
                expanded={expandedChains.has(chain.id)}
                onToggle={() => toggleChain(chain.id)}
                onViewCriticalPath={() => handleViewCriticalPath(chain.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Legend */}
      <div className="px-2 py-1 border-t border-white/[0.04]">
        <div className="flex items-center gap-2 text-[6px] text-white/20 flex-wrap">
          {Object.entries(RELATIONSHIP_LABELS).map(([key, label]) => (
            <span key={key} className={cn("flex items-center gap-0.5", RELATIONSHIP_COLORS[key]?.split(" ")[0] ?? "text-white/30")}>
              ● {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
