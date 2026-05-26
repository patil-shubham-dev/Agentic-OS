import type { AppState, RuntimeRole } from "@/types"
import { useAppStore } from "@/stores/app-store"
import { useAgentStore } from "@/stores/agent-store"

const VALID_TRANSITIONS: Record<AppState, AppState[]> = {
  idle: ["coding", "designing", "testing"],
  coding: ["idle", "designing", "testing"],
  designing: ["idle", "coding", "testing"],
  testing: ["idle", "coding", "designing"],
}

export function isValidTransition(from: AppState, to: AppState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionTo(to: AppState): boolean {
  const from = useAppStore.getState().appState
  if (!isValidTransition(from, to)) {
    console.warn(`Invalid state transition: ${from} → ${to}`)
    return false
  }
  // Ensure no agent is processing before transitioning away from idle
  if (from !== "idle" && to === "idle") {
    const isProcessing = useAgentStore.getState().isProcessing
    if (isProcessing) return false
  }
  useAppStore.getState().setAppState(to)
  return true
}

// File locking

const fileLocks = new Set<string>()

export function lockFile(path: string, _agentRole: RuntimeRole): boolean {
  if (fileLocks.has(path)) return false
  fileLocks.add(path)
  return true
}

export function unlockFile(path: string): void {
  fileLocks.delete(path)
}

export function isFileLocked(path: string): boolean {
  return fileLocks.has(path)
}

export function getLockedFiles(): string[] {
  return Array.from(fileLocks)
}

export function clearAllLocks(): void {
  fileLocks.clear()
}

// Execution lock

let executionLock: RuntimeRole | null = null

export function acquireExecutionLock(agentRole: RuntimeRole): boolean {
  if (executionLock !== null && executionLock !== agentRole) return false
  executionLock = agentRole
  return true
}

export function releaseExecutionLock(agentRole: RuntimeRole): void {
  if (executionLock === agentRole) {
    executionLock = null
  }
}

export function getExecutionLockOwner(): RuntimeRole | null {
  return executionLock
}
