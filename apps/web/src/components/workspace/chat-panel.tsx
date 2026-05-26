import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAgentStore } from "@/stores/agent-store"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useWorkspaceRuntime } from "@/runtime/workspace-runtime"
import { ExecutionSessionManager, type ExecutionSession } from "@/runtime/sessions/ExecutionSessionManager"
import { EXECUTION_MODES } from "@/runtime/execution-mode"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"
import { cn } from "@/lib/utils"
import { ExecutionTimeline } from "./timeline/execution-timeline"
import { ContextBar } from "./timeline/context-bar"
import { AssistantInput } from "./timeline/assistant-input"
import { SessionBar } from "./timeline/SessionBar"
import { ApprovalGate } from "./approval-gate"
import {
  Bot, ChevronDown, Cpu, Zap, Target, BookOpen, UserCheck, Shield,
  AlertTriangle,
} from "lucide-react"

const MODE_ICONS: Record<string, typeof Cpu> = {
  autonomous: Cpu, fastest: Zap,
  most_accurate: Target, research_heavy: BookOpen,
  human_guided: UserCheck, safe_mode: Shield,
}

function buildModeConfig() {
  const entries: Record<string, { icon: typeof Cpu; label: string; color: string; desc: string }> = {}
  for (const [id, mode] of Object.entries(EXECUTION_MODES)) {
    entries[id] = { icon: MODE_ICONS[id] ?? Cpu, label: mode.label, color: mode.color, desc: mode.description }
  }
  return entries
}

const MODE_CONFIG = buildModeConfig()
const executionSessionManager = ExecutionSessionManager.getInstance()

