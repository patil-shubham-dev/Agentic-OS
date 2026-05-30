import { normalizeError } from "@/lib/normalize-error"
import { emitTelemetry } from "@/lib/telemetry"

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
    const startedAt = performance.now()

    const rawResult = await invoke<unknown>("run_command", {
      workingDir: cwd,
      command,
      args: [],
    })

    const durationMs = Math.round(performance.now() - startedAt)
    const output = typeof rawResult === "string"
      ? rawResult
      : JSON.stringify(rawResult, null, 2)

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
    options?: { stepId?: string; role?: string; signal?: AbortSignal }
  ): AsyncGenerator<{ type: "COMMAND_START" | "OUTPUT_LINE" | "COMMAND_COMPLETE"; line?: string; exitCode?: number }> {
    const stepId = options?.stepId ?? `terminal-${Date.now()}`
    const streamId = `${stepId}-${Date.now()}`
    const signal = options?.signal

    if (signal?.aborted) {
      yield { type: "COMMAND_COMPLETE", exitCode: -1 }
      return
    }

    yield { type: "COMMAND_START" }

    const eventApi = await import("@tauri-apps/api/event")
    const outputQueue: string[] = []
    let done = false
    let exitCode = -1
    let error: string | null = null

    const unlistenOutput = await eventApi.listen<string>(`terminal-output:${streamId}`, (event) => {
      if (signal?.aborted) return
      outputQueue.push(event.payload)
    })

    const unlistenComplete = await eventApi.listen<number>(`terminal-complete:${streamId}`, (event) => {
      if (signal?.aborted) return
      done = true
      exitCode = event.payload
    })

    const abortHandler = () => {
      if (!done) {
        emitTelemetry({ type: "terminal_failure", timestamp: Date.now(), error: "kill_command failed on abort", metadata: { streamId, command: command.slice(0, 120) } })
        invoke("kill_command", { streamId }).catch(() => {})
        done = true
        exitCode = -1
      }
    }

    signal?.addEventListener("abort", abortHandler, { once: true })

    const invokePromise = invoke<number>("run_command_stream", {
      command,
      cwd,
      streamId,
    }).catch((err) => {
      if (signal?.aborted) return
      const errMsg = `Command execution failed: ${normalizeError(err, "Unknown error")}`
      emitTelemetry({ type: "terminal_failure", timestamp: Date.now(), error: errMsg, metadata: { command, cwd } })
      error = errMsg
      done = true
      exitCode = -1
    })

    const startTime = Date.now()
    const MAX_TIMEOUT = 60_000

    try {
      while (!done || outputQueue.length > 0) {
        if (signal?.aborted && !done) {
          emitTelemetry({ type: "terminal_failure", timestamp: Date.now(), error: "kill_command failed during abort poll", metadata: { streamId, command: command.slice(0, 120) } })
          invoke("kill_command", { streamId }).catch(() => {})
          done = true
          exitCode = -1
        }
        while (outputQueue.length > 0) {
          const line = outputQueue.shift()!
          yield { type: "OUTPUT_LINE", line }
        }
        if (!done) {
          if (Date.now() - startTime > MAX_TIMEOUT) {
            emitTelemetry({ type: "timeout", timestamp: Date.now(), durationMs: Date.now() - startTime, error: "Command timed out", metadata: { command: command.slice(0, 120), streamId } })
            error = "Command timed out"
            done = true
            exitCode = -1
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
      }

      await invokePromise
    } finally {
      signal?.removeEventListener("abort", abortHandler)
      unlistenOutput()
      unlistenComplete()
    }

    if (signal?.aborted) {
      yield { type: "COMMAND_COMPLETE", exitCode: -1 }
    } else {
      yield { type: "COMMAND_COMPLETE", exitCode }
    }
  }
}
