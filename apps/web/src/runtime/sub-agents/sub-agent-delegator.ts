/**
 * SubAgentDelegator — executes sub-agent tasks with fully isolated context windows.
 *
 * Each sub-agent gets:
 * - Its own system prompt (explore/plan/verify/general)
 * - Its own isolated conversation history (just the task, not the full parent context)
 * - Its own restricted tool set (explore/plan = read-only, verify/general = full)
 * - Its own LLM provider call (not a stub)
 *
 * Architecture:
 *   Parent Agent → delegate_subtask tool → SubAgentDelegator.execute()
 *     → Resolves provider/model for sub-agent type
 *     → Builds isolated system prompt
 *     → Makes LLM calls with tool execution loop (no parent context leakage)
 *     → Returns structured result to parent agent
 */

import { useAppStore } from "@/stores/app-store"
import { useWorkspaceRuntime } from "@/runtime/workspace-runtime"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { ChatMessage, ChatResponse, ToolDef, ToolCall } from "@/lib/ai-service"
import { directChatCompletion, streamChatCompletion } from "@/lib/ai-service"
import { trace } from "@/lib/execution-trace"
import { EventBus } from "@/runtime/render-engine/event-bus"
import { ToolExecutionSandbox } from "@/runtime/tools/ToolExecutionSandbox"
import { EXPLORE_AGENT_PROMPT, PLAN_AGENT_PROMPT, VERIFICATION_AGENT_PROMPT, DEFAULT_SUBAGENT_PROMPT } from "@/runtime/system-prompt-factory"
import type { SubAgentType } from "./sub-agent-manager"

// ── Sub-agent tool restrictions ──

const READ_ONLY_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "grep_files",
      description: "Search file contents with a regex pattern in the workspace",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to search" },
          include: { type: "string", description: "Comma-separated file extensions (e.g. ts,tsx)" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob_files",
      description: "Find files matching a glob pattern in the workspace",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern (e.g. src/**/*.ts)" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace root" },
        },
        required: ["path"],
      },
    },
  },
]

const FULL_TOOLS: ToolDef[] = [
  ...READ_ONLY_TOOLS,
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file (creates directories if needed)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace root" },
          content: { type: "string", description: "File content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Apply targeted text replacements in an existing file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace root" },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                old_content: { type: "string", description: "Exact text to find" },
                new_content: { type: "string", description: "Replacement text" },
              },
              required: ["old_content", "new_content"],
            },
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command in the workspace directory",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to run" },
        },
        required: ["command"],
      },
    },
  },
]

function getSystemPrompt(type: SubAgentType): string {
  switch (type) {
    case "explore": return EXPLORE_AGENT_PROMPT
    case "plan": return PLAN_AGENT_PROMPT
    case "verify": return VERIFICATION_AGENT_PROMPT
    case "general": return DEFAULT_SUBAGENT_PROMPT
  }
}

function getTools(type: SubAgentType): ToolDef[] {
  // Explore and Plan are strictly read-only
  if (type === "explore" || type === "plan") return READ_ONLY_TOOLS
  // Verify and General get full tools
  return FULL_TOOLS
}

export interface SubAgentDelegationRequest {
  type: SubAgentType
  task: string
  /** Optional: restrict which tools are available (defaults based on type) */
  allowedTools?: string[]
  /** Optional: override the model to use (e.g., "claude-sonnet-4-20250514" for complex tasks) */
  modelOverride?: string
  /** Optional: abort signal */
  signal?: AbortSignal
}

export interface SubAgentDelegationResult {
  success: boolean
  content: string
  type: SubAgentType
  toolCalls: number
  tokensUsed: number
  durationMs: number
  error?: string
}

const MAX_SUBAGENT_ROUNDS = 5
const SUBAGENT_TIMEOUT_MS = 60_000

/**
 * Emit telemetry and return a consistent result.
 * Ensures SUB_AGENT_COMPLETE is always emitted, even on error paths.
 */