export function ChatPanel() {
  const activeRole = useAgentStore((s) => s.activeRole)
  const isProcessing = useAgentStore((s) => s.isProcessing)
  const addMessage = useAgentStore((s) => s.addMessage)
  const executionMode = useAgentStore((s) => s.executionMode)
  const setExecutionMode = useAgentStore((s) => s.setExecutionMode)
  const streamState = useAgentStore((s) => s.streamState)
  const runtimeStatus = useWorkspaceRuntime((s) => s.status)
  const runtimeReady = useWorkspaceRuntime((s) => s.isReady)
  const memoryPressure = useWorkspaceRuntime((s) => s.memoryPressure)
  const tokenUsage = useWorkspaceRuntime((s) => s.tokenUsage)
  const wiredAgents = useWorkspaceRuntime((s) => s.wiredAgents)
  const rootPath = useWorkspaceStore((s) => s.rootPath)
  const workspaceName = rootPath ? rootPath.split(/[/\\]/).pop() || rootPath : null

  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false)
  const [currentSession, setCurrentSession] = useState<ExecutionSession | null>(null)

  useEffect(() => {
    useRuntimeProjectionStore.getState().initialize()
    return () => {
      useRuntimeProjectionStore.getState().destroy()
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [activeRole])

  const modelName = useMemo(() => {
    const wired = wiredAgents.find((a) => a.runtimeRole === activeRole)
    return wired?.model
  }, [wiredAgents, activeRole])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isProcessing) return

    const userInput = input.trim()
    addMessage(activeRole, { role: "user", content: userInput, timestamp: Date.now() })
    setInput("")
    useAgentStore.getState().setProcessing(true)

    try {
      const session = await executionSessionManager.start({
        input: userInput,
        activeRole,
      })
      setCurrentSession(session)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[ChatPanel] Execution failed:", msg)
      useAgentStore.getState().addMessage(activeRole, {
        role: "assistant",
        content: `⚠️ Execution failed: ${msg}`,
        timestamp: Date.now(),
      })
    } finally {
      useAgentStore.getState().setProcessing(false)
    }
  }, [input, activeRole, isProcessing, addMessage])

  const handleCancel = useCallback(() => {
    if (currentSession) {
      executionSessionManager.cancel(currentSession.id)
    }
    useAgentStore.getState().setProcessing(false)
  }, [currentSession])

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0a0a0b] to-[#09090a]">
      {/* Premium header with glass effect */}
      <div className="relative border-b border-white/[0.06] bg-gradient-to-r from-[#0c0c0d] via-[#0c0c0d] to-[#0b0b0c]">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.02] to-transparent" />
        <div className="relative flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{
                scale: isProcessing ? [1, 1.05, 1] : 1,
              }}
              transition={{ duration: 2, repeat: isProcessing ? Infinity : 0 }}
              className={cn(
                "flex items-center justify-center h-5 w-5 rounded-lg shrink-0 transition-all duration-300",
                isProcessing
                  ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20"
                  : "bg-blue-500/10 border border-blue-500/10",
              )}
            >
              <Bot className={cn(
                "h-2.5 w-2.5 transition-all duration-300",
                isProcessing ? "text-blue-400" : "text-blue-400/70",
              )} />
            </motion.div>
            <span className={cn(
              "text-[11px] font-semibold transition-all duration-300",
              isProcessing ? "text-white/80" : "text-white/70",
            )}>
              Assistant
              {isProcessing && (
                <span className="inline-flex items-center gap-1 ml-2 text-[9px] font-normal">
                  <span className="inline-flex gap-0.5">
                    <span className="h-1 w-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1 w-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1 w-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="text-blue-400/60 font-medium">
                    {streamState === "streaming" ? "Streaming" : "Processing"}
                  </span>
                </span>
              )}
            </span>

            {/* Memory Pressure Indicator — premium gradient badge */}
            {memoryPressure > 70 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md border",
                  memoryPressure > 90
                    ? "bg-gradient-to-r from-red-500/10 to-red-600/5 border-red-500/15"
                    : "bg-gradient-to-r from-amber-500/10 to-amber-600/5 border-amber-500/15",
                )}
              >
                <AlertTriangle className={cn(
                  "h-2.5 w-2.5",
                  memoryPressure > 90 ? "text-red-400 animate-pulse" : "text-amber-400",
                )} />
                <span className={cn(
                  "font-medium",
                  memoryPressure > 90 ? "text-red-400/80" : "text-amber-400/80",
                )}>
                  {memoryPressure}% mem
                </span>
              </motion.div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setModeSelectorOpen(!modeSelectorOpen)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-medium transition-all",
                "bg-gradient-to-r from-blue-500/[0.04] to-purple-500/[0.04]",
                "border-white/[0.06] text-white/50",
                "hover:from-blue-500/[0.08] hover:to-purple-500/[0.08] hover:text-white/70",
              )}
            >
              <Cpu className={cn("h-2.5 w-2.5", MODE_CONFIG[executionMode].color)} />
              <span>{MODE_CONFIG[executionMode].label}</span>
              <ChevronDown className="h-2 w-2 text-white/30" />
            </button>
            <AnimatePresence>
              {modeSelectorOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -4 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-1 w-48 rounded-2xl border border-white/[0.08] bg-[#0d0d0e]/98 backdrop-blur-2xl shadow-2xl p-1.5 z-50"
                >
                  {Object.entries(MODE_CONFIG).map(([key, config]) => {
                    const Icon = config.icon
                    return (
                      <button
                        key={key}
                        onClick={() => { setExecutionMode(key as any); setModeSelectorOpen(false) }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[10px] transition-all",
                          executionMode === key
                            ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-400 border border-blue-500/10"
                            : "text-white/40 hover:bg-white/[0.04] hover:text-white/70 border border-transparent"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center h-6 w-6 rounded-lg shrink-0",
                          executionMode === key ? "bg-blue-500/15" : "bg-white/[0.04]",
                        )}>
                          <Icon className={cn("h-3 w-3", config.color)} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-semibold">{config.label}</div>
                          <div className="text-[8px] text-white/30 truncate">{config.desc}</div>
                        </div>
                        {executionMode === key && (
                          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <SessionBar />
      <ExecutionTimeline onSendMessage={sendMessage} />

      <ContextBar
        workspaceName={workspaceName}
        activeRole={activeRole}
        executionMode={executionMode}
        modelName={modelName}
        isProcessing={isProcessing}
        isReady={runtimeReady}
        memoryPressure={memoryPressure}
        tokenUsage={tokenUsage}
        onModeClick={() => setModeSelectorOpen(!modeSelectorOpen)}
      />

      {/* Approval Gate — appears when execution mode requires user approval */}
      <div className="px-3 pt-2">
        <ApprovalGate />
      </div>

      <div className="relative border-t border-white/[0.04] bg-gradient-to-t from-[#0a0a0b] via-[#0b0b0c] to-transparent px-3 pt-2 pb-3">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />
        <AssistantInput
          input={input}
          onInputChange={setInput}
          onSend={sendMessage}
          onCancel={handleCancel}
          isProcessing={isProcessing}
          inputRef={inputRef}
          modeLabel={MODE_CONFIG[executionMode].label}
          modeColor={MODE_CONFIG[executionMode].color}
          isReady={runtimeReady}
        />
      </div>
    </div>
  )
}
