import type { AgentRoleConfig, GatewayProvider } from "@/types"
import type { ChatMessage, ChatResponse, UsageInfo, ToolCall } from "@agentic-os/providers"
import { FAST_CHAT_PROMPT } from "@/runtime/runtime-role-registry"
import { getTools } from "./agent-tools"
import { normalizeRole } from "@/lib/role-identity"
import { executeToolCall } from "@/lib/tool-executor"
import { ProviderTransport } from "@agentic-os/providers"
import type { TransportAdapterConfig, CompletionRequest, TransportError } from "@agentic-os/providers"
import { useLedgerStore } from "@/stores/ledger-store"
import { useAgentStore } from "@/stores/agent-store"
import { useWorkspaceRuntime } from "@/runtime/workspace-runtime"
import { useWorkspaceStore, getWorkspaceContextSnapshot } from "@/stores/workspace-store"
import { useAppStore } from "@/stores/app-store"
import { memoryLoader } from "@/runtime/project-memory/memory-loader"
import { trace } from "@/lib/execution-trace"
import { getEffectiveMaxTokens, clampOutputTokens } from "@/runtime/runtime-token-config"
import type { ToolCallRecord, FileEditRecord } from "@/components/workspace/timeline/step-card"
import { ContextManager } from "@/runtime/context/ContextManager"
import type { ContextAssemblyInput } from "@/runtime/context/context-types"
import { PostWriteVerifier } from "@/runtime/PostWriteVerifier"
import type { ExecutionModeId } from "@/runtime/execution-mode"

export interface AgentConfig {
  role: string
  endpoint: string
  apiKey: string
  runtime: string | null
  model: string
  maxTokens?: number
  providerId?: string
  providerName?: string
}

export interface AgentResult {
  role: string
  response: string
  messages: ChatMessage[]
  usage: UsageInfo
}

export interface AgentCallbacks {
  stepId?: string
  onStreamChunk?: (chunk: string) => void
  onToolCallStart?: (tc: ToolCallRecord) => void
  onToolCallComplete?: (tcId: string, result: string) => void
  onFileEdit?: (fe: FileEditRecord) => void
  onModelDetected?: (modelName: string) => void
  /** Called after auto-verification (typecheck/lint) completes post-file-edits */
  onVerificationComplete?: (result: {
    passed: boolean
    typeCheckErrors: number
    lintErrors?: number
    summary: string
  }) => void
}

interface StreamRoundResult {
  content: string
  toolCalls?: ToolCall[]
  finishReason: string | null
}

const AGENT_EXECUTION_TIMEOUT_MS = 120_000   // 2 minutes hard cap
const AGENT_SOFT_DEADLINE_MS = 60_000

const transport = new ProviderTransport({
  getApiKey: (providerId?: string) => {
    if (providerId) {
      const providers = useAppStore.getState().providers ?? []
      const p = providers.find((p) => p.id === providerId)
      return p?.apiKey
    }
    return undefined
  },
})

function toAdapterConfig(config: AgentConfig): TransportAdapterConfig {
  return {
    baseUrl: config.endpoint,
    apiKey: config.apiKey,
    runtime: config.runtime,
    providerId: config.providerId ?? config.role,
    providerName: config.providerName ?? config.role,
  }
}

function validateProviderConfig(config: AgentConfig): void {
  if (!config.apiKey || config.apiKey.trim() === "") {
    throw new Error(
      `No API key for role "${config.role}". Go to Settings → Providers and add your API key.`,
    )
  }
  if (!config.endpoint || config.endpoint.trim() === "") {
    throw new Error(
      `No endpoint URL for role "${config.role}". Go to Settings → Providers and check the endpoint.`,
    )
  }
  if (!config.model || config.model.trim() === "") {
    throw new Error(
      `No model selected for role "${config.role}". Go to Settings → Roles and assign a model.`,
    )
  }
}

