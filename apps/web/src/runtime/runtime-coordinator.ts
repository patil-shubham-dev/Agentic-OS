import { useWorkspaceRuntime } from "./workspace-runtime"

type RefreshSource = "config_change" | "workspace_change" | "manual" | "recovery"

interface RefreshRequest {
  source: RefreshSource
  timestamp: number
}

let pending: RefreshRequest | null = null
let scheduled = false

const LOG_PREFIX = "[RuntimeCoordinator]"

function schedule(): void {
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    const req = pending
    pending = null
    if (req) {
      const elapsed = performance.now() - req.timestamp
      console.debug(`${LOG_PREFIX} processing refresh (source=${req.source}, queued=${Math.round(elapsed)}ms)`)
      useWorkspaceRuntime.getState().refresh()
    }
  })
}

export function requestRefresh(source: RefreshSource): void {
  if (source === "recovery") {
    pending = null
    scheduled = false
    useWorkspaceRuntime.getState().refresh()
    return
  }
  if (!pending || pending.source !== "config_change") {
    pending = { source, timestamp: performance.now() }
  }
  schedule()
}

export function cancelPendingRefresh(): void {
  pending = null
  scheduled = false
}
