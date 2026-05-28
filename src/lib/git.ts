export interface GitStatus {
  branch: string
  changes: GitChange[]
  ahead: number
  behind: number
}

export interface GitChange {
  path: string
  status: string
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  timestamp: string
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core")
    return await tauriInvoke<T>(cmd, args)
  } catch {
    throw new Error(`Tauri command "${cmd}" not available in web mode`)
  }
}

export async function gitStatus(workingDir: string): Promise<GitStatus> {
  return await invoke<GitStatus>("git_status", { workingDir })
}

export async function gitLog(workingDir: string, maxCount?: number): Promise<GitCommit[]> {
  return await invoke<GitCommit[]>("git_log", { workingDir, maxCount: maxCount ?? 20 })
}

export async function gitDiff(workingDir: string, file: string): Promise<string> {
  return await invoke<string>("git_diff", { workingDir, file })
}

export async function gitCommit(workingDir: string, message: string): Promise<string> {
  return await invoke<string>("git_commit", { workingDir, message })
}

export async function gitRestore(workingDir: string, file: string): Promise<string> {
  return await invoke<string>("git_restore", { workingDir, file })
}

export async function gitInit(workingDir: string): Promise<string> {
  return await invoke<string>("git_init", { workingDir })
}
