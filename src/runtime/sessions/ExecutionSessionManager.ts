import { ExecutionOrchestrator, type ExecuteOptions } from "@/runtime/execution/ExecutionOrchestrator"
import type { ExecutionEvent } from "@/runtime/ExecutionEvent"
import { useAgentStore } from "@/stores/agent-store"
import { useLedgerStore } from "@/stores/ledger-store"
import { useTimelineStore } from "@/components/workspace/timeline/timeline-store"
import { StreamManager } from "@/runtime/streaming/StreamManager"
import type { ToolCallRecord, FileEditRecord, TerminalRecord } from "@/components/workspace/timeline/step-card"
import { normalizeError } from "@/lib/normalize-error"
import { emitTelemetry } from "@/lib/telemetry"

export interface ExecutionSession {
  id: string
  traceId: string
  startedAt: number
  completedAt?: number
  status: "running" | "completed" | "failed" | "cancelled"
  input: string
  error?: string
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class ExecutionSessionManager {
  private static instance: ExecutionSessionManager
  private sessions: Map<string, ExecutionSession> = new Map()
  private orchestrator = ExecutionOrchestrator.getInstance()
  private stepByExecId = new Map<string, string>()
  private initStepIds = new Map<string, string>()
  private sessionToExecId = new Map<string, string>()
  private activeSessionId: string | null = null
  private streamManagerFlushSet = false
  private forceStopTimer: ReturnType<typeof setTimeout> | null = null

  static getInstance(): ExecutionSessionManager {
    if (!ExecutionSessionManager.instance) {
      ExecutionSessionManager.instance = new ExecutionSessionManager()
    }
    return ExecutionSessionManager.instance
  }

  static cancelCurrent(): void {
    const inst = ExecutionSessionManager.getInstance()
    if (inst.activeSessionId) {
      inst.cancel(inst.activeSessionId)
    }
  }

  async start(options: ExecuteOptions): Promise<ExecutionSession> {
    if (this.activeSessionId) {
      const existing = this.sessions.get(this.activeSessionId)
      if (existing?.status === "running") {
        throw new Error("An execution is already in progress. Please wait for it to complete or cancel it.")
      }
    }
    if (this.forceStopTimer !== null) {
      clearTimeout(this.forceStopTimer)
      this.forceStopTimer = null
    }
    StreamManager.getInstance().resetCancelled()
    const id = generateId()
    this.activeSessionId = id
    const session: ExecutionSession = {
      id,
      traceId: `msg_${Date.now()}`,
      startedAt: Date.now(),
      status: "running",
      input: options.input,
    }

    this.sessions.set(id, session)

    if (!this.streamManagerFlushSet) {
      this.streamManagerFlushSet = true
      StreamManager.getInstance().setFlushCallback((stepId, delta) => {
        useTimelineStore.getState().appendStreamingText(stepId, delta)
      })
    }

    try {
      const eventStream = this.orchestrator.execute(options)

      for await (const event of eventStream) {
        this.handleEvent(event, options)
      }

      if (session.status !== "cancelled") {
        session.status = "completed"
      }
      session.completedAt = Date.now()
    } catch (e) {
      const msg = normalizeError(e, "Execution failed")
      session.error = msg
      session.status = msg.includes("abort") || msg.includes("cancel") ? "cancelled" : "failed"
      session.completedAt = Date.now()

        emitTelemetry({ type: "execution_complete", timestamp: Date.now(), durationMs: Date.now() - session.startedAt, error: msg, metadata: { status: session.status, sessionId: id } })
      if (msg.includes("abort") || msg.includes("cancel")) {
        emitTelemetry({ type: "cancellation", timestamp: Date.now(), metadata: { sessionId: id, reason: msg } })
      }
      // Safety net: finalize any remaining timeline sessions
      const timeline = useTimelineStore.getState()
      for (const [execId, stepId] of this.stepByExecId) {
        StreamManager.getInstance().clearStep(stepId)
        timeline.commitStreamingText(stepId)
        timeline.updateAgentSession(stepId, { status: "complete", streamState: "cancelled" })
        timeline.streamingTexts.delete(stepId)
      }
      for (const [execId, initStepId] of this.initStepIds) {
        timeline.updateAgentSession(initStepId, { status: "complete", streamState: "cancelled" })
        this.initStepIds.delete(execId)
      }
      this.stepByExecId.clear()
      this.sessionToExecId.clear()
    }

    // Prune old sessions to prevent unbounded map growth
    this.pruneSessions()

    this.activeSessionId = null
    return session
  }

  private handleEvent(event: ExecutionEvent, options: ExecuteOptions): void {
    const timeline = useTimelineStore.getState()

    switch (event.type) {
      case "AGENT_ASSIGNED": {
        const initBeforeReal = this.initStepIds.get(event.executionId)
        if (initBeforeReal) {
          timeline.updateAgentSession(initBeforeReal, { status: "complete", streamState: "completed" })
          this.initStepIds.delete(event.executionId)
        }
        this.stepByExecId.set(event.executionId, event.stepId)
        timeline.addAgentSession({
          stepId: event.stepId,
          roleId: event.roleId,
          roleName: event.roleName,
          status: "running",
          streamState: "streaming",
          streamingText: "",
          toolCalls: [],
          fileEdits: [],
          fileOps: [],
          terminalOutputs: [],
          modelName: event.modelName,
          providerName: event.providerName,
          startedAt: Date.now(),
          tokenAppended: 0,
        }, event.correlationId)
        break
      }

      case "MESSAGE_COMPLETE": {
        StreamManager.getInstance().clearStep(event.stepId)
        timeline.commitStreamingText(event.stepId)
        timeline.updateAgentSession(event.stepId, { status: "complete" })
        this.stepByExecId.delete(event.executionId)
        if (event.content) {
          useAgentStore.getState().addMessage(options.activeRole, {
            role: "assistant",
            content: event.content,
            timestamp: Date.now(),
          })
        }
        break
      }

      case "TOOL_START": {
        const stepId = this.stepByExecId.get(event.executionId)
        if (!stepId) break
        const argsStr = typeof event.args === 'string' ? event.args : JSON.stringify(event.args).slice(0, 200)
        const toolCall: ToolCallRecord = {
          id: event.toolId,
          name: event.toolName,
          args: argsStr,
          status: "running",
        }
        timeline.addToolCallToAgent(stepId, toolCall)
        break
      }

      case "TOOL_COMPLETE": {
        const stepId = this.stepByExecId.get(event.executionId)
        if (!stepId) break
        timeline.updateToolCall(stepId, event.toolId, {
          status: "complete",
          result: event.result,
          durationMs: event.durationMs,
        })
        break
      }

      case "TOOL_ERROR": {
        const teStepId = this.stepByExecId.get(event.executionId)
        if (!teStepId) break
        timeline.updateToolCall(teStepId, event.toolId, {
          status: "error",
          result: event.error,
          durationMs: event.durationMs,
        })
        break
      }

      case "FILE_EDIT": {
        const stepId = this.stepByExecId.get(event.executionId)
        if (!stepId) break
        const fileEdit: FileEditRecord = {
          path: event.path,
          additions: event.additions ?? 0,
          deletions: event.deletions ?? 0,
          diffContent: event.newContent?.split("\n").map((l: string) => `+ ${l}`).join("\n") || "",
          oldContent: event.oldContent,
          newContent: event.newContent,
        }
        timeline.addFileEditToAgent(stepId, fileEdit)
        break
      }

      case "COMMAND_START": {
        const cmdStepId = this.stepByExecId.get(event.executionId)
        if (!cmdStepId) break
        const terminal: TerminalRecord = {
          command: event.command,
          output: "",
          status: "running",
        }
        timeline.addTerminalToAgent(cmdStepId, terminal)
        break
      }

      case "COMMAND_COMPLETE": {
        const ccStepId = this.stepByExecId.get(event.executionId)
        if (!ccStepId) break
        const session = timeline.agentSessions.get(ccStepId)
        if (!session) break
        const lastIdx = session.terminalOutputs.length - 1
        if (lastIdx < 0) break
        const updated = [...session.terminalOutputs]
        updated[lastIdx] = { ...updated[lastIdx], status: "success", exitCode: event.exitCode, durationMs: event.durationMs, output: session.terminalOutputs[lastIdx].output }
        timeline.updateAgentSession(ccStepId, { terminalOutputs: updated })
        break
      }

      case "COMMAND_ERROR": {
        const ceStepId = this.stepByExecId.get(event.executionId)
        if (!ceStepId) break
        const ceSession = timeline.agentSessions.get(ceStepId)
        if (!ceSession) break
        const ceLastIdx = ceSession.terminalOutputs.length - 1
        if (ceLastIdx < 0) break
        const ceUpdated = [...ceSession.terminalOutputs]
        ceUpdated[ceLastIdx] = { ...ceUpdated[ceLastIdx], status: "error", exitCode: 1, output: event.error }
        timeline.updateAgentSession(ceStepId, { terminalOutputs: ceUpdated })
        break
      }

      case "ACTION": {
        useLedgerStore.getState().addAction({
          agentRole: event.agentRole,
          action: event.action,
          status: event.status,
          summary: event.summary,
        })
        break
      }

      case "SYNTHESIS_COMPLETE": {
        useAgentStore.getState().addMessage(event.role as any, {
          role: "assistant",
          content: event.content,
          timestamp: Date.now(),
        })
        break
      }

      case "EXECUTION_FAILED": {
        // Check if this execution's session was already cancelled
        let wasCancelled = false
        for (const [, execId] of this.sessionToExecId) {
          if (execId === event.executionId) {
            const s = this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined
            if (s?.status === "cancelled") wasCancelled = true
            break
          }
        }
        const efStepId = this.stepByExecId.get(event.executionId)
        if (efStepId) {
          StreamManager.getInstance().clearStep(efStepId)
          timeline.commitStreamingText(efStepId)
          timeline.updateAgentSession(efStepId, {
            status: wasCancelled ? "complete" : "error",
            streamState: wasCancelled ? "cancelled" : "failed",
            error: wasCancelled ? undefined : event.error,
          })
          if (wasCancelled) {
            timeline.streamingTexts.delete(efStepId)
          }
          this.stepByExecId.delete(event.executionId)
        }
        const initFailId = this.initStepIds.get(event.executionId)
        if (initFailId) {
          timeline.updateAgentSession(initFailId, {
            status: "complete",
            streamState: wasCancelled ? "cancelled" : "completed",
          })
          this.initStepIds.delete(event.executionId)
        }
        if (!wasCancelled) {
          useAgentStore.getState().addMessage(options.activeRole, {
            role: "assistant",
            content: `Error: ${event.error}`,
            timestamp: Date.now(),
          })
        }
        break
      }

      case "COMMAND_OUTPUT": {
        const coStepId = this.stepByExecId.get(event.executionId)
        if (!coStepId) break
        const coSession = timeline.agentSessions.get(coStepId)
        if (!coSession) break
        const coLastIdx = coSession.terminalOutputs.length - 1
        if (coLastIdx < 0) break
        const coTerminal = coSession.terminalOutputs[coLastIdx]
        if (coTerminal.status !== "running") {
          const coBuf = [...coSession.terminalOutputs]
          coBuf[coLastIdx] = { ...coTerminal, output: coTerminal.output + event.output }
          timeline.updateAgentSession(coStepId, { terminalOutputs: coBuf })
          break
        }
        const coUpdated = [...coSession.terminalOutputs]
        coUpdated[coLastIdx] = { ...coUpdated[coLastIdx], output: coUpdated[coLastIdx].output + event.output }
        timeline.updateAgentSession(coStepId, { terminalOutputs: coUpdated })
        break
      }

      case "EXECUTION_CREATED": {
        if (this.activeSessionId) {
          this.sessionToExecId.set(this.activeSessionId, event.executionId)
        }
        const initStepId = `${event.executionId}_init`
        this.initStepIds.set(event.executionId, initStepId)
        timeline.addAgentSession({
          stepId: initStepId,
          roleId: options.activeRole,
          roleName: "Assistant",
          status: "running",
          streamState: "not_started",
          streamingText: "",
          toolCalls: [],
          fileEdits: [],
          fileOps: [],
          terminalOutputs: [],
          startedAt: Date.now(),
          tokenAppended: 0,
          currentPhase: "Preparing...",
        }, options.correlationId)
        this.stepByExecId.set(event.executionId, initStepId)
        break
      }

      case "THINKING_STARTED": {
        const tsStepId = this.stepByExecId.get(event.executionId)
        if (tsStepId) {
          timeline.setPhase(tsStepId, event.label)
        }
        break
      }

      case "THINKING_UPDATE": {
        const tuStepId = this.stepByExecId.get(event.executionId)
        if (tuStepId) {
          timeline.setPhase(tuStepId, event.label)
        }
        break
      }

      case "TOOL_PROGRESS": {
        const tpStepId = this.stepByExecId.get(event.executionId)
        if (tpStepId) {
          timeline.setPhase(tpStepId, event.progress)
          timeline.updateToolCall(tpStepId, event.toolId, { progress: event.progress })
        }
        break
      }

      case "CONTEXT_LOADING": {
        const clStepId = this.stepByExecId.get(event.executionId)
        if (clStepId) {
          timeline.setPhase(clStepId, `Loading ${event.source}...`)
        }
        break
      }

      case "CONTEXT_READY": {
        const crStepId = this.stepByExecId.get(event.executionId)
        if (crStepId) {
          timeline.setPhase(crStepId, `${event.source} loaded`)
        }
        break
      }

      case "PROVIDER_CONNECTING": {
        const pcnStepId = this.stepByExecId.get(event.executionId)
        if (pcnStepId) {
          timeline.setPhase(pcnStepId, `Connecting to ${event.provider}...`)
        }
        break
      }

      case "PROVIDER_CONNECTED": {
        const pcdStepId = this.stepByExecId.get(event.executionId)
        if (pcdStepId) {
          timeline.setPhase(pcdStepId, `Connected to ${event.provider}`)
        }
        break
      }

      case "EXECUTION_COMPLETE": {
        const initCompleteId = this.initStepIds.get(event.executionId)
        if (initCompleteId) {
          timeline.updateAgentSession(initCompleteId, { status: "complete", streamState: "completed" })
          this.initStepIds.delete(event.executionId)
        }
        break
      }

      case "TOKEN":
      case "MESSAGE_UPDATE":
        break
    }
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== "running") return

    session.status = "cancelled"
    session.completedAt = Date.now()
    emitTelemetry({ type: "cancellation", timestamp: Date.now(), durationMs: Date.now() - session.startedAt, metadata: { sessionId, input: session.input.slice(0, 100) } })

    this.orchestrator.cancel()

    const timeline = useTimelineStore.getState()
    const execId = this.sessionToExecId.get(sessionId)

    const finalize = () => {
      if (execId) {
        const stepId = this.stepByExecId.get(execId)
        if (stepId) {
          StreamManager.getInstance().clearStep(stepId)
          timeline.commitStreamingText(stepId)
          timeline.updateAgentSession(stepId, { status: "complete", streamState: "cancelled" })
          timeline.streamingTexts.delete(stepId)
          this.stepByExecId.delete(execId)
        }

        const initStepId = this.initStepIds.get(execId)
        if (initStepId) {
          timeline.updateAgentSession(initStepId, { status: "complete", streamState: "cancelled" })
          this.initStepIds.delete(execId)
        }

        this.sessionToExecId.delete(sessionId)
      }
    }

    finalize()

    // Force-stop: if the orchestrator hasn't fully stopped within 5s,
    // forcefully clean up all remaining sessions
    this.forceStopTimer = setTimeout(() => {
      for (const [sid, s] of this.sessions) {
        if (s.status === "running" || s.status === "cancelled") {
          if (s.status === "running") {
            s.status = "cancelled"
            s.completedAt = Date.now()
          }
          const eid = this.sessionToExecId.get(sid)
          if (eid) {
            const fsStepId = this.stepByExecId.get(eid)
            if (fsStepId) {
              StreamManager.getInstance().clearStep(fsStepId)
              timeline.commitStreamingText(fsStepId)
              timeline.updateAgentSession(fsStepId, { status: "complete", streamState: "cancelled" })
              timeline.streamingTexts.delete(fsStepId)
              this.stepByExecId.delete(eid)
            }
            this.sessionToExecId.delete(sid)
          }
          this.activeSessionId = null
        }
      }
    }, 5000)

    this.pruneSessions()
  }

