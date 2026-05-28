import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Square, AlertCircle, ChevronDown, ChevronRight, Code, FileText, Terminal, Globe, Loader2, Clock, Brain, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { ToolCallItem } from "./cards/tool-call-item"
import { FileEditDiff } from "./cards/file-edit-diff"
import { TerminalOutputCard } from "./cards/terminal-output-card"
import { StreamingTextMem } from "./step-card/streaming-text"
import { LiveToolStream } from "./step-card/live-tool-stream"
import { MessageActions } from "./step-card/message-actions"
import { MessageMetrics } from "./step-card/message-metrics"
import { SuggestedFollowups } from "./suggested-followups"
import { VerificationBadge, type FileEditVerification } from "./cards/verification-badge"

export type StepCardStatus = "running" | "complete" | "error" | "waiting"

export interface ToolCallRecord {
  id: string
  name: string
  args: string
  result?: string
  status: "pending" | "running" | "complete" | "error"
  durationMs?: number
}

export interface FileEditRecord {
  path: string
  additions: number
  deletions: number
  diffContent: string
  oldContent?: string
  newContent?: string
  /** Auto-verification result after the file edit round */
  verification?: FileEditVerification
}

export interface TerminalRecord {
  command: string
  output: string
  exitCode?: number
  status: "running" | "success" | "error"
}

interface StepCardProps {
  roleId: string
  roleName: string
  status: StepCardStatus
  streamingText: string
  toolCalls: ToolCallRecord[]
  fileEdits: FileEditRecord[]
  terminalOutputs: TerminalRecord[]
  modelName?: string
  providerName?: string
  onStop?: () => void
  reasoningText?: string
  startedAt?: number
  agentHandoffFrom?: string
  agentHandoffTo?: string
  onFollowUpSelect?: (prompt: string) => void
}

const STATUS_STYLES = {
  running: cn(
    "border-blue-500/30",
    "bg-gradient-to-b from-blue-500/[0.04] to-blue-500/[0.01]",
    "shadow-lg shadow-blue-500/[0.05]",
  ),
  complete: "border-foreground/6 bg-gradient-to-b from-foreground/[0.03] to-foreground/[0.01]",
  error: "border-red-500/30 bg-gradient-to-b from-red-500/[0.04] to-red-500/[0.01]",
  waiting: "border-foreground/3 bg-foreground/[0.01] opacity-60",
} as const

const SECTION_ICONS: Record<string, typeof Brain> = {
  reasoning: Brain,
  tools: Code,
  files: FileText,
  terminal: Terminal,
}

// ─── Inline helpers that didn't need extraction ───

function ReasoningStream({ text, isRunning }: { text: string; isRunning: boolean }) {
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (textRef.current && isRunning) {
      textRef.current.scrollTop = textRef.current.scrollHeight
    }
  }, [text, isRunning])

  if (!text) return null

  return (
    <div
      ref={textRef}
      className="px-3 py-2 bg-amber-500/[0.03] border-t border-amber-500/10 max-h-32 overflow-y-auto"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Brain className="h-2.5 w-2.5 text-amber-400/60" />
        <span className="text-[9px] text-amber-400/40 font-medium uppercase tracking-wider">Reasoning</span>
      </div>
      <p className="text-[10px] text-amber-300/60 leading-relaxed whitespace-pre-wrap">
        {text}
        {isRunning && (
          <span className="inline-block w-1.5 h-3 bg-amber-400/60 animate-pulse ml-0.5 align-middle" />
        )}
      </p>
    </div>
  )
}

const ReasoningStreamMem = memo(ReasoningStream)

