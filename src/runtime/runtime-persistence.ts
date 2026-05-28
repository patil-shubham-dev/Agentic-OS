const RUNTIME_STORAGE_KEY = "agentic-runtime-state"

export interface RuntimeSnapshot {
  lastProviders: number
  lastRoles: number
  lastWired: number
  lastBootTime: number | null
}

export function persistRuntimeSnapshot(snapshot: RuntimeSnapshot): void {
  try {
    localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // silently fail
  }
}

export function loadRuntimeSnapshot(): RuntimeSnapshot | null {
  try {
    const raw = localStorage.getItem(RUNTIME_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as RuntimeSnapshot
  } catch {
    // ignore corrupt data
  }
  return null
}

export function clearRuntimeSnapshot(): void {
  localStorage.removeItem(RUNTIME_STORAGE_KEY)
}
