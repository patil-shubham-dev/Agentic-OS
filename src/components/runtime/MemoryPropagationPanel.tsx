import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { MemoryPropagationSystem } from "@/runtime/observability/MemoryPropagationSystem"
import type { MemoryRecord, MemoryMutation, MemorySnapshot } from "@/runtime/observability/ObservabilityTypes"
import {
  Database,
  Brain,
  Layers,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Trash2,
  RefreshCw,
  Maximize2,
  Minimize2,
  ArrowRight,
  ArrowDown,
  BarChart3,
  CircleDot,
  Filter,
} from "lucide-react"

interface MemoryPropagationPanelProps {
  className?: string
}

// ── Type Colors ──

const TYPE_COLORS: Record<MemoryRecord["type"], string> = {
  session: "bg-blue-500",
  project: "bg-amber-500",
  workspace: "bg-purple-500",
  role_scoped: "bg-emerald-500",
  compressed: "bg-rose-500",
  retrieval: "bg-cyan-500",
  long_term: "bg-green-500",
}

const TYPE_LABELS: Record<MemoryRecord["type"], string> = {
  session: "Session",
  project: "Project",
  workspace: "Workspace",
  role_scoped: "Role-Scoped",
  compressed: "Compressed",
  retrieval: "Retrieval",
  long_term: "Long-Term",
}

const MUTATION_COLORS: Record<string, string> = {
  create: "text-green-400",
  update: "text-blue-400",
  compress: "text-rose-400",
  evict: "text-red-400",
  propagate: "text-amber-400",
}

// ── Pressure Gauge ──

function PressureGauge({ pressure }: { pressure: number }) {
  const status = pressure > 80 ? "critical" : pressure > 50 ? "warning" : "good"
  return (
    <div className="bg-white/[0.03] rounded px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] text-white/30 uppercase tracking-wider flex items-center gap-1">
          <Activity className="h-2 w-2" /> Memory Pressure
        </span>
        <span className={cn(
          "text-[10px] font-mono tabular-nums",
          status === "good" ? "text-green-400" : status === "warning" ? "text-amber-400" : "text-red-400",
        )}>
          {pressure.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            status === "good" ? "bg-gradient-to-r from-green-500 to-emerald-400" :
            status === "warning" ? "bg-gradient-to-r from-amber-500 to-orange-400" :
            "bg-gradient-to-r from-red-500 to-rose-400",
          )}
          style={{ width: `${Math.min(100, pressure)}%` }}
        />
      </div>
      <div className="flex justify-between text-[7px] text-white/20 mt-0.5">
        <span>0%</span>
        <span>{pressure > 50 ? "High" : "Normal"}</span>
        <span>100%</span>
      </div>
    </div>
  )
}

// ── Stats Cards ──

