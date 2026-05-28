import { Importance } from '../ast/PromptNode'
import { PromptCategory } from '../categories/PromptCategory'
import type { SectionDefinition, ResolutionContext } from '../registry/SectionDefinition'

export const workspaceContextSection: SectionDefinition = {
  id: 'workspace-context',
  category: PromptCategory.WORKSPACE,
  importance: Importance.MEDIUM,
  priority: 50,
  cache: 'task',
  dependsOn: ['project-rules'],
  compute: async (ctx: ResolutionContext) => {
    if (!ctx.workspaceFiles && !ctx.environmentInfo) return null

    const lines: string[] = [
      '### Workspace Context',
      '',
    ]

    if (ctx.workspaceFiles !== undefined) {
      lines.push(`- Workspace contains approximately ${ctx.workspaceFiles} files.`)
    }

    if (ctx.environmentInfo) {
      lines.push('', '**Environment:**')
      for (const [key, value] of Object.entries(ctx.environmentInfo)) {
        lines.push(`- ${key}: ${value}`)
      }
    }

    return lines.join('\n')
  },
}
