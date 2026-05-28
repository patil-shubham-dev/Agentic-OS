import { EventBus } from "@/runtime/EventBus"

export interface TerminalRunResult {
  command: string
  output: string
  exitCode: number
  durationMs: number
}

async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await import("@tauri-apps/api/core")
  return core.invoke<T>(cmd, args)
}

export class TerminalRuntime {
  private static instance: TerminalRuntime
  private eventBus = EventBus.getInstance()

  static getInstance(): TerminalRuntime {
    if (!TerminalRuntime.instance) {
      TerminalRuntime.instance = new TerminalRuntime()
    }
    return TerminalRuntime.instance
  }

  async run(
    command: string,
    cwd: string | null,
    options?: { stepId?: string; role?: string }
  ): Promise<TerminalRunResult> {
    const stepId = options?.stepId ?? `terminal-${Date.now()}`
    const role = options?.role ?? "runtime"
    const startedAt = performance.now()

    this.eventBus.emit({
      type: "COMMAND_START",
      stepId,
      role,
      command,
      timestamp: Date.now(),
    } as any)

    const rawResult = await invoke<unknown>("run_command", {
      workingDir: cwd,
      command,
      args: [],
    })

    const durationMs = Math.round(performance.now() - startedAt)
    const output = typeof rawResult === "string"
      ? rawResult
      : JSON.stringify(rawResult, null, 2)

    this.eventBus.emit({
      type: "COMMAND_OUTPUT",
      stepId,
      output,
    } as any)

    this.eventBus.emit({
      type: "COMMAND_COMPLETE",
      stepId,
      exitCode: 0,
      durationMs,
    } as any)

    return {
      command,
      output,
      exitCode: 0,
      durationMs,
    }
  }

  async *runStream(
    command: string,
    cwd: string | null,
    options?: { stepId?: string; role?: string }
  ): AsyncGenerator<{ type: "COMMAND_START" | "OUTPUT_LINE" | "COMMAND_COMPLETE"; line?: string; exitCode?: number }> {
    const stepId = options?.stepId ?? `terminal-${Date.now()}`
    const role = options?.role ?? "runtime"
    const streamId = `${stepId}-${Date.now()}`

    yield { type: "COMMAND_START" }

    this.eventBus.emit({
      type: "COMMAND_START",
      stepId,
      role,
      command,
      timestamp: Date.now(),
    } as any)

    const eventApi = await import("@tauri-apps/api/event")
    const outputQueue: string[] = []
    let done = false
    let exitCode = -1

    const unlistenOutput = await eventApi.listen<string>(`terminal-output:${streamId}`, (event) => {
      outputQueue.push(event.payload)
      this.eventBus.emit({
        type: "COMMAND_OUTPUT",
        stepId,
        output: event.payload,
      } as any)
    })

    const unlistenComplete = await eventApi.listen<number>(`terminal-complete:${streamId}`, (event) => {
      done = true
      exitCode = event.payload
    })

    const invokePromise = invoke<number>("run_command_stream", {
      command,
      cwd,
      streamId,
    })

    try {
      while (!done || outputQueue.length > 0) {
        while (outputQueue.length > 0) {
          const line = outputQueue.shift()!
          yield { type: "OUTPUT_LINE", line }
        }
        if (!done) {
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
      }

      await invokePromise
    } finally {
      unlistenOutput()
      unlistenComplete()
    }

    this.eventBus.emit({
      type: "COMMAND_COMPLETE",
      stepId,
      exitCode,
      durationMs: 0,
    } as any)

    yield { type: "COMMAND_COMPLETE", exitCode }
  }
}
