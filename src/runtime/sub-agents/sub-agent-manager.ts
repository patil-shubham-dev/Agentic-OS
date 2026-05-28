/**
 * SubAgentManager — orchestrates delegation to specialized sub-agents
 * (Explore, Plan, Verify, General Purpose) with isolated context windows.
 *
 * Adapted from Claude Code's sub-agent architecture where:
 * - Explore: fast, read-only codebase search (runs on cheaper model)
 * - Plan: read-only architecture planning
 * - Verify: adversarial testing and verification
 * - General Purpose: multi-step research/implementation tasks
 *
 * Key constraints:
 * - Sub-agents cannot spawn other sub-agents (prevents infinite loops)
 * - Explore and Plan agents are strictly read-only
 * - Each sub-agent runs with its own system prompt and tool access
 */

import { EXPLORE_AGENT_PROMPT, PLAN_AGENT_PROMPT, VERIFICATION_AGENT_PROMPT, DEFAULT_SUBAGENT_PROMPT, buildRolePrompt } from "./sub-agent-prompts"
import type { RuntimeRole } from "@/types"
import { ContextManager } from "@/runtime/context/ContextManager"

export type SubAgentType = "explore" | "plan" | "verify" | "general"

export interface SubAgentTask {
  id: string
  type: SubAgentType
  prompt: string
  role: string
  model?: string // Optional override for specific sub-agent model
}

export interface SubAgentResult {
  id: string
  type: SubAgentType
  content: string
  success: boolean
  error?: string
  durationMs: number
}

export interface SubAgentConfig {
  maxConcurrent: number
  enableExplore: boolean
  enablePlan: boolean
  enableVerify: boolean
}

const DEFAULT_CONFIG: SubAgentConfig = {
  maxConcurrent: 3,
  enableExplore: true,
  enablePlan: true,
  enableVerify: true,
}

export class SubAgentManager {
  private config: SubAgentConfig
  private activeTasks: Map<string, SubAgentTask> = new Map()
  private completedResults: Map<string, SubAgentResult> = new Map()
  private promptCache: Map<string, string> = new Map()
  private promptFetches: Map<string, Promise<string>> = new Map()