export async function runAgent(
  config: AgentConfig,
  userMessage: string,
  conversationHistory: ChatMessage[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
  onToken?: (token: string) => void,
  onStreamReady?: () => void,
  callbacks?: AgentCallbacks,
): Promise<AgentResult> {
  validateProviderConfig(config)
  trace("runAgent", "start", { role: config.role })
  const startedAt = Date.now()
  const logTag = `[Agent:${config.role}]`
  console.log(`${logTag} task started`, { model: config.model, messageLength: userMessage.length })
  callbacks?.onModelDetected?.(config.model)

  // Initialize context budget for this task
  ContextManager.getInstance().initializeTask(config.model)

  // Build a structured system prompt using the factory (Claude Code-style layered prompt)
  const normalizedRole = normalizeRole(config.role) ?? "coder"
  const executionMode = useAgentStore.getState().executionMode

  // Load project rules from CLAUDE.md hierarchy (global → project → local → path-scoped)
  const rootPath = useWorkspaceStore.getState().rootPath
  let projectRules: string | undefined
  if (rootPath) {
    try {
      const memory = await memoryLoader.load(rootPath)
      if (memory.combined.trim().length > 0) {
        projectRules = memory.combined.trim()
        trace("runAgent", "project_rules_loaded", {
          files: memory.files.length,
          chars: projectRules.length,
        })
      }
    } catch (memErr) {
      console.warn("[Orchestrator] Failed to load project rules:", memErr instanceof Error ? memErr.message : String(memErr))
    }
  }

  // Inject workspace context (active file, cursor, selection, open tabs) into assembly
  const wsSnapshot = getWorkspaceContextSnapshot()
  const assemblyInput: ContextAssemblyInput = {
    role: normalizedRole,
    userMessage,
    executionMode,
    memorySummary: undefined,
    customInstructions: projectRules,
    environmentInfo: undefined,
    activeFilePath: wsSnapshot.activeFilePath ?? undefined,
    activeFileName: wsSnapshot.activeFileName ?? undefined,
    activeFileLanguage: wsSnapshot.activeFileLanguage ?? undefined,
    activeFileLines: wsSnapshot.activeFileLines > 0 ? wsSnapshot.activeFileLines : undefined,
    openFiles: wsSnapshot.openFiles.length > 0 ? wsSnapshot.openFiles : undefined,
    selectedText: wsSnapshot.selectedText || undefined,
    cursorLine: wsSnapshot.cursorLine > 0 ? wsSnapshot.cursorLine : undefined,
    cursorColumn: wsSnapshot.cursorColumn > 0 ? wsSnapshot.cursorColumn : undefined,
    visibleRangeStart: wsSnapshot.visibleRangeStart > 0 ? wsSnapshot.visibleRangeStart : undefined,
    visibleRangeEnd: wsSnapshot.visibleRangeEnd > 0 ? wsSnapshot.visibleRangeEnd : undefined,
    unsavedChanges: wsSnapshot.unsavedChanges > 0 ? wsSnapshot.unsavedChanges : undefined,
    recentEdits: wsSnapshot.recentEdits.length > 0 ? wsSnapshot.recentEdits : undefined,
    fileTreeSummary: wsSnapshot.fileTreeSummary || undefined,
  }
  const promptResult = await ContextManager.getInstance().assembleSystemPrompt(assemblyInput)
  const systemPrompt = promptResult.systemPrompt
  const contextResult = await ContextManager.getInstance().buildContext(userMessage, config.role)
  const promptLoadElapsed = Date.now() - startedAt
  const tools = getTools(config.role)
  trace("runAgent", "system_prompt_loaded", { role: config.role, elapsedMs: promptLoadElapsed })

  const systemMessage: ChatMessage = { role: "system", content: systemPrompt }
  const contextMessage = contextResult.promptBlock
    ? [{ role: "system" as const, content: contextResult.promptBlock }]
    : []
  const messages = [systemMessage, ...contextMessage, ...conversationHistory, { role: "user" as const, content: userMessage }]
  trace("runAgent", "messages_built", { count: messages.length })

  const msgs = [...messages]
  const totalUsage: UsageInfo = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  let softDeadlineLogged = false
  let consecutiveToolOnlyRounds = 0
  const MAX_TOOL_ONLY_ROUNDS = 5

  for (let round = 0; round < 10; round++) {
    const elapsed = Date.now() - startedAt

    if (!softDeadlineLogged && elapsed > AGENT_SOFT_DEADLINE_MS) {
      console.warn(`${logTag} SOFT DEADLINE exceeded (${elapsed}ms > ${AGENT_SOFT_DEADLINE_MS}ms) — response is slow`)
      softDeadlineLogged = true
    }

    if (elapsed > AGENT_EXECUTION_TIMEOUT_MS) {
      throw new Error(`Agent execution exceeded ${AGENT_EXECUTION_TIMEOUT_MS / 1000}s timeout`)
    }

    if (signal?.aborted) {
      throw new DOMException("Agent execution aborted", "AbortError")
    }

    console.log(`${logTag} round ${round + 1}/10 — provider request`, {
      model: config.model,
      endpoint: config.endpoint?.slice(0, 60),
      runtime: config.runtime,
      apiKeyPresent: !!config.apiKey,
      messagesCount: msgs.length,
      elapsedMs: elapsed,
    })
    onProgress?.(`${config.role}: round ${round + 1} — sending provider request...`)
    trace("runAgent", "provider_request_start", { round: round + 1 })

    const maxTokens = config.maxTokens ?? getEffectiveMaxTokens(config.role, config.model)

    // Use streaming for the response round if onToken is provided
    const effectiveOnToken = onToken
      ? (token: string) => {
          callbacks?.onStreamChunk?.(token)
          onToken(token)
        }
      : undefined
    let res: ChatResponse | null = null
    if (onToken) {
      try {
        trace("runAgent", "stream_attempt_start")
        const streamResult = await streamSingleRound(
          config, { model: config.model, messages: msgs, tools, maxTokens }, signal, effectiveOnToken ?? onToken, onStreamReady,
        )
        trace("runAgent", "stream_attempt_end", {
          success: true,
          length: streamResult?.content.length ?? 0,
          toolCalls: streamResult?.toolCalls?.length ?? 0,
          finishReason: streamResult?.finishReason ?? null,
        })
        if (streamResult) {
          res = {
            message: {
              role: "assistant",
              content: streamResult.content,
              tool_calls: streamResult.toolCalls ?? [],
            },
            finish_reason: streamResult.finishReason,
          }
        }
      } catch (streamErr) {
        const msg = streamErr instanceof Error ? streamErr.message : String(streamErr)
        console.warn(`${logTag} streaming failed (${msg}), falling back to non-streaming`)
        trace("runAgent", "stream_attempt_fail", { error: msg })
      }
    }

    if (!res) {
      trace("runAgent", "transport_nonstream_start")
      try {
        const tcResult = await transport.chatCompletion(
          toAdapterConfig(config),
          { model: config.model, messages: msgs, tools, maxTokens, signal },
        )
        res = {
          message: {
            role: "assistant",
            content: tcResult.content,
            tool_calls: (tcResult.toolCalls ?? []) as ToolCall[],
          },
          finish_reason: tcResult.finishReason,
          usage: tcResult.usage ? {
            prompt_tokens: tcResult.usage.promptTokens,
            completion_tokens: tcResult.usage.completionTokens,
            total_tokens: tcResult.usage.totalTokens,
          } : undefined,
        }
        trace("runAgent", "transport_nonstream_end", { success: true })
      } catch (transportErr) {
        const transportMsg = transportErr instanceof Error ? transportErr.message : String(transportErr)
        trace("runAgent", "transport_nonstream_fail", { error: transportMsg })
        throw new Error(`ProviderTransport chat completion failed: ${transportMsg}`)
      }
    }

    if (!res) throw new Error("No response from provider")

    trace("runAgent", "non_streaming_end", { hasToolCalls: !!res.message.tool_calls?.length })

    console.log(`${logTag} round ${round + 1}/10 — response received`, {
      hasToolCalls: !!res.message.tool_calls?.length,
      finishReason: res.finish_reason,
      usage: res.usage,
    })

    if (res.usage) {
      totalUsage.prompt_tokens += res.usage.prompt_tokens
      totalUsage.completion_tokens += res.usage.completion_tokens
      totalUsage.total_tokens += res.usage.total_tokens
    }

    msgs.push(res.message)
    ContextManager.getInstance().updateBudget(msgs as any)

    if (res.message.tool_calls && res.message.tool_calls.length > 0) {
      onProgress?.(`${config.role}: executing ${res.message.tool_calls.length} tool(s)...`)
      console.log(`${logTag} executing ${res.message.tool_calls.length} tool(s)`)
      trace("runAgent", "tool_execution_start", { count: res.message.tool_calls.length })

      // Notify tool call start for each
      for (const tc of res.message.tool_calls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(tc.function.arguments) } catch {}
        callbacks?.onToolCallStart?.({
          id: tc.id,
          name: tc.function.name,
          args: JSON.stringify(args).slice(0, 200),
          status: 'running',
        })
      }

      // Track file edits for post-write verification
      const editedFiles: string[] = []

      const settled = await Promise.allSettled(
        res.message.tool_calls.map((tc: import("@agentic-os/providers").ToolCall) => executeToolCall(tc, config.role, callbacks?.stepId)),
      )
      const toolResults = settled.map((result, i) => {
        const tc = res.message.tool_calls![i]
        if (result.status === 'fulfilled') {
          callbacks?.onToolCallComplete?.(tc.id, result.value.content)
          // Detect file edit for write_file / edit_file
          if (tc.function.name === 'write_file' || tc.function.name === 'edit_file') {
            let args: Record<string, unknown> = {}
            try { args = JSON.parse(tc.function.arguments) } catch {}
            const path = (args.path || args.file) as string || ''
            if (path) editedFiles.push(path)
            const edits = Array.isArray(args.edits) ? args.edits as Array<Record<string, unknown>> : []
            const oldStr = edits.length > 0
              ? edits.map((e) => String(e.old_content ?? "")).join("\n")
              : (args.old_string || '') as string
            const newStr = edits.length > 0
              ? edits.map((e) => String(e.new_content ?? "")).join("\n")
              : (args.content || args.new_string) as string || ''
            const oldLines = oldStr ? oldStr.split('\n').length : 0
            const newLines = newStr ? newStr.split('\n').length : 0
            callbacks?.onFileEdit?.({
              path,
              additions: newLines,
              deletions: oldLines,
              diffContent: newStr,
              oldContent: oldStr,
              newContent: newStr,
            })
          }
          return result.value
        } else {
          console.error(`[Orchestrator] Tool call failed:`, result.reason)
          return {
            tool_call_id: tc.id,
            role: 'tool' as const,
            content: `Error: Tool execution failed — ${result.reason?.message ?? 'unknown error'}. Please try a different approach.`,
          }
        }
      })
      msgs.push(...toolResults)
      trace("runAgent", "tool_execution_end")

      // ── Auto-compaction: reduce context if budget exceeds threshold ──
      if (ContextManager.getInstance().shouldCompact(msgs as any)) {
        const compacted = ContextManager.getInstance().compact(msgs as any)
        if (compacted && compacted.tokensRecovered > 0) {
          console.log(`${logTag} auto-compacted: ${compacted.messagesRetained} messages retained, ${compacted.tokensRecovered} tokens recovered (strategy: ${compacted.strategy})`)
          trace("runAgent", "auto_compact", { messagesRetained: compacted.messagesRetained, tokensRecovered: compacted.tokensRecovered })
        }
      }

      // ── Auto-verification after file edits ──
      // Runs typecheck automatically and feeds results back to the agent for self-correction
      if (editedFiles.length > 0) {
        trace("runAgent", "auto_verify_start", { files: editedFiles.length })
        try {
          const verificationResult = await PostWriteVerifier.verify(
            executionMode as ExecutionModeId,
            [...new Set(editedFiles)], // deduplicate
          )
          if (verificationResult) {
            const verifyMsg = PostWriteVerifier.formatForAgent(verificationResult)
            // Use "user" role for mid-conversation injection (some providers
            // don't support system messages mid-conversation)
            msgs.push({
              role: "user" as const,
              content: verifyMsg,
            })
            console.log(
              `[Orchestrator] Auto-verification injected: ${verificationResult.typeCheck?.passed ? "✅ passed" : verificationResult.typeCheck ? "❌ failed" : "ℹ️ skipped"}`,
            )
            trace("runAgent", "auto_verify_end", {
              passed: verificationResult.typeCheck?.passed ?? null,
              errors: verificationResult.typeCheck?.errors.length ?? 0,
            })

            // Notify UI via callback
            callbacks?.onVerificationComplete?.({
              passed: verificationResult.typeCheck?.passed ?? false,
              typeCheckErrors: verificationResult.typeCheck?.errors.length ?? 0,
              lintErrors: verificationResult.lint?.errors.length,
              summary: verificationResult.typeCheck?.passed
                ? verificationResult.lint?.passed
                  ? "✅ TypeScript & ESLint passed"
                  : "⚠️ ESLint issues found"
                : `❌ ${verificationResult.typeCheck?.errors.length ?? 0} TypeScript error(s)`,
            })
          }
        } catch (verifyErr) {
          // Verification failures should never crash the agent
          const verifyMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
          console.warn(`[Orchestrator] Auto-verification error: ${verifyMsg}`)
          trace("runAgent", "auto_verify_error", { error: verifyMsg })
        }
      }
    } else {
      console.log(`${logTag} no tool calls — breaking loop`)
      break
    }

    // Stall detection: break if agent keeps calling tools without producing text
    if (res.message.tool_calls && res.message.tool_calls.length > 0 && !res.message.content) {
      consecutiveToolOnlyRounds++
      if (consecutiveToolOnlyRounds >= MAX_TOOL_ONLY_ROUNDS) {
        console.warn(`[Orchestrator] Agent stuck in tool-only loop, forcing completion`)
        break
      }
    } else {
      consecutiveToolOnlyRounds = 0
    }
  }

  const toolCallCount = msgs.filter((m) => m.role === "tool").length
  const totalElapsed = Date.now() - startedAt
  console.log(`${logTag} completed`, { toolCallCount, totalTokens: totalUsage.total_tokens, elapsedMs: totalElapsed })

  useLedgerStore.getState().addAction({
    agentRole: config.role,
    action: `agent:${config.role}`,
    status: "success",
    summary: `Agent completed with ${toolCallCount} tool calls, ${totalUsage.total_tokens} tokens in ${totalElapsed}ms`,
  })

  const assistantMessages = msgs.filter((m) => m.role === "assistant" && !m.tool_calls)
  const lastResponse = assistantMessages[assistantMessages.length - 1]?.content || ""

  return {
    role: config.role,
    response: lastResponse,
    messages: msgs,
    usage: totalUsage,
  }
}