function emitResult(opts: {
  success: boolean
  type: SubAgentType
  content?: string
  error?: string
  duration: number
  toolCalls?: number
  tokens?: number
}): SubAgentDelegationResult {
  const durationMs = Math.round(opts.duration)
  const result: SubAgentDelegationResult = {
    success: opts.success,
    content: opts.content ?? "",
    type: opts.type,
    toolCalls: opts.toolCalls ?? 0,
    tokensUsed: opts.tokens ?? 0,
    durationMs,
    error: opts.error,
  }

  EventBus.getInstance().emit({
    type: "SUB_AGENT_COMPLETE",
    subAgentType: opts.type,
    success: opts.success,
    durationMs,
    toolCalls: opts.toolCalls ?? 0,
    tokensUsed: opts.tokens ?? 0,
    error: opts.error,
    timestamp: Date.now(),
  })

  trace("executeSubAgent", opts.success ? "complete" : "error", {
    type: opts.type,
    contentLength: (opts.content ?? "").length,
    toolCalls: opts.toolCalls ?? 0,
    tokens: opts.tokens ?? 0,
    durationMs,
    error: opts.error,
  })

  return result
}

/**
 * Execute a sub-agent task with a fully isolated context window.
 *
 * The sub-agent receives:
 * 1. Its own system prompt (explore/plan/verify/general) — no parent context leakage
 * 2. Only the task prompt as the conversation history — not the full parent conversation
 * 3. Its own tool set based on sub-agent type
 * 4. A real LLM provider call
 *
 * This ensures true context isolation between parent and sub-agent.
 */
