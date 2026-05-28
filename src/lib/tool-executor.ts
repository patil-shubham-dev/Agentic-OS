import { useWorkspaceStore } from "@/stores/workspace-store"
import { useDesignStore } from "@/stores/design-store"
import { useToastStore } from "@/stores/toast-store"
import { useLedgerStore } from "@/stores/ledger-store"
import type { ToolCall } from "@/lib/ai-service"
import { ToolExecutionSandbox } from "@/runtime/tools/ToolExecutionSandbox"
import { executeSubAgent } from "@/runtime/sub-agents/sub-agent-delegator"
import type { SubAgentType } from "@/runtime/sub-agents/sub-agent-manager"
import { RuntimeOS } from "@/runtime/RuntimeOS"

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

/* ── Exported implementation functions for built-in tools ── */

export async function implGrepFiles(rootPath: string | null, pattern: string, include?: string): Promise<string> {
  return String(await invoke("grep_files", { root: rootPath, pattern, include: include ?? null }))
}

export async function implGlobFiles(rootPath: string | null, pattern: string): Promise<string> {
  return String(await invoke("glob_files", { root: rootPath, pattern }))
}

export async function implReadFile(rootPath: string | null, path: string): Promise<string> {
  return readTextFile(resolveWorkspacePath(rootPath, path))
}

export async function implWriteFile(rootPath: string | null, path: string, content: string): Promise<string> {
  const fullPath = resolveWorkspacePath(rootPath, path)
  await invoke("write_text_file", { path: fullPath, content })
  try {
    await invoke("save_snapshot", { path: fullPath, content, description: `AI wrote ${path}` })
  } catch {}
  useWorkspaceStore.getState().notifyFileEdited(fullPath, content ?? '')
  return "File written successfully"
}

export async function implEditFile(rootPath: string | null, args: {
  path?: string; file?: string; old_string?: string; new_string?: string
  edits?: Array<{ old_content: string; new_content: string }>
}): Promise<string> {
  const filePath = args.path ?? args.file
  if (!filePath) throw new Error("edit_file requires either 'path' or 'file'")
  const fullPath = resolveWorkspacePath(rootPath, filePath)
  const edits = Array.isArray(args.edits) && args.edits.length > 0
    ? args.edits.map(e => ({ old_string: e.old_content, new_string: e.new_content }))
    : [{ old_string: args.old_string ?? "", new_string: args.new_string ?? "" }]
  for (const edit of edits) {
    await invoke("edit_file", { operation: { file: fullPath, old_string: edit.old_string, new_string: edit.new_string } })
  }
  const updatedContent = await readTextFile(fullPath)
  try {
    await invoke("save_snapshot", { path: fullPath, content: "", description: `AI edited ${filePath}` })
  } catch {}
  useWorkspaceStore.getState().notifyFileEdited(fullPath, updatedContent)
  return "File edited successfully"
}

export async function implRunCommand(rootPath: string | null, role: string, tcId: string, command: string, args?: string[]): Promise<string> {
  const sandbox = ToolExecutionSandbox.getInstance()
  const result = await sandbox.executeTerminalTool({ id: tcId, name: "run_command", args: { command, args } }, { role })
  return result.content
}

export async function implLaunchBrowser(url: string): Promise<string> {
  const sessionId = await invoke<string>("browser_launch", { url })
  const title = await invoke<string>("browser_get_title", { sessionId })
  return `Browser launched (ID: ${sessionId}). Page title: ${title}`
}

export async function implBrowserNavigate(sessionId: string, url: string): Promise<string> {
  await invoke("browser_navigate", { sessionId, url })
  const title = await invoke<string>("browser_get_title", { sessionId })
  return `Navigated to ${url}. Page title: ${title}`
}

export async function implBrowserScreenshot(sessionId: string): Promise<string> {
  const b64 = await invoke<string>("browser_screenshot", { sessionId })
  return `data:image/png;base64,${b64.substring(0, 100)}... [${b64.length} chars]`
}

export async function implBrowserClick(sessionId: string, selector: string): Promise<string> {
  await invoke("browser_click", { sessionId, selector })
  return `Clicked element: ${selector}`
}

export async function implBrowserFill(sessionId: string, selector: string, value: string): Promise<string> {
  await invoke("browser_fill", { sessionId, selector, value })
  return `Filled ${selector} with "${value}"`
}

export async function implBrowserExecuteJs(sessionId: string, js: string): Promise<string> {
  return String(await invoke<string>("browser_execute_js", { sessionId, js }))
}