async function streamSingleRound(
  config: AgentConfig,
  req: { model: string; messages: ChatMessage[]; tools?: import("@agentic-os/providers").ToolDef[]; maxTokens?: number },
  signal: AbortSignal | undefined,
  onToken: (token: string) => void,
  onStreamReady?: () => void,
): Promise<StreamRoundResult | null> {
  const logTag = `[StreamRound:${config.role}]`
  console.log(`${logTag} start`, { endpoint: config.endpoint?.slice(0, 40), model: req.model })
  trace("streamSingleRound", "start", { endpoint: config.endpoint?.slice(0, 40), model: req.model })

  let streamedContent = ""
  let pendingToolCalls: ToolCall[] = []
  let streamError: Error | null = null

  await transport.streamChatCompletion(
    toAdapterConfig(config),
    { model: req.model, messages: req.messages, tools: req.tools, maxTokens: req.maxTokens, signal },
    {
      onToken: (token) => {
        streamedContent += token
        onToken(token)
      },
      onToolCallBegin: () => {},
      onToolCallDelta: () => {},
      onToolCallEnd: () => {},
      onToolCallsComplete: (toolCalls) => {
        pendingToolCalls = toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        }))
      },
      onFinish: () => {},
      onError: (error: TransportError) => {
        streamError = new Error(error.message)
      },
      onDone: () => {
        onStreamReady?.()
      },
    },
  )

  if (streamError) throw streamError
  if (!streamedContent && pendingToolCalls.length === 0) return null

  return {
    content: streamedContent,
    toolCalls: pendingToolCalls,
    finishReason: pendingToolCalls.length > 0 ? "tool_calls" : "stop",
  }
}

