import { EventBus, type RuntimeEvent } from "./event-bus"
import { RenderScheduler } from "./render-scheduler"
import { StreamBuffer } from "./stream-buffer"
import { useTimelineStore, type AgentSession } from "@/components/workspace/timeline/timeline-store"
import type { ToolCallRecord, FileEditRecord, TerminalRecord } from "@/components/workspace/timeline/step-card"

type UnsubscribeFn = () => void

export class UiSync {
  private eventBus: EventBus
  private scheduler: RenderScheduler
  private streamBuffer: StreamBuffer
  private unsubscribers: UnsubscribeFn[] = []
  private static instance: UiSync

  static getInstance(): UiSync {
    if (!UiSync.instance) {
      UiSync.instance = new UiSync()
    }
    return UiSync.instance
  }

  private constructor() {
    this.eventBus = EventBus.getInstance()
    this.scheduler = RenderScheduler.getInstance()
    this.streamBuffer = StreamBuffer.getInstance()
  }

  start(): void {
    if (this.unsubscribers.length > 0) return

    const schedule = (priority: "high" | "medium" | "low", fn: () => void) => {
      this.scheduler.schedule(`sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fn, priority)
    }

    // Timeline Events

    this.unsubscribers.push(
      this.eventBus.on("ROUTING_DECISION", (ev: any) => {
        schedule("high", () => {
          useTimelineStore.getState().addEvent({
            type: "manager-routing",
            id: useTimelineStore.getState().generateId(),
            status: "complete",
            detectedRoles: ev.selectedRoles,
            reasoning: ev.reasoning,
            context: ev.context,
            assignedRole: ev.selectedRoles?.[0] ?? "",
            timestamp: ev.timestamp,
          })
        })
      }),
    )

    this.unsubscribers.push(
      this.eventBus.on("USER_MESSAGE", (ev: any) => {
        schedule("high", () => {
          useTimelineStore.getState().addEvent({
            type: "user-message",
            id: useTimelineStore.getState().generateId(),
            content: ev.content,
            timestamp: ev.timestamp,
          })
        })
      }),
    )

    this.unsubscribers.push(
      this.eventBus.on("EXECUTION_SUMMARY", (ev: any) => {
        schedule("high", () => {
          useTimelineStore.getState().addEvent({
            type: "execution-summary",
            id: useTimelineStore.getState().generateId(),
            filesEdited: ev.filesEdited,
            commandsRun: ev.commandsRun,
            browserActions: ev.browserActions,
            durationMs: ev.durationMs,
            modelName: ev.modelName,
            status: ev.status,
            timestamp: Date.now(),
          })
        })
      }),
    )

    this.unsubscribers.push(
      this.eventBus.on("EXECUTION_ERROR", (ev: any) => {
        schedule("high", () => {
          useTimelineStore.getState().addEvent({
            type: "execution-error",
            id: useTimelineStore.getState().generateId(),
            roleId: ev.role,
            message: ev.message,
            suggestion: ev.suggestion,
            timestamp: Date.now(),
          })
        })
      }),
    )

    // Agent Sessions

    this.unsubscribers.push(
      this.eventBus.on("AGENT_ASSIGNED", (ev: any) => {
        schedule("high", () => {
          const session: AgentSession = {
            stepId: `${ev.roleId}-${ev.timestamp}`,
            roleId: ev.roleId,
            roleName: ev.roleName,
            status: "running",
            streamingText: "",
            toolCalls: [],
            fileEdits: [],
            terminalOutputs: [],
            modelName: ev.modelName,
            providerName: ev.providerName,
          }
          useTimelineStore.getState().addAgentSession(session)
        })
      }),
    )

    this.unsubscribers.push(
      this.eventBus.on("AGENT_COMPLETE", (ev: any) => {
        schedule("high", () => {
          useTimelineStore.getState().updateAgentSession(ev.stepId, {
            status: ev.status === "complete" ? "complete" : "error",
          })
        })
      }),
    )

    this.unsubscribers.push(
      this.eventBus.on("MODEL_DETECTED", (ev: any) => {
        schedule("low", () => {
          useTimelineStore.getState().updateAgentSession(ev.stepId, {
            modelName: ev.modelName,
          })
        })
      }),
    )

    this.streamBuffer.setFlushCallback((stepId, accumulated) => {
      schedule("high", () => {
        useTimelineStore.getState().appendAgentStreamText(stepId, accumulated)
      })
    })

    this.unsubscribers.push(
      this.eventBus.createBufferedSubscriber("TOKEN_STREAM", (events) => {
        for (const ev of events) {
          if (ev.type === "TOKEN_STREAM") {
            this.streamBuffer.append(ev.stepId, ev.token)
          }
        }
      }, 32),
    )

    this.unsubscribers.push(
      this.eventBus.createBufferedSubscriber("TOOL_START", (events) => {
        for (const ev of events) {
          if (ev.type === "TOOL_START") {
            schedule("high", () => {
              const argsStr = typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args).slice(0, 200)
              const toolCall: ToolCallRecord = {
                id: ev.toolId,
                name: ev.toolName,
                args: argsStr,
                status: "running",
              }
              useTimelineStore.getState().addToolCallToAgent(ev.stepId, toolCall)
            })
          }
        }
      }, 30),
    )

    this.unsubscribers.push(
      this.eventBus.createBufferedSubscriber("TOOL_COMPLETE", (events) => {
        for (const ev of events) {
          if (ev.type === "TOOL_COMPLETE") {
            schedule("medium", () => {
              useTimelineStore.getState().updateToolCall(ev.stepId, ev.toolId, {
                status: "complete",
                result: ev.result?.slice(0, 200),
                durationMs: ev.durationMs,
              })
            })
          }
        }
      }, 30),
    )

    this.unsubscribers.push(
      this.eventBus.createBufferedSubscriber("FILE_EDIT", (events) => {
        for (const ev of events) {
          if (ev.type === "FILE_EDIT") {
            schedule("medium", () => {
              const fileEdit: FileEditRecord = {
                path: ev.path,
                additions: ev.additions ?? 0,
                deletions: ev.deletions ?? 0,
                diffContent: ev.newContent?.split("\n").map((l: string) => `+ ${l}`).join("\n") || "",
                oldContent: ev.oldContent,
                newContent: ev.newContent,
              }
              useTimelineStore.getState().addFileEditToAgent(ev.stepId, fileEdit)
            })
          }
        }
      }, 50),
    )

    this.unsubscribers.push(
      this.eventBus.on("COMMAND_START", (ev: any) => {
        schedule("medium", () => {
          const terminal: TerminalRecord = {
            command: ev.command,
            output: "",
            status: "running",
          }
          useTimelineStore.getState().addTerminalToAgent(ev.stepId, terminal)
        })
      }),
    )

    this.unsubscribers.push(
      this.eventBus.on("COMMAND_OUTPUT", (ev: any) => {
        schedule("medium", () => {
          const sessions = useTimelineStore.getState().agentSessions
          const session = sessions.get(ev.stepId)
          if (session) {
            const lastIdx = session.terminalOutputs.length - 1
            if (lastIdx >= 0 && session.terminalOutputs[lastIdx].status === "running") {
              const updated = [...session.terminalOutputs]
              updated[lastIdx] = { ...updated[lastIdx], output: updated[lastIdx].output + ev.output }
              useTimelineStore.getState().updateAgentSession(ev.stepId, { terminalOutputs: updated } as any)
            }
          }
        })
      }),
    )

    this.unsubscribers.push(
      this.eventBus.on("COMMAND_COMPLETE", (ev: any) => {
        schedule("medium", () => {
          const sessions = useTimelineStore.getState().agentSessions
          const session = sessions.get(ev.stepId)
          if (session) {
            const lastIdx = session.terminalOutputs.length - 1
            if (lastIdx >= 0) {
              const updated = [...session.terminalOutputs]
              updated[lastIdx] = {
                ...updated[lastIdx],
                status: ev.exitCode === 0 ? "success" : "error",
                exitCode: ev.exitCode,
              }
              useTimelineStore.getState().updateAgentSession(ev.stepId, { terminalOutputs: updated } as any)
            }
          }
        })
      }),
    )
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
    this.streamBuffer.clearAll()
  }
}
