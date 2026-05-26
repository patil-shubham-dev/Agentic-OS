import { useWorkspaceStore } from "@/stores/workspace-store"
import { useDesignStore } from "@/stores/design-store"
import { useToastStore } from "@/stores/toast-store"
import { useLedgerStore } from "@/stores/ledger-store"
import type { ToolCall } from "@/lib/ai-service"
import { ToolExecutionSandbox } from "@/runtime/tools/ToolExecutionSandbox"
import { executeSubAgent } from "@/runtime/sub-agents/sub-agent-delegator"
import type { SubAgentType } from "@/runtime/sub-agents/sub-agent-manager"

interface ToolResult {
  tool_call_id: string
  role: "tool"
  content: string
}

async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const core = await import("@tauri-apps/api/core")
    return await core.invoke<T>(cmd, args)
  } catch {
    throw new Error(`Tauri command "${cmd}" not available in web mode`)
  }
}

async function readTextFile(path: string): Promise<string> {
  try {
    const fs = await import("@tauri-apps/plugin-fs")
    return await fs.readTextFile(path)
  } catch {
    throw new Error("File system not available in web mode")
  }
}

function resolveWorkspacePath(rootPath: string | null, inputPath: string): string {
  if (!rootPath) return inputPath
  if (/^[a-zA-Z]:[\\/]/.test(inputPath)) return inputPath
  return `${rootPath}\\${inputPath.replace(/\//g, "\\")}`
}

