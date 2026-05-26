import { ProviderRegistry } from "./ProviderRegistry"
import type { RuntimeRole, ProviderInstance } from "./ProviderInstance"
import type { ValidationIssue } from "./PreflightValidation"

export interface AutoFixAction {
  id: string
  description: string
  apply: () => boolean
}

export interface AutoFixResult {
  applied: number
  failed: number
  actions: { id: string; description: string; success: boolean; error?: string }[]
}

export class AutoFixEngine {
  private registry: ProviderRegistry

  constructor(registry: ProviderRegistry) {
    this.registry = registry
  }

  fixIssues(issues: ValidationIssue[]): AutoFixResult {
    const actions: AutoFixResult["actions"] = []
    let applied = 0
    let failed = 0

    for (const issue of issues) {
      if (!issue.repairable) continue

      const action = this.createFixAction(issue)
      if (!action) continue

      try {
        const success = action.apply()
        actions.push({ id: issue.id, description: action.description, success })
        if (success) applied++
        else failed++
      } catch (e: any) {
        actions.push({
          id: issue.id,
          description: action.description,
          success: false,
          error: e.message,
        })
        failed++
      }
    }

    return { applied, failed, actions }
  }

  autoAssignAll(): AutoFixResult {
    const result = this.registry.autoAssignAll()
    return {
      applied: result.assigned,
      failed: result.failed,
      actions: [],
    }
  }

  private createFixAction(issue: ValidationIssue): AutoFixAction | null {
    if (!issue.repairAction) return null
    if (!issue.role) return null

    if (issue.repairAction.startsWith("auto-assign-")) {
      const role = issue.role
      return {
        id: `fix-${issue.id}`,
        description: `Auto-assign provider to role "${role}"`,
        apply: () => {
          const best = this.registry.findBestInstance(role)
          if (!best) return false
          return this.registry.assignRole(role, best.instanceId)
        },
      }
    }

    return null
  }
}