export async function implBrowserGetTitle(sessionId: string): Promise<string> {
  return String(await invoke<string>("browser_get_title", { sessionId }))
}

export async function implBrowserClose(sessionId: string): Promise<string> {
  await invoke("browser_close", { sessionId })
  return "Browser closed"
}

export async function implBrowserGetText(sessionId: string, selector: string): Promise<string> {
  return String(await invoke<string>("browser_get_text", { sessionId, selector }))
}

export async function implBrowserWait(sessionId: string, selector: string, timeout?: number): Promise<string> {
  await invoke("browser_wait", { sessionId, selector, timeout: timeout ?? 5000 })
  return `Waited for ${selector}`
}

export async function implDesignCreateArtifact(args: Record<string, unknown>): Promise<string> {
  const a = args as Record<string, string>
  const id = useDesignStore.getState().addArtifact({
    name: a.name ?? '',
    description: a.description ?? '',
    tags: (args.tags as string[]) ?? ["ai-generated"],
  })
  useDesignStore.getState().addVersion(id, { label: a.label || "AI Generated", code: a.code ?? '', changes: a.description || "Created from AI request" })
  useToastStore.getState().addToast(`Design artifact "${a.name}" created`, "success", 3000)
  return `Design artifact "${a.name}" created with ID: ${id}.`
}

export async function implDesignAddVersion(args: Record<string, unknown>): Promise<string> {
  const a = args as Record<string, string>
  useDesignStore.getState().addVersion(a.artifact_id ?? '', { label: a.label ?? '', code: a.code ?? '', changes: a.changes ?? '' })
  useToastStore.getState().addToast(`New version "${a.label}" added to artifact`, "success", 3000)
  return `Version added to artifact ${a.artifact_id} (${a.label})`
}

export async function implDesignGeneratePreview(code: string): Promise<string> {
  return `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body class="p-6 bg-[#0a0a0b] text-white min-h-screen"><pre class="bg-[#1a1a2e] p-4 rounded-lg text-sm overflow-auto"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre></body></html>`
}

export async function implDelegateSubtask(args: Record<string, unknown>): Promise<string> {
  const a = args as Record<string, string>
  const subAgentType = a.type as SubAgentType
  if (!["explore", "plan", "verify", "general"].includes(subAgentType)) {
    throw new Error(`Invalid sub-agent type: "${a.type}". Must be one of: explore, plan, verify, general`)
  }
  if (!a.task || a.task.trim().length === 0) {
    throw new Error("delegate_subtask requires a 'task' string argument")
  }
  const subResult = await executeSubAgent({ type: subAgentType, task: a.task, modelOverride: a.model })
  if (subResult.success) {
    useToastStore.getState().addToast(`Sub-agent ${subAgentType} completed (${subResult.toolCalls} tools, ${subResult.durationMs}ms)`, "info", 3000)
  } else {
    useToastStore.getState().addToast(`Sub-agent ${subAgentType} failed: ${subResult.error?.slice(0, 100)}`, "error", 5000)
  }
  useLedgerStore.getState().addAction({
    agentRole: "manager" as any,
    action: `delegate_subtask:${subAgentType}`,
    status: subResult.success ? "success" : "error",
    summary: `${subAgentType} agent: ${subResult.toolCalls} tool calls, ${subResult.tokensUsed} tokens, ${subResult.durationMs}ms`,
  })
  return JSON.stringify({
    subAgentType, success: subResult.success, content: subResult.content,
    toolCalls: subResult.toolCalls, tokensUsed: subResult.tokensUsed,
    durationMs: subResult.durationMs, error: subResult.error ?? undefined,
  }, null, 2)
}

export async function implRunSkill(name: string, skillArgs: string, role: string): Promise<string> {
  const runtime = RuntimeOS.getInstance()
  const result = await runtime.skillExecutor.execute(name, skillArgs, { role })
  if (!result.executed) throw new Error(result.error ?? `Skill "${name}" failed to execute`)
  return result.prompt
}

/* ── Main executeToolCall entry point ── */

