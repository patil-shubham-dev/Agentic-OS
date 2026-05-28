import { useAgentStore } from "@/stores/agent-store"
import { useAppStore } from "@/stores/app-store"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useWorkspaceRuntime } from "@/runtime/workspace-runtime"
import { useTimelineStore } from "@/components/workspace/timeline/timeline-store"
import { route as managerRoute } from "@/runtime/manager-routing-engine"
import type { RoutingDecision } from "@/runtime/manager-routing-engine"
import { TaskGraphRuntime, type RuntimeTaskGraph } from "@/runtime/task-graph/TaskGraphRuntime"
import { ContextManager } from "@/runtime/context/ContextManager"
import { AgentWorker } from "@/runtime/agents/AgentWorker"
import { executionEngine } from "@/runtime/execution-engine"
import { EXECUTION_MODES, applyModeConstraints } from "@/runtime/execution-mode"
import { compressConversationHistory } from "@/runtime/context/HistoryCompressor"
import { summarizeMessages, getMemoryPressure } from "@/runtime/memory-manager"
import { RUNTIME_TOKEN_LIMITS } from "@/runtime/runtime-token-config"
import { EventBus } from "@/runtime/render-engine/event-bus"
import { SynthesisEngine } from "@/runtime/execution/SynthesisEngine"
import { RuntimeSupervisor } from "@/runtime/RuntimeSupervisor"
import { startTrace, trace, endTrace } from "@/lib/execution-trace"
import { safeValidateProvider } from "@/lib/provider-manager"
import { normalizeRole } from "@/lib/role-identity"
import { fastChatCompletion } from "@/lib/agents/orchestrator"
import type { AgentCallbacks } from "@/lib/agents/orchestrator"
import type { RuntimeRole } from "@/types"
import { SpanProcessor } from "@/runtime/telemetry/SpanProcessor"
import { ProviderInspector } from "@/runtime/observability/ProviderInspector"

export interface ExecuteOptions {
  input: string
  activeRole: RuntimeRole
  signal?: AbortSignal
}

export interface ExecuteResult {
  traceId: string
  success: boolean
  failures: number
  totalDurationMs: number
  filesEdited: number
  commandsRun: number
  browserActions: number
}

const eventBus = EventBus.getInstance()
const synthesisEngine = new SynthesisEngine()
const runtimeSupervisor = new RuntimeSupervisor()

export class ExecutionOrchestrator {
  private static instance: ExecutionOrchestrator
  private taskGraphRuntime = new TaskGraphRuntime()

  static getInstance(): ExecutionOrchestrator {
    if (!ExecutionOrchestrator.instance) {
      ExecutionOrchestrator.instance = new ExecutionOrchestrator()
    }
    return ExecutionOrchestrator.instance
  }

  buildTaskGraph(input: string, roles: RuntimeRole[]): RuntimeTaskGraph {
    return this.taskGraphRuntime.buildParallelGraph(input, roles)
  }

  async buildAgentContext(input: string, role: string): Promise<string> {
    const context = await ContextManager.getInstance().buildContext(input, role)
    return context.promptBlock
  }

  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    const { input, activeRole, signal: userSignal } = options
    const t0 = performance.now()
    const traceId = `msg_${Date.now()}`
    const ctrl = new AbortController()
    const agentResults: { role: string; content: string }[] = []

    const spanProcessor = SpanProcessor.getInstance()
    const providerInspector = ProviderInspector.getInstance()

    // ── OpenTelemetry-style root span for this execution ──
    const execSpan = spanProcessor.startSpan("execute", {
      kind: "server",
      attributes: {
        inputLength: input.length,
        activeRole,
        traceId,
      },
      resource: { service: "execution-orchestrator" },
    })

    if (userSignal) {
      if (userSignal.aborted) ctrl.abort()
      userSignal.addEventListener("abort", () => ctrl.abort(), { once: true })
    }
    let totalFilesEdited = 0
    let totalCommandsRun = 0
    let totalBrowserActions = 0

