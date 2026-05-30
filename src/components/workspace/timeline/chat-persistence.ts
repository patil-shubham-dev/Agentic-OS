const STORAGE_KEY = "agentic-chat-state"
const LOG_PREFIX = "[ChatPersistence]"

export interface PersistedChatState {
  events: import("./types").TimelineEvent[]
  agentSessions: [string, import("./step-card").ToolCallRecord[]][]
  streamingTexts: [string, string][]
  sessionOrder: string[]
  sessionCreatedAtEventCount: number[]
  collapsedSections: string[]
}

export interface PersistableSession {
  stepId: string
  roleId: string
  roleName: string
  correlationId?: string
  status: "running" | "complete" | "error"
  streamState: import("./timeline-store").StreamState
  streamingText: string
  toolCalls: import("./step-card").ToolCallRecord[]
  fileEdits: import("./step-card").FileEditRecord[]
  fileOps: import("./step-card").FileOpRecord[]
  terminalOutputs: import("./step-card").TerminalRecord[]
  modelName?: string
  providerName?: string
  startedAt?: number
  completedAt?: number
  error?: string
  tokenAppended: number
  currentPhase?: string
  phaseHistory?: import("./timeline-store").PhaseEntry[]
}

export function serializeChatState(
  events: import("./types").TimelineEvent[],
  agentSessions: Map<string, import("./timeline-store").AgentSession>,
  streamingTexts: Map<string, string>,
  sessionOrder: string[],
  sessionCreatedAtEventCount: number[],
  collapsedSections: Set<string>,
): string {
  const sessions: [string, PersistableSession][] = []
  for (const [key, session] of agentSessions) {
    sessions.push([key, session])
  }
  const texts: [string, string][] = []
  for (const [key, text] of streamingTexts) {
    if (text) texts.push([key, text])
  }
  const data = {
    version: 1,
    events,
    agentSessions: sessions,
    streamingTexts: texts,
    sessionOrder,
    sessionCreatedAtEventCount,
    collapsedSections: [...collapsedSections],
  }
  return JSON.stringify(data)
}

export function deserializeChatState(json: string): {
  events: import("./types").TimelineEvent[]
  agentSessions: Map<string, import("./timeline-store").AgentSession>
  streamingTexts: Map<string, string>
  sessionOrder: string[]
  sessionCreatedAtEventCount: number[]
  collapsedSections: Set<string>
} | null {
  try {
    const parsed = JSON.parse(json)
    if (!parsed || parsed.version !== 1) return null

    const agentSessions = new Map<string, import("./timeline-store").AgentSession>()
    if (Array.isArray(parsed.agentSessions)) {
      for (const [key, session] of parsed.agentSessions) {
        agentSessions.set(key, session)
      }
    }

    const streamingTexts = new Map<string, string>()
    if (Array.isArray(parsed.streamingTexts)) {
      for (const [key, text] of parsed.streamingTexts) {
        streamingTexts.set(key, text)
      }
    }

    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      agentSessions,
      streamingTexts,
      sessionOrder: Array.isArray(parsed.sessionOrder) ? parsed.sessionOrder : [],
      sessionCreatedAtEventCount: Array.isArray(parsed.sessionCreatedAtEventCount) ? parsed.sessionCreatedAtEventCount : [],
      collapsedSections: new Set<string>(Array.isArray(parsed.collapsedSections) ? parsed.collapsedSections : []),
    }
  } catch (err) {
    console.warn(LOG_PREFIX, "Failed to deserialize chat state:", err)
    return null
  }
}

export function persistChatState(
  events: import("./types").TimelineEvent[],
  agentSessions: Map<string, import("./timeline-store").AgentSession>,
  streamingTexts: Map<string, string>,
  sessionOrder: string[],
  sessionCreatedAtEventCount: number[],
  collapsedSections: Set<string>,
): void {
  try {
    const data = serializeChatState(events, agentSessions, streamingTexts, sessionOrder, sessionCreatedAtEventCount, collapsedSections)
    localStorage.setItem(STORAGE_KEY, data)
  } catch (err) {
    console.warn(LOG_PREFIX, "Failed to persist chat state:", err)
  }
}

export function loadPersistedChatState(): {
  events: import("./types").TimelineEvent[]
  agentSessions: Map<string, import("./timeline-store").AgentSession>
  streamingTexts: Map<string, string>
  sessionOrder: string[]
  sessionCreatedAtEventCount: number[]
  collapsedSections: Set<string>
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return deserializeChatState(raw)
  } catch (err) {
    console.warn("[chat-persistence] Failed to load persisted chat state:", err)
    return null
  }
}

export function clearPersistedChatState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn("[chat-persistence] Failed to clear persisted chat state:", err)
  }
}
