import { RuntimeKernel } from "./RuntimeKernel"
import { EventBusService, StorageService, WorkspaceRuntimeService } from "./services"
import { useAppStore } from "@/stores/app-store"
import { validateRegistryIntegrity, printRuntimeDiagnostics } from "@/runtime/runtime-role-registry"
import { detectSafeMode, isInSafeMode } from "@/core/crash-handling/safe-mode"
import type { BootReport } from "./types"

let _kernel: RuntimeKernel | null = null

export function getKernel(): RuntimeKernel {
  if (!_kernel) {
    _kernel = new RuntimeKernel()
  }
  return _kernel
}

export async function bootRuntime(): Promise<BootReport> {
  // Phase 1: detect safe mode
  const safeMode = detectSafeMode()
  if (safeMode.enabled) {
    console.warn(`[Startup] SAFE MODE: ${safeMode.reason}`)
  }

  // Phase 2: initialize default roles + validate integrity
  const state = useAppStore.getState()
  if (state.roleConfigs.length === 0) {
    state.initializeDefaultRoles()
  }

  const integrity = validateRegistryIntegrity()
  if (!integrity.valid) {
    console.error("[Startup] Registry integrity FAILED:", integrity.issues)
  }
  printRuntimeDiagnostics()

  // Phase 3: bootstrap kernel services
  const kernel = getKernel()

  if (!safeMode.enabled || safeMode.features.extensions) {
    kernel.register(new EventBusService())
  }

  kernel.register(new StorageService())

  if (!isInSafeMode()) {
    kernel.register(new WorkspaceRuntimeService())
  }

  const report = await kernel.boot()
  return report
}

export async function shutdownRuntime(): Promise<void> {
  const kernel = getKernel()
  await kernel.shutdown()
}
