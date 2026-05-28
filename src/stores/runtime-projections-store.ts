import { create } from "zustand"
import { EventBus } from "@/runtime/EventBus"
import type {
  RuntimeEvent,
  RuntimeState,
  ToolRequestedEvent,
  ToolStartedEvent,
  ToolStreamEvent,
  ToolCompletedEvent,
  ToolFailedEvent,
  StreamDeltaEvent,
  StateTransitionEvent,
  AgentMessageEvent,
  VerificationStartedEvent,
  VerificationCompletedEvent,
  RepairAttemptedEvent,
  RepairFailedEvent,
  RepairResolvedEvent,
  ExecutionErrorEvent,
  ExecutionHaltedEvent,
} from "@/runtime/RuntimeTypes"
import { compareTimelineEvents } from "@/runtime/RuntimeTypes"

const MAX_PROJECTED_EVENTS = 1000

export interface ProjectedEventBase {
  id: string
  ts: number
  execId: string
  agentId: string
  source: "user" | "system" | "agent" | "tool"
}

export interface ProjectedStateTransition extends ProjectedEventBase {
  kind: "state_transition"
  from: RuntimeState
  to: RuntimeState
}

export interface ProjectedToolRequested extends ProjectedEventBase {
  kind: "tool_requested"
  toolName: string
  args: string
}

export interface ProjectedToolStarted extends ProjectedEventBase {
  kind: "tool_started"
  toolName: string
  toolId: string
}

export interface ProjectedToolStream extends ProjectedEventBase {
  kind: "tool_stream"
  toolName: string
  toolId: string
  chunk: string
}

export interface ProjectedToolCompleted extends ProjectedEventBase {
  kind: "tool_completed"
  toolName: string
  toolId: string
  durationMs: number
}

export interface ProjectedToolFailed extends ProjectedEventBase {
  kind: "tool_failed"
  toolName: string
  toolId: string
  error: string
  durationMs: number
}

export interface ProjectedStreamDelta extends ProjectedEventBase {
  kind: "stream_delta"
  deltaText: string
  reasoningText: string | null
}

export interface ProjectedAgentMessage extends ProjectedEventBase {
  kind: "agent_message"
  content: string
  role: "user" | "assistant" | "system"
}

export interface ProjectedVerificationStarted extends ProjectedEventBase {
  kind: "verification_started"
  scope: string
}

export interface ProjectedVerificationCompleted extends ProjectedEventBase {
  kind: "verification_completed"
  scope: string
  passed: boolean
  diagnostics: string[]
}

export interface ProjectedRepairAttempted extends ProjectedEventBase {
  kind: "repair_attempted"
  target: string
  attempt: number
}

export interface ProjectedRepairFailed extends ProjectedEventBase {
  kind: "repair_failed"
  target: string
  error: string
}

export interface ProjectedRepairResolved extends ProjectedEventBase {
  kind: "repair_resolved"
  target: string
  repairsApplied: number
}

export interface ProjectedExecutionError extends ProjectedEventBase {
  kind: "execution_error"
  error: string
  recoverable: boolean
}

export interface ProjectedExecutionHalted extends ProjectedEventBase {
  kind: "execution_halted"
  reason: string
}

export type ProjectedEvent =
  | ProjectedStateTransition
  | ProjectedToolRequested
  | ProjectedToolStarted
  | ProjectedToolStream
  | ProjectedToolCompleted
  | ProjectedToolFailed
  | ProjectedStreamDelta
  | ProjectedAgentMessage
  | ProjectedVerificationStarted
  | ProjectedVerificationCompleted
  | ProjectedRepairAttempted
  | ProjectedRepairFailed
  | ProjectedRepairResolved
  | ProjectedExecutionError
  | ProjectedExecutionHalted