export async function executeToolCall(tc: ToolCall, role = "coder", stepId?: string): Promise<ToolResult> {
  const rootPath = useWorkspaceStore.getState().rootPath
  const workspaceStore = useWorkspaceStore.getState()
  const sandbox = ToolExecutionSandbox.getInstance()

  let args: Record<string, unknown>
  try {
    args = JSON.parse(tc.function.arguments)
  } catch {
    return {
      tool_call_id: tc.id,
      role: "tool",
      content: `Error executing ${tc.function.name}: Invalid JSON in tool arguments — ${tc.function.arguments}`,
    }
  }

  // Validate required arguments by tool name
  const toolName = tc.function.name
  if (toolName === 'write_file' || toolName === 'read_file') {
    if (typeof args.path !== 'string') {
      return {
        tool_call_id: tc.id,
        role: 'tool',
        content: `Error: '${toolName}' requires a 'path' argument (string). Got: ${JSON.stringify(args)}`,
      }
    }
  }
  if (toolName === 'run_command') {
    if (!args.command || typeof args.command !== 'string') {
      return {
        tool_call_id: tc.id,
        role: 'tool',
        content: `Error: 'run_command' requires a 'command' argument (string). Got: ${JSON.stringify(args)}`,
      }
    }
  }

  try {
    await sandbox.assertAllowed({
      id: tc.id,
      name: tc.function.name,
      args,
    }, {
      role,
      stepId,
    })

    let result: unknown

    switch (tc.function.name) {
      case "grep_files": {
        result = await invoke("grep_files", {
          root: rootPath,
          pattern: args.pattern,
          include: args.include ?? null,
        })
        break
      }
      case "glob_files": {
        result = await invoke("glob_files", {
          root: rootPath,
          pattern: args.pattern as string,
        })
        break
      }
      case "read_file": {
        const pathArg = args.path as string
        const fullPath = resolveWorkspacePath(rootPath, pathArg)
        result = await readTextFile(fullPath)
        break
      }
      case "write_file": {
        const fullPath = resolveWorkspacePath(rootPath, args.path as string)
        const content = args.content as string
        await invoke("write_text_file", { path: fullPath, content })
        try {
          await invoke("save_snapshot", {
            path: fullPath,
            content,
            description: `AI wrote ${args.path}`,
          })
        } catch (_) {}
        // Notify workspace store about file edit
        workspaceStore.notifyFileEdited(fullPath, content ?? '')
        result = "File written successfully"
        break
      }
      case "edit_file": {
        const editArgs = args as {
          path?: string
          file?: string
          old_string?: string
          new_string?: string
          edits?: Array<{ old_content: string; new_content: string }>
        }
        const filePath = editArgs.path ?? editArgs.file
        if (!filePath) {
          throw new Error("edit_file requires either 'path' or 'file'")
        }
        const fullPath = resolveWorkspacePath(rootPath, filePath)
        const edits = Array.isArray(editArgs.edits) && editArgs.edits.length > 0
          ? editArgs.edits.map((edit) => ({
              old_string: edit.old_content,
              new_string: edit.new_content,
            }))
          : [{ old_string: editArgs.old_string ?? "", new_string: editArgs.new_string ?? "" }]

        for (const edit of edits) {
          await invoke("edit_file", {
            operation: {
              file: fullPath,
              old_string: edit.old_string,
              new_string: edit.new_string,
            },
          })
        }

        const updatedContent = await readTextFile(fullPath)
        try {
          await invoke("save_snapshot", {
            path: fullPath,
            content: "",
            description: `AI edited ${filePath}`,
          })
        } catch (_) {}
        // Notify workspace store about file edit
        workspaceStore.notifyFileEdited(fullPath, updatedContent)
        result = "File edited successfully"
        break
      }
      case "run_command": {
        const terminalResult = await sandbox.executeTerminalTool({
          id: tc.id,
          name: tc.function.name,
          args,
        }, {
          role,
          stepId,
        })
        result = terminalResult.content
        break
      }
      case "launch_browser": {
        const sessionId = await invoke<string>("browser_launch", { url: args.url })
        const title = await invoke<string>("browser_get_title", { sessionId })
        result = `Browser launched (ID: ${sessionId}). Page title: ${title}`
        break
      }
      case "browser_screenshot": {
        const b64 = await invoke<string>("browser_screenshot", { sessionId: args.session_id })
        result = `data:image/png;base64,${b64.substring(0, 100)}... [${b64.length} chars]`
        break
      }
      case "browser_execute_js": {
        result = await invoke<string>("browser_execute_js", {
          sessionId: args.session_id,
          js: args.js,
        })
        break
      }
      case "browser_get_title": {
        result = await invoke<string>("browser_get_title", { sessionId: args.session_id })
        break
      }
      case "browser_close": {
        await invoke("browser_close", { sessionId: args.session_id })
        result = "Browser closed"
        break
      }
      case "browser_click": {
        await invoke("browser_click", {
          sessionId: args.session_id,
          selector: args.selector,
        })
        result = `Clicked element: ${args.selector}`
        break
      }
      case "browser_fill": {
        await invoke("browser_fill", {
          sessionId: args.session_id,
          selector: args.selector,
          value: args.value,
        })
        result = `Filled ${args.selector} with "${args.value}"`
        break
      }
      case "browser_wait": {
        await invoke("browser_wait", {
          sessionId: args.session_id,
          selector: args.selector,
          timeout: args.timeout ?? 5000,
        })
        result = `Waited for ${args.selector}`
        break
      }
      case "browser_get_text": {
        result = await invoke<string>("browser_get_text", {
          sessionId: args.session_id,
          selector: args.selector,
        })
        break
      }
      // ── OpenDesign Agent Tools ──
      case "design_create_artifact": {
        const a = args as Record<string, string>
        const id = useDesignStore.getState().addArtifact({
          name: a.name ?? '',
          description: a.description ?? '',
          tags: (args.tags as string[]) ?? ["ai-generated"],
        })
        useDesignStore.getState().addVersion(id, {
          label: a.label || "AI Generated",
          code: a.code ?? '',
          changes: a.description || "Created from AI request",
        })
        useToastStore.getState().addToast(`Design artifact "${a.name}" created`, "success", 3000)
        result = `Design artifact "${a.name}" created with ID: ${id}.`
        break
      }
      case "design_add_version": {
        const a = args as Record<string, string>
        const state = useDesignStore.getState()
        state.addVersion(a.artifact_id ?? '', {
          label: a.label ?? '',
          code: a.code ?? '',
          changes: a.changes ?? '',
        })
        useToastStore.getState().addToast(`New version "${a.label}" added to artifact`, "success", 3000)
        result = `Version added to artifact ${a.artifact_id} (${a.label})`
        break
      }
      case "design_generate_preview": {
        const code = String(args.code ?? '')
        const preview = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body class="p-6 bg-[#0a0a0b] text-white min-h-screen"><pre class="bg-[#1a1a2e] p-4 rounded-lg text-sm overflow-auto"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre></body></html>`
        result = preview
        break
      }

      // ── Sub-agent delegation (Manager-only tool) ──
      case "delegate_subtask": {
        const a = args as Record<string, string>
        const subAgentType = a.type as SubAgentType
        if (!["explore", "plan", "verify", "general"].includes(subAgentType)) {
          throw new Error(`Invalid sub-agent type: "${a.type}". Must be one of: explore, plan, verify, general`)
        }
        if (!a.task || a.task.trim().length === 0) {
          throw new Error("delegate_subtask requires a 'task' string argument")
        }

        console.log(`[ToolExecutor] Delegating subtask to ${subAgentType} agent`, {
          taskLength: a.task.length,
          modelOverride: a.model ?? "default",
        })

        const subResult = await executeSubAgent({
          type: subAgentType,
          task: a.task,
          modelOverride: a.model,
        })

        // Show toast for user visibility
        if (subResult.success) {
          useToastStore.getState().addToast(
            `Sub-agent ${subAgentType} completed (${subResult.toolCalls} tools, ${subResult.durationMs}ms)`,
            "info", 3000,
          )
        } else {
          useToastStore.getState().addToast(
            `Sub-agent ${subAgentType} failed: ${subResult.error?.slice(0, 100)}`,
            "error", 5000,
          )
        }

        // Log to ledger for history
        useLedgerStore.getState().addAction({
          agentRole: "manager" as any,
          action: `delegate_subtask:${subAgentType}`,
          status: subResult.success ? "success" : "error",
          summary: `${subAgentType} agent: ${subResult.toolCalls} tool calls, ${subResult.tokensUsed} tokens, ${subResult.durationMs}ms`,
        })

        result = JSON.stringify({
          subAgentType,
          success: subResult.success,
          content: subResult.content,
          toolCalls: subResult.toolCalls,
          tokensUsed: subResult.tokensUsed,
          durationMs: subResult.durationMs,
          error: subResult.error ?? undefined,
        }, null, 2)
        break
      }

      // ── Hermes Browser Tools ──
      case "browser_navigate": {
        const a = args as Record<string, string>
        await invoke("browser_navigate", {
          sessionId: a.session_id,
          url: a.url,
        })
        const title = await invoke<string>("browser_get_title", { sessionId: a.session_id })
        result = `Navigated to ${a.url}. Page title: ${title}`
        break
      }

      default:
        result = `Unknown tool: ${tc.function.name}`
    }

    const importantOps = ["write_file", "edit_file", "run_command", "launch_browser", "browser_navigate", "browser_close", "browser_click", "browser_fill", "design_create_artifact", "design_add_version"]
    if (importantOps.includes(tc.function.name)) {
      const resultStr = String(typeof result === "string" ? result : JSON.stringify(result) ?? "")
      const pathStr = typeof args.path === 'string' ? args.path : typeof args.file === 'string' ? args.file : typeof args.selector === 'string' ? args.selector : null
      useLedgerStore.getState().addAction({
        agentRole: "coding" as any,
        action: tc.function.name,
        file: pathStr,
        status: "success",
        summary: resultStr.slice(0, 120),
      })
    }

    return {
      tool_call_id: tc.id,
      role: "tool",
      content: typeof result === "string" ? result : JSON.stringify(result, null, 2),
    }
  } catch (e) {
    return {
      tool_call_id: tc.id,
      role: "tool",
      content: `Error executing ${tc.function.name}: ${String(e)}`,
    }
  }
}