function ThinkingPhase() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 px-3 py-3"
    >
      <div className="relative">
        <Brain className="h-3.5 w-3.5 text-blue-400/60" />
        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-blue-400/60 font-medium">Thinking</span>
        <span className="flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-blue-400/40 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-1 w-1 rounded-full bg-blue-400/40 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-1 w-1 rounded-full bg-blue-400/40 animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
      </div>
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="px-3 pb-3 space-y-2">
      <div className="h-3 bg-white/[0.04] rounded animate-pulse w-3/4" />
      <div className="h-3 bg-white/[0.04] rounded animate-pulse w-1/2" />
      <div className="h-3 bg-white/[0.04] rounded animate-pulse w-5/6" />
    </div>
  )
}

function AgentHandoff({ from, to }: { from?: string; to?: string }) {
  if (!from && !to) return null
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500/[0.03] via-white/[0.01] to-purple-500/[0.03] border-t border-white/[0.03]"
    >
      <Sparkles className="h-2.5 w-2.5 text-white/20" />
      {from && <span className="text-[9px] text-white/30 font-mono">{from}</span>}
      {from && to && <ChevronRight className="h-2.5 w-2.5 text-white/15" />}
      {to && <span className="text-[9px] text-white/30 font-mono">{to}</span>}
    </motion.div>
  )
}

