import type { Skill, SkillDefinition } from './Skill'

export class SkillRegistry {
  private bundled: Map<string, Skill> = new Map()
  private userDefined: Map<string, Skill> = new Map()
  private pluginProvided: Map<string, Skill> = new Map()
  private mcpDiscovered: Map<string, Skill> = new Map()

  register(def: SkillDefinition): Skill {
    const skill: Skill = {
      ...def,
      isEnabled: def.isEnabled ?? (() => true),
      userInvocable: def.userInvocable ?? true,
      disableModelInvocation: def.disableModelInvocation ?? false,
    }
    this.bundled.set(def.name, skill)
    return skill
  }

  registerUser(def: SkillDefinition): Skill {
    const skill: Skill = {
      ...def,
      isEnabled: def.isEnabled ?? (() => true),
      userInvocable: def.userInvocable ?? true,
      disableModelInvocation: def.disableModelInvocation ?? false,
    }
    this.userDefined.set(def.name, skill)
    return skill
  }

  registerPlugin(def: SkillDefinition): Skill {
    const skill: Skill = {
      ...def,
      isEnabled: def.isEnabled ?? (() => true),
      userInvocable: def.userInvocable ?? true,
      disableModelInvocation: def.disableModelInvocation ?? false,
    }
    this.pluginProvided.set(def.name, skill)
    return skill
  }

  registerMcp(def: SkillDefinition): Skill {
    const skill: Skill = {
      ...def,
      isEnabled: def.isEnabled ?? (() => true),
      userInvocable: def.userInvocable ?? true,
      disableModelInvocation: def.disableModelInvocation ?? false,
    }
    this.mcpDiscovered.set(def.name, skill)
    return skill
  }

  unregister(name: string): boolean {
    return this.bundled.delete(name) || this.userDefined.delete(name) || this.pluginProvided.delete(name) || this.mcpDiscovered.delete(name)
  }

  resolve(name: string): Skill | undefined {
    return this.bundled.get(name) ?? this.userDefined.get(name) ?? this.pluginProvided.get(name) ?? this.mcpDiscovered.get(name)
  }

  getAll(): Skill[] {
    return [...this.bundled.values(), ...this.userDefined.values(), ...this.pluginProvided.values(), ...this.mcpDiscovered.values()]
  }

  getEnabled(): Skill[] {
    return this.getAll().filter(s => s.isEnabled())
  }

  getUserInvocable(): Skill[] {
    return this.getAll().filter(s => s.isEnabled() && s.userInvocable)
  }

  findByAgent(agent: string): Skill[] {
    return this.getAll().filter(s => s.agent === agent)
  }

  size(): { bundled: number; user: number; plugin: number; mcp: number; total: number } {
    return {
      bundled: this.bundled.size,
      user: this.userDefined.size,
      plugin: this.pluginProvided.size,
      mcp: this.mcpDiscovered.size,
      total: this.bundled.size + this.userDefined.size + this.pluginProvided.size + this.mcpDiscovered.size,
    }
  }
}
