import { create } from "zustand"
import { RenderScheduler } from "./RenderScheduler"
import { WorkerTelemetryBridge } from "./WorkerTelemetryBridge"
import { EventBus } from "@/runtime/EventBus"
import type { RuntimeEvent, RuntimeState } from "@/runtime/RuntimeTypes"

const MAX_EVENTS = 2000

export interface ProjectedEvent {
  id: string
  ts: number
  kind: string
  label: string
  description: string
  sourceEvent: RuntimeEvent
}

interface ProjectionState {
  events: ProjectedEvent[]
  currentState: RuntimeState
  telemetryText: string
  activeToolCount: number
  errorCount: number
  fps: number
  isReady: boolean
}

interface ProjectionActions {
  initialize: (bus: EventBus) => () => void
  destroy: () => void
}

type ProjectionStore = ProjectionState & ProjectionActions

const scheduler = new RenderScheduler()
let telemetryBridge: WorkerTelemetryBridge | null = null
let unsubs: (() => void)[] = []

function getDescription(event: RuntimeEvent): string {
  switch (event.type) {
    case "state_transition":
      return `${(event as any).from} → ${(event as any).to}`
    case "tool_requested":
    case "tool_started":
      return `${(event as any).toolName}`
    case "tool_completed":
      return `${(event as any).toolName} (${(event as any).durationMs}ms)`
    case "tool_failed":
      return `${(event as any).toolName}: ${((event as any).error ?? "").slice(0, 60)}`
    case "agent_message":
      return ((event as any).content ?? "").slice(0, 80)
    case "execution_error":
      return ((event as any).error ?? "").slice(0, 80)
    case "execution_halted":
      return ((event as any).reason ?? "").slice(0, 80)
    default:
      return ""
  }
}

function getLabel(event: RuntimeEvent): string {
  const map: Record<string, string> = {
    state_transition: "State Change",
    tool_requested: "Tool Requested",
    tool_started: "Tool Started",
    tool_stream: "Tool Output",
    tool_completed: "Tool Completed",
    tool_failed: "Tool Failed",
    stream_delta: "Stream",
    agent_message: "Message",
    verification_started: "Verifying",
    verification_completed: "Verification",
    repair_attempted: "Repair Attempt",
    repair_failed: "Repair Failed",
    repair_resolved: "Repair Resolved",
    execution_error: "Error",
    execution_halted: "Halted",
  }
  return map[event.type] ?? event.type
}

function projectEvent(event: RuntimeEvent): ProjectedEvent {
  return {
    id: `${event.metadata.timestamp}-${event.metadata.eventSequence}-${Math.random().toString(36).slice(2, 6)}`,
    ts: event.metadata.timestamp,
    kind: event.type,
    label: getLabel(event),
    description: getDescription(event),
    sourceEvent: event,
  }
}

export const useEventProjectionStore = create<ProjectionStore>((set, get) => {
  let lastState: RuntimeState = "Idle"
  let errorCount = 0

  function onRuntimeEvent(event: RuntimeEvent): void {
    scheduler.enqueue({
      id: `project_${event.metadata.timestamp}_${event.metadata.eventSequence}`,
      priority: "high",
      estimatedDurationMs: 1,
      execute: () => {
        const current = get()
        const projected = projectEvent(event)
        const merged = [...current.events, projected]
        const trimmed = merged.length > MAX_EVENTS ? merged.slice(merged.length - MAX_EVENTS) : merged

        if (event.type === "state_transition") {
          lastState = event.to
        }
        if (event.type === "execution_error") {
          errorCount++
        }

        const fps = scheduler.getMetrics().fps
        const toolEvents = trimmed.filter((e) =>
          ["tool_requested", "tool_started", "tool_stream", "tool_completed", "tool_failed"].includes(e.kind),
        ).length

        set({
          events: trimmed,
          currentState: lastState,
          activeToolCount: toolEvents,
          errorCount,
          fps,
        })
      },
    })
  }

  return {
    events: [],
    currentState: "Idle",
    telemetryText: "",
    activeToolCount: 0,
    errorCount: 0,
    fps: 0,
    isReady: false,

    initialize: (bus: EventBus) => {
      scheduler.start()

      telemetryBridge = new WorkerTelemetryBridge()
      telemetryBridge.initialize()
      telemetryBridge.onTelemetry((text) => {
        set({ telemetryText: text })
      })

      const types: RuntimeEvent["type"][] = [
        "state_transition", "tool_requested", "tool_started", "tool_stream",
        "tool_completed", "tool_failed", "stream_delta", "agent_message",
        "verification_started", "verification_completed", "repair_attempted",
        "repair_failed", "repair_resolved", "execution_error", "execution_halted",
      ]

      for (const type of types) {
        unsubs.push(bus.on(type, onRuntimeEvent as any))
      }

      set({ isReady: true })

      return () => {
        for (const u of unsubs) { u() }
        unsubs = []
        scheduler.stop()
        telemetryBridge?.destroy()
        telemetryBridge = null
      }
    },

    destroy: () => {
      for (const u of unsubs) { u() }
      unsubs = []
      scheduler.stop()
      telemetryBridge?.destroy()
      telemetryBridge = null
      set({
        events: [],
        currentState: "Idle",
        telemetryText: "",
        activeToolCount: 0,
        errorCount: 0,
        fps: 0,
        isReady: false,
      })
    },
  }
})