export async function executeToolCall(tc: ToolCall, role = "coder", stepId?: string): Promise<ToolResult> {
  const toolName = tc.function.name

  let args: Record<string, unknown>
  try {
    args = JSON.parse(tc.function.arguments)
  } catch {
    return { tool_call_id: tc.id, role: "tool", content: `Error executing ${toolName}: Invalid JSON in tool arguments — ${tc.function.arguments}` }
  }

  // ── Try RuntimeOS pipeline first ──
  try {
    const runtime = RuntimeOS.getInstance()
    const agentTool = runtime.toolRegistry.resolve(toolName)
    if (agentTool) {
      const toolCtx: import("@/runtime/tools/core/ToolContext").ToolContext = { role, signal: undefined }
      const pipelineResult = await runtime.toolExecutionPipeline.execute(toolName, args, toolCtx)

      const resultStr = pipelineResult.error
        ? `Error executing ${toolName}: ${pipelineResult.error}`
        : (typeof pipelineResult.data === 'string' ? pipelineResult.data : JSON.stringify(pipelineResult.data, null, 2))

      const importantOps = ["write_file", "edit_file", "run_command", "launch_browser", "browser_navigate", "browser_close", "browser_click", "browser_fill", "design_create_artifact", "design_add_version"]
      if (importantOps.includes(toolName) && !pipelineResult.error) {
        const pathStr = typeof args.path === 'string' ? args.path : typeof args.file === 'string' ? args.file : typeof args.selector === 'string' ? args.selector : null
        useLedgerStore.getState().addAction({
          agentRole: role as any, action: toolName, file: pathStr, status: "success", summary: resultStr.slice(0, 120),
        })
      }

      return { tool_call_id: tc.id, role: "tool", content: resultStr }
    }
  } catch {
    // RuntimeOS not initialized — fall through
  }

  // ── Fallback: direct implementation (used when RuntimeOS is unavailable, e.g. tests) ──
  try {
    const rootPath = useWorkspaceStore.getState().rootPath
    const sandbox = ToolExecutionSandbox.getInstance()
    await sandbox.assertAllowed({ id: tc.id, name: toolName, args }, { role, stepId })

    const dispatch: Record<string, () => Promise<string>> = {
      grep_files: async () => implGrepFiles(rootPath, String(args.pattern ?? '')),
      glob_files: async () => implGlobFiles(rootPath, String(args.pattern ?? '')),
      read_file: async () => implReadFile(rootPath, String(args.path ?? '')),
      write_file: async () => implWriteFile(rootPath, String(args.path ?? ''), String(args.content ?? '')),
      edit_file: async () => implEditFile(rootPath, args),
      run_command: async () => implRunCommand(rootPath, role, tc.id, String(args.command ?? ''), args.args as string[] | undefined),
      launch_browser: async () => implLaunchBrowser(String(args.url ?? '')),
      browser_navigate: async () => implBrowserNavigate(String(args.session_id ?? ''), String(args.url ?? '')),
      browser_screenshot: async () => implBrowserScreenshot(String(args.session_id ?? '')),
      browser_click: async () => implBrowserClick(String(args.session_id ?? ''), String(args.selector ?? '')),
      browser_fill: async () => implBrowserFill(String(args.session_id ?? ''), String(args.selector ?? ''), String(args.value ?? '')),
      browser_execute_js: async () => implBrowserExecuteJs(String(args.session_id ?? ''), String(args.js ?? '')),
      browser_get_title: async () => implBrowserGetTitle(String(args.session_id ?? '')),
      browser_close: async () => implBrowserClose(String(args.session_id ?? '')),
      browser_get_text: async () => implBrowserGetText(String(args.session_id ?? ''), String(args.selector ?? '')),
      browser_wait: async () => implBrowserWait(String(args.session_id ?? ''), String(args.selector ?? ''), args.timeout as number | undefined),
      design_create_artifact: async () => implDesignCreateArtifact(args),
      design_add_version: async () => implDesignAddVersion(args),
      design_generate_preview: async () => implDesignGeneratePreview(String(args.code ?? '')),
      delegate_subtask: async () => implDelegateSubtask(args),
      run_skill: async () => implRunSkill(String(args.name ?? ''), String(args.args ?? ''), role),
    }

    const impl = dispatch[toolName]
    if (!impl) {
      return { tool_call_id: tc.id, role: "tool", content: `Unknown tool: ${toolName}` }
    }

    const result = await impl()

    const importantOps = ["write_file", "edit_file", "run_command", "launch_browser", "browser_navigate", "browser_close", "browser_click", "browser_fill", "design_create_artifact", "design_add_version"]
    if (importantOps.includes(toolName)) {
      const pathStr = typeof args.path === 'string' ? args.path : typeof args.file === 'string' ? args.file : typeof args.selector === 'string' ? args.selector : null
      useLedgerStore.getState().addAction({
        agentRole: role as any, action: toolName, file: pathStr, status: "success", summary: result.slice(0, 120),
      })
    }

    return { tool_call_id: tc.id, role: "tool", content: result }
  } catch (e) {
    return { tool_call_id: tc.id, role: "tool", content: `Error executing ${toolName}: ${String(e)}` }
  }
}
