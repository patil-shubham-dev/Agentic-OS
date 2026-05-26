export interface FileSnapshot {
  id: string
  path: string
  content: string
  timestamp: number
  description: string
}

export class FileSnapshotManager {
  private snapshots: Map<string, FileSnapshot[]> = new Map()
  private maxSnapshotsPerFile: number

  constructor(maxSnapshotsPerFile: number = 20) {
    this.maxSnapshotsPerFile = maxSnapshotsPerFile
  }

  takeSnapshot(path: string, content: string, description: string = ""): FileSnapshot {
    const snapshot: FileSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      path,
      content,
      timestamp: Date.now(),
      description,
    }

    let history = this.snapshots.get(path)
    if (!history) {
      history = []
      this.snapshots.set(path, history)
    }

    history.push(snapshot)
    if (history.length > this.maxSnapshotsPerFile) {
      history.shift()
    }

    return snapshot
  }

  rollback(path: string): FileSnapshot | null {
    const history = this.snapshots.get(path)
    if (!history || history.length < 2) return null

    history.pop()
    const previous = history[history.length - 1]
    return previous
  }

  rollbackToSnapshot(snapshotId: string): FileSnapshot | null {
    for (const [, history] of this.snapshots) {
      const index = history.findIndex((s) => s.id === snapshotId)
      if (index !== -1) {
        const snapshot = history[index]
        history.splice(index + 1)
        return snapshot
      }
    }
    return null
  }

  rollbackToIndex(path: string, index: number): FileSnapshot | null {
    const history = this.snapshots.get(path)
    if (!history || index < 0 || index >= history.length) return null
    const snapshot = history[index]
    history.splice(index + 1)
    return snapshot
  }

  getSnapshots(path: string): FileSnapshot[] {
    return this.snapshots.get(path) ?? []
  }

  getLatestSnapshot(path: string): FileSnapshot | undefined {
    const history = this.snapshots.get(path)
    return history ? history[history.length - 1] : undefined
  }

  getSnapshot(snapshotId: string): FileSnapshot | undefined {
    for (const [, history] of this.snapshots) {
      const found = history.find((s) => s.id === snapshotId)
      if (found) return found
    }
    return undefined
  }

  clearPath(path: string): void {
    this.snapshots.delete(path)
  }

  clearAll(): void {
    this.snapshots.clear()
  }

  hasSnapshots(path: string): boolean {
    return (this.snapshots.get(path)?.length ?? 0) > 0
  }

  getSnapshotCount(path: string): number {
    return this.snapshots.get(path)?.length ?? 0
  }
}
