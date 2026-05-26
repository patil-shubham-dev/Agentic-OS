import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { ReplayEngine, type ReplayProgress } from "@/runtime/observability/ReplayEngine"
import type { ReplaySegment, ReplayState } from "@/runtime/observability/ObservabilityTypes"
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Activity,
  Zap,
  CircleDot,
  Disc,
  RotateCcw,
  Trash2,
} from "lucide-react"

interface ReplayPanelProps {
  className?: string
}

const POLL_INTERVAL = 100
const SPEED_OPTIONS: { label: string; value: 0.25 | 0.5 | 1 | 2 | 4 }[] = [
  { label: "0.25×", value: 0.25 },
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
]

// ── Color palette for segments ──

const SEGMENT_COLORS: Record<string, string> = {
  "coordinator-plan": "bg-blue-500",
  "context-assembly": "bg-cyan-500",
  retrieval: "bg-amber-500",
  "provider-connect": "bg-purple-500",
  "streaming-reasoning": "bg-emerald-500",
  "tool-execution": "bg-orange-500",
  synthesis: "bg-pink-500",
  "memory-propagation": "bg-violet-500",
}

const SEGMENT_BORDER_COLORS: Record<string, string> = {
  "coordinator-plan": "border-blue-500/40",
  "context-assembly": "border-cyan-500/40",
  retrieval: "border-amber-500/40",
  "provider-connect": "border-purple-500/40",
  "streaming-reasoning": "border-emerald-500/40",
  "tool-execution": "border-orange-500/40",
  synthesis: "border-pink-500/40",
  "memory-propagation": "border-violet-500/40",
}

function getSegmentColor(name: string): string {
  return SEGMENT_COLORS[name] ?? "bg-gray-500"
}

function getSegmentBorderColor(name: string): string {
  return SEGMENT_BORDER_COLORS[name] ?? "border-gray-500/40"
}

// ── Format helpers ──

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

// ── Empty State ──

