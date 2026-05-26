/**
 * AgentExecutionService — singleton that runs agent tasks independent of
 * any React component lifecycle. Survives navigation/unmount.
 */
import { runRuntimeAgent } from '../lib/agents/orchestrator'
import { useAgentStore } from '../stores/agent-store'
import { EventBus } from './EventBus'
import type { AgentResult } from '../lib/agents/orchestrator'

const eventBus = EventBus.getInstance()

class AgentExecutionService {
  private static instance: AgentExecutionService
  private currentController: AbortController | null = null
  private isRunning = false

  static getInstance(): AgentExecutionService {
    if (!AgentExecutionService.instance) {
      AgentExecutionService.instance = new AgentExecutionService()
    }
    return AgentExecutionService.instance
  }

  async run(
    role: string,
    input: string,
    history: any[],
    callbacks: any,
  ): Promise<AgentResult> {
    if (this.isRunning) {
      console.warn('[AgentExecutionService] Task already running, ignoring.')
      throw new Error("AgentExecutionService is already running a task")
    }

    this.currentController = new AbortController()
    this.isRunning = true
    useAgentStore.getState().setProcessing(true, role as any)

    try {
      const result = await runRuntimeAgent(
        role,
        input,
        history,
        undefined,
        this.currentController.signal,
        callbacks?.onStreamReady,
        callbacks?.onToken,
        callbacks?.agentCallbacks,
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ;(eventBus as any).emit({ type: 'AGENT_ERROR', message, role })
      throw err
    } finally {
      this.isRunning = false
      this.currentController = null
      useAgentStore.getState().setProcessing(false)
      ;(eventBus as any).emit({ type: 'AGENT_DONE', role })
    }
  }

  cancel(): void {
    if (this.currentController) {
      this.currentController.abort()
    }
  }

  get running(): boolean {
    return this.isRunning
  }
}

export const agentExecutionService = AgentExecutionService.getInstance()