export async function executeSubAgent(request: SubAgentDelegationRequest): Promise<SubAgentDelegationResult> {
  const t0 = performance.now()
  const { type, task, modelOverride, signal } = request
  const logTag = `[SubAgent:${type}]`

  console.log(`${logTag} starting isolated delegation`, {
    taskLength: task.length,
    type,
    modelOverride: modelOverride ?? "default",
  })
  trace("executeSubAgent", "start", { type, taskLength: task.length })

  // ── 1. Resolve provider + model from wired agents ──
  const runtimeState = useWorkspaceRuntime.getState()
  const providers = useAppStore.getState().providers ?? []

  // Sub-agents use the manager's provider config by default
  const managerWired = runtimeState.wiredAgents.find(
    (a) => a.runtimeRole === "manager" || a.roleId === "manager"
  )

  if (!managerWired) {
    const msg = "No manager agent wired — cannot delegate sub-agents"
    console.error(`${logTag} ${msg}`)
    return {
      success: false,
      content: msg,
      type,
      toolCalls: 0,
      tokensUsed: 0,
      durationMs: Math.round(performance.now() - t0),
      error: msg,
    }
  }

  const provider = providers.find((p) => p.id === managerWired.providerId)
  if (!provider) {
    const msg = `Provider "${managerWired.providerId}" not found for sub-agent delegation`
    console.error(`${logTag} ${msg}`)
    return {
      success: false,
      content: msg,
      type,
      toolCalls: 0,
      tokensUsed: 0,
      durationMs: Math.round(performance.now() - t0),
      error: msg,
    }
  }

  const model = modelOverride ?? managerWired.model
  if (!model) {
    const msg = "No model configured for sub-agent delegation"
    console.error(`${logTag} ${msg}`)
    return {
      success: false,
      content: msg,
      type,
      toolCalls: 0,
      tokensUsed: 0,
      durationMs: Math.round(performance.now() - t0),
      error: msg,
    }
  }

  // ── 2. Build isolated context window ──
  const systemPrompt = getSystemPrompt(type)
  const tools = getTools(type)
  const isolatedContext: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ]

  let totalTokens = 0
  let totalToolCalls = 0

  // ── 3. Execute the sub-agent loop with its isolated context ──
  const msgs: ChatMessage[] = [...isolatedContext]

  // Emit telemetry event for UI visibility (after provider resolution so we have the real model)
  EventBus.getInstance().emit({
    type: "SUB_AGENT_START",
    subAgentType: type,
    taskPreview: task.slice(0, 200),
    model,
    timestamp: Date.now(),
  })

  for (let round = 0; round < MAX_SUBAGENT_ROUNDS; round++) {
    if (signal?.aborted) {
      return emitResult({ success: false, type, error: "Sub-agent execution aborted", duration: performance.now() - t0, toolCalls: totalToolCalls, tokens: totalTokens })
    }

    const elapsed = performance.now() - t0
    if (elapsed > SUBAGENT_TIMEOUT_MS) {
      return emitResult({ success: false, type, error: `Sub-agent exceeded ${SUBAGENT_TIMEOUT_MS / 1000}s timeout`, duration: performance.now() - t0, toolCalls: totalToolCalls, tokens: totalTokens })
    }

    console.log(`${logTag} round ${round + 1}/${MAX_SUBAGENT_ROUNDS}`, {
      provider: provider.name,
      model,
      messagesCount: msgs.length,
    })

    let res: ChatResponse
    try {
      const streamedContent = await attemptStreamingRound(
        provider.baseUrl, provider.apiKey, model, provider.runtime,
        msgs, tools, signal,
      )

      if (streamedContent !== null) {
        msgs.push({ role: "assistant", content: streamedContent.content, tool_calls: streamedContent.toolCalls ?? [] })
        res = {
          message: { role: "assistant", content: streamedContent.content, tool_calls: streamedContent.toolCalls ?? [] },
          finish_reason: streamedContent.toolCalls?.length ? "tool_calls" : "stop",
        }
      } else {
        res = await directChatCompletion(provider.baseUrl, provider.apiKey, { model, messages: msgs, tools, maxTokens: 4096 }, signal)
        msgs.push(res.message)
        if (res.usage) totalTokens += res.usage.total_tokens
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`${logTag} LLM call failed:`, errMsg)
      if (round === 0) {
        return emitResult({ success: false, type, error: `Sub-agent LLM call failed: ${errMsg}`, duration: performance.now() - t0, toolCalls: totalToolCalls, tokens: totalTokens })
      }
      break
    }

    if (res.message.tool_calls && res.message.tool_calls.length > 0) {
      totalToolCalls += res.message.tool_calls.length
      const toolResults = await executeSubAgentTools(res.message.tool_calls)
      msgs.push(...toolResults)
    } else {
      console.log(`${logTag} completed in round ${round + 1}`, { contentLength: res.message.content?.length ?? 0, totalToolCalls, totalTokens })
      break
    }
  }

  const finalContent = msgs
    .filter((m) => m.role === "assistant" && !m.tool_calls)
    .map((m) => m.content)
    .filter(Boolean)
    .join("\n\n")

  return emitResult({
    success: true,
    type,
    content: finalContent,
    duration: performance.now() - t0,
    toolCalls: totalToolCalls,
    tokens: totalTokens,
  })
}

// ── Inline Tool Execution (avoids circular import with @/lib/tool-executor) ──

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

interface InlineToolResult {
  tool_call_id: string
  role: "tool"
  content: string
}

/**
 * Execute tools inline for the sub-agent's tool calls.
 * This avoids a circular import with @/lib/tool-executor while providing
 * the same underlying Tauri command execution for the subset of tools
 * that sub-agents are allowed to use.
 */