function EmptyState({ onCreateSeed }: { onCreateSeed: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[200px]">
      <div className="text-center px-6">
        <Disc className="h-8 w-8 text-white/10 mx-auto mb-2" />
        <p className="text-[11px] text-white/30 font-medium mb-1">No Recordings</p>
        <p className="text-[9px] text-white/20 mb-3 max-w-[200px]">
          Record an execution session or generate a demo trace to explore the replay system.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={onCreateSeed}
            className="text-[9px] px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-all"
          >
            Generate Demo Trace
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Playback Controls ──

function PlaybackControls({
  isPlaying,
  isPaused,
  speed,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onStepBack,
  onStepForward,
}: {
  isPlaying: boolean
  isPaused: boolean
  speed: number
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSpeedChange: (speed: 0.25 | 0.5 | 1 | 2 | 4) => void
  onStepBack: () => void
  onStepForward: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-1 px-2 py-1.5 border-t border-white/5">
      {/* Step back */}
      <button
        onClick={onStepBack}
        className="p-1 text-white/30 hover:text-white/60 transition-colors"
        title="Step back"
      >
        <SkipBack className="h-3 w-3" />
      </button>

      {/* Play/Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        className={cn(
          "p-1.5 rounded-full transition-all",
          isPlaying
            ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
            : "bg-green-500/15 text-green-300 hover:bg-green-500/25",
        )}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>

      {/* Stop */}
      <button
        onClick={onStop}
        className="p-1 text-white/30 hover:text-white/60 transition-colors"
        title="Stop"
      >
        <Square className="h-3 w-3" />
      </button>

      {/* Step forward */}
      <button
        onClick={onStepForward}
        className="p-1 text-white/30 hover:text-white/60 transition-colors"
        title="Step forward"
      >
        <SkipForward className="h-3 w-3" />
      </button>

      {/* Speed selector */}
      <div className="ml-2 flex items-center gap-0.5">
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSpeedChange(opt.value)}
            className={cn(
              "text-[8px] px-1.5 py-0.5 rounded transition-all font-mono",
              speed === opt.value
                ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                : "text-white/30 hover:text-white/50 border border-transparent",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Timeline Scrubber ──

function TimelineScrubber({
  progress,
  onSeek,
}: {
  progress: ReplayProgress
  onSeek: (time: number) => void
}) {
  const scrubRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)

  const handleInteraction = useCallback(
    (clientX: number) => {
      const rect = scrubRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const pct = x / rect.width
      const time = progress.startTime + pct * progress.durationMs
      onSeek(time)
    },
    [progress.startTime, progress.durationMs, onSeek],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true)
      handleInteraction(e.clientX)
    },
    [handleInteraction],
  )

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: MouseEvent) => handleInteraction(e.clientX)
    const handleUp = () => setIsDragging(false)
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [isDragging, handleInteraction])

  const cursorPct = ((progress.currentTime - progress.startTime) / progress.durationMs) * 100

  return (
    <div className="px-2 py-1.5">
      <div
        ref={scrubRef}
        className="relative h-7 bg-white/[0.04] rounded-md cursor-pointer overflow-hidden border border-white/5"
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          const rect = scrubRef.current?.getBoundingClientRect()
          if (!rect) return
          const x = (e.clientX - rect.left) / rect.width
          setHoverTime(progress.startTime + x * progress.durationMs)
        }}
        onMouseLeave={() => setHoverTime(null)}
      >
        {/* Segment blocks */}
        {progress.segments.map((seg, i) => {
          const left = ((seg.startTime - progress.startTime) / progress.durationMs) * 100
          const width = (seg.durationMs / progress.durationMs) * 100
          return (
            <div
              key={seg.spanId}
              className={cn(
                "absolute top-0.5 bottom-0.5 rounded-sm transition-opacity",
                getSegmentColor(seg.spans[0]?.name ?? ""),
                i === progress.currentSegmentIndex ? "opacity-90 ring-1 ring-white/20" : "opacity-40",
              )}
              style={{ left: `${left}%`, width: `${Math.max(0.5, width)}%` }}
              title={`${seg.spans[0]?.name ?? seg.spanId}: ${formatTime(seg.durationMs)}`}
            />
          )
        })}

        {/* Playhead */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-0.5 bg-white/80 z-10 transition-opacity pointer-events-none",
            isDragging ? "opacity-100" : "opacity-70",
          )}
          style={{ left: `${cursorPct}%`, transform: "translateX(-50%)" }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-lg" />
        </div>

        {/* Hover time indicator */}
        {hoverTime !== null && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[7px] bg-white/10 text-white/60 px-1 rounded">
            {formatTime(hoverTime - progress.startTime)}
          </div>
        )}

        {/* Current time label */}
        <div className="absolute bottom-0.5 left-1.5 text-[7px] text-white/30 font-mono pointer-events-none">
          {formatTime(progress.currentTime - progress.startTime)}
        </div>
        <div className="absolute bottom-0.5 right-1.5 text-[7px] text-white/20 font-mono pointer-events-none">
          {formatTime(progress.durationMs)}
        </div>
      </div>
    </div>
  )
}

// ── Segment List ──

