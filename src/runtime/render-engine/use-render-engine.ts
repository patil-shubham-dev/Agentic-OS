import { useEffect } from "react"
import { UiSync } from "./ui-sync"
import { RenderMetrics } from "./render-metrics"
import { useTimelineStore } from "@/components/workspace/timeline/timeline-store"

/**
 * Initializes the render engine subsystems.
 * Call this once at the app root level.
 */
export function useRenderEngine() {
  useEffect(() => {
    const uiSync = UiSync.getInstance()
    const renderMetrics = RenderMetrics.getInstance()

    renderMetrics.setActiveStepCardsProvider(() => {
      try {
        let count = 0
        for (const session of useTimelineStore.getState().agentSessions.values()) {
          if (session.status === "running") count++
        }
        return count
      } catch {
        return 0
      }
    })

    uiSync.start()
    renderMetrics.start()

    return () => {
      uiSync.stop()
      renderMetrics.stop()
    }
  }, [])
}
