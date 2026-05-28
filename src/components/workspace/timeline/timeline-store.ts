import { create } from "zustand"
import type {
  TimelineEvent,
  UserMessageEvent,
  ManagerRoutingEvent,
  AgentAssignedEvent,
  AgentStreamingEvent,
  ToolCallEvent,
  FileEditEvent,
  TerminalOutputEvent,
  BrowserActionEvent,
  ExecutionSummaryEvent,
  ExecutionErrorEvent,
  ExecutionStatus,
} from "./types"
import type { ToolCallRecord, FileEditRecord, TerminalRecord } from "./step-card"

const MAX_EVENTS = 500

/**
 * Timeline state is VOLATILE UI state that does NOT survive restarts.
 * Old sessions are archived to SessionHistoryStore on shutdown.
 * We intentionally never persist timeline to localStorage so users
 * always see a fresh Cursor/Claude-Code-style conversation on launch.
 */
function clearStorage(): void {
  try {
    localStorage.removeItem("agentic-timeline-state")
  } catch {}
}

export interface AgentSession {
  stepId: string
  roleId: string
  roleName: string
  status: "running" | "complete" | "error"
  streamingText: string
  toolCalls: ToolCallRecord[]
  fileEdits: FileEditRecord[]
  terminalOutputs: TerminalRecord[]
  modelName?: string
  providerName?: string
  startedAt?: number
}

interface TimelineState {
  events: TimelineEvent[]
  agentSessions: Map<string, AgentSession>
  sessionOrder: string[]  // tracks insertion order of agent sessions for turn correlation
  sessionCreatedAtEventCount: number[]  // events.length at session creation time
  collapsedSections: Set<string>

  addEvent: (event: TimelineEvent) => void
  updateEvent: (id: string, updates: Partial<TimelineEvent>) => void
  clear: () => void

  getEventsByType: <T extends TimelineEvent>(type: T["type"]) => T[]
  getLatestByType: <T extends TimelineEvent>(type: T["type"]) => T | undefined

  addAgentSession: (session: AgentSession) => void
  updateAgentSession: (stepId: string, updates: Partial<AgentSession>) => void
  appendAgentStreamText: (stepId: string, text: string) => void
  addToolCallToAgent: (stepId: string, toolCall: ToolCallRecord) => void
  updateToolCall: (stepId: string, toolId: string, updates: Partial<ToolCallRecord>) => void
  addFileEditToAgent: (stepId: string, fileEdit: FileEditRecord) => void
  addTerminalToAgent: (stepId: string, terminal: TerminalRecord) => void

  toggleCollapse: (id: string) => void
  isCollapsed: (id: string) => boolean

  getExecutionCounts: () => {
    filesEdited: number
    commandsRun: number
    browserActions: number
    toolCalls: number
    agentsUsed: string[]
    totalDurationMs: number
  }

  generateId: () => string
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}



/**
 * NOTE: Timeline state is VOLATILE UI state — it does NOT survive app restarts.
 * Old sessions are archived to SessionHistoryStore on shutdown/close.
 * We intentionally start with empty state on every app launch so the user
 * sees a fresh Cursor/Claude-Code-style conversation.
 */