function SegmentList({
  segments,
  currentIndex,
  onSegmentClick,
  onSeek,
}: {
  segments: ReplaySegment[]
  currentIndex: number
  onSegmentClick: (idx: number) => void
  onSeek: (time: number) => void
}) {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set())

  const toggleExpand = (spanId: string) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev)
      if (next.has(spanId)) next.delete(spanId)
      else next.add(spanId)
      return next
    })
  }

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="text-[9px] text-white/25">No segments</span>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 px-2 pb-2">
      {segments.map((seg, idx) => {
        const spanName = seg.spans[0]?.name ?? seg.spanId
        const isActive = idx === currentIndex
        const isExpanded = expandedSegments.has(seg.spanId)

        return (
          <div
            key={seg.spanId}
            className={cn(
              "rounded border transition-all",
              isActive
                ? "bg-white/[0.04] border-blue-500/30"
                : "bg-white/[0.015] border-white/5 hover:border-white/10",
            )}
          >
            <button
              onClick={() => {
                onSegmentClick(idx)
                onSeek(seg.startTime)
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
            >
              <div className={cn("h-2 w-2 rounded-full shrink-0", getSegmentColor(spanName))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "text-[9px] font-medium truncate",
                    isActive ? "text-white/80" : "text-white/50",
                  )}>
                    {spanName}
                  </span>
                  <span className="text-[7px] text-white/20">{seg.events.length} events</span>
                </div>
                <div className="text-[7px] text-white/25 font-mono">
                  {formatTime(seg.durationMs)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand(seg.spanId)
                }}
                className="p-0.5 text-white/20 hover:text-white/50"
              >
                {isExpanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
              </button>
            </button>

            {isExpanded && (
              <div className="px-2 pb-1.5 pt-0.5 border-t border-white/5 space-y-0.5">
                {seg.events.length === 0 ? (
                  <div className="text-[8px] text-white/15 text-center py-1">No events recorded</div>
                ) : (
                  seg.events.map((evt, ei) => (
                    <div key={ei} className="flex items-center gap-1 text-[7px] text-white/30">
                      <CircleDot className="h-1.5 w-1.5 shrink-0 text-white/15" />
                      <span className="font-mono text-white/20">{evt.type}</span>
                      <span className="text-white/15 ml-auto">
                        +{formatTime(evt.timestamp - seg.startTime)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Trace Selector ──

function TraceSelector({
  traceIds,
  activeTraceId,
  onSelect,
  onDelete,
}: {
  traceIds: string[]
  activeTraceId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (traceIds.length <= 1) return null

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-white/5 overflow-x-auto">
      {traceIds.map((id) => (
        <div key={id} className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onSelect(id)}
            className={cn(
              "text-[8px] px-1.5 py-0.5 rounded font-mono transition-all",
              id === activeTraceId
                ? "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                : "text-white/30 hover:text-white/60 border border-transparent",
            )}
          >
            {id.slice(0, 10)}…
          </button>
          <button
            onClick={() => onDelete(id)}
            className="p-0.5 text-white/15 hover:text-red-400 transition-colors"
            title="Remove trace"
          >
            <Trash2 className="h-2 w-2" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Current Segment Inspector ──

function SegmentInspector({ segment, progress }: { segment: ReplaySegment | null; progress: ReplayProgress }) {
  if (!segment) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-center">
          <Layers className="h-4 w-4 text-white/10 mx-auto mb-1" />
          <div className="text-[9px] text-white/20">No segment selected</div>
        </div>
      </div>
    )
  }

  const span = segment.spans[0]
  const spanName = span?.name ?? "unknown"

  return (
    <div className="px-2 pb-2 space-y-1.5">
      {/* Segment header */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded border",
        getSegmentBorderColor(spanName),
      )}>
        <div className={cn("h-2 w-2 rounded-full shrink-0", getSegmentColor(spanName))} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-white/70 truncate">{spanName}</div>
          <div className="text-[7px] text-white/25 font-mono">
            {segment.events.length} events · {formatTime(segment.durationMs)}
          </div>
        </div>
        <div className="text-[8px] text-white/30 font-mono text-right">
          +{formatTime(segment.startTime - progress.startTime)}
        </div>
      </div>

      {/* Segment details grid */}
      {span && (
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-white/[0.02] rounded px-1.5 py-1">
            <span className="text-[7px] text-white/20 uppercase block">Kind</span>
            <span className="text-[8px] text-white/50 font-mono">{span.kind}</span>
          </div>
          <div className="bg-white/[0.02] rounded px-1.5 py-1">
            <span className="text-[7px] text-white/20 uppercase block">Status</span>
            <span className={cn(
              "text-[8px] font-mono",
              span.status === "ok" ? "text-green-400" : span.status === "error" ? "text-red-400" : "text-white/40",
            )}>
              {span.status}
            </span>
          </div>
          <div className="bg-white/[0.02] rounded px-1.5 py-1">
            <span className="text-[7px] text-white/20 uppercase block">Duration</span>
            <span className="text-[8px] text-white/50 font-mono">{formatTime(segment.durationMs)}</span>
          </div>
        </div>
      )}

      {/* Events list */}
      {segment.events.length > 0 && (
        <div>
          <div className="text-[8px] text-white/25 font-medium uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <Activity className="h-2 w-2" />
            Events ({segment.events.length})
          </div>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {segment.events.map((evt, i) => (
              <div
                key={i}
                className="flex items-center gap-1 text-[7px] font-mono bg-white/[0.015] rounded px-1.5 py-0.5"
              >
                <CircleDot className="h-1.5 w-1.5 shrink-0 text-white/15" />
                <span className="text-white/40 w-16 shrink-0">{evt.type.slice(0, 16)}</span>
                <span className="text-white/20">+{formatTime(evt.timestamp - segment.startTime)}</span>
                <span className="text-white/15 ml-auto">{evt.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Progress Stats Bar ──

function ProgressStats({ progress }: { progress: ReplayProgress }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-white/5">
      <div className="flex items-center gap-1 text-[8px] text-white/30">
        <Clock className="h-2.5 w-2.5" />
        <span className="font-mono">{formatTime(progress.currentTime - progress.startTime)}</span>
        <span className="text-white/15">/</span>
        <span className="font-mono text-white/20">{formatTime(progress.durationMs)}</span>
      </div>
      <div className="flex items-center gap-1 text-[8px] text-white/30">
        <Activity className="h-2.5 w-2.5" />
        <span>{progress.currentSegmentIndex + 1}/{progress.segments.length}</span>
      </div>
      <div className="flex items-center gap-1 text-[8px] text-white/30">
        <Zap className="h-2.5 w-2.5" />
        <span>{progress.eventsPlayed}/{progress.totalEvents}</span>
      </div>
      <div className="flex-1 text-right">
        <span className={cn(
          "text-[8px] font-mono",
          progress.isPlaying ? "text-green-400" : "text-white/20",
        )}>
          {progress.isPlaying ? `▶ ${progress.speed}×` : "⏸ paused"}
        </span>
      </div>
    </div>
  )
}

// ── Main Panel ──

export function ReplayPanel({ className }: ReplayPanelProps) {
  const engine = ReplayEngine.getInstance()
  const [activeTraceId, setActiveTraceId] = useState<string>("")
  const [progress, setProgress] = useState<ReplayProgress | null>(null)
  const [traceIds, setTraceIds] = useState<string[]>([])
  const seedCounterRef = useRef(0)

  // Poll for trace IDs
  useEffect(() => {
    const refresh = () => setTraceIds(engine.getAllTraceIds())
    refresh()
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [engine])

  // Auto-select first trace when list changes
  useEffect(() => {
    if (traceIds.length > 0 && !traceIds.includes(activeTraceId)) {
      const id = traceIds[0]
      setActiveTraceId(id)
      engine.createReplayState(id, false)
      setProgress(engine.getProgress(id))
    }
  }, [traceIds, activeTraceId, engine])

  // Subscribe to progress updates
  useEffect(() => {
    if (!activeTraceId) return
    const unsub = engine.onProgress(activeTraceId, (p) => setProgress(p))
    return unsub
  }, [activeTraceId, engine])

  // Fallback polling for progress
  useEffect(() => {
    if (!activeTraceId) return
    const interval = setInterval(() => {
      const p = engine.getProgress(activeTraceId)
      if (p) setProgress(p)
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [activeTraceId, engine])

  // ── Handlers ──

  const handleCreateSeed = useCallback(() => {
    seedCounterRef.current++
    const traceId = `demo_${Date.now()}_${seedCounterRef.current}`
    engine.generateSeedData(traceId)
    engine.createReplayState(traceId, false)
    setActiveTraceId(traceId)
    setProgress(engine.getProgress(traceId))
  }, [engine])

  const handlePlay = useCallback(() => {
    if (!activeTraceId) return
    // Ensure state exists
    if (!engine.getReplayState(activeTraceId)) {
      engine.createReplayState(activeTraceId, true)
    }
    engine.play(activeTraceId)
  }, [activeTraceId, engine])

  const handlePause = useCallback(() => {
    if (!activeTraceId) return
    engine.pause(activeTraceId)
  }, [activeTraceId, engine])

  const handleStop = useCallback(() => {
    if (!activeTraceId) return
    engine.stop(activeTraceId)
  }, [activeTraceId, engine])

  const handleSpeedChange = useCallback(
    (speed: 0.25 | 0.5 | 1 | 2 | 4) => {
      if (!activeTraceId) return
      engine.setSpeed(activeTraceId, speed)
    },
    [activeTraceId, engine],
  )

  const handleSeek = useCallback(
    (time: number) => {
      if (!activeTraceId) return
      engine.seek(activeTraceId, time)
    },
    [activeTraceId, engine],
  )

  const handleSegmentClick = useCallback(
    (idx: number) => {
      if (!activeTraceId || !progress) return
      const seg = progress.segments[idx]
      if (seg) {
        handleSeek(seg.startTime)
      }
    },
    [activeTraceId, progress, handleSeek],
  )

  const handleStepBack = useCallback(() => {
    if (!activeTraceId || !progress) return
    const prevIdx = Math.max(0, progress.currentSegmentIndex - 1)
    const seg = progress.segments[prevIdx]
    if (seg) {
      engine.seek(activeTraceId, seg.startTime)
    }
  }, [activeTraceId, progress, engine])

  const handleStepForward = useCallback(() => {
    if (!activeTraceId || !progress) return
    const nextIdx = Math.min(progress.segments.length - 1, progress.currentSegmentIndex + 1)
    const seg = progress.segments[nextIdx]
    if (seg) {
      engine.seek(activeTraceId, seg.startTime)
    }
  }, [activeTraceId, progress, engine])

  const handleSelectTrace = useCallback(
    (id: string) => {
      setActiveTraceId(id)
      if (!engine.getReplayState(id)) {
        engine.createReplayState(id, false)
      }
      setProgress(engine.getProgress(id))
    },
    [engine],
  )

  const handleDeleteTrace = useCallback(
    (id: string) => {
      engine.removeTrace(id)
      if (id === activeTraceId) {
        const remaining = engine.getAllTraceIds()
        if (remaining.length > 0) {
          handleSelectTrace(remaining[0])
        } else {
          setActiveTraceId("")
          setProgress(null)
        }
      }
    },
    [activeTraceId, engine, handleSelectTrace],
  )

  const state = activeTraceId ? engine.getReplayState(activeTraceId) : undefined

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/6 shrink-0">
        <div className="flex items-center gap-1.5">
          <RotateCcw className="h-3 w-3 text-amber-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Replay</span>
          {progress && (
            <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">
              {Math.round(progress.progress * 100)}%
            </span>
          )}
        </div>
        <button
          onClick={handleCreateSeed}
          className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-all"
        >
          + Demo
        </button>
      </div>

      {/* Trace selector */}
      <TraceSelector
        traceIds={traceIds}
        activeTraceId={activeTraceId}
        onSelect={handleSelectTrace}
        onDelete={handleDeleteTrace}
      />

      {/* Empty state */}
      {!progress && (
        <EmptyState onCreateSeed={handleCreateSeed} />
      )}

      {/* Main content */}
      {progress && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Progress stats */}
          <ProgressStats progress={progress} />

          {/* Timeline scrubber */}
          <TimelineScrubber progress={progress} onSeek={handleSeek} />

          {/* Segment list (scrollable) */}
          <div className="flex-1 overflow-y-auto border-t border-white/5">
            <div className="flex items-center gap-1 px-2 py-1 text-[8px] text-white/25 uppercase tracking-wider font-medium">
              <Layers className="h-2 w-2" />
              Segments
              <span className="text-white/15 ml-auto">{progress.segments.length} total</span>
            </div>
            <SegmentList
              segments={progress.segments}
              currentIndex={progress.currentSegmentIndex}
              onSegmentClick={handleSegmentClick}
              onSeek={handleSeek}
            />
          </div>

          {/* Current segment inspector */}
          <div className="border-t border-white/5">
            <div className="flex items-center gap-1 px-2 py-1 text-[8px] text-white/25 uppercase tracking-wider font-medium">
              <Activity className="h-2 w-2" />
              Current Segment
            </div>
            <SegmentInspector segment={progress.currentSegment} progress={progress} />
          </div>

          {/* Playback controls (fixed at bottom) */}
          <PlaybackControls
            isPlaying={progress.isPlaying}
            isPaused={!!state?.isPaused}
            speed={progress.speed}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onSpeedChange={handleSpeedChange}
            onStepBack={handleStepBack}
            onStepForward={handleStepForward}
          />
        </div>
      )}
    </div>
  )
}
