import { useRef, useEffect, useMemo } from "react"
import { Brain, Loader2 } from "lucide-react"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"
import { CinematicTokenStream } from "./CinematicTokenStream"

interface StreamingReasoningPanelProps {
  className?: string
  maxHeight?: string
}

export function StreamingReasoningPanel({ className, maxHeight }: StreamingReasoningPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const streamText = useRuntimeProjectionStore((s) => s.activeStreamText)
  const reasoningText = useRuntimeProjectionStore((s) => s.activeReasoningText)
  const currentState = useRuntimeProjectionStore((s) => s.currentState)
  const isStreaming = currentState === "Executing" || currentState === "Planning"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamText, reasoningText])

  if (!streamText && !reasoningText && !isStreaming) {
    return null
  }

  return (
    <div
      className={`rounded-lg border border-white/8 bg-white/[0.02] overflow-hidden ${className ?? ""}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8">
        <Brain className="h-3.5 w-3.5 text-indigo-400" />
        <span className="text-[10px] font-medium text-white/50">Reasoning</span>
        {isStreaming && <Loader2 className="h-3 w-3 text-indigo-400 animate-spin ml-auto" />}
      </div>

      <div
        ref={scrollRef}
        className="overflow-y-auto px-3 py-2 max-h-[inherit]"
        style={{ maxHeight: maxHeight ? `calc(${maxHeight} - 32px)` : undefined }}
      >
        {reasoningText && (
          <div className="text-[10px] text-indigo-400/60 italic leading-relaxed mb-2 whitespace-pre-wrap">
            {reasoningText}
          </div>
        )}
        {streamText && (
          <div className="text-[11px] text-white/70 font-mono leading-relaxed whitespace-pre-wrap">
            {isStreaming ? (
              <CinematicTokenStream tokens={streamText.split(/(?<=\s)/)} />
            ) : (
              streamText
            )}
          </div>
        )}
        {!streamText && !reasoningText && isStreaming && (
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            <Loader2 className="h-3 w-3 animate-spin" />
            Waiting for response...
          </div>
        )}
      </div>
    </div>
  )
}
