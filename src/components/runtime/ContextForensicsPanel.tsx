import { useState, useEffect, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { ContextDiagnosticsEngine } from "@/runtime/observability/ContextDiagnosticsEngine"
import type { ContextDiagnostics, RetrievalEntry, MemoryInjection } from "@/runtime/observability/ObservabilityTypes"
import {
  Layers,
  Database,
  FileSearch,
  Minimize2,
  Activity,
  TrendingDown,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCode,
  BookOpen,
  Filter,
  Trash2,
  BarChart4,
} from "lucide-react"

interface ContextForensicsPanelProps {
  className?: string
}

// ── Token Budget Bar ──

function TokenBudgetBar({ diagnostics }: { diagnostics: ContextDiagnostics }) {
  const total = diagnostics.totalTokens || 1
  const systemPct = (diagnostics.systemTokens / total) * 100
  const retrievalPct = (diagnostics.retrievalTokens / total) * 100
  const memoryPct = (diagnostics.memoryTokens / total) * 100
  const outputPct = (diagnostics.outputBudget / Math.max(total, diagnostics.outputBudget)) * 100

  return (
    <div className="space-y-1.5">
      <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider flex items-center gap-1">
        <BarChart4 className="h-2 w-2" /> Token Allocation
      </span>
      <div className="h-4 bg-white/[0.06] rounded-full overflow-hidden flex">
        {systemPct > 0 && (
          <div
            className="h-full bg-blue-500/50 transition-all"
            style={{ width: `${Math.max(2, systemPct)}%` }}
            title={`System: ${diagnostics.systemTokens} tokens`}
          />
        )}
        {retrievalPct > 0 && (
          <div
            className="h-full bg-amber-500/50 transition-all"
            style={{ width: `${Math.max(2, retrievalPct)}%` }}
            title={`Retrieval: ${diagnostics.retrievalTokens} tokens`}
          />
        )}
        {memoryPct > 0 && (
          <div
            className="h-full bg-purple-500/50 transition-all"
            style={{ width: `${Math.max(2, memoryPct)}%` }}
            title={`Memory: ${diagnostics.memoryTokens} tokens`}
          />
        )}
      </div>
      <div className="grid grid-cols-4 gap-1 text-[8px]">
        <div>
          <span className="text-blue-400/80">{diagnostics.systemTokens.toLocaleString()}</span>
          <span className="text-white/20 ml-0.5">sys</span>
        </div>
        <div>
          <span className="text-amber-400/80">{diagnostics.retrievalTokens.toLocaleString()}</span>
          <span className="text-white/20 ml-0.5">ret</span>
        </div>
        <div>
          <span className="text-purple-400/80">{diagnostics.memoryTokens.toLocaleString()}</span>
          <span className="text-white/20 ml-0.5">mem</span>
        </div>
        <div className="text-right">
          <span className="text-white/50">{diagnostics.totalTokens.toLocaleString()}</span>
          <span className="text-white/20 ml-0.5">total</span>
        </div>
      </div>
      {diagnostics.compressionRatio > 0 && (
        <div className="flex items-center gap-1 text-[8px] text-white/30">
          <Minimize2 className="h-2 w-2" />
          Compression ratio: {diagnostics.compressionRatio.toFixed(2)}x
        </div>
      )}
    </div>
  )
}

// ── Retrieval Score Distribution ──

function RetrievalScoreChart({ entries }: { entries: RetrievalEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-[8px] text-white/20 py-2 text-center">No retrieval data</div>
    )
  }

  const sorted = [...entries].sort((a, b) => b.relevanceScore - a.relevanceScore)

  return (
    <div className="space-y-1">
      <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider flex items-center gap-1">
        <BarChart3 className="h-2 w-2" /> Retrieval Scores
      </span>
      <div className="space-y-0.5 max-h-36 overflow-y-auto">
        {sorted.slice(0, 10).map((entry, i) => (
          <div key={`${entry.filePath}-${i}`} className="flex items-center gap-1.5 text-[8px]">
            <span className="text-white/20 font-mono w-4 shrink-0 text-right">#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white/50 truncate">{entry.filePath}</span>
                <span className="text-white/30 font-mono ml-1 shrink-0">
                  {(entry.relevanceScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${entry.relevanceScore * 100}%`,
                    background: entry.relevanceScore > 0.7
                      ? "linear-gradient(90deg, #3b82f6, #10b981)"
                      : entry.relevanceScore > 0.4
                        ? "linear-gradient(90deg, #f59e0b, #3b82f6)"
                        : "linear-gradient(90deg, #6b7280, #f59e0b)",
                  }}
                />
              </div>
            </div>
            <span className="text-white/20 font-mono w-10 text-right">{entry.tokenCount}t</span>
          </div>
        ))}
      </div>
      {sorted.length > 10 && (
        <div className="text-[7px] text-white/20 text-center">+{sorted.length - 10} more files</div>
      )}
    </div>
  )
}

// ── Memory Injection Timeline ──

function MemoryInjectionTimeline({ injections }: { injections: MemoryInjection[] }) {
  if (injections.length === 0) {
    return (
      <div className="text-[8px] text-white/20 py-2 text-center">No memory injections</div>
    )
  }

  const sourceColors: Record<string, string> = {
    session: "bg-blue-500",
    project: "bg-amber-500",
    workspace: "bg-purple-500",
    long_term: "bg-green-500",
  }

  return (
    <div className="space-y-1">
      <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider flex items-center gap-1">
        <Database className="h-2 w-2" /> Memory Injections
      </span>
      <div className="space-y-0.5 max-h-32 overflow-y-auto">
        {injections.map((inj, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[8px]">
            <span className={cn("h-1.5 w-1.5 rounded-full mt-0.5 shrink-0", sourceColors[inj.source] ?? "bg-white/20")} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-white/40 uppercase text-[7px]">{inj.source}</span>
                <span className="text-white/20">·</span>
                <span className="text-white/30">{inj.tokenCount}t</span>
                {inj.relevance > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-white/30">{(inj.relevance * 100).toFixed(0)}% relevant</span>
                  </>
                )}
              </div>
              <p className="text-white/50 truncate">{inj.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Selection Reason Card ──

function SelectionReasons({ entries }: { entries: RetrievalEntry[] }) {
  if (entries.length === 0) return null

  const sorted = [...entries].sort((a, b) => b.relevanceScore - a.relevanceScore)

  return (
    <div className="space-y-1">
      <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider flex items-center gap-1">
        <FileSearch className="h-2 w-2" /> Why Files Were Selected
      </span>
      <div className="space-y-0.5 max-h-32 overflow-y-auto">
        {sorted.slice(0, 5).map((entry, i) => (
          <div key={i} className="flex items-start gap-1 text-[8px] bg-white/[0.02] rounded px-1.5 py-1">
            <span className="text-amber-400/60 shrink-0 mt-0.5">→</span>
            <div className="min-w-0">
              <span className="text-white/60 block truncate">{entry.filePath}</span>
              <span className="text-white/30 text-[7px]">{entry.selectionReason}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ──

export function ContextForensicsPanel({ className }: ContextForensicsPanelProps) {
  const engine = ContextDiagnosticsEngine.getInstance()
  const [diagnostics, setDiagnostics] = useState<ContextDiagnostics[]>([])
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [expandedDiag, setExpandedDiag] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setDiagnostics(engine.getAllDiagnostics())
    refresh()
    const interval = setInterval(refresh, 800)
    return () => clearInterval(interval)
  }, [engine])

  const current = selectedTraceId
    ? diagnostics.find((d) => d.traceId === selectedTraceId)
    : diagnostics[diagnostics.length - 1]

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-cyan-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Context Forensics</span>
          {diagnostics.length > 0 && (
            <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">{diagnostics.length} traces</span>
          )}
        </div>
      </div>

      {/* Trace selector */}
      {diagnostics.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.04] overflow-x-auto">
          {diagnostics.map((d) => (
            <button
              key={d.traceId}
              onClick={() => setSelectedTraceId(d.traceId)}
              className={cn(
                "text-[8px] px-1.5 py-0.5 rounded font-mono transition-all shrink-0",
                (selectedTraceId ?? diagnostics[diagnostics.length - 1]?.traceId) === d.traceId
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]",
              )}
            >
              {d.traceId.slice(0, 10)}…
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!current && (
        <div className="flex-1 flex items-center justify-center min-h-[120px]">
          <div className="text-center px-4">
            <BarChart3 className="h-5 w-5 text-white/15 mx-auto mb-1" />
            <p className="text-[10px] text-white/25">No context diagnostics</p>
            <p className="text-[8px] text-white/15 mt-0.5">
              Token budget and retrieval data appear here
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {current && (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
          {/* Token budget bar */}
          <TokenBudgetBar diagnostics={current} />

          {/* Output budget */}
          <div className="grid grid-cols-2 gap-1">
            <div className="bg-white/[0.03] rounded px-1.5 py-1">
              <span className="text-[7px] text-white/25 uppercase block">Output Budget</span>
              <span className="text-[10px] font-mono text-white/60">{current.outputBudget.toLocaleString()} tok</span>
            </div>
            <div className="bg-white/[0.03] rounded px-1.5 py-1">
              <span className="text-[7px] text-white/25 uppercase block">Compression</span>
              <span className="text-[10px] font-mono text-white/60">{current.compressionRatio > 0 ? `${current.compressionRatio.toFixed(2)}x` : "—"}</span>
            </div>
          </div>

          {/* Retrieval score chart */}
          <RetrievalScoreChart entries={current.retrievalEntries} />

          {/* Selection reasons */}
          <SelectionReasons entries={current.retrievalEntries} />

          {/* Memory injections */}
          <MemoryInjectionTimeline injections={current.memoryInjections} />

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/[0.04]">
            <div className="text-center">
              <span className="text-white/60 text-[8px] block">{current.retrievalEntries.length}</span>
              <span className="text-white/20 text-[7px]">files retrieved</span>
            </div>
            <div className="text-center">
              <span className="text-white/60 text-[8px] block">{current.memoryInjections.length}</span>
              <span className="text-white/20 text-[7px]">mem injections</span>
            </div>
            <div className="text-center">
              <span className="text-white/60 text-[8px] block">
                {current.totalTokens > 0
                  ? `${((current.systemTokens / current.totalTokens) * 100).toFixed(0)}% sys`
                  : "—"}
              </span>
              <span className="text-white/20 text-[7px]">system ratio</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
