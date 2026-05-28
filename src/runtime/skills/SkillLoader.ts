import type { SkillDefinition } from './Skill'
import type { SkillRegistry } from './SkillRegistry'

export class SkillLoader {
  private registry: SkillRegistry

  constructor(registry: SkillRegistry) {
    this.registry = registry
  }

  loadBundled(defs: SkillDefinition[]): void {
    for (const def of defs) {
      this.registry.register(def)
    }
  }

  loadFromFrontmatter(content: string, source: string): SkillDefinition | null {
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    const descMatch = content.match(/^description:\s*(.+)$/m)
    const modelMatch = content.match(/^model:\s*(.+)$/m)
    const toolsMatch = content.match(/^allowedTools:\s*\[(.+)\]$/m)

    if (!nameMatch || !descMatch) return null

    const bodyStart = content.indexOf('---', content.indexOf('---') + 1)
    const promptBody = bodyStart >= 0 ? content.slice(bodyStart + 3).trim() : content

    return {
      name: nameMatch[1]!.trim(),
      description: descMatch[1]!.trim(),
      model: modelMatch?.[1]?.trim(),
      allowedTools: toolsMatch ? toolsMatch[1]!.split(',').map(s => s.trim().replace(/['"]/g, '')) : undefined,
      getPromptForCommand: async () => promptBody,
    }
  }

  loadMultipleFromFrontmatter(contents: Array<{ content: string; source: string }>): SkillDefinition[] {
    const defs: SkillDefinition[] = []
    for (const { content, source } of contents) {
      const def = this.loadFromFrontmatter(content, source)
      if (def) defs.push(def)
    }
    return defs
  }
}
