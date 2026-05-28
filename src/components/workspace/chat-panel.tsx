import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAgentStore } from "@/stores/agent-store"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { useWorkspaceRuntime } from "@/runtime/workspace-runtime"
import { ExecutionSessionManager, type ExecutionSession } from "@/runtime/sessions/ExecutionSessionManager"
import { EXECUTION_MODES } from "@/runtime/execution-mode"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"
import { cn } from "@/lib/utils"
import { ConversationTimeline, Composer } from "./timeline/conversation"
import { ContextBar } from "./timeline/context-bar"
import { SessionBar } from "./timeline/SessionBar"
import { ApprovalGate } from "./approval-gate"
import {
  Bot, ChevronDown, Cpu, Zap, Target, BookOpen, UserCheck, Shield,
  AlertTriangle, Sparkles,
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
    const ts = Date.now()

    addMessage(activeRole, { role: "user", content: userInput, timestamp: ts })
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
      {/* Minimal header with status */}
      <div className="relative border-b border-white/[0.05]">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <motion.div
                animate={{
                  scale: isProcessing ? [1, 1.05, 1] : 1,
                }}
                transition={{ duration: 1.5, repeat: isProcessing ? Infinity : 0, ease: "easeInOut" }}
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-lg shrink-0 transition-all duration-300",
                  isProcessing
                    ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20"
                    : "bg-blue-500/8",
                )}
              >
                <Bot className={cn(
                  "h-3 w-3 transition-all duration-300",
                  isProcessing ? "text-blue-400" : "text-blue-400/50",
                )} />
              </motion.div>
              {isProcessing && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[11px] font-semibold transition-all duration-300",
                  isProcessing ? "text-white/80" : "text-white/65",
                )}>
                  Assistant
                </span>
                <span className="text-[8px] text-white/15 font-mono bg-white/[0.02] rounded px-1 py-0.5 border border-white/[0.03]">
                  {activeRole}
                </span>
              </div>
              {isProcessing && (
                <span className="flex items-center gap-1 text-[9px] text-blue-400/50 mt-0.5">
                  <span className="thinking-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  {streamState === "streaming" ? "Streaming" : "Processing"}
                </span>
              )}
            </div>

            {memoryPressure > 75 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-lg border shrink-0",
                  memoryPressure > 90
                    ? "border-red-500/15 bg-red-500/[0.04] text-red-400/60"
                    : "border-amber-500/10 bg-amber-500/[0.03] text-amber-400/50",
                )}
              >
                <AlertTriangle className="h-2 w-2" />
                {memoryPressure}%
              </motion.div>
            )}
          </div>

          {/* Mode selector */}
          <div className="relative">
            <button
              onClick={() => setModeSelectorOpen(!modeSelectorOpen)}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium transition-all",
                "bg-white/[0.02] border-white/[0.05] text-white/40",
                "hover:bg-white/[0.04] hover:text-white/60",
              )}
            >
              <Zap className={cn("h-2.5 w-2.5", MODE_CONFIG[executionMode].color)} />
              <span>{MODE_CONFIG[executionMode].label}</span>
              <ChevronDown className="h-2 w-2 text-white/20" />
            </button>
            <AnimatePresence>
              {modeSelectorOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -4 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-white/[0.06] bg-[#0d0d0e]/98 backdrop-blur-2xl shadow-2xl p-1 z-50"
                >
                  {Object.entries(MODE_CONFIG).map(([key, config]) => {
                    const Icon = config.icon
                    return (
                      <button
                        key={key}
                        onClick={() => { setExecutionMode(key as any); setModeSelectorOpen(false) }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] transition-all",
                          executionMode === key
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/8"
                            : "text-white/35 hover:bg-white/[0.03] hover:text-white/60 border border-transparent",
                        )}
                      >
                        <Icon className={cn("h-3 w-3", config.color)} />
                        <span className="font-medium">{config.label}</span>
                        {executionMode === key && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500" />
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

      {/* Conversation area - takes remaining space */}
      <div className="flex-1 overflow-hidden relative">
        <ConversationTimeline onSendMessage={sendMessage} />
      </div>

      {/* Context bar */}
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

      {/* Approval Gate */}
      <div className="px-3 pt-2">
        <ApprovalGate />
      </div>

      {/* Composer - floating bottom */}
      <div className="px-3 pb-2 pt-1">
        <Composer
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