const ElapsedTimer = memo(function ElapsedTimer({ startedAt, status }: { startedAt?: number; status: StepCardStatus }) {
  const [elapsed, setElapsed] = useState("0:00")

  useEffect(() => {
    if (!startedAt || status !== "running") {
      if (startedAt) {
        const seconds = Math.floor((Date.now() - startedAt) / 1000)
        setElapsed(`${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`)
      }
      return
    }

    const update = () => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(`${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startedAt, status])

  if (!startedAt) return null

  return (
    <span className="flex items-center gap-1 text-[9px] text-white/25">
      <Clock className="h-2.5 w-2.5" />
      {elapsed}
    </span>
  )
})

const StatusBadge = memo(function StatusBadge({ status }: { status: StepCardStatus }) {
  return (
    <>
      {status === "running" && (
        <span className="flex items-center gap-1 text-[10px] text-blue-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Working...
        </span>
      )}
      {status === "complete" && (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
          <Check size={11} />
          Complete
        </span>
      )}
      {status === "error" && (
        <span className="flex items-center gap-1 text-[10px] text-red-400">
          <AlertCircle size={11} />
          Error
        </span>
      )}
    </>
  )
})

const ROLE_GRADIENTS: Record<string, { bg: string; border: string }> = {
  coder: { bg: "from-blue-500/20 to-blue-600/10", border: "border-blue-500/15" },
  manager: { bg: "from-amber-500/20 to-amber-600/10", border: "border-amber-500/15" },
  browser: { bg: "from-sky-500/20 to-sky-600/10", border: "border-sky-500/15" },
  runtime: { bg: "from-cyan-500/20 to-cyan-600/10", border: "border-cyan-500/15" },
  design: { bg: "from-purple-500/20 to-purple-600/10", border: "border-purple-500/15" },
  vision: { bg: "from-pink-500/20 to-pink-600/10", border: "border-pink-500/15" },
  qa: { bg: "from-green-500/20 to-green-600/10", border: "border-green-500/15" },
  research: { bg: "from-indigo-500/20 to-indigo-600/10", border: "border-indigo-500/15" },
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  coder: <Code className="h-3 w-3 text-blue-400" />,
  manager: <Terminal className="h-3 w-3 text-amber-400" />,
  browser: <Globe className="h-3 w-3 text-sky-400" />,
  runtime: <Terminal className="h-3 w-3 text-cyan-400" />,
  design: <FileText className="h-3 w-3 text-purple-400" />,
  vision: <FileText className="h-3 w-3 text-pink-400" />,
  qa: <Check className="h-3 w-3 text-green-400" />,
  research: <FileText className="h-3 w-3 text-indigo-400" />,
}

function RoleIcon({ roleId }: { roleId: string }) {
  const gradient = ROLE_GRADIENTS[roleId] ?? { bg: "from-white/10 to-white/5", border: "border-white/10" }
  return (
    <div className={cn(
      "flex items-center justify-center h-6 w-6 rounded-xl bg-gradient-to-br shrink-0",
      gradient.bg,
      gradient.border,
      "border",
    )}>
      {ROLE_ICONS[roleId] || <Code className="h-3 w-3 text-white/40" />}
    </div>
  )
}

function SectionHeader({
  section,
  label,
  count,
  isExpanded,
  onToggle,
  extra,
}: {
  section: string
  label: string
  count: number
  isExpanded: boolean
  onToggle: () => void
  extra?: React.ReactNode
}) {
  const Icon = SECTION_ICONS[section] ?? ChevronRight
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-foreground/[0.03] transition-colors"
    >
      <div className="flex items-center gap-1.5">
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-foreground/30" />
        ) : (
          <ChevronRight className="h-3 w-3 text-foreground/30" />
        )}
        {section !== "reasoning" && (
          <Icon className="h-2.5 w-2.5 text-foreground/30" />
        )}
        <span className="text-[10px] text-foreground/40 font-medium">{label}</span>
        <span className="text-[9px] text-foreground/20">({count})</span>
      </div>
      {extra}
    </button>
  )
}

export const StepCard = memo(function StepCard({
  roleId,
  roleName,
  status,
  streamingText,
  toolCalls,
  fileEdits,
  terminalOutputs,
  modelName,
  providerName,
  onStop,
  reasoningText,
  startedAt,
  agentHandoffFrom,
  agentHandoffTo,
  onFollowUpSelect,
}: StepCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["tools", "files"]))

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }, [])

  const runningToolNames = useMemo(() => {
    const running = toolCalls.filter((tc) => tc.status === "running")
    return running.map((tc) => tc.name)
  }, [toolCalls])

  const totalAdditions = useMemo(() => fileEdits.reduce((s, f) => s + f.additions, 0), [fileEdits])
  const totalDeletions = useMemo(() => fileEdits.reduce((s, f) => s + f.deletions, 0), [fileEdits])

  // Aggregate verification status: pick the "worst" verification result across all file edits
  const aggregateVerification = useMemo((): FileEditVerification | null => {
    const verifications = fileEdits.map((fe) => fe.verification).filter(Boolean) as FileEditVerification[]
    if (verifications.length === 0) return null
    // If any failed, show failure
    const failed = verifications.find((v) => !v.passed)
    if (failed) return failed
    // If any has lint warnings, show that
    const withLint = verifications.find((v) => (v.lintErrors ?? 0) > 0)
    if (withLint) return withLint
    // Otherwise show the first passed result
    return verifications[0]
  }, [fileEdits])

  const hasToolCalls = toolCalls.length > 0
  const hasFileEdits = fileEdits.length > 0
  const hasTerminal = terminalOutputs.length > 0
  const hasStreaming = streamingText.length > 0
  const hasReasoning = !!reasoningText
  const isThinking = status === "running" && !hasStreaming && !hasToolCalls && !hasReasoning
  const hasAnyContent = hasStreaming || hasToolCalls || hasFileEdits || hasTerminal || hasReasoning

  return (
    <div className={cn(
      "rounded-xl border transition-all duration-300",
      STATUS_STYLES[status],
      status === "running" && "shadow-blue-500/10",
    )}>
      <AgentHandoff from={agentHandoffFrom} to={agentHandoffTo} />

      {/* Animated glow bar for running state */}
      {status === "running" && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      )}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-foreground/6">
        <div className="flex items-center gap-2 min-w-0">
          <RoleIcon roleId={roleId} />
          <span className="text-[11px] font-semibold text-foreground/70 truncate">{roleName}</span>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <ElapsedTimer startedAt={startedAt} status={status} />
          {status === "running" && onStop && (
            <button
              onClick={onStop}
              className="text-foreground/30 hover:text-foreground/70 transition-colors"
              title="Stop execution"
            >
              <Square className="h-3 w-3" />
            </button>
          )}
          {status === "running" && (
            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
          )}
        </div>
      </div>

      {/* Thinking phase → content transition */}
      <AnimatePresence mode="wait">
        {isThinking && (
          <motion.div
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.25 }}
          >
            <ThinkingPhase />
            <LoadingSkeleton />
          </motion.div>
        )}
      </AnimatePresence>

      {hasReasoning && (
        <ReasoningStreamMem text={reasoningText} isRunning={status === "running"} />
      )}

      {hasStreaming && <StreamingTextMem text={streamingText} isRunning={status === "running"} />}

      {hasToolCalls && status === "running" && !isThinking && <LiveToolStream toolCalls={toolCalls} />}

      {hasToolCalls && (
        <div className="border-t border-white/6">
          <SectionHeader
            section="tools"
            label="Tool Calls"
            count={toolCalls.length}
            isExpanded={expandedSections.has("tools")}
            onToggle={() => toggleSection("tools")}
            extra={
              runningToolNames.length > 0 && (
                <span className="text-[9px] text-blue-400/60 font-mono">
                  {runningToolNames.join(", ")}
                </span>
              )
            }
          />
          {expandedSections.has("tools") && (
            <div className="px-3 pb-2 space-y-1">
              {toolCalls.map((tc) => (
                <ToolCallItem
                  key={tc.id}
                  toolName={tc.name}
                  args={tc.args}
                  status={tc.status}
                  result={tc.result}
                  durationMs={tc.durationMs}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {hasFileEdits && (
        <div className="border-t border-white/6">
          <SectionHeader
            section="files"
            label="File Edits"
            count={fileEdits.length}
            isExpanded={expandedSections.has("files")}
            onToggle={() => toggleSection("files")}
            extra={
              <div className="flex items-center gap-2">
                {aggregateVerification && (
                  <VerificationBadge verification={aggregateVerification} />
                )}
                <span className="flex items-center gap-2 text-[9px]">
                  {totalAdditions > 0 && <span className="text-emerald-400">+{totalAdditions}</span>}
                  {totalDeletions > 0 && <span className="text-red-400">-{totalDeletions}</span>}
                </span>
              </div>
            }
          />
          {expandedSections.has("files") && (
            <div className="px-3 pb-2 space-y-2">
              {fileEdits.map((fe) => (
                <FileEditDiff
                  key={fe.path}
                  path={fe.path}
                  additions={fe.additions}
                  deletions={fe.deletions}
                  diffContent={fe.diffContent}
                  oldContent={fe.oldContent}
                  newContent={fe.newContent}
                  verification={fe.verification}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {hasTerminal && (
        <div className="border-t border-white/6">
          <SectionHeader
            section="terminal"
            label="Terminal"
            count={terminalOutputs.length}
            isExpanded={expandedSections.has("terminal")}
            onToggle={() => toggleSection("terminal")}
          />
          {expandedSections.has("terminal") && (
            <div className="px-3 pb-2 space-y-2">
              {terminalOutputs.map((t, i) => (
                <TerminalOutputCard
                  key={i}
                  command={t.command}
                  output={t.output}
                  exitCode={t.exitCode}
                  status={t.status}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {hasStreaming && (status === "complete" || status === "error") && (
        <MessageActions text={streamingText} status={status} />
      )}

      {status === "complete" && onFollowUpSelect && (
        <SuggestedFollowups
          toolCalls={toolCalls}
          fileEdits={fileEdits}
          terminalOutputs={terminalOutputs}
          onSelect={onFollowUpSelect}
        />
      )}

      <MessageMetrics
        startedAt={startedAt}
        status={status}
        modelName={modelName}
        providerName={providerName}
        toolCallCount={toolCalls.length}
        fileEditCount={fileEdits.length}
      />
    </div>
  )
})