const EVENT_TYPES: RuntimeEvent["type"][] = [
  "state_transition",
  "tool_requested",
  "tool_started",
  "tool_stream",
  "tool_completed",
  "tool_failed",
  "stream_delta",
  "agent_message",
  "verification_started",
  "verification_completed",
  "repair_attempted",
  "repair_failed",
  "repair_resolved",
  "execution_error",
  "execution_halted",
]

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function projectEvent(event: RuntimeEvent): ProjectedEvent {
  const base: ProjectedEventBase = {
    id: generateId(),
    ts: event.metadata.timestamp,
    execId: event.metadata.executionId,
    agentId: event.metadata.agentId,
    source: event.metadata.source,
  }

  switch (event.type) {
    case "state_transition":
      return { ...base, kind: "state_transition", from: event.from, to: event.to }
    case "tool_requested":
      return { ...base, kind: "tool_requested", toolName: event.toolName, args: event.args }
    case "tool_started":
      return { ...base, kind: "tool_started", toolName: event.toolName, toolId: event.toolId }
    case "tool_stream":
      return { ...base, kind: "tool_stream", toolName: event.toolName, toolId: event.toolId, chunk: event.chunk }
    case "tool_completed":
      return { ...base, kind: "tool_completed", toolName: event.toolName, toolId: event.toolId, durationMs: event.durationMs }
    case "tool_failed":
      return { ...base, kind: "tool_failed", toolName: event.toolName, toolId: event.toolId, error: event.error, durationMs: event.durationMs }
    case "stream_delta":
      return { ...base, kind: "stream_delta", deltaText: event.deltaText, reasoningText: event.reasoningText }
    case "agent_message":
      return { ...base, kind: "agent_message", content: event.content, role: event.role }
    case "verification_started":
      return { ...base, kind: "verification_started", scope: event.scope }
    case "verification_completed":
      return { ...base, kind: "verification_completed", scope: event.scope, passed: event.passed, diagnostics: event.diagnostics }
    case "repair_attempted":
      return { ...base, kind: "repair_attempted", target: event.target, attempt: event.attempt }
    case "repair_failed":
      return { ...base, kind: "repair_failed", target: event.target, error: event.error }
    case "repair_resolved":
      return { ...base, kind: "repair_resolved", target: event.target, repairsApplied: event.repairsApplied }
    case "execution_error":
      return { ...base, kind: "execution_error", error: event.error, recoverable: event.recoverable }
    case "execution_halted":
      return { ...base, kind: "execution_halted", reason: event.reason }
  }
}

export interface ActiveToolDisplay {
  toolId: string
  toolName: string
  args: string
  status: "running" | "completed" | "failed"
  accumulatedOutput: string
  durationMs: number | null
  startTime: number
  error: string | null
}

export interface RuntimeProjectionState {
  projectedEvents: ProjectedEvent[]
  currentState: RuntimeState
  activeStreamText: string
  activeReasoningText: string | null
  activeTools: Map<string, ActiveToolDisplay>
  lastVerificationResult: { scope: string; passed: boolean; diagnostics: string[] } | null
  totalToolCalls: number
  totalErrors: number
  totalRepairs: number
  currentExecutionId: string | null
  executionCount: number
  isInitialized: boolean
}

interface RuntimeProjectionActions {
  initialize: () => () => void
  destroy: () => void
  clear: () => void
  setAutoScroll: (enabled: boolean) => void
}

type RuntimeProjectionStore = RuntimeProjectionState & RuntimeProjectionActions

function createInitialState(): RuntimeProjectionState {
  return {
    projectedEvents: [],
    currentState: "Idle",
    activeStreamText: "",
    activeReasoningText: null,
    activeTools: new Map(),
    lastVerificationResult: null,
    totalToolCalls: 0,
    totalErrors: 0,
    totalRepairs: 0,
    currentExecutionId: null,
    executionCount: 0,
    isInitialized: false,
  }
}