  constructor(config?: Partial<SubAgentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Pre-warm the system prompt cache for a sub-agent type and role.
   * Call during app boot for roles that are likely to use sub-agents.
   */
  async prewarmPrompt(type: SubAgentType, role?: string): Promise<void> {
    const key = `${type}:${role ?? 'default'}`
    if (this.promptCache.has(key)) return
    if (this.promptFetches.has(key)) {
      await this.promptFetches.get(key)
      return
    }

    const fetch = this.fetchPrompt(type, role)
    this.promptFetches.set(key, fetch)
    try {
      const prompt = await fetch
      this.promptCache.set(key, prompt)
    } finally {
      this.promptFetches.delete(key)
    }
  }

  /**
   * Get the cached or legacy system prompt for a sub-agent type.
   * Synchronous — returns cached ContextManager prompts if available,
   * otherwise falls back to legacy hardcoded prompts.
   */
  getSystemPrompt(type: SubAgentType, role?: string): string {
    const key = `${type}:${role ?? 'default'}`

    const cached = this.promptCache.get(key)
    if (cached !== undefined) return cached

    // Kick off async prewarm for next time (don't await)
    if (type === 'general' && role) {
      this.prewarmPrompt(type, role).catch(() => {})
    }

    switch (type) {
      case "explore":
        return EXPLORE_AGENT_PROMPT
      case "plan":
        return PLAN_AGENT_PROMPT
      case "verify":
        return VERIFICATION_AGENT_PROMPT
      case "general":
        return role
          ? buildRolePrompt(role)
          : DEFAULT_SUBAGENT_PROMPT
    }
  }

  /**
   * Fetch a prompt from ContextManager for the given type/role.
   */
  private async fetchPrompt(agtType: SubAgentType, role?: string): Promise<string> {
    if (agtType !== 'general' || !role) {
      return this.getSystemPrompt(agtType, role)
    }

    try {
      const cm = ContextManager.getInstance()
      const result = await cm.assembleSystemPrompt({
        role,
        userMessage: `Execute task as ${agtType} sub-agent`,
        executionMode: 'default',
      })
      if (result.systemPrompt && result.systemPrompt.length > 0) {
        return result.systemPrompt
      }
    } catch {
      // Fall through to legacy
    }

    return buildRolePrompt(role ?? 'coder')
  }

  /**
   * Clear the prompt cache, forcing a fresh fetch on next access.
   */
  clearPromptCache(): void {
    this.promptCache.clear()
    this.promptFetches.clear()
  }

  /**
   * Determine if a sub-agent is needed for a given task.
   * Returns the recommended sub-agent type or null if the main agent should handle it.
   */
  classifyTask(input: string): { needsSubAgent: boolean; recommendedType?: SubAgentType; reasoning: string } {
    const trimmed = input.trim().toLowerCase()

    // Codebase search / exploration
    if (
      /^(find|search|locate|where is|how is|what files|show me|list|explore|investigate)/.test(trimmed) &&
      /(file|class|function|component|module|directory|code|implementation|pattern)/.test(trimmed)
    ) {
      return {
        needsSubAgent: true,
        recommendedType: "explore",
        reasoning: "Task requires codebase exploration — delegating to fast read-only explore agent",
      }
    }

    // Architecture / planning
    if (
      /^(plan|design|architect|strategy|approach|how should|what's the best|diagram)/.test(trimmed) &&
      /(implement|build|create|structure|refactor|migrate|organize)/.test(trimmed)
    ) {
      return {
        needsSubAgent: true,
        recommendedType: "plan",
        reasoning: "Task requires architectural planning — delegating to plan agent",
      }
    }

    // Verification / testing
    if (
      /^(verify|validate|test|check|audit|review|confirm)/.test(trimmed) &&
      /(works|correct|passes|builds|compiles|behaves|implements)/.test(trimmed)
    ) {
      return {
        needsSubAgent: true,
        recommendedType: "verify",
        reasoning: "Task requires verification — delegating to verification agent",
      }
    }

    // Complex multi-step tasks
    if (
      trimmed.length > 200 ||
      (trimmed.split(/\s+/).length > 30 && /(first|then|next|finally|step|phase)/.test(trimmed))
    ) {
      return {
        needsSubAgent: true,
        recommendedType: "general",
        reasoning: "Complex multi-step task — delegating to general purpose agent",
      }
    }

    return {
      needsSubAgent: false,
      reasoning: "Task is simple enough for the main agent to handle directly",
    }
  }

  /**
   * Spawn and execute a sub-agent task.
   * In the real implementation, this would make a separate LLM call.
   * For the architecture-aware implementation, returns a task that the runtime will execute.
   */
  async spawnTask(task: SubAgentTask): Promise<SubAgentResult> {
    const startedAt = Date.now()

    this.activeTasks.set(task.id, task)

    try {
      // In production, this would call the provider API with the sub-agent's system prompt
      // and restricted tool set. For now, we mark the task and the runtime will execute it.
      const result: SubAgentResult = {
        id: task.id,
        type: task.type,
        content: "", // Will be populated by the execution runtime
        success: true,
        durationMs: Date.now() - startedAt,
      }

      this.activeTasks.delete(task.id)
      this.completedResults.set(task.id, result)
      return result
    } catch (err) {
      this.activeTasks.delete(task.id)
      const result: SubAgentResult = {
        id: task.id,
        type: task.type,
        content: "",
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      }
      this.completedResults.set(task.id, result)
      return result
    }
  }

  /**
   * Spawn multiple sub-agent tasks in parallel
   */
  async spawnParallel(tasks: SubAgentTask[]): Promise<SubAgentResult[]> {
    const limited = tasks.slice(0, this.config.maxConcurrent)
    return Promise.all(limited.map((task) => this.spawnTask(task)))
  }

  getActiveCount(): number {
    return this.activeTasks.size
  }

  getResult(id: string): SubAgentResult | undefined {
    return this.completedResults.get(id)
  }

  clearResults(): void {
    this.completedResults.clear()
  }

  updateConfig(config: Partial<SubAgentConfig>): void {
    this.config = { ...this.config, ...config }
  }

  canSpawn(): boolean {
    return this.activeTasks.size < this.config.maxConcurrent
  }
}

/** Singleton instance */
export const subAgentManager = new SubAgentManager()