    startTrace(traceId)
    trace(traceId, "message_received", { length: input.length })

    eventBus.emit({
      type: "USER_MESSAGE",
      content: input,
      timestamp: Date.now(),
    })

    const store = useAgentStore.getState()
    const activeRole_ = activeRole
    store.addMessage(activeRole_, { role: "user", content: input, timestamp: Date.now() })
    executionEngine.startTask(traceId)

    const runtimeState = useWorkspaceRuntime.getState()
    const providers = useAppStore.getState().providers ?? []

    trace(traceId, "routing_start")
    const runtimeRoles = runtimeState.wiredRuntimeRoles
    const decision = this.assignAgentForTask(input, runtimeRoles)
    trace(traceId, "routing_end", { strategy: decision.executionStrategy, roles: decision.selectedRoles })

    const history = this.getProcessedHistory(activeRole_)
    const runtimeStatus = runtimeState.status

    if (runtimeStatus === "uninitialized" || runtimeStatus === "initializing") {
      store.addMessage(activeRole_, {
        role: "assistant",
        content: "**Runtime is still initializing**\n\nThe workspace runtime has not finished loading. Please wait a moment and try again.",
        timestamp: Date.now(),
      })
      spanProcessor.endSpan(execSpan, "error", "Runtime not ready")
      return { traceId, success: false, failures: 1, totalDurationMs: 0, filesEdited: 0, commandsRun: 0, browserActions: 0 }
    }

    if (runtimeStatus === "error") {
      store.addMessage(activeRole_, {
        role: "assistant",
        content: "**Runtime Error**\n\nThe workspace runtime encountered an error. Check Settings → Providers.",
        timestamp: Date.now(),
      })
      spanProcessor.endSpan(execSpan, "error", "Runtime error state")
      return { traceId, success: false, failures: 1, totalDurationMs: 0, filesEdited: 0, commandsRun: 0, browserActions: 0 }
    }

    if (runtimeState.wiredRoles === 0 && runtimeState.wiredAgents.length === 0) {
      store.addMessage(activeRole_, {
        role: "assistant",
        content: "**No Agents Configured**\n\nGo to **Settings → Providers** and add a provider.",
        timestamp: Date.now(),
      })
      spanProcessor.endSpan(execSpan, "error", "No agents configured")
      return { traceId, success: false, failures: 1, totalDurationMs: 0, filesEdited: 0, commandsRun: 0, browserActions: 0 }
    }

    if (!runtimeState.managerWired) {
      store.addMessage(activeRole_, {
        role: "assistant",
        content: "**Manager Agent Not Configured**\n\nPlease configure the Manager role in **Settings → Roles**.",
        timestamp: Date.now(),
      })
      spanProcessor.endSpan(execSpan, "error", "Manager not wired")
      return { traceId, success: false, failures: 1, totalDurationMs: 0, filesEdited: 0, commandsRun: 0, browserActions: 0 }
    }

    // ── Route to direct response or delegated execution ──
    if (!decision.requiresDelegation) {
      const result = await this.handleDirectResponse(input, activeRole_, history, ctrl, t0, traceId)
      spanProcessor.endSpan(execSpan, result.success ? "ok" : "error", result.failures > 0 ? `Failed: ${result.failures} failures` : undefined)
      return result
    }

