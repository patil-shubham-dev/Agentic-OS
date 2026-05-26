import { useState, useEffect, useRef, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { TraceStore, getTraceStore } from "@/runtime/telemetry/TraceStore"
import { TimelineSpanTree, type SpanTreeNode, type SpanTreeWaterfall } from "@/runtime/telemetry/TimelineSpanTree"
import { type Span, formatDuration, computeSpanDuration } from "@/runtime/telemetry/TraceTypes"
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Layers,
  Timer,
  ZoomIn,
  ZoomOut,
  Columns3,
} from "lucide-react"

interface TimelineWaterfallProps {
  className?: string
  maxHeight?: string
}

// ── Span Bar ──

interface SpanBarProps {
  node: SpanTreeNode
  totalDuration: number
  depth: number
  isExpanded: boolean
  isSelected: boolean
  onClick: () => void
  onToggle: () => void
  treeStartTime: number
}

const PHASE_COLORS_MAP: Record<string, string> = {
  execute: "#3b82f6",
  direct_response: "#06b6d4",
  fast_chat_completion: "#10b981",
  delegated_execution: "#8b5cf6",
  build_task_graph: "#6366f1",
  agent: "#f59e0b",
  synthesis: "#ec4899",
  context_assembly: "#3b82f6",
  tool_execution: "#f59e0b",
  streaming: "#06b6d4",
  provider_connect: "#10b981",
  routing: "#8b5cf6",
  validation: "#14b8a6",
}

function getSpanColor(name: string, kind: string): string {
  // Check for prefix matches (e.g., "agent:coder")
  for (const [key, color] of Object.entries(PHASE_COLORS_MAP)) {
    if (name.startsWith(key) || name.includes(key)) return color
  }
  // Default by kind
  const kindColors: Record<string, string> = {
    server: "#6366f1",
    client: "#3b82f6",
    internal: "#6b7280",
    producer: "#8b5cf6",
    consumer: "#10b981",
  }
  return kindColors[kind] ?? "#6b7280"
}

