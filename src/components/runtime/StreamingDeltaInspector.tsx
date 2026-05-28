import { useState, useEffect, useRef, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { StreamDiagnostics } from "@/runtime/observability/StreamDiagnostics"
import { ProviderInspector } from "@/runtime/observability/ProviderInspector"

import type { ChunkRecord, ToolCallReconstruction } from "@/runtime/observability/ObservabilityTypes"
import type { TraceableEvent } from "@/runtime/telemetry/TraceTypes"
import {
  Wifi,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Code,
  FileCode,
  Layers,
  Terminal,
  Zap,
  Braces,
  Quote,
  Columns3,
  Search,
  Play,
  Pause,
  Trash2,
} from "lucide-react"

interface StreamingDeltaInspectorProps {
  className?: string
  maxHeight?: string
}

// ── Wireshark-style Packet Row ──

const CHUNK_TYPE_STYLES = {
  normal: { bg: "hover:bg-white/[0.02]", dot: "bg-blue-500/40", icon: "text-blue-400/60" },
  tool_call: { bg: "hover:bg-amber-500/[0.04]", dot: "bg-amber-500", icon: "text-amber-400" },
  tool_call_partial: { bg: "hover:bg-amber-500/[0.03]", dot: "bg-amber-500/60", icon: "text-amber-400/70" },
  malformed: { bg: "hover:bg-red-500/[0.04]", dot: "bg-red-500", icon: "text-red-400" },
  repaired: { bg: "hover:bg-green-500/[0.04]", dot: "bg-green-500", icon: "text-green-400" },
}

interface ChunkRowProps {
  chunk: ChunkRecord
  index: number
  isSelected: boolean
  onClick: () => void
}

const ChunkRow = memo(function ChunkRow({ chunk, index, isSelected, onClick }: ChunkRowProps) {
  const type = chunk.isToolCall
    ? "tool_call"
    : chunk.jsonRepairApplied
      ? "repaired"
      : "normal"
  const style = CHUNK_TYPE_STYLES[type] ?? CHUNK_TYPE_STYLES.normal

  const preview = chunk.raw.length > 80
    ? chunk.raw.slice(0, 80) + "..."
    : chunk.raw

  const displayText = preview.replace(/\n/g, "↵")

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 px-2 py-1.5 cursor-pointer border-b border-white/[0.02] text-[10px] transition-all group",
        style.bg,
        isSelected && "bg-blue-500/[0.06] border-l-2 border-l-blue-500",
      )}
    >
      {/* Packet number */}
      <span className="text-[8px] text-white/20 font-mono w-6 shrink-0 text-right tabular-nums mt-0.5">
        #{index + 1}
      </span>

      {/* Status dot */}
      <span className={cn("h-1.5 w-1.5 rounded-full mt-1 shrink-0", style.dot)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {chunk.isToolCall && (
            <span className="text-[8px] font-medium text-amber-400/80 bg-amber-500/10 px-1 rounded">
              TOOL {chunk.toolCallName ?? `#${chunk.toolCallIndex}`}
            </span>
          )}
          {chunk.jsonRepairApplied && (
            <span className="text-[8px] font-medium text-green-400/80 bg-green-500/10 px-1 rounded">
              REPAIRED
            </span>
          )}
          <span className="text-[8px] text-white/20 font-mono ml-auto">
            {chunk.raw.length}B
          </span>
        </div>
        <code className="text-[9px] font-mono text-white/50 leading-relaxed break-all">
          {displayText}
        </code>
        {chunk.repaired && chunk.repaired !== chunk.raw && (
          <div className="mt-0.5 text-[8px] text-green-400/50 font-mono truncate">
            → {chunk.repaired.slice(0, 100)}
          </div>
        )}
      </div>
    </div>
  )
})

// ── Tool Call Reconstruction Card ──