    const result = await this.handleDelegatedExecution(input, activeRole_, decision, history, ctrl, t0, traceId, providers, agentResults)
    spanProcessor.endSpan(execSpan, result.success ? "ok" : "error", result.failures > 0 ? `Failed: ${result.failures} failures` : undefined)
    return result
  }

  private assignAgentForTask(userInput: string, wiredRoles: RuntimeRole[]): RoutingDecision {
    const store = useAgentStore.getState()
    store.clearAssignments()
    store.clearOrchestrationSteps()

    const decision = managerRoute(userInput, wiredRoles)
    const executionMode = store.executionMode
    const constrainedRoles = applyModeConstraints(executionMode, [...decision.selectedRoles])
      .filter((role, index, roles) => roles.indexOf(role) === index)
    const constrainedDecision: RoutingDecision = {
      ...decision,
      selectedRoles: constrainedRoles as RoutingDecision["selectedRoles"],
    }

    for (const role of constrainedDecision.selectedRoles) {
      store.addAgentAssignment({ role, reason: constrainedDecision.reasoning, status: "active", startedAt: Date.now() })
    }

    store.addOrchestrationStep({
      type: constrainedDecision.requiresDelegation ? "delegate" : "analyze",
      agent: constrainedDecision.selectedRoles[0] ?? "manager",
      description: constrainedDecision.reasoning,
      status: "running",
    })

    useWorkspaceStore.getState().setOrchestrationState(constrainedDecision.requiresDelegation ? "executing" : "analyzing")

    eventBus.emit({
      type: "ROUTING_DECISION",
      reasoning: constrainedDecision.reasoning,
      selectedRoles: constrainedDecision.selectedRoles,
      context: `Intent: ${constrainedDecision.intentCategory}`,
      timestamp: Date.now(),
    })

    return constrainedDecision
  }

  private getProcessedHistory(activeRole: RuntimeRole): any[] {
    const conversations = useAgentStore.getState().conversations
    const currentMessages = conversations[activeRole]?.messages ?? []
    const history = currentMessages.filter((m: any) => m.role !== "system")

    if (history.length > RUNTIME_TOKEN_LIMITS.MAX_CONTEXT_MESSAGES) {
      const compressed = summarizeMessages(history, RUNTIME_TOKEN_LIMITS.MAX_HISTORY_TOKENS)
      const pressure = getMemoryPressure(compressed)
      const runtime = useWorkspaceRuntime.getState()
      runtime.setMemoryPressure(pressure)
      runtime.setTokenUsage(compressed.totalTokens)
      return compressConversationHistory(history)
    }

    return history
  }

  private async handleDirectResponse(
    input: string,
    activeRole: RuntimeRole,
    history: any[],
    ctrl: AbortController,
    t0: number,
    traceId: string,
  ): Promise<ExecuteResult> {
    const spanProcessor = SpanProcessor.getInstance()
    const providerInspector = ProviderInspector.getInstance()

    const directSpan = spanProcessor.startSpan("direct_response", {
      kind: "client",
      attributes: { inputLength: input.length, activeRole, traceId },
      resource: { service: "execution-orchestrator" },
    })

    const store = useAgentStore.getState()
    const runtimeState = useWorkspaceRuntime.getState()

    executionEngine.classifyIntent()
    const wiredForFastChat = runtimeState.wiredAgents.find((a) => a.runtimeRole === "manager") ?? runtimeState.wiredAgents[0]

    if (wiredForFastChat) {
      const fcT0 = performance.now()
      const stepId = useTimelineStore.getState().generateId()
      trace(traceId, "fast_chat_start", { role: wiredForFastChat.runtimeRole })
      const providers = useAppStore.getState().providers ?? []
      const fcProvider = providers.find((p) => p.id === wiredForFastChat.providerId)

      if (!fcProvider) {
        executionEngine.fail(`Provider "${wiredForFastChat.providerId}" not found for fast chat`)
        spanProcessor.endSpan(directSpan, "error", "Fast-chat provider not found")
        return { traceId, success: false, failures: 1, totalDurationMs: Math.round(performance.now() - t0), filesEdited: 0, commandsRun: 0, browserActions: 0 }
      }

      executionEngine.startDelegation(wiredForFastChat.runtimeRole, wiredForFastChat.model, fcProvider.name)

      // Emit AGENT_ASSIGNED for timeline rendering
      eventBus.emit({
        type: "AGENT_ASSIGNED",
        roleId: wiredForFastChat.runtimeRole,
        roleName: wiredForFastChat.runtimeRole.charAt(0).toUpperCase() + wiredForFastChat.runtimeRole.slice(1),
        modelName: wiredForFastChat.model,
        providerName: fcProvider.name,
        timestamp: Date.now(),
        stepId,
      })

      // Capture provider request through ProviderInspector
      providerInspector.captureRequest({
        baseUrl: fcProvider.baseUrl,
        model: wiredForFastChat.model,
        endpoint: "/chat/completions",
        headers: { authorization: "Bearer ***" },
        body: { model: wiredForFastChat.model, messages: history.slice(-2) },
        timestamp: performance.now(),
        traceId,
      })

      const fastChatSpan = spanProcessor.createChildSpan(directSpan, "fast_chat_completion", "client", {
        provider: fcProvider.name,
        model: wiredForFastChat.model,
      })

      let streamedContent = ""

      try {
        const result = await fastChatCompletion(
          fcProvider.baseUrl, fcProvider.apiKey, wiredForFastChat.model,
          input, history, ctrl.signal,
          (token: string) => {
            streamedContent += token
            eventBus.emit({
              type: "TOKEN_STREAM",
              stepId,
              role: wiredForFastChat.runtimeRole,
              token,
            })
            providerInspector.captureStreamChunk({
              providerId: wiredForFastChat.providerId ?? "unknown",
              rawChunk: token,
              normalizedDelta: token,
              accumulated: streamedContent,
              chunkIndex: streamedContent.length,
              timestamp: performance.now(),
              traceId,
              hasToolCall: false,
              toolCallPartial: false,
            })
          },
        )

        // Capture provider response
        providerInspector.captureResponse({
          statusCode: 200,
          headers: {},
          body: { content: result.response.slice(0, 100) },
          durationMs: Math.round(performance.now() - fcT0),
          timestamp: performance.now(),
          traceId,
        })

        trace(traceId, "fast_chat_end", { elapsedMs: performance.now() - fcT0 })
        executionEngine.completeDelegation(wiredForFastChat.runtimeRole, performance.now() - fcT0, result.usage.total_tokens)
        executionEngine.complete()

        spanProcessor.endSpan(fastChatSpan, "ok")
        spanProcessor.endSpan(directSpan, "ok")

        store.addMessage(activeRole, { role: "assistant", content: result.response, timestamp: Date.now() })
        return { traceId, success: true, failures: 0, totalDurationMs: Math.round(performance.now() - t0), filesEdited: 0, commandsRun: 0, browserActions: 0 }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        spanProcessor.endSpan(fastChatSpan, "error", msg)
        spanProcessor.endSpan(directSpan, "error", msg)
        throw err
      }
    }

    executionEngine.fail("No agent available for direct response")
    store.addMessage(activeRole, {
      role: "assistant",
      content: "No agent available. Configure a provider in Settings → Providers.",
      timestamp: Date.now(),
    })
    spanProcessor.endSpan(directSpan, "error", "No wired agent for direct response")
    return { traceId, success: false, failures: 1, totalDurationMs: Math.round(performance.now() - t0), filesEdited: 0, commandsRun: 0, browserActions: 0 }
  }

  private async handleDelegatedExecution(
    input: string,
    activeRole: RuntimeRole,
    decision: RoutingDecision,
    history: any[],
    ctrl: AbortController,
    t0: number,
    traceId: string,
    providers: any[],
    agentResults: { role: string; content: string }[],
  ): Promise<ExecuteResult> {
    const spanProcessor = SpanProcessor.getInstance()
    const providerInspector = ProviderInspector.getInstance()

    const delegationSpan = spanProcessor.startSpan("delegated_execution", {
      kind: "server",
      attributes: {
        inputLength: input.length,
        activeRole,
        strategy: decision.executionStrategy,
        roles: decision.selectedRoles.join(","),
        traceId,
      },
      resource: { service: "execution-orchestrator" },
    })

    const store = useAgentStore.getState()
    const runtimeState = useWorkspaceRuntime.getState()

    executionEngine.selectRoles(decision.selectedRoles)

    const MAX_CONSECUTIVE_FAILURES = 2
    let failures = 0
    let totalFilesEdited = 0
    let totalCommandsRun = 0
    let totalBrowserActions = 0

    const taskGraphSpan = spanProcessor.createChildSpan(delegationSpan, "build_task_graph", "internal", {
      roles: decision.selectedRoles.join(","),
    })
    const taskGraph = this.buildTaskGraph(input, decision.selectedRoles)
    spanProcessor.endSpan(taskGraphSpan, "ok")

    for (const parallelGroup of taskGraph.executionOrder) {
      if (ctrl.signal.aborted) break

      const groupPromises = parallelGroup.map(async (taskId) => {
        const task = taskGraph.tasks.find((t) => t.id === taskId)
        if (!task) return

        const role = task.role
        const runtimeRole = normalizeRole(role) ?? role

        if (!runtimeRole) {
          console.warn(`[Orchestrator] Cannot normalize role "${role}" — skipping`)
          store.addMessage(activeRole, {
            role: "assistant",
            content: `Unknown role "${role}". Cannot resolve runtime identity.`,
            timestamp: Date.now(),
          })
          failures++
          return
        }

        try {
          const provider = providers.find((p) => {
            const wired = runtimeState.wiredAgents.find((a) => a.runtimeRole === runtimeRole || a.roleId === runtimeRole)
            return wired && p.id === wired.providerId
          })
          if (provider) {
          safeValidateProvider(provider.baseUrl, provider.apiKey).catch(() => {/* validation is best-effort */})
        }
      } catch { /* provider lookup is best-effort */ }

        const stepId = useTimelineStore.getState().generateId()
        const wiredAgentInfo = runtimeState.wiredAgents.find((a) => a.runtimeRole === runtimeRole || a.roleId === runtimeRole)

        eventBus.emit({
          type: "AGENT_ASSIGNED",
          roleId: runtimeRole,
          roleName: runtimeRole.charAt(0).toUpperCase() + runtimeRole.slice(1),
          modelName: wiredAgentInfo?.model,
          providerName: wiredAgentInfo?.providerName,
          timestamp: Date.now(),
          stepId,
        })

        let streamedContent = ""
        let streamMsgId = 0

        trace(traceId, "delegation_start", { role: runtimeRole })
        const delegationStart = performance.now()
        executionEngine.startDelegation(runtimeRole, wiredAgentInfo?.model, wiredAgentInfo?.providerName)

        // ── OpenTelemetry-style per-agent span ──
        const agentSpan = spanProcessor.createChildSpan(delegationSpan, `agent:${runtimeRole}`, "client", {
          role: runtimeRole,
          model: wiredAgentInfo?.model,
          provider: wiredAgentInfo?.providerName,
        })

        // Capture provider request through ProviderInspector
        const matchedProvider = providers.find((p) => {
          const wired = runtimeState.wiredAgents.find((a) => a.runtimeRole === runtimeRole || a.roleId === runtimeRole)
          return wired && p.id === wired.providerId
        })
        if (matchedProvider) {
          providerInspector.captureRequest({
            baseUrl: matchedProvider.baseUrl,
            model: wiredAgentInfo?.model ?? "",
            endpoint: "/chat/completions",
            headers: { authorization: "Bearer ***" },
            body: { model: wiredAgentInfo?.model, messages: history.slice(-2) },
            timestamp: performance.now(),
            traceId,
          })
        }

        try {
          const onAgentStreamReady = () => {
            if (!streamMsgId) {
              streamMsgId = Date.now()
              store.addOrchestrationStep({
                type: "execute",
                agent: role,
                description: `Streaming from ${runtimeRole}...`,
                status: "running",
              })
            }
          }

          const agentCallbacks: AgentCallbacks = {
            stepId,
            onStreamChunk: (chunk) => {
              eventBus.emit({
                type: "TOKEN_STREAM",
                stepId,
                role: runtimeRole,
                token: chunk,
              })
              // Capture streaming chunk through ProviderInspector
              providerInspector.captureStreamChunk({
                providerId: wiredAgentInfo?.providerId ?? "unknown",
                rawChunk: chunk,
                normalizedDelta: chunk,
                accumulated: streamedContent + chunk,
                chunkIndex: streamedContent.length,
                timestamp: performance.now(),
                traceId,
                hasToolCall: false,
                toolCallPartial: false,
              })
            },
            onToolCallStart: (tc) => {
              if (tc.name === "run_command") totalCommandsRun++
              if (tc.name.startsWith("browser_") || tc.name === "launch_browser") totalBrowserActions++
              eventBus.emit({
                type: "TOOL_START",
                stepId,
                role: runtimeRole,
                toolId: tc.id,
                toolName: tc.name,
                args: tc.args,
              })
            },
            onToolCallComplete: (tcId, result) => {
              eventBus.emit({
                type: "TOOL_COMPLETE",
                stepId,
                role: runtimeRole,
                toolId: tcId,
                result,
              })
            },
            onFileEdit: (fe) => {
              totalFilesEdited++
              eventBus.emit({
                type: "FILE_EDIT",
                stepId,
                role: runtimeRole,
                path: fe.path,
                oldContent: fe.oldContent ?? "",
                newContent: fe.newContent ?? "",
                additions: fe.additions ?? 0,
                deletions: fe.deletions ?? 0,
              })
            },
            onVerificationComplete: (vResult) => {
              // Update all file edits in this session with verification status
              const session = useTimelineStore.getState().agentSessions.get(stepId)
              if (session) {
                const updatedFileEdits = session.fileEdits.map((fe) => ({
                  ...fe,
                  verification: {
                    passed: vResult.passed,
                    typeCheckErrors: vResult.typeCheckErrors,
                    lintErrors: vResult.lintErrors,
                    summary: vResult.summary,
                  },
                }))
                useTimelineStore.getState().updateAgentSession(stepId, {
                  fileEdits: updatedFileEdits,
                })
              }
              // Timeline store updated above — no EventBus emit needed
            },
            onModelDetected: (modelName) => {
              eventBus.emit({
                type: "MODEL_DETECTED",
                stepId,
                modelName,
              })
            },
          }

          const roleSpecificInput = [
            input,
            await ContextManager.getInstance().buildContext(input, runtimeRole).then((c) => c.promptBlock),
          ].filter(Boolean).join("\n\n")

          const worker = new AgentWorker(runtimeRole as RuntimeRole)
          const agentStream = worker.execute({
            role: runtimeRole as RuntimeRole,
            input: roleSpecificInput,
            history,
            callbacks: agentCallbacks,
            signal: ctrl.signal,
          })

          for await (const event of agentStream) {
            switch (event.type) {
              case "THINKING":
              case "STREAM_READY":
                onAgentStreamReady()
                break
              case "CONTEXT_LOADED":
                store.addOrchestrationStep({
                  type: "analyze",
                  agent: role,
                  description: `Loaded context for ${runtimeRole}`,
                  status: "done",
                })
                break
              case "COMPLETE":
                if (event.result) streamedContent = event.result
                break
              case "ERROR":
                throw new Error(event.error)
            }
          }

          trace(traceId, "delegation_complete", { role: runtimeRole, chars: streamedContent.length, elapsedMs: Math.round(performance.now() - delegationStart) })

          eventBus.emit({
            type: "AGENT_COMPLETE",
            stepId,
            role: runtimeRole,
            status: "complete",
          })
          executionEngine.completeDelegation(runtimeRole, Math.round(performance.now() - delegationStart))

          // End per-agent span with success
          spanProcessor.endSpan(agentSpan, "ok", `Completed in ${Math.round(performance.now() - delegationStart)}ms`)

          if (streamedContent) {
            agentResults.push({ role: runtimeRole, content: streamedContent })
          }
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e)
          console.error(`[Orchestrator] Agent ${role} failed`, errMsg)

          // End per-agent span with error
          spanProcessor.endSpan(agentSpan, "error", errMsg.slice(0, 200))

          eventBus.emit({
            type: "EXECUTION_ERROR",
            stepId,
            role,
            message: errMsg.slice(0, 300),
            suggestion: "Check your provider settings and API key, then try again.",
          })
          executionEngine.fail(errMsg, runtimeRole)
          failures++

          if (e instanceof Error && e.name === "AbortError") return

          const isFetchError = errMsg.includes("fetch") || errMsg.includes("network") || errMsg.includes("connect") || errMsg.includes("Failed to fetch")

          if (!streamMsgId) {
            const errorContent = isFetchError
              ? `**Provider request failed for ${runtimeRole}**\n\n_${errMsg.slice(0, 300)}_\n\nCheck **Settings → Providers** that the endpoint, API key, and model are correct.`
              : `Agent **${runtimeRole}** encountered an error:\n\n_${errMsg}_`
            store.addMessage(activeRole, {
              role: "assistant",
              content: errorContent,
              timestamp: Date.now(),
            })
          }
        }
      })

      await Promise.allSettled(groupPromises)

      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        store.addMessage(activeRole, {
          role: "assistant",
          content: "Too many consecutive failures. Aborting orchestration.",
          timestamp: Date.now(),
        })
        break
      }
    }

    // ── Synthesis span (multi-agent merge) ──
    if (decision.executionStrategy === "multi-agent" && agentResults.length > 0) {
      const synthesisSpan = spanProcessor.createChildSpan(delegationSpan, "synthesis", "internal", {
        agentCount: agentResults.length,
      })
      try {
        const synthesized = await synthesisEngine.synthesize(input, agentResults, history, ctrl.signal)
        store.addMessage(activeRole, {
          role: "assistant",
          content: synthesized,
          timestamp: Date.now(),
        })
        spanProcessor.endSpan(synthesisSpan, "ok")
      } catch (e) {
        const synthErr = e instanceof Error ? e.message : String(e)
        console.error("[Orchestrator] Synthesis failed", synthErr)
        executionEngine.fail(synthErr, "manager")
        spanProcessor.endSpan(synthesisSpan, "error", synthErr)
      }
    }

    const totalElapsed = performance.now() - t0
    endTrace(traceId)

    eventBus.emit({
      type: "EXECUTION_SUMMARY",
      filesEdited: totalFilesEdited,
      commandsRun: totalCommandsRun,
      browserActions: totalBrowserActions,
      durationMs: Math.round(totalElapsed),
      modelName: runtimeState.wiredAgents.find((a) => a.runtimeRole === activeRole)?.model,
      status: ctrl.signal.aborted || failures > 0 ? "error" : "complete",
    })

    if (ctrl.signal.aborted) {
      executionEngine.cancel()
    } else {
      executionEngine.complete()
    }

    const overallSuccess = failures === 0 && !ctrl.signal.aborted
    spanProcessor.endSpan(delegationSpan, overallSuccess ? "ok" : "error", overallSuccess ? undefined : `Failures: ${failures}`)

    return {
      traceId,
      success: overallSuccess,
      failures,
      totalDurationMs: Math.round(totalElapsed),
      filesEdited: totalFilesEdited,
      commandsRun: totalCommandsRun,
      browserActions: totalBrowserActions,
    }
  }

  cancel(): void {
    executionEngine.cancel()
  }
}