  /** Clean auxiliary maps for sessions that have been pruned */
  private pruneAuxiliaryMaps(): void {
    const validSessionIds = new Set(this.sessions.keys())
    for (const [sid] of this.sessionToExecId) {
      if (!validSessionIds.has(sid)) {
        const eid = this.sessionToExecId.get(sid)
        this.sessionToExecId.delete(sid)
        if (eid) {
          this.stepByExecId.delete(eid)
          this.initStepIds.delete(eid)
        }
      }
    }
  }

  /** Remove sessions older than 1 hour, keep at most 50 recent sessions */
  private pruneSessions(): void {
    const MAX_SESSIONS = 50
    const MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
    const now = Date.now()

    if (this.sessions.size <= MAX_SESSIONS) return

    const entries = Array.from(this.sessions.entries())
      .sort((a, b) => (b[1].startedAt ?? 0) - (a[1].startedAt ?? 0))

    const toDelete: string[] = []
    let count = 0
    for (const [id, session] of entries) {
      count++
      if (count > MAX_SESSIONS || (session.status !== "running" && now - (session.completedAt ?? session.startedAt) > MAX_AGE_MS)) {
        toDelete.push(id)
      }
    }

    for (const id of toDelete) {
      this.sessions.delete(id)
    }
  }

  getSession(id: string): ExecutionSession | undefined {
    return this.sessions.get(id)
  }

  getActiveSessions(): ExecutionSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === "running")
  }
}