const ToolCallCard = memo(function ToolCallCard({ tc }: { tc: ToolCallReconstruction }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[10px] hover:bg-amber-500/[0.03] transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-amber-400" /> : <ChevronRight className="h-3 w-3 text-amber-400" />}
        <Code className="h-3 w-3 text-amber-400" />
        <span className="font-medium text-amber-300">Tool #{tc.index}: {tc.name}</span>
        <span className="text-[8px] text-white/25 font-mono ml-auto">{tc.id}</span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5 border-t border-amber-500/10 pt-1.5">
          {/* Partial chunks */}
          {tc.partialChunks.length > 0 && (
            <div>
              <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider block mb-0.5">
                Partial Chunks ({tc.partialChunks.length})
              </span>
              {tc.partialChunks.map((chunk, i) => (
                <code key={i} className="block text-[8px] font-mono text-white/40 bg-white/[0.03] rounded px-1.5 py-0.5 mb-0.5 truncate">
                  #{i + 1}: {chunk}
                </code>
              ))}
            </div>
          )}

          {/* Reconstructed arguments */}
          <div>
            <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider block mb-0.5">
              Reconstructed Arguments
            </span>
            <code className="block text-[8px] font-mono text-white/60 bg-white/[0.03] rounded px-1.5 py-1 whitespace-pre-wrap break-all max-h-20 overflow-y-auto">
              {tc.arguments}
            </code>
          </div>

          {/* Validation */}
          {tc.validationErrors.length > 0 && (
            <div>
              <span className="text-[8px] font-medium text-red-400/60 block mb-0.5">
                Validation Errors ({tc.validationErrors.length})
              </span>
              {tc.validationErrors.map((err, i) => (
                <div key={i} className="text-[8px] text-red-400/50 font-mono">
                  ✗ {err}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 pt-0.5">
            <span className={cn(
              "text-[8px] font-medium px-1 rounded",
              tc.normalized ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400",
            )}>
              {tc.normalized ? "Normalized" : "Raw"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})

// ── Chunk Detail Panel ──

function ChunkDetailPanel({ chunk }: { chunk: ChunkRecord | null }) {
  if (!chunk) {
    return (
      <div className="flex items-center justify-center h-24 text-[9px] text-white/20">
        <Search className="h-3 w-3 mr-1" />
        Select a chunk to inspect
      </div>
    )
  }

  return (
    <div className="space-y-1.5 text-[10px]">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider">Packet Details</span>
        <span className="text-[8px] text-white/20 font-mono">#{chunk.index + 1}</span>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Size</span>
          <span className="text-[10px] font-mono text-white/60">{chunk.raw.length}B</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Accumulated</span>
          <span className="text-[10px] font-mono text-white/60">{chunk.accumulatedLength}B</span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Tool Call</span>
          <span className={cn("text-[10px] font-mono", chunk.isToolCall ? "text-amber-400" : "text-white/40")}>
            {chunk.isToolCall ? "Yes" : "No"}
          </span>
        </div>
        <div className="bg-white/[0.03] rounded px-1.5 py-1">
          <span className="text-[7px] text-white/25 uppercase block">Repair</span>
          <span className={cn("text-[10px] font-mono", chunk.jsonRepairApplied ? "text-green-400" : "text-white/40")}>
            {chunk.jsonRepairApplied ? "Applied" : "None"}
          </span>
        </div>
      </div>

      {/* Raw chunk */}
      <div>
        <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider block mb-0.5">Raw Chunk</span>
        <code className="block text-[9px] font-mono text-white/60 bg-white/[0.03] rounded px-1.5 py-1 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
          {chunk.raw}
        </code>
      </div>

      {/* Repaired version */}
      {chunk.repaired && chunk.repaired !== chunk.raw && (
        <div>
          <span className="text-[8px] font-medium text-green-400/60 uppercase tracking-wider block mb-0.5">Repaired</span>
          <code className="block text-[9px] font-mono text-green-400/60 bg-green-500/[0.03] rounded px-1.5 py-1 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
            {chunk.repaired}
          </code>
        </div>
      )}
    </div>
  )
}

// ── Active Stream Monitor ──

function ActiveStreamMonitor() {
  const diagnostics = StreamDiagnostics.getInstance()
  const inspector = ProviderInspector.getInstance()
  const streams = diagnostics.getAllStreams()
  const activeStreams = streams.filter((s) => s.endTime === null)

  if (activeStreams.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Wifi className="h-3 w-3 text-green-400 animate-pulse" />
        <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">
          Active Streams
        </span>
      </div>
      {activeStreams.slice(0, 3).map((s) => (
        <div key={s.streamId} className="flex items-center gap-2 px-2 py-1 text-[9px]">
          <Loader2 className="h-2 w-2 text-green-400 animate-spin shrink-0" />
          <span className="text-white/50 truncate font-mono">{s.streamId.slice(0, 20)}</span>
          <span className="text-white/25 font-mono ml-auto">{s.totalChunks} chunks</span>
        </div>
      ))}
    </div>
  )
}

// ── Streaming Metrics Bar ──

function StreamingMetricsBar({ streamId }: { streamId: string | null }) {
  const diagnostics = StreamDiagnostics.getInstance()

  if (!streamId) {
    const allStreams = diagnostics.getAllStreams()
    const totalChunks = allStreams.reduce((a, s) => a + s.totalChunks, 0)
    const totalTokens = allStreams.reduce((a, s) => a + s.totalTokens, 0)
    const toolCalls = allStreams.reduce((a, s) => a + s.toolCallsDetected, 0)
    const repairs = allStreams.reduce((a, s) => a + s.jsonRepairCount, 0)

    if (totalChunks === 0) {
      return (
        <div className="flex items-center justify-center py-6">
          <div className="text-center">
            <Wifi className="h-5 w-5 text-white/15 mx-auto mb-1" />
            <p className="text-[10px] text-white/25">No stream data captured</p>
            <p className="text-[8px] text-white/15 mt-0.5">Chunks appear here as the AI streams responses</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 px-2 py-1 text-[9px] text-white/30 border-b border-white/[0.04]">
        <span>{totalChunks} <span className="text-white/20">chunks</span></span>
        <span className="text-white/15">·</span>
        <span>{totalTokens} <span className="text-white/20">tokens</span></span>
        <span className="text-white/15">·</span>
        <span className={toolCalls > 0 ? "text-amber-400" : ""}>{toolCalls} <span className="text-white/20">tool calls</span></span>
        <span className="text-white/15">·</span>
        <span className={repairs > 0 ? "text-green-400" : ""}>{repairs} <span className="text-white/20">repairs</span></span>
      </div>
    )
  }

  const stream = diagnostics.getStream(streamId)
  if (!stream) return null

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-[9px] text-white/30 border-b border-white/[0.04]">
      <span>{stream.totalChunks} <span className="text-white/20">chunks</span></span>
      <span className="text-white/15">·</span>
      <span>{stream.totalTokens} <span className="text-white/20">tokens</span></span>
      <span className="text-white/15">·</span>
      <span className={stream.toolCallsDetected > 0 ? "text-amber-400" : ""}>{stream.toolCallsDetected} <span className="text-white/20">tools</span></span>
      <span className="text-white/15">·</span>
      <span className={stream.malformedChunks > 0 ? "text-red-400" : ""}>{stream.malformedChunks} <span className="text-white/20">malformed</span></span>
      <span className="text-white/15">·</span>
      <span className={stream.jsonRepairCount > 0 ? "text-green-400" : ""}>{stream.jsonRepairCount} <span className="text-white/20">repaired</span></span>
      {stream.tokensPerSecond > 0 && (
        <>
          <span className="text-white/15">·</span>
          <span>{stream.tokensPerSecond.toFixed(0)} <span className="text-white/20">tok/s</span></span>
        </>
      )}
    </div>
  )
}

// ── Utility: isMalformedChunk ──

function isMalformedChunk(raw: string): boolean {
  const openBraces = (raw.match(/\{/g) ?? []).length
  const closeBraces = (raw.match(/\}/g) ?? []).length
  const openBrackets = (raw.match(/\[/g) ?? []).length
  const closeBrackets = (raw.match(/\]/g) ?? []).length
  return Math.abs(openBraces - closeBraces) > 3 || Math.abs(openBrackets - closeBrackets) > 3
}

// ── Main Component ──

export function StreamingDeltaInspector({ className, maxHeight }: StreamingDeltaInspectorProps) {
  const diagnostics = StreamDiagnostics.getInstance()

  const [streams, setStreams] = useState(diagnostics.getAllStreams())
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null)
  const [chunks, setChunks] = useState<ChunkRecord[]>([])
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null)
  const [toolCalls, setToolCalls] = useState<ToolCallReconstruction[]>([])
  const [showToolCalls, setShowToolCalls] = useState(true)
  const [showChunks, setShowChunks] = useState(true)
  const [filterType, setFilterType] = useState<"all" | "tool" | "malformed" | "repaired">("all")
  const [autoScroll, setAutoScroll] = useState(true)
  const chunkListRef = useRef<HTMLDivElement>(null)

  // Poll for stream data
  const latestStreamIdRef = useRef<string | null>(null)
  latestStreamIdRef.current = selectedStreamId

  useEffect(() => {
    const interval = setInterval(() => {
      const current = diagnostics.getAllStreams()
      setStreams(current)

      const sid = latestStreamIdRef.current
      if (sid) {
        const newChunks = diagnostics.getChunks(sid)
        setChunks((prev) => {
          if (prev.length !== newChunks.length || prev[0]?.index !== newChunks[0]?.index) {
            return newChunks
          }
          return prev
        })
        setToolCalls(diagnostics.getToolCallBuffers(sid))
      }
    }, 500)

    return () => clearInterval(interval)
  }, [diagnostics])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && chunkListRef.current) {
      chunkListRef.current.scrollTop = chunkListRef.current.scrollHeight
    }
  }, [chunks.length, autoScroll])

  // Select latest stream by default
  useEffect(() => {
    if (!selectedStreamId && streams.length > 0) {
      const latest = streams[streams.length - 1]
      setSelectedStreamId(latest.streamId)
      setChunks(diagnostics.getChunks(latest.streamId))
      setToolCalls(diagnostics.getToolCallBuffers(latest.streamId))
    }
  }, [streams, selectedStreamId, diagnostics])

  const handleSelectStream = useCallback((streamId: string) => {
    setSelectedStreamId(streamId)
    setChunks(diagnostics.getChunks(streamId))
    setToolCalls(diagnostics.getToolCallBuffers(streamId))
    setSelectedChunkIndex(null)
  }, [diagnostics])

  const handleClear = useCallback(() => {
    diagnostics.clear()
    setStreams([])
    setSelectedStreamId(null)
    setChunks([])
    setToolCalls([])
    setSelectedChunkIndex(null)
  }, [diagnostics])

  const filteredChunks = chunks.filter((c) => {
    if (filterType === "tool") return c.isToolCall
    if (filterType === "malformed") return isMalformedChunk(c.raw) && !c.jsonRepairApplied
    if (filterType === "repaired") return !!c.jsonRepairApplied
    return true
  })

  const selectedChunk = selectedChunkIndex !== null
    ? chunks[selectedChunkIndex] ?? null
    : null

  const activeToolCalls = toolCalls.filter((tc) =>
    !tc.validationErrors.length || tc.partialChunks.length > 0,
  )

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-cyan-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Stream Inspector</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "rounded p-0.5 transition-all",
              autoScroll ? "text-blue-400" : "text-white/20 hover:text-white/50",
            )}
            title="Auto-scroll"
          >
            {autoScroll ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
          </button>
          <button
            onClick={handleClear}
            className="rounded p-0.5 text-white/20 hover:text-red-400 transition-all"
            title="Clear all stream data"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Stream selector */}
      {streams.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.04] overflow-x-auto">
          {streams.map((s) => (
            <button
              key={s.streamId}
              onClick={() => handleSelectStream(s.streamId)}
              className={cn(
                "text-[8px] px-1.5 py-0.5 rounded font-mono transition-all shrink-0",
                selectedStreamId === s.streamId
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]",
              )}
            >
              {s.streamId.slice(0, 12)}…
              {s.endTime === null && (
                <Loader2 className="h-2 w-2 text-green-400 animate-spin inline ml-0.5" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Metrics bar */}
      <StreamingMetricsBar streamId={selectedStreamId} />

      {/* Filter tabs */}
      {chunks.length > 0 && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-white/[0.04]">
          {(["all", "tool", "malformed", "repaired"] as const).map((f) => {
            const count = f === "all" ? chunks.length
              : f === "tool" ? chunks.filter((c) => c.isToolCall).length
              : f === "malformed" ? chunks.filter((c) => isMalformedChunk(c.raw) && !c.jsonRepairApplied).length
              : chunks.filter((c) => c.jsonRepairApplied).length
            return (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={cn(
                  "text-[8px] px-1.5 py-0.5 rounded font-medium transition-all",
                  filterType === f
                    ? "bg-white/[0.08] text-white/70"
                    : "text-white/30 hover:text-white/50",
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Chunk list */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Chunks section */}
          {chunks.length > 0 && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <button
                onClick={() => setShowChunks(!showChunks)}
                className="flex items-center gap-1 px-2 py-1 text-[8px] font-medium text-white/30 hover:text-white/50 uppercase tracking-wider border-b border-white/[0.04]"
              >
                {showChunks ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                Packets ({filteredChunks.length})
              </button>
              {showChunks && (
                <div
                  ref={chunkListRef}
                  className="flex-1 overflow-y-auto"
                >
                  {filteredChunks.length === 0 ? (
                    <div className="flex items-center justify-center h-12 text-[8px] text-white/20">
                      No matching packets
                    </div>
                  ) : (
                    filteredChunks.map((chunk, i) => {
                      const realIndex = chunks.indexOf(chunk)
                      return (
                        <ChunkRow
                          key={`${realIndex}-${chunk.timestamp}`}
                          chunk={chunk}
                          index={realIndex}
                          isSelected={selectedChunkIndex === realIndex}
                          onClick={() => setSelectedChunkIndex(realIndex)}
                        />
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {chunks.length === 0 && (
            <div className="flex-1 flex items-center justify-center min-h-[120px]">
              <div className="text-center px-4">
                <Wifi className="h-5 w-5 text-white/15 mx-auto mb-1" />
                <p className="text-[10px] text-white/25">Waiting for stream data…</p>
                <p className="text-[8px] text-white/15 mt-0.5">
                  AI provider responses will be captured here
                </p>
              </div>
            </div>
          )}

          {/* Tool Calls */}
          {activeToolCalls.length > 0 && (
            <div className="border-t border-white/[0.06] shrink-0">
              <button
                onClick={() => setShowToolCalls(!showToolCalls)}
                className="flex items-center gap-1 px-2 py-1 text-[8px] font-medium text-white/30 hover:text-white/50 uppercase tracking-wider"
              >
                {showToolCalls ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                Tool Call Buffers ({activeToolCalls.length})
              </button>
              {showToolCalls && (
                <div className="px-2 pb-2 space-y-1 max-h-32 overflow-y-auto">
                  {activeToolCalls.map((tc) => (
                    <ToolCallCard key={`${tc.index}-${tc.id}`} tc={tc} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail panel (right side) */}
        {selectedChunk && (
          <div className="w-56 shrink-0 border-l border-white/[0.06] overflow-y-auto p-2">
            <ChunkDetailPanel chunk={selectedChunk} />
          </div>
        )}
      </div>

      {/* Active stream monitor at bottom */}
      <ActiveStreamMonitor />
    </div>
  )
}
