import type { Skill } from './Skill'
import type { SkillRegistry } from './SkillRegistry'
import type { ToolRegistry } from '../tools/registry/ToolRegistry'

export type SkillExecutionResult = {
  prompt: string
  skill: Skill
  executed: boolean
  error?: string
}

export class SkillExecutor {
  private registry: SkillRegistry

  constructor(registry: SkillRegistry) {
    this.registry = registry
  }

  async execute(name: string, args: string, ctx: { role: string; executionMode?: string }): Promise<SkillExecutionResult> {
    const skill = this.registry.resolve(name)
    if (!skill) {
      return { prompt: '', skill: null as unknown as Skill, executed: false, error: `Skill "${name}" not found` }
    }

    if (!skill.isEnabled()) {
      return { prompt: '', skill, executed: false, error: `Skill "${name}" is disabled` }
    }

    try {
      const prompt = await skill.getPromptForCommand(args, ctx)
      return { prompt, skill, executed: true }
    } catch (err) {
      return { prompt: '', skill, executed: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async batchExecute(
    names: string[],
    args: string[],
    ctx: { role: string; executionMode?: string },
  ): Promise<SkillExecutionResult[]> {
    return Promise.all(names.map((name, i) => this.execute(name, args[i] ?? '', ctx)))
  }
}
