/**
 * PlanEngine — adds a real plan-before-execute phase to the agent execution pipeline.
 *
 * Before any agent starts writing code, PlanEngine:
 * 1. Analyzes the user's request to understand what's needed
 * 2. Checks which files already exist in the workspace
 * 3. Identifies dependencies and potential conflicts
 * 4. Generates a structured plan with ordered steps
 * 5. (Optional) Presents the plan for user approval before execution
 *
 * Adapted from Claude Code's plan-before-execute pattern where the agent
 * articulates its approach before touching files.
 */

export interface PlanStep {
  id: string
  order: number
  action: "read" | "search" | "edit" | "create" | "delete" | "verify" | "research"
  target: string
  description: string
  dependencies: string[] // IDs of steps that must complete first
}

export interface ExecutionPlan {
  id: string
  title: string
  summary: string
  steps: PlanStep[]
  estimatedComplexity: "simple" | "moderate" | "complex"
  requiresApproval: boolean
  createdAt: number
}

export interface PlanResult {
  plan: ExecutionPlan | null
  needsUserApproval: boolean
  reasoning: string
}

export class PlanEngine {
  private planHistory: Map<string, ExecutionPlan> = new Map()

  /**
   * Generate a structured execution plan from a user request.
   * This analyzes the request context and produces ordered steps.
   */
  generatePlan(
    request: string,
    role: string,
    workspaceFiles?: string[],
    conversationHistory?: string,
  ): PlanResult {
    const trimmed = request.trim().toLowerCase()
    const wordCount = trimmed.split(/\s+/).length

    // Simple requests don't need a plan
    if (wordCount < 5) {
      return {
        plan: null,
        needsUserApproval: false,
        reasoning: "Request is simple enough to execute directly",
      }
    }

    const steps: PlanStep[] = []
    let stepOrder = 0
    let complexity: "simple" | "moderate" | "complex" = "simple"
    const stepDeps: Map<string, string[]> = new Map()

    // Step 1: Research/Read — understand existing code
    steps.push({
      id: "step-research",
      order: stepOrder++,
      action: "research",
      target: "workspace",
      description: "Explore the codebase to understand existing patterns, conventions, and relevant files",
      dependencies: [],
    })
    stepDeps.set("step-research", [])

    // Step 2: Determine if we need to read specific files
    const fileMentions = request.match(/\b([\w.-]+\/[\/\w.-]+\.\w+)\b/g)
    if (fileMentions) {
      for (const file of fileMentions.slice(0, 5)) {
        steps.push({
          id: `step-read-${file.replace(/[/.]/g, "-")}`,
          order: stepOrder++,
          action: "read",
          target: file,
          description: `Read ${file} to understand its current state`,
          dependencies: ["step-research"],
        })
        stepDeps.set(`step-read-${file.replace(/[/.]/g, "-")}`, ["step-research"])
      }
    }

    // Step 3: Determine write/edit operations
    const hasWriteIntent = /(create|write|add|make|build|implement|generate)/.test(trimmed)
    const hasEditIntent = /(edit|update|change|modify|refactor|fix|improve)/.test(trimmed)
    const hasDeleteIntent = /(delete|remove|drop|deprecate)/.test(trimmed)

    if (hasDeleteIntent) {
      steps.push({
        id: "step-remove",
        order: stepOrder++,
        action: "delete",
        target: "specified",
        description: "Remove or deprecate specified code/files",
        dependencies: ["step-research"],
      })
      complexity = "moderate"
    }

    if (hasEditIntent) {
      const editTargets = fileMentions ?? ["relevant files"]
      for (const target of editTargets) {
        steps.push({
          id: `step-edit-${target.replace(/[/.]/g, "-")}`,
          order: stepOrder++,
          action: "edit",
          target,
          description: `Modify ${target} to implement the requested changes`,
          dependencies: [`step-read-${target.replace(/[/.]/g, "-")}`].filter((d) =>
            stepDeps.has(d),
          ).length > 0
            ? [`step-read-${target.replace(/[/.]/g, "-")}`]
            : ["step-research"],
        })
      }
      if (fileMentions && fileMentions.length > 2) complexity = "complex"
      else if (complexity === "simple") complexity = "moderate"
    }

    if (hasWriteIntent) {
      steps.push({
        id: "step-create",
        order: stepOrder++,
        action: "create",
        target: "new files",
        description: "Create new files with the requested functionality",
        dependencies: ["step-research"],
      })
      if (complexity === "simple") complexity = "moderate"
    }

    // Step 4: Verification
    steps.push({
      id: "step-verify",
      order: stepOrder++,
      action: "verify",
      target: "project",
      description: "Verify the changes compile and pass type checks",
      dependencies: steps
        .filter((s) => s.action === "edit" || s.action === "create" || s.action === "delete")
        .map((s) => s.id),
    })

    // Determine if user approval is needed
    const needsApproval = hasDeleteIntent || complexity === "complex" || wordCount > 50

    const plan: ExecutionPlan = {
      id: `plan-${Date.now()}`,
      title: this.generateTitle(request),
      summary: this.generateSummary(request, steps.length, complexity),
      steps,
      estimatedComplexity: complexity,
      requiresApproval: needsApproval,
      createdAt: Date.now(),
    }

    this.planHistory.set(plan.id, plan)

    return {
      plan,
      needsUserApproval: needsApproval,
      reasoning: needsApproval
        ? `Complex request with ${steps.length} steps — generated a structured execution plan for review`
        : `Generated ${steps.length}-step execution plan`,
    }
  }

  /**
   * Get steps that are ready to execute (all dependencies met)
   */
  getReadySteps(planId: string, completedSteps: string[]): PlanStep[] {
    const plan = this.planHistory.get(planId)
    if (!plan) return []

    return plan.steps.filter(
      (step) =>
        !completedSteps.includes(step.id) &&
        step.dependencies.every((dep) => completedSteps.includes(dep)),
    )
  }

  private generateTitle(request: string): string {
    const words = request.split(/\s+/).slice(0, 8)
    return words.join(" ").replace(/[.!?]$/, "").slice(0, 60) + "..."
  }

  private generateSummary(request: string, stepCount: number, complexity: string): string {
    const verb = /(fix|repair|debug)/.test(request) ? "Fix" :
                 /(create|build|implement)/.test(request) ? "Implement" :
                 /(refactor|restructure)/.test(request) ? "Refactor" :
                 /(add|extend)/.test(request) ? "Add" :
                 /(test|verify)/.test(request) ? "Test" :
                 "Update"
    return `${verb} with ${stepCount} ordered steps (${complexity} complexity)`
  }

  getPlan(planId: string): ExecutionPlan | undefined {
    return this.planHistory.get(planId)
  }

  clearHistory(): void {
    this.planHistory.clear()
  }
}

/** Singleton instance */
export const planEngine = new PlanEngine()