const SpanBarDisplay = memo(function SpanBarDisplay({
  node, totalDuration, depth, isExpanded, isSelected, onClick, onToggle, treeStartTime,
}: SpanBarProps) {
  const span = node.span
  const color = getSpanColor(span.name, span.kind)
  const hasChildren = node.children.length > 0
  const offsetPct = totalDuration > 0
    ? ((span.startTime - treeStartTime) / totalDuration) * 100
    : 0
  const widthPct = totalDuration > 0
    ? (node.duration / totalDuration) * 100
    : 0

  const statusIcon = span.status === "ok"
    ? <CheckCircle2 className="h-2.5 w-2.5 text-green-400" />
    : span.status === "error"
      ? <XCircle className="h-2.5 w-2.5 text-red-400" />
      : null

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 py-0.5 px-1 cursor-pointer transition-colors group text-[10px]",
        isSelected
          ? "bg-blue-500/[0.08]"
          : "hover:bg-white/[0.03]",
      )}
      style={{ paddingLeft: `${12 + depth * 12}px` }}
    >
      {/* Expand/collapse */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className={cn(
          "shrink-0 transition-opacity",
          hasChildren ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {isExpanded
          ? <ChevronDown className="h-2.5 w-2.5 text-white/30" />
          : <ChevronRight className="h-2.5 w-2.5 text-white/30" />
        }
      </button>

      {/* Status icon */}
      <span className="shrink-0">
        {statusIcon}
        {!statusIcon && (
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: color, opacity: 0.6 }}
          />
        )}
      </span>

      {/* Name */}
      <span className="text-white/70 truncate min-w-0 flex-1">{span.name}</span>

      {/* Bar chart area */}
      <div className="relative flex-1 h-4 min-w-[60px] max-w-[200px] shrink-0">
        <div className="absolute inset-0 bg-white/[0.03] rounded" />
        {widthPct > 0.5 && (
          <div
            className="absolute top-0.5 bottom-0.5 rounded-full transition-all"
            style={{
              left: `${Math.max(0, offsetPct)}%`,
              width: `${Math.max(2, widthPct)}%`,
              backgroundColor: color,
              opacity: span.status === "error" ? 0.8 : 0.5,
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)`,
              }}
            />
          </div>
        )}
        {widthPct <= 0.5 && widthPct > 0 && (
          <div
            className="absolute top-1 bottom-1 w-0.5 rounded-full"
            style={{
              left: `${Math.max(0, offsetPct)}%`,
              backgroundColor: color,
            }}
          />
        )}
      </div>

      {/* Duration */}
      <span className="text-[8px] text-white/30 font-mono w-16 text-right shrink-0 tabular-nums">
        {formatDuration(node.duration)}
      </span>

      {/* Status text */}
      {span.status === "error" && (
        <AlertTriangle className="h-2.5 w-2.5 text-red-400 shrink-0" />
      )}
    </div>
  )
})

// ── Span Detail Panel ──

function SpanDetail({ span }: { span: Span }) {
  const attrs = Object.entries(span.attributes).filter(([, v]) => v !== undefined && v !== null)

  return (
    <div className="space-y-2 text-[10px] p-2">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider">Span Details</span>
        <span className="text-[8px] font-mono text-white/20">{span.spanId.slice(0, 12)}…</span>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Name</span>
          <span className="text-[10px] text-white/70 truncate block">{span.name}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Kind</span>
          <span className="text-[10px] text-white/70 capitalize">{span.kind}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Duration</span>
          <span className="text-[10px] text-white/70 font-mono">
            {span.duration !== null ? formatDuration(span.duration) : "running"}
          </span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Status</span>
          <span className={cn(
            "text-[10px] font-mono",
            span.status === "ok" ? "text-green-400" :
            span.status === "error" ? "text-red-400" : "text-white/40",
          )}>
            {span.status}
          </span>
        </div>
      </div>

      {/* Attributes */}
      {attrs.length > 0 && (
        <div>
          <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider block mb-0.5">
            Attributes ({attrs.length})
          </span>
          <div className="space-y-0.5">
            {attrs.map(([key, val]) => (
              <div key={key} className="flex items-start gap-1 text-[8px]">
                <span className="text-white/40 font-mono shrink-0">{key}:</span>
                <span className="text-white/60 font-mono truncate">
                  {typeof val === "object" ? JSON.stringify(val).slice(0, 80) : String(val).slice(0, 80)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      {span.events.length > 0 && (
        <div>
          <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider block mb-0.5">
            Events ({span.events.length})
          </span>
          <div className="space-y-0.5 max-h-20 overflow-y-auto">
            {span.events.map((ev, i) => (
              <div key={i} className="text-[8px] text-white/40 font-mono">
                <span className="text-white/20">{ev.timestamp.toFixed(1)}ms</span> {ev.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status message */}
      {span.statusMessage && (
        <div>
          <span className="text-[8px] font-medium text-red-400/60 uppercase tracking-wider block mb-0.5">
            Error
          </span>
          <div className="text-[9px] text-red-400/70 font-mono bg-red-500/[0.03] rounded px-1.5 py-1">
            {span.statusMessage}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trace Selector ──

function TraceSelector({
  traces,
  selectedTraceId,
  onSelect,
}: {
  traces: { traceId: string; startTime: number; spanCount: number; status: string }[]
  selectedTraceId: string | null
  onSelect: (id: string) => void
}) {
  if (traces.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.04] overflow-x-auto">
      <Layers className="h-2.5 w-2.5 text-white/30 shrink-0" />
      {traces.map((t) => (
        <button
          key={t.traceId}
          onClick={() => onSelect(t.traceId)}
          className={cn(
            "text-[8px] px-1.5 py-0.5 rounded font-mono transition-all shrink-0",
            selectedTraceId === t.traceId
              ? "bg-purple-500/10 text-purple-400"
              : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]",
          )}
        >
          {t.traceId.slice(0, 12)}…
          <span className={cn(
            "ml-1",
            t.status === "ok" ? "text-green-400" :
            t.status === "error" ? "text-red-400" : "text-white/20",
          )}>
            {t.spanCount} spans
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Legend ──

function PhaseLegend() {
  return (
    <div className="flex flex-wrap gap-1 px-2 py-1 border-t border-white/[0.04]">
      {Object.entries(PHASE_COLORS_MAP).slice(0, 12).map(([phase, color]) => (
        <div key={phase} className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[7px] text-white/30">{phase.replace(/_/g, " ")}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ──

export function TimelineWaterfall({ className, maxHeight }: TimelineWaterfallProps) {
  const store = getTraceStore()

  const [spans, setSpans] = useState<Span[]>(store.getAllSpans())
  const [traces, setTraces] = useState<{ traceId: string; startTime: number; spanCount: number; status: string }[]>([])
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [waterfall, setWaterfall] = useState<SpanTreeWaterfall | null>(null)
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [showLegend, setShowLegend] = useState(true)

  // Refresh from store
  const refreshFromStore = useCallback(() => {
    const allSpans = store.getAllSpans()
    setSpans(allSpans)

    const allTraces = store.getTraces()
    setTraces(allTraces.map((t) => ({
      traceId: t.traceId,
      startTime: t.startTime,
      spanCount: t.spanCount,
      status: t.status,
    })))

    // Build waterfall for selected trace
    if (selectedTraceId) {
      const builder = new TimelineSpanTree()
      const wf = builder.buildWaterfall(selectedTraceId)
      setWaterfall(wf)
    } else if (allTraces.length > 0) {
      const latest = allTraces[0]
      setSelectedTraceId(latest.traceId)
    }
  }, [store, selectedTraceId])

  // Subscribe to span events
  useEffect(() => {
    refreshFromStore()

    const interval = setInterval(refreshFromStore, 800)
    return () => clearInterval(interval)
  }, [refreshFromStore])

  // Rebuild waterfall when selected trace changes
  useEffect(() => {
    if (selectedTraceId) {
      const builder = new TimelineSpanTree()
      const wf = builder.buildWaterfall(selectedTraceId)
      setWaterfall(wf)
    } else {
      setWaterfall(null)
    }
  }, [selectedTraceId, spans])

  const handleSelectTrace = useCallback((traceId: string) => {
    setSelectedTraceId(traceId)
    setSelectedSpanId(null)
    setExpandedNodes(new Set())
  }, [])

  const handleSelectSpan = useCallback((spanId: string) => {
    setSelectedSpanId(spanId === selectedSpanId ? null : spanId)
  }, [selectedSpanId])

  const handleToggleNode = useCallback((spanId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(spanId)) {
        next.delete(spanId)
      } else {
        next.add(spanId)
      }
      return next
    })
  }, [])

  // Recursive render
  const renderNode = (node: SpanTreeNode, treeStartTime: number) => {
    const isExpanded = expandedNodes.has(node.span.spanId)
    const isSelected = selectedSpanId === node.span.spanId

    return (
      <div key={node.span.spanId}>
        <SpanBarDisplay
          node={node}
          totalDuration={waterfall?.totalDuration ?? 1}
          depth={node.depth}
          isExpanded={isExpanded}
          isSelected={isSelected}
          onClick={() => handleSelectSpan(node.span.spanId)}
          onToggle={() => handleToggleNode(node.span.spanId)}
          treeStartTime={treeStartTime}
        />
        {isExpanded && node.children.map((child) => renderNode(child, treeStartTime))}
      </div>
    )
  }

  const selectedSpan = selectedSpanId ? store.getSpan(selectedSpanId) : null

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-purple-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Span Waterfall</span>
          {spans.length > 0 && (
            <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">{spans.length} spans</span>
          )}
        </div>
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="rounded p-0.5 text-white/20 hover:text-white/50 transition-all"
        >
          <Columns3 className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Trace selector */}
      <TraceSelector
        traces={traces}
        selectedTraceId={selectedTraceId}
        onSelect={handleSelectTrace}
      />

      {/* Empty state */}
      {spans.length === 0 && (
        <div className="flex-1 flex items-center justify-center min-h-[120px]">
          <div className="text-center px-4">
            <Layers className="h-5 w-5 text-white/15 mx-auto mb-1" />
            <p className="text-[10px] text-white/25">No spans recorded</p>
            <p className="text-[8px] text-white/15 mt-0.5">
              OpenTelemetry-style spans will appear here during execution
            </p>
          </div>
        </div>
      )}

      {/* Waterfall content */}
      {spans.length > 0 && (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Tree + bars */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {waterfall?.tree.map((root) => renderNode(root, root.span.startTime))}
              {waterfall && waterfall.tree.length === 0 && (
                <div className="flex items-center justify-center h-12 text-[8px] text-white/20">
                  No root spans found
                </div>
              )}
            </div>

            {/* Legend */}
            {showLegend && <PhaseLegend />}
          </div>

          {/* Detail panel */}
          {selectedSpan && (
            <div className="w-56 shrink-0 border-l border-white/[0.06] overflow-y-auto">
              <SpanDetail span={selectedSpan} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
