export interface FileSnapshot {
  path: string
  content: string
  timestamp: string
  description: string
}

export interface DiffHunk {
  old_start: number
  old_count: number
  new_start: number
  new_count: number
  lines: string[]
}

export interface DiffResult {
  path: string
  old_content: string
  new_content: string
  hunks: DiffHunk[]
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core")
    return await tauriInvoke<T>(cmd, args)
  } catch {
    throw new Error(`Tauri command "${cmd}" not available in web mode`)
  }
}

export async function saveSnapshot(path: string, content: string, description: string): Promise<void> {
  await invoke("save_snapshot", { path, content, description })
}

export async function getHistory(path: string): Promise<FileSnapshot[]> {
  return await invoke<FileSnapshot[]>("get_history", { path })
}

export async function rollbackTo(path: string, timestamp: string): Promise<string> {
  return await invoke<string>("rollback_to", { path, timestamp })
}

export async function computeDiff(oldContent: string, newContent: string): Promise<DiffResult> {
  return await invoke<DiffResult>("compute_diff", { oldContent, newContent })
}