export const useRuntimeProjectionStore = create<RuntimeProjectionStore>((set, get) => {
  let buffer: RuntimeEvent[] = []
  let rafId: number | null = null
  let unsubs: (() => void)[] = []

  function processBatch(events: RuntimeEvent[]): void {
    const projected: ProjectedEvent[] = []
    let stateChange: RuntimeState | null = null
    let streamText = ""
    let reasoningText: string | null = null
    let lastVerify: { scope: string; passed: boolean; diagnostics: string[] } | null = null
    const activeTools = new Map(get().activeTools)
    let toolCalls = get().totalToolCalls
    let errors = get().totalErrors
    let repairs = get().totalRepairs
    let execId: string | null = get().currentExecutionId

    for (const event of events) {
      projected.push(projectEvent(event))

      if (event.type === "state_transition") {
        stateChange = event.to
        if (event.to === "Planning" || event.to === "Idle") {
          execId = event.metadata.executionId
        }
      } else if (event.type === "tool_requested") {
        toolCalls++
        activeTools.set(event.toolName, {
          toolId: `pending-${event.toolName}`,
          toolName: event.toolName,
          args: event.args,
          status: "running",
          accumulatedOutput: "",
          durationMs: null,
          startTime: event.metadata.timestamp,
          error: null,
        })
      } else if (event.type === "tool_started") {
        const existing = activeTools.get(event.toolName)
        if (existing) {
          activeTools.set(event.toolName, { ...existing, toolId: event.toolId })
        } else {
          activeTools.set(event.toolName, {
            toolId: event.toolId,
            toolName: event.toolName,
            args: "",
            status: "running",
            accumulatedOutput: "",
            durationMs: null,
            startTime: event.metadata.timestamp,
            error: null,
          })
        }
      } else if (event.type === "tool_stream") {
        const existing = activeTools.get(event.toolName)
        if (existing) {
          activeTools.set(event.toolName, {
            ...existing,
            accumulatedOutput: existing.accumulatedOutput + event.chunk,
          })
        }
      } else if (event.type === "tool_completed") {
        const existing = activeTools.get(event.toolName)
        if (existing) {
          activeTools.set(event.toolName, {
            ...existing,
            status: "completed",
            durationMs: event.durationMs,
          })
        }
      } else if (event.type === "tool_failed") {
        errors++
        const existing = activeTools.get(event.toolName)
        if (existing) {
          activeTools.set(event.toolName, {
            ...existing,
            status: "failed",
            durationMs: event.durationMs,
            error: event.error,
          })
        }
      } else if (event.type === "stream_delta") {
        streamText += event.deltaText
        if (event.reasoningText) {
          reasoningText = (reasoningText ?? "") + event.reasoningText
        }
      } else if (event.type === "verification_completed") {
        lastVerify = { scope: event.scope, passed: event.passed, diagnostics: event.diagnostics }
      } else if (event.type === "repair_attempted" || event.type === "repair_resolved") {
        repairs++
      } else if (event.type === "execution_error") {
        errors++
      }
    }

    const currentEvents = get().projectedEvents
    const merged = [...currentEvents, ...projected]
    const trimmed = merged.length > MAX_PROJECTED_EVENTS
      ? merged.slice(merged.length - MAX_PROJECTED_EVENTS)
      : merged

    set({
      projectedEvents: trimmed,
      currentState: stateChange ?? get().currentState,
      activeStreamText: streamText ? (get().activeStreamText + streamText) : get().activeStreamText,
      activeReasoningText: reasoningText !== null
        ? (get().activeReasoningText ?? "") + reasoningText
        : get().activeReasoningText,
      activeTools,
      lastVerificationResult: lastVerify ?? get().lastVerificationResult,
      totalToolCalls: toolCalls,
      totalErrors: errors,
      totalRepairs: repairs,
      currentExecutionId: execId,
    })
  }

  function scheduleFlush(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (buffer.length > 0) {
        const batch = buffer.splice(0)
        processBatch(batch)
      }
    })
  }

  return {
    ...createInitialState(),

    initialize: () => {
      if (get().isInitialized) return () => {}
      const bus = EventBus.getInstance()

      for (const type of EVENT_TYPES) {
        unsubs.push(
          bus.on(type, (event: RuntimeEvent) => {
            buffer.push(event)
            scheduleFlush()
          }),
        )
      }

      set({ isInitialized: true })

      return () => {
        for (const unsub of unsubs) {
          unsub()
        }
        unsubs = []
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
        buffer = []
      }
    },

    destroy: () => {
      for (const unsub of unsubs) {
        unsub()
      }
      unsubs = []
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      buffer = []
      set(createInitialState())
    },

    clear: () => {
      set({
        ...createInitialState(),
        isInitialized: true,
      })
    },

    setAutoScroll: (_enabled: boolean) => {},
  }
})
