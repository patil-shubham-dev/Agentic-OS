import { FileSnapshotManager, type FileSnapshot } from "./FileSnapshotManager"

export interface PatchRecord {
  id: string
  path: string
  timestamp: number
  description: string
  snapshotId: string
  rolledBack: boolean
}

export class PatchRollbackEngine {
  private patches: PatchRecord[] = []
  private snapshotManager: FileSnapshotManager
  private maxPatches: number

  constructor(snapshotManager: FileSnapshotManager, maxPatches: number = 50) {
    this.snapshotManager = snapshotManager
    this.maxPatches = maxPatches
  }

  recordPatch(path: string, description: string, snapshotId: string): PatchRecord {
    const record: PatchRecord = {
      id: `patch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      path,
      timestamp: Date.now(),
      description,
      snapshotId,
      rolledBack: false,
    }

    this.patches.push(record)
    if (this.patches.length > this.maxPatches) {
      this.patches.shift()
    }

    return record
  }

  rollback(patchId: string): FileSnapshot | null {
    const patch = this.patches.find((p) => p.id === patchId)
    if (!patch || patch.rolledBack) return null

    const snapshot = this.snapshotManager.rollbackToSnapshot(patch.snapshotId)
    if (!snapshot) return null

    patch.rolledBack = true
    return snapshot
  }

  rollbackLast(path: string): FileSnapshot | null {
    const patch = this.getLastPatch(path)
    if (!patch) return null
    return this.rollback(patch.id)
  }

  rollbackAll(path: string): FileSnapshot | null {
    const pathPatches = this.patches.filter((p) => p.path === path && !p.rolledBack)
    if (pathPatches.length === 0) return null

    const firstPatch = pathPatches[0]
    const snapshot = this.snapshotManager.rollbackToSnapshot(firstPatch.snapshotId)
    if (!snapshot) return null

    for (const p of pathPatches) {
      p.rolledBack = true
    }

    return snapshot
  }

  getPatch(patchId: string): PatchRecord | undefined {
    return this.patches.find((p) => p.id === patchId)
  }

  getPatches(path: string): PatchRecord[] {
    return this.patches.filter((p) => p.path === path)
  }

  getLastPatch(path: string): PatchRecord | undefined {
    const pathPatches = this.patches.filter((p) => p.path === path && !p.rolledBack)
    return pathPatches[pathPatches.length - 1]
  }

  getAllPatches(): PatchRecord[] {
    return [...this.patches]
  }

  getUnrolledBackPatches(): PatchRecord[] {
    return this.patches.filter((p) => !p.rolledBack)
  }

  canRollback(path: string): boolean {
    return this.getLastPatch(path) !== undefined
  }

  clearPath(path: string): void {
    this.patches = this.patches.filter((p) => p.path !== path)
  }

  clearAll(): void {
    this.patches = []
  }
}
