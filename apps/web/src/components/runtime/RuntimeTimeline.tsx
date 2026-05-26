import { useRef, useEffect } from "react"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"
import { RuntimeEventCard } from "./RuntimeEventCard"

interface RuntimeTimelineProps {
  className?: string
  maxHeight?: string
}

export function RuntimeTimeline({ className, maxHeight }: RuntimeTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const events = useRuntimeProjectionStore((s) => s.projectedEvents)
  const prevCountRef = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    const count = events.length
    if (el && count > prevCountRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
    prevCountRef.current = count
  })

  if (events.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full min-h-[100px] ${className ?? ""}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <div className="text-center px-4">
          <div className="text-[11px] text-white/25 font-medium mb-1">No events yet</div>
          <div className="text-[10px] text-white/15">Runtime events will appear here</div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={`overflow-y-auto ${className ?? ""}`}
      style={maxHeight ? { maxHeight } : undefined}
      role="log"
      aria-label="Runtime execution timeline"
      aria-live="polite"
    >
      <div className="space-y-0.5 py-2 px-2">
        {events.map((event) => (
          <RuntimeEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
