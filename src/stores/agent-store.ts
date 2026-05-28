import { create } from "zustand"
import type { RuntimeRole } from "@/types"
import type { ChatMessage } from "@agentic-os/providers"

export type ExecutionMode = "autonomous" | "fastest" | "most_accurate" | "research_heavy" | "human_guided" | "safe_mode"

export type StreamState =
  | "queued"
  | "thinking"
  | "routing"
  | "delegating"
  | "connecting"
  | "streaming"
  | "synthesizing"
  | "completed"
  | "aborted"
  | "failed"

export interface AgentAssignment {
  role: RuntimeRole
  reason: string
  status: "pending" | "active" | "completed" | "failed"
  startedAt?: number
  completedAt?: number
}

export interface OrchestrationStep {
  id: string
  type: "analyze" | "delegate" | "execute" | "review" | "complete" | "error"
  agent: RuntimeRole
  description: string
  status: "pending" | "running" | "done" | "failed"
  timestamp: number
}

interface AgentConversation {
  role: RuntimeRole
  messages: ChatMessage[]
}

interface QueuedTask {
  id: string
  role: RuntimeRole
  prompt: string
  status: "queued" | "running" | "completed" | "failed"
  result?: string
  error?: string
}

export interface AgentStore {
  streamState: StreamState
  activeRole: RuntimeRole
  conversations: Partial<Record<RuntimeRole, AgentConversation>>
  taskQueue: QueuedTask[]
  isProcessing: boolean
  processingRole: RuntimeRole | null
  abortController: AbortController | null

  // Wired roles from runtime (for orchestrator validation)
  wiredRoles: RuntimeRole[]

  // Manager AI state
  executionMode: ExecutionMode
  managerAnalysis: string
  agentAssignments: AgentAssignment[]
  orchestrationSteps: OrchestrationStep[]
  activeTaskDescription: string
  isManagerProcessing: boolean

  setStreamState: (state: StreamState) => void
  setWiredRoles: (roles: RuntimeRole[]) => void
  validateAssignment: (role: RuntimeRole) => boolean
  setActiveRole: (role: RuntimeRole) => void
  getMessages: () => ChatMessage[]
  addMessage: (role: RuntimeRole, msg: ChatMessage) => void
  setMessages: (role: RuntimeRole, msgs: ChatMessage[]) => void
  enqueueTask: (task: Omit<QueuedTask, "id" | "status">) => string
  dequeueTask: () => void
  updateTask: (id: string, updates: Partial<QueuedTask>) => void
  setProcessing: (processing: boolean, role?: RuntimeRole | null) => void
  setAbortController: (ctrl: AbortController | null) => void
  cancelRequest: () => void

  // Manager AI actions
  setExecutionMode: (mode: ExecutionMode) => void
  setManagerAnalysis: (analysis: string) => void
  addAgentAssignment: (assignment: AgentAssignment) => void
  updateAgentAssignment: (role: RuntimeRole, updates: Partial<AgentAssignment>) => void
  clearAssignments: () => void
  addOrchestrationStep: (step: Omit<OrchestrationStep, "id" | "timestamp">) => string
  updateOrchestrationStep: (id: string, updates: Partial<OrchestrationStep>) => void
  clearOrchestrationSteps: () => void
  setActiveTaskDescription: (desc: string) => void
  setManagerProcessing: (processing: boolean) => void
  resetOrchestration: () => void
}

function emptyConversation(role: RuntimeRole): AgentConversation {
  return { role, messages: [] }
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  streamState: "queued",
  activeRole: "coder",
  conversations: {
    coder: emptyConversation("coder"),
    design: emptyConversation("design"),
    vision: emptyConversation("vision"),
    qa: emptyConversation("qa"),
    manager: emptyConversation("manager"),
    runtime: emptyConversation("runtime"),
  },
  taskQueue: [],
  isProcessing: false,
  processingRole: null,
  abortController: null,

  wiredRoles: [],

  executionMode: "autonomous",
  managerAnalysis: "",
  agentAssignments: [],
  orchestrationSteps: [],
  activeTaskDescription: "",
  isManagerProcessing: false,

  setStreamState: (state) => set({ streamState: state }),
  setActiveRole: (role) => set({ activeRole: role }),

  getMessages: () => {
    const { conversations, activeRole } = get()
    return conversations[activeRole]?.messages ?? []
  },

  addMessage: (role, msg) =>
    set((s) => ({
      conversations: {
        ...s.conversations,
        [role]: {
          role,
          messages: [...(s.conversations[role]?.messages ?? []), msg],
        },
      },
    })),

  setMessages: (role, msgs) =>
    set((s) => ({
      conversations: {
        ...s.conversations,
        [role]: { role, messages: msgs },
      },
    })),

  enqueueTask: (task) => {
    const id = crypto.randomUUID()
    set((s) => ({
      taskQueue: [...s.taskQueue, { ...task, id, status: "queued" }],
    }))
    return id
  },

  dequeueTask: () =>
    set((s) => ({
      taskQueue: s.taskQueue.slice(1),
    })),

  updateTask: (id, updates) =>
    set((s) => ({
      taskQueue: s.taskQueue.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  setProcessing: (processing, role = null) =>
    set({ isProcessing: processing, processingRole: role }),

  setAbortController: (ctrl) => set({ abortController: ctrl }),

  cancelRequest: () => {
    const ctrl = get().abortController
    if (ctrl) {
      ctrl.abort()
      set({ abortController: null, isProcessing: false, processingRole: null })
    }
  },

  setWiredRoles: (roles) => set({ wiredRoles: roles }),

  validateAssignment: (role) => {
    const { wiredRoles } = get()
    if (wiredRoles.length === 0) return true // no constraint — allow
    return wiredRoles.includes(role)
  },

  setExecutionMode: (mode) => set({ executionMode: mode }),
  setManagerAnalysis: (analysis) => set({ managerAnalysis: analysis }),
  addAgentAssignment: (assignment) =>
    set((s) => {
      // Only add assignment if the role is wired (or no wiring info available)
      if (s.wiredRoles.length > 0 && !s.wiredRoles.includes(assignment.role)) {
        console.warn(`[AgentStore] Blocked assignment for unwired role "${assignment.role}". Available: [${s.wiredRoles.join(", ")}]`)
        return s
      }
      return {
        agentAssignments: [...s.agentAssignments, assignment],
      }
    }),
  updateAgentAssignment: (role, updates) =>
    set((s) => ({
      agentAssignments: s.agentAssignments.map((a) =>
        a.role === role ? { ...a, ...updates } : a
      ),
    })),
  clearAssignments: () => set({ agentAssignments: [] }),
  addOrchestrationStep: (step) => {
    const id = crypto.randomUUID()
    set((s) => ({
      orchestrationSteps: [
        ...s.orchestrationSteps,
        { ...step, id, timestamp: Date.now() },
      ],
    }))
    return id
  },
  updateOrchestrationStep: (id, updates) =>
    set((s) => ({
      orchestrationSteps: s.orchestrationSteps.map((step) =>
        step.id === id ? { ...step, ...updates } : step
      ),
    })),
  clearOrchestrationSteps: () => set({ orchestrationSteps: [] }),
  setActiveTaskDescription: (desc) => set({ activeTaskDescription: desc }),
  setManagerProcessing: (processing) => set({ isManagerProcessing: processing }),
  resetOrchestration: () =>
    set({
      agentAssignments: [],
      orchestrationSteps: [],
      activeTaskDescription: "",
      isManagerProcessing: false,
      managerAnalysis: "",
    }),
}))