export const useTimelineStore = create<TimelineState>((set, get) => ({
  events: [],
  agentSessions: new Map(),
  sessionOrder: [],
  sessionCreatedAtEventCount: [],
  collapsedSections: new Set(),

  addEvent: (event) => {
    set((s) => ({
      events: [...s.events, event].slice(-MAX_EVENTS),
    }))
  },

  updateEvent: (id, updates) => {
    set((s) => ({
      events: s.events.map((e) =>
        (e as any).id === id ? ({ ...e, ...updates } as TimelineEvent) : e
      ),
    }))
  },

  clear: () => {
    set({ events: [], agentSessions: new Map(), sessionOrder: [], sessionCreatedAtEventCount: [], collapsedSections: new Set() })
    clearStorage()
  },

  getEventsByType: (type) =>
    get().events.filter((e) => e.type === type) as any,

  getLatestByType: (type) =>
    get().events.filter((e) => e.type === type).pop() as any,

  addAgentSession: (session) => {
    set((s) => {
      const next = new Map(s.agentSessions)
      next.set(session.stepId, session)
      return {
        agentSessions: next,
        sessionOrder: [...s.sessionOrder, session.stepId],
        sessionCreatedAtEventCount: [...s.sessionCreatedAtEventCount, s.events.length],
      }
    })
  },

  updateAgentSession: (stepId, updates) => {
    set((s) => {
      const next = new Map(s.agentSessions)
      const existing = next.get(stepId)
      if (existing) {
        next.set(stepId, { ...existing, ...updates })
      }
      return { agentSessions: next }
    })
  },

  appendAgentStreamText: (stepId, text) => {
    set((s) => {
      const next = new Map(s.agentSessions)
      const existing = next.get(stepId)
      if (existing) {
        next.set(stepId, { ...existing, streamingText: existing.streamingText + text })
      }
      return { agentSessions: next }
    })
  },

  addToolCallToAgent: (stepId, toolCall) => {
    set((s) => {
      const next = new Map(s.agentSessions)
      const existing = next.get(stepId)
      if (existing) {
        next.set(stepId, {
          ...existing,
          toolCalls: [...existing.toolCalls, toolCall],
        })
      }
      return { agentSessions: next }
    })
  },

  updateToolCall: (stepId, toolId, updates) => {
    set((s) => {
      const next = new Map(s.agentSessions)
      const existing = next.get(stepId)
      if (existing) {
        next.set(stepId, {
          ...existing,
          toolCalls: existing.toolCalls.map((tc) =>
            tc.id === toolId ? { ...tc, ...updates } : tc
          ),
        })
      }
      return { agentSessions: next }
    })
  },

  addFileEditToAgent: (stepId, fileEdit) => {
    set((s) => {
      const next = new Map(s.agentSessions)
      const existing = next.get(stepId)
      if (existing) {
        next.set(stepId, {
          ...existing,
          fileEdits: [...existing.fileEdits, fileEdit],
        })
      }
      return { agentSessions: next }
    })
  },

  addTerminalToAgent: (stepId, terminal) => {
    set((s) => {
      const next = new Map(s.agentSessions)
      const existing = next.get(stepId)
      if (existing) {
        next.set(stepId, {
          ...existing,
          terminalOutputs: [...existing.terminalOutputs, terminal],
        })
      }
      return { agentSessions: next }
    })
  },

  toggleCollapse: (id) =>
    set((s) => {
      const next = new Set(s.collapsedSections)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { collapsedSections: next }
    }),

  isCollapsed: (id) => get().collapsedSections.has(id),

  getExecutionCounts: () => {
    const events = get().events
    const fileEditEvents = events.filter((e) => e.type === "file-edit") as FileEditEvent[]
    const terminalEvents = events.filter((e) => e.type === "terminal-output") as TerminalOutputEvent[]
    const browserEvents = events.filter((e) => e.type === "browser-action") as BrowserActionEvent[]
    const toolEvents = events.filter((e) => e.type === "tool-call") as ToolCallEvent[]
    const agentEvents = events.filter((e) => e.type === "agent-assigned") as AgentAssignedEvent[]
    const summaryEvent = events.filter((e) => e.type === "execution-summary").pop() as ExecutionSummaryEvent | undefined

    return {
      filesEdited: fileEditEvents.length,
      commandsRun: terminalEvents.filter((t) => t.status !== "running").length,
      browserActions: browserEvents.length,
      toolCalls: toolEvents.length,
      agentsUsed: [...new Set(agentEvents.map((a) => a.roleName))],
      totalDurationMs: summaryEvent?.durationMs ?? 0,
    }
  },

  generateId,
}))

export { generateId }
export type {
  TimelineEvent,
  UserMessageEvent,
  ManagerRoutingEvent,
  AgentAssignedEvent,
  AgentStreamingEvent,
  ToolCallEvent,
  FileEditEvent,
  TerminalOutputEvent,
  BrowserActionEvent,
  ExecutionSummaryEvent,
  ExecutionErrorEvent,
}