async function executeSubAgentTools(toolCalls: ToolCall[]): Promise<ChatMessage[]> {
  const sandbox = ToolExecutionSandbox.getInstance()
  const rootPath = useWorkspaceStore.getState().rootPath

  const results = await Promise.allSettled(
    toolCalls.map(async (tc): Promise<InlineToolResult> => {
      let args: Record<string, unknown>
      try {
        args = JSON.parse(tc.function.arguments)
      } catch {
        return {
          tool_call_id: tc.id,
          role: "tool",
          content: `Error: Invalid JSON in arguments — ${tc.function.arguments}`,
        }
      }

      try {
        await sandbox.assertAllowed({
          id: tc.id,
          name: tc.function.name,
          args,
        }, {
          role: "sub-agent",
        })

        let result: unknown

        switch (tc.function.name) {
          case "grep_files":
            result = await invoke("grep_files", {
              root: rootPath,
              pattern: args.pattern,
              include: args.include ?? null,
            })
            break

          case "glob_files":
            result = await invoke("glob_files", {
              root: rootPath,
              pattern: args.pattern,
            })
            break

          case "read_file": {
            const fullPath = resolveWorkspacePath(rootPath, args.path as string)
            result = await readTextFile(fullPath)
            break
          }

          case "write_file": {
            const fullPath = resolveWorkspacePath(rootPath, args.path as string)
            const content = args.content as string
            await invoke("write_text_file", { path: fullPath, content })
            try { await invoke("save_snapshot", { path: fullPath, content, description: `Sub-agent wrote ${args.path}` }) } catch {}
            result = "File written successfully"
            break
          }

          case "edit_file": {
            const filePath = args.path as string ?? args.file as string
            if (!filePath) throw new Error("edit_file requires 'path' or 'file'")
            const fullPath = resolveWorkspacePath(rootPath, filePath)
            const edits = Array.isArray(args.edits) && (args.edits as Array<Record<string, string>>).length > 0
              ? (args.edits as Array<Record<string, string>>).map((e) => ({ old_string: e.old_content, new_string: e.new_content }))
              : [{ old_string: args.old_string as string ?? "", new_string: args.new_string as string ?? "" }]
            for (const edit of edits) {
              await invoke("edit_file", {
                operation: { file: fullPath, old_string: edit.old_string, new_string: edit.new_string },
              })
            }
            try { await invoke("save_snapshot", { path: fullPath, content: "", description: `Sub-agent edited ${filePath}` }) } catch {}
            result = "File edited successfully"
            break
          }

          case "run_command": {
            const terminalResult = await sandbox.executeTerminalTool({
              id: tc.id,
              name: tc.function.name,
              args,
            }, {
              role: "sub-agent",
            })
            result = terminalResult.content
            break
          }

          default:
            result = `Unknown tool: ${tc.function.name}`
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
    }),
  )

  return results.map((r) => {
    if (r.status === "fulfilled") return r.value
    return {
      tool_call_id: toolCalls[0]?.id ?? "unknown",
      role: "tool" as const,
      content: `Tool execution failed: ${r.reason?.message ?? "unknown error"}`,
    }
  })
}

/**
 * Attempt streaming chat completion for a sub-agent.
 * Returns null if streaming is unavailable, forcing a fallback to non-streaming.
 */
export interface StreamRoundResult {
  content: string
  toolCalls?: import("@/lib/ai-service").ToolCall[]
  finishReason?: string | null
}

async function attemptStreamingRound(
  endpoint: string,
  apiKey: string,
  model: string,
  runtime: string | null,
  messages: ChatMessage[],
  tools: ToolDef[],
  signal?: AbortSignal,
): Promise<StreamRoundResult | null> {
  // Only attempt streaming if we can
  try {
    let streamedContent = ""
    let pendingToolCalls: import("@/lib/ai-service").ToolCall[] = []

    return await new Promise((resolve, reject) => {
      streamChatCompletion(
        endpoint,
        apiKey,
        runtime,
        { model, messages, tools, maxTokens: 4096 },
        {
          onReady: () => {
            // Stream connected
          },
          onToken: (token: string) => {
            streamedContent += token
          },
          onDone: (fullContent: string, _meta) => {
            const meta = _meta as { toolCalls?: import("@/lib/ai-service").ToolCall[] } | undefined
            const toolCalls = meta?.toolCalls ?? pendingToolCalls
            resolve({
              content: fullContent || streamedContent,
              toolCalls,
              // usage is not available from streaming callbacks
            })
          },
          onError: (err: Error) => {
            reject(err)
          },
        },
        signal,
      )
    })
  } catch {
    return null
  }
}
