import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export interface PtySession {
  id: string
  onData: (callback: (data: string) => void) => void
  onExit: (callback: (code: number | null) => void) => void
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
}

export function getPlatformShell(): string {
  if (navigator.platform.includes("Win")) return "cmd.exe"
  return "/bin/bash"
}

export async function ptySpawn(shell: string, cwd: string | null): Promise<PtySession> {
  const sessionId = await invoke<string>("pty_spawn", { shell, cwd: cwd ?? "" })

  const dataCallbacks: Array<(data: string) => void> = []
  const exitCallbacks: Array<(code: number | null) => void> = []
  let unlistenData: UnlistenFn | null = null
  let unlistenExit: UnlistenFn | null = null

  unlistenData = await listen<{ sessionId: string; data: string }>("pty-output", (event) => {
    if (event.payload.sessionId === sessionId) {
      for (const cb of dataCallbacks) cb(event.payload.data)
    }
  })

  unlistenExit = await listen<{ sessionId: string }>("pty-exit", (event) => {
    if (event.payload.sessionId === sessionId) {
      for (const cb of exitCallbacks) cb(0)
    }
  })

  return {
    id: sessionId,
    onData: (cb) => { dataCallbacks.push(cb) },
    onExit: (cb) => { exitCallbacks.push(cb) },
    write: (data) => { invoke("pty_write", { sessionId, data }).catch(() => {}) },
    resize: (cols, rows) => { invoke("pty_resize", { sessionId, cols, rows }).catch(() => {}) },
    kill: () => {
      invoke("pty_kill", { sessionId }).catch(() => {})
      unlistenData?.()
      unlistenExit?.()
    },
  }
}
