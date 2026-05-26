import { useAppStore } from "@/stores/app-store"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useAgentStore } from "@/stores/agent-store"
import { requestCommandApproval } from "@/runtime/approval-gate"
import { requiresApproval, type ExecutionModeId } from "@/runtime/execution-mode"
import { executionEngine } from "@/runtime/execution-engine"
import { TerminalRuntime } from "@/runtime/terminal/TerminalRuntime"
import { EventBus } from "@/runtime/EventBus"

/** Build a human-readable summary of a tool call for the approval gate */
function buildApprovalSummary(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "write_file":
      return `Write file: ${args.path ?? "?"}${args.instructions ? ` — ${String(args.instructions).slice(0, 80)}` : ""}`
    case "edit_file":
      return `Edit file: ${args.path ?? "?"}`
    case "run_command":
      return `Run: ${String(args.command ?? "?").slice(0, 120)}`
    case "browser_navigate":
      return `Navigate to: ${String(args.url ?? "?")}`
    case "browser_click":
      return `Click: ${String(args.selector ?? "?")}`
    case "browser_fill":
      return `Fill input: ${String(args.selector ?? "?")}`
    case "design_create_artifact":
      return `Create design artifact: ${String(args.name ?? "?")}`
    case "design_add_version":
      return `Add design version: ${String(args.name ?? "?")}`
    default:
      return `${toolName}(${JSON.stringify(args).slice(0, 120)})`
  }
}

const DESTRUCTIVE_COMMANDS = [
  "npm install", "npm i ", "npm uninstall",
  "yarn add", "yarn remove",
  "pnpm add", "pnpm remove",
  "rm ", "del ", "rmdir", "rd ", "rm -rf", "rmdir /s",
  "git push", "git reset", "git rebase", "git merge", "git commit",
  "pip install", "pip uninstall",
  "cargo publish",
  "sudo ",
]

/** Map tool names to operation types for approval checks */
const TOOL_OPERATION_MAP: Record<string, "tool_execution" | "file_write" | "file_edit" | "command_run" | "browser_launch" | "design_create"> = {
  run_command: "command_run",
  write_file: "file_write",
  edit_file: "file_edit",
  launch_browser: "browser_launch",
  browser_navigate: "browser_launch",
  browser_click: "browser_launch",
  browser_fill: "browser_launch",
  design_create_artifact: "design_create",
  design_add_version: "design_create",
}

export interface SandboxedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolSandboxContext {
  role: string
  stepId?: string
}

export interface ToolSandboxResult {
  content: string
  telemetry?: {
    durationMs: number
    commandOutput?: string
  }
}

export class ToolExecutionSandbox {
  private static instance: ToolExecutionSandbox
  private eventBus = EventBus.getInstance()
  private terminalRuntime = TerminalRuntime.getInstance()

  static getInstance(): ToolExecutionSandbox {
    if (!ToolExecutionSandbox.instance) {
      ToolExecutionSandbox.instance = new ToolExecutionSandbox()
    }
    return ToolExecutionSandbox.instance
  }

  hasPermission(role: string, toolName: string): boolean {
    const roleConfig = useAppStore.getState().roleConfigs.find((cfg) =>
      cfg.runtimeRole === role || cfg.id === role,
    )
    if (!roleConfig) return true
    if (!roleConfig.toolPermissions?.length) return true
    return roleConfig.toolPermissions.includes(toolName)
  }

  async assertAllowed(toolCall: SandboxedToolCall, context: ToolSandboxContext): Promise<void> {
    if (!this.hasPermission(context.role, toolCall.name)) {
      throw new Error(`Role "${context.role}" is not allowed to use tool "${toolCall.name}"`)
    }

    const toolName = toolCall.name
    const command = String((toolCall.args as Record<string, unknown>)?.command ?? "")
    const args = toolCall.args as Record<string, unknown>

    // Blocked pattern check (for run_command)
    if (toolName === "run_command") {
      const blocked = useWorkspaceStore.getState().runtimeConfig.blockPatterns.some((pattern) =>
        pattern && command.includes(pattern),
      )
      if (blocked) {
        throw new Error(`Command blocked by workspace runtime policy: ${command}`)
      }
    }

    // ── Execution mode approval check ──
    // Check if the current execution mode requires approval for this operation type
    const executionMode = useAgentStore.getState().executionMode
    const operationType = TOOL_OPERATION_MAP[toolName] ?? "tool_execution"

    if (requiresApproval(executionMode as ExecutionModeId, operationType)) {
      const approved = await requestCommandApproval({
        command: toolName === "run_command" ? command : buildApprovalSummary(toolName, args),
        operationType,
        toolName,
        args,
      })

      // Transition execution engine to WAITING_APPROVAL
      executionEngine.requireApproval(context.role)

      if (approved) {
        executionEngine.grantApproval(context.role)
      } else {
        executionEngine.denyApproval(context.role)
        throw new Error(`Operation rejected by user: ${buildApprovalSummary(toolName, args)}`)
      }
      return
    }

    // ── Legacy destructive command check (for modes that don't require full approval) ──
    if (toolName === "run_command") {
      const needsApproval = DESTRUCTIVE_COMMANDS.some((prefix) =>
        command.trim().startsWith(prefix) || command.includes(prefix),
      )
      if (needsApproval) {
        const approved = await requestCommandApproval({
          command,
          operationType: "command_run",
          toolName,
          args,
        })
        executionEngine.requireApproval(context.role)
        if (approved) {
          executionEngine.grantApproval(context.role)
        } else {
          executionEngine.denyApproval(context.role)
          throw new Error(`Command rejected by user: ${command}`)
        }
      }
    }
  }

  async executeTerminalTool(toolCall: SandboxedToolCall, context: ToolSandboxContext): Promise<ToolSandboxResult> {
    const command = String(toolCall.args.command ?? "")
    const cwd = useWorkspaceStore.getState().rootPath
    const lines: string[] = []
    const startedAt = performance.now()

    for await (const event of this.terminalRuntime.runStream(command, cwd, {
      role: context.role,
      stepId: context.stepId,
    })) {
      if (event.type === "OUTPUT_LINE" && event.line) {
        lines.push(event.line)
      }
    }

    const durationMs = Math.round(performance.now() - startedAt)
    const output = lines.join("\n")

    return {
      content: output,
      telemetry: {
        durationMs,
        commandOutput: output,
      },
    }
  }
}