export async function runWorkspaceAgent(
  roleConfig: AgentRoleConfig,
  providers: GatewayProvider[],
  userMessage: string,
  conversationHistory: ChatMessage[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
  onStreamReady?: () => void,
  onToken?: (token: string) => void,
  callbacks?: AgentCallbacks,
): Promise<AgentResult> {
  const provider = providers.find((p) => p.id === roleConfig.providerId)
  if (!provider) {
    throw new Error(`Provider not found for role "${roleConfig.name}" (providerId: ${roleConfig.providerId})`)
  }

  const model = roleConfig.model
  if (!model) {
    throw new Error(`No model configured for role "${roleConfig.name}"`)
  }

  const maxTokens = roleConfig.maxTokens ?? getEffectiveMaxTokens(roleConfig.runtimeRole ?? roleConfig.id, model)

  const agentConfig: AgentConfig = {
    role: roleConfig.runtimeRole ?? roleConfig.id,
    endpoint: provider.baseUrl,
    apiKey: provider.apiKey,
    runtime: provider.runtime,
    model,
    maxTokens,
    providerId: provider.id,
    providerName: provider.name,
  }

  return runAgent(agentConfig, userMessage, conversationHistory, onProgress, signal, onToken, onStreamReady, callbacks)
}

const MINIMAL_MAX_TOKENS = 1024

export async function fastChatCompletion(
  endpoint: string,
  apiKey: string,
  model: string,
  userMessage: string,
  conversationHistory: ChatMessage[],
  signal?: AbortSignal,
  onToken?: (token: string) => void,
  onStreamReady?: () => void,
): Promise<AgentResult> {
  const startedAt = Date.now()
  const logTag = "[FastChat]"
  console.log(`${logTag} start`, {
    model,
    endpoint: endpoint?.slice(0, 60),
    apiKeyPresent: !!apiKey,
    messageLength: userMessage.length,
    historyLength: conversationHistory.length,
  })

  const messages: ChatMessage[] = [
    { role: "system", content: FAST_CHAT_PROMPT },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ]

  let content = ""
  let usage: UsageInfo = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  const fastConfig: AgentConfig = {
    role: "fast-assistant",
    endpoint,
    apiKey,
    runtime: null,
    model,
    maxTokens: 4096,
  }

  // Try streaming first if onToken is provided
  if (onToken) {
    try {
      let streamError: Error | null = null
      await transport.streamChatCompletion(
        toAdapterConfig(fastConfig),
        { model, messages, maxTokens: 4096, signal },
        {
          onToken: (token: string) => {
            content += token
            onToken(token)
          },
          onToolCallBegin: () => {},
          onToolCallDelta: () => {},
          onToolCallEnd: () => {},
          onFinish: () => {},
          onError: (error: TransportError) => {
            streamError = new Error(error.message)
          },
          onDone: () => {
            onStreamReady?.()
          },
        },
      )
      if (streamError) throw streamError
    } catch {
      console.warn(`${logTag} streaming failed, falling back to non-streaming`)
    }
  }

  // Fallback to non-streaming
  if (!content) {
    try {
      const result = await transport.chatCompletion(
        toAdapterConfig(fastConfig),
        { model, messages, maxTokens: 4096, signal },
      )
      content = result.content
      if (result.usage) {
        usage = {
          prompt_tokens: result.usage.promptTokens,
          completion_tokens: result.usage.completionTokens,
          total_tokens: result.usage.totalTokens,
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Fast chat completion failed: ${msg}`)
    }
  }

  const elapsed = Date.now() - startedAt
  console.log(`${logTag} completed in ${elapsed}ms`, { length: content.length })

  return {
    role: "fast-assistant",
    response: content,
    messages,
    usage,
  }
}

export async function runRuntimeAgent(
  role: string,
  userMessage: string,
  conversationHistory: ChatMessage[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
  onStreamReady?: () => void,
  onToken?: (token: string) => void,
  callbacks?: AgentCallbacks,
): Promise<AgentResult> {
  const { wiredAgents } = useWorkspaceRuntime.getState()
  const providers = useAppStore.getState().providers ?? []

  const managedRole = normalizeRole(role) ?? role
  const wired = wiredAgents.find((a) => a.runtimeRole === managedRole || a.roleId === managedRole || a.runtimeRole === role)
  if (!wired) {
    console.error(`[runRuntimeAgent] ROLE NOT WIRED`, { role, managedRole, wiredAgents: wiredAgents.map(a => ({ runtimeRole: a.runtimeRole, roleId: a.roleId, providerId: a.providerId })) })
    throw new Error(`Runtime role "${role}" is not wired. Configure it in Settings → Roles.`)
  }

  const provider = providers.find((p) => p.id === wired.providerId)
  if (!provider) {
    console.error(`[runRuntimeAgent] PROVIDER NOT FOUND`, { role, managedRole, wiredProviderId: wired.providerId, wiredModel: wired.model, availableProviders: providers.map(p => ({ id: p.id, name: p.name, baseUrl: p.baseUrl?.slice(0, 40) })) })
    throw new Error(`Provider "${wired.providerId}" assigned to role "${role}" no longer exists. Go to Settings → Roles to fix this.`)
  }

  if (!wired.model) {
    throw new Error(`Role "${role}" has no model selected. Go to Settings → Roles and select a model for the ${role} role.`)
  }

  if (!provider.apiKey) {
    throw new Error(`Provider "${provider.name}" has no API key. Go to Settings → Providers and add your API key.`)
  }

  console.log(`[runRuntimeAgent] resolved`, {
    role,
    wiredRuntimeRole: wired.runtimeRole,
    wiredProviderId: wired.providerId,
    providerName: provider.name,
    model: wired.model,
    baseUrl: provider.baseUrl?.slice(0, 60),
    runtime: provider.runtime,
    apiKeyPresent: !!provider.apiKey,
  })

  const roleConfig = useAppStore.getState().roleConfigs.find((r) => r.runtimeRole === role || r.id === role)
  const maxTokens = roleConfig?.maxTokens ?? getEffectiveMaxTokens(role, wired.model)

  const agentConfig: AgentConfig = {
    role: wired.runtimeRole,
    endpoint: provider.baseUrl,
    apiKey: provider.apiKey,
    runtime: provider.runtime,
    model: wired.model,
    maxTokens,
    providerId: provider.id,
    providerName: provider.name,
  }

  return runAgent(agentConfig, userMessage, conversationHistory, onProgress, signal, onToken, onStreamReady, callbacks)
}