function StatsCards({ snapshot }: { snapshot: MemorySnapshot }) {
  const byTypeCounts = new Map<string, number>()
  for (const record of snapshot.records) {
    byTypeCounts.set(record.type, (byTypeCounts.get(record.type) ?? 0) + 1)
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Records</span>
          <span className="text-[11px] font-mono text-white/70 tabular-nums">{snapshot.records.length}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Tokens</span>
          <span className="text-[11px] font-mono text-white/70 tabular-nums">{snapshot.totalTokens.toLocaleString()}</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Mutations</span>
          <span className="text-[11px] font-mono text-white/70 tabular-nums">{snapshot.mutations.length}</span>
        </div>
      </div>

      {/* By-type breakdown */}
      <div className="grid grid-cols-3 gap-1">
        {Array.from(byTypeCounts.entries()).map(([type, count]) => (
          <div key={type} className="flex items-center gap-1 text-[8px]">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TYPE_COLORS[type as MemoryRecord["type"]] ?? "bg-white/20")} />
            <span className="text-white/20 capitalize truncate">{TYPE_LABELS[type as MemoryRecord["type"]] ?? type}</span>
            <span className="text-white/50 font-mono ml-auto">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Records by Type ──

function RecordsByType({ records }: { records: MemoryRecord[] }) {
  const grouped = new Map<MemoryRecord["type"], MemoryRecord[]>()
  for (const record of records) {
    const existing = grouped.get(record.type) ?? []
    existing.push(record)
    grouped.set(record.type, existing)
  }

  const [expandedType, setExpandedType] = useState<MemoryRecord["type"] | null>(null)

  if (records.length === 0) {
    return (
      <div className="text-[8px] text-white/20 py-3 text-center">No memory records</div>
    )
  }

  return (
    <div className="space-y-0.5">
      {Array.from(grouped.entries()).map(([type, typeRecords]) => (
        <div key={type}>
          <button
            onClick={() => setExpandedType(expandedType === type ? null : type)}
            className="flex items-center gap-1 w-full px-1 py-0.5 rounded hover:bg-white/[0.03] transition-all"
          >
            {expandedType === type
              ? <ChevronDown className="h-2.5 w-2.5 text-white/30" />
              : <ChevronRight className="h-2.5 w-2.5 text-white/30" />}
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TYPE_COLORS[type])} />
            <span className="text-[8px] font-medium text-white/40 uppercase tracking-wider">{TYPE_LABELS[type]}</span>
            <span className="text-[7px] text-white/20 font-mono ml-auto">{typeRecords.length}</span>
          </button>
          {expandedType === type && (
            <div className="ml-3 space-y-0.5 border-l border-white/[0.06] pl-2">
              {typeRecords.map((record) => (
                <div key={record.id} className="bg-white/[0.02] rounded px-1.5 py-1 group">
                  <div className="flex items-start gap-1">
                    <span className="text-[7px] font-mono text-white/20 mt-0.5 shrink-0">
                      {record.id.slice(0, 8)}…
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] text-white/60 leading-tight line-clamp-2">{record.summary}</p>
                      {record.role && (
                        <span className="text-[7px] text-white/20 capitalize">Role: {record.role}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[7px] text-white/20">
                    <span>{record.tokens}t</span>
                    {record.ttl && <span>TTL: {(record.ttl / 1000).toFixed(0)}s</span>}
                    <span className="ml-auto">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Mutation Timeline ──

function MutationTimeline({ mutations }: { mutations: MemoryMutation[] }) {
  if (mutations.length === 0) {
    return (
      <div className="text-[8px] text-white/20 py-2 text-center">No mutations recorded</div>
    )
  }

  const recent = mutations.slice(-20).reverse()

  return (
    <div className="space-y-0.5 max-h-40 overflow-y-auto">
      {recent.map((mutation, i) => (
        <div key={i} className="flex items-start gap-1.5 text-[8px]">
          <div className="flex flex-col items-center shrink-0">
            <span className={cn("h-1.5 w-1.5 rounded-full", MUTATION_COLORS[mutation.mutationType])} />
            {i < recent.length - 1 && <div className="w-px h-full bg-white/[0.04] mt-0.5" />}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-1">
              <span className="text-white/40 font-medium capitalize">{mutation.mutationType}</span>
              <ArrowRight className="h-2 w-2 text-white/20" />
              <span className={cn("text-white/30 capitalize", TYPE_COLORS[mutation.fromType]?.replace("bg-", "text-") + "/60")}>
                {TYPE_LABELS[mutation.fromType]}
              </span>
              {mutation.fromType !== mutation.toType && (
                <>
                  <ArrowRight className="h-2 w-2 text-white/20" />
                  <span className={cn("text-white/30 capitalize", TYPE_COLORS[mutation.toType]?.replace("bg-", "text-") + "/60")}>
                    {TYPE_LABELS[mutation.toType]}
                  </span>
                </>
              )}
            </div>
            <p className="text-white/30 truncate">{mutation.reason}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={cn(
                "text-[7px] font-mono",
                mutation.tokenDelta > 0 ? "text-green-400/60" : mutation.tokenDelta < 0 ? "text-red-400/60" : "text-white/20",
              )}>
                {mutation.tokenDelta > 0 ? "+" : ""}{mutation.tokenDelta}t
              </span>
              <span className="text-[7px] text-white/15">{new Date(mutation.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Propagation Flow ──

function PropagationFlow({ records }: { records: MemoryRecord[] }) {
  const typeOrder: MemoryRecord["type"][] = [
    "session", "project", "workspace", "role_scoped", "retrieval", "compressed", "long_term",
  ]

  return (
    <div className="space-y-1">
      <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider flex items-center gap-1">
        <Zap className="h-2 w-2" /> Propagation Pathways
      </span>
      <div className="flex items-center gap-0.5 overflow-x-auto py-1">
        {typeOrder.map((type, i) => {
          const hasRecords = records.some((r) => r.type === type)
          return (
            <div key={type} className="flex items-center gap-0.5 shrink-0">
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-medium uppercase tracking-wider",
                hasRecords ? "bg-white/[0.04] text-white/50" : "bg-white/[0.01] text-white/15",
              )}>
                <span className={cn("h-1 w-1 rounded-full", TYPE_COLORS[type])} />
                {TYPE_LABELS[type]}
              </div>
              {i < typeOrder.length - 1 && (
                <ArrowDown className="h-2 w-2 text-white/15" />
              )}
            </div>
          )
        })}
      </div>
      <div className="text-[7px] text-white/20 text-center">Memory flows through the pipeline: short-lived → compressed → persistent</div>
    </div>
  )
}

// ── Main Component ──

export function MemoryPropagationPanel({ className }: MemoryPropagationPanelProps) {
  const engine = MemoryPropagationSystem.getInstance()
  const [snapshot, setSnapshot] = useState<MemorySnapshot>(engine.snapshot())
  const [expandedSection, setExpandedSection] = useState<string | null>("stats")

  useEffect(() => {
    const refresh = () => setSnapshot(engine.snapshot())
    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [engine])

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Database className="h-3 w-3 text-rose-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Memory Propagation</span>
          <span className={cn(
            "text-[8px] font-mono px-1 rounded",
            snapshot.pressure > 80 ? "bg-red-500/10 text-red-400" :
            snapshot.pressure > 50 ? "bg-amber-500/10 text-amber-400" :
            "bg-green-500/10 text-green-400",
          )}>
            {snapshot.pressure.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Pressure gauge */}
      <div className="px-2 py-1.5 border-b border-white/[0.04]">
        <PressureGauge pressure={snapshot.pressure} />
      </div>

      {/* Stats section */}
      <div className="px-2 py-1.5 border-b border-white/[0.04]">
        <StatsCards snapshot={snapshot} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Propagation flow */}
        <div className="px-2 py-1.5 border-b border-white/[0.04]">
          <PropagationFlow records={snapshot.records} />
        </div>

        {/* Records section */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === "records" ? null : "records")}
            className="flex items-center gap-1 w-full px-2 py-1.5 text-[8px] font-medium text-white/30 hover:text-white/50 uppercase tracking-wider border-b border-white/[0.04]"
          >
            {expandedSection === "records" ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            <BarChart3 className="h-2.5 w-2.5" />
            Records ({snapshot.records.length})
          </button>
          {expandedSection === "records" && (
            <div className="px-2 py-1.5 max-h-48 overflow-y-auto">
              <RecordsByType records={snapshot.records} />
            </div>
          )}
        </div>

        {/* Mutation timeline */}
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === "mutations" ? null : "mutations")}
            className="flex items-center gap-1 w-full px-2 py-1.5 text-[8px] font-medium text-white/30 hover:text-white/50 uppercase tracking-wider border-b border-white/[0.04]"
          >
            {expandedSection === "mutations" ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            <Activity className="h-2.5 w-2.5" />
            Mutation Timeline ({snapshot.mutations.length})
          </button>
          {expandedSection === "mutations" && (
            <div className="px-2 py-1.5">
              <MutationTimeline mutations={snapshot.mutations} />
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="px-2 py-1.5 border-t border-white/[0.04]">
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <span className="text-white/60 text-[9px] font-mono block">{snapshot.records.length}</span>
              <span className="text-white/15 text-[7px] block">records</span>
            </div>
            <div>
              <span className="text-white/60 text-[9px] font-mono block">{snapshot.mutations.length}</span>
              <span className="text-white/15 text-[7px] block">mutations</span>
            </div>
            <div>
              <span className="text-white/60 text-[9px] font-mono block">{snapshot.totalTokens.toLocaleString()}</span>
              <span className="text-white/15 text-[7px] block">tokens</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
