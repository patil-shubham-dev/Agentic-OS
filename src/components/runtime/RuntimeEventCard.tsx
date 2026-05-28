import { memo } from "react"
import {
  ArrowRight,
  ArrowLeftRight,
  Wrench,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Brain,
  FileSearch,
  AlertTriangle,
  ShieldAlert,
  Terminal,
  RotateCcw,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ProjectedEvent,
  ProjectedStateTransition,
  ProjectedToolRequested,
  ProjectedToolStarted,
  ProjectedToolCompleted,
  ProjectedToolFailed,
  ProjectedStreamDelta,
  ProjectedAgentMessage,
  ProjectedVerificationStarted,
  ProjectedVerificationCompleted,
  ProjectedRepairAttempted,
  ProjectedRepairFailed,
  ProjectedRepairResolved,
  ProjectedExecutionError,
  ProjectedExecutionHalted,
} from "@/stores/runtime-projections-store"

type EventCardProps = { event: ProjectedEvent }

function StateTransitionCard({ event }: { event: ProjectedStateTransition }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-cyan-500/10 shrink-0">
        <ArrowRight className="h-3 w-3 text-cyan-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-cyan-400/70 font-medium">State</span>
          <ArrowLeftRight className="h-2.5 w-2.5 text-white/20" />
          <span className="text-white/40">{event.from}</span>
          <ArrowRight className="h-2.5 w-2.5 text-white/20" />
          <span className="text-cyan-300">{event.to}</span>
        </div>
      </div>
    </div>
  )
}

function ToolRequestedCard({ event }: { event: ProjectedToolRequested }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 shrink-0">
        <Wrench className="h-3 w-3 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-blue-300/80 font-medium">{event.toolName}</div>
        <div className="text-[9px] text-white/35 font-mono truncate max-w-[400px]">{event.args}</div>
      </div>
    </div>
  )
}

function ToolStartedCard({ event }: { event: ProjectedToolStarted }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-amber-500/10 shrink-0">
        <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-amber-300/80 font-medium">{event.toolName}</div>
        <div className="text-[9px] text-white/25 font-mono truncate">id: {event.toolId}</div>
      </div>
    </div>
  )
}

function ToolCompletedCard({ event }: { event: ProjectedToolCompleted }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-emerald-500/10 shrink-0">
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-emerald-300/80 font-medium">{event.toolName}</span>
          <span className="text-[8px] text-white/20">{event.durationMs}ms</span>
        </div>
      </div>
    </div>
  )
}

function ToolFailedCard({ event }: { event: ProjectedToolFailed }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-red-500/10 shrink-0">
        <XCircle className="h-3 w-3 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-red-300/80 font-medium">{event.toolName}</span>
          <span className="text-[8px] text-white/20">{event.durationMs}ms</span>
        </div>
        <div className="text-[9px] text-red-400/60 font-mono truncate max-w-[400px]">{event.error}</div>
      </div>
    </div>
  )
}

function StreamDeltaCard({ event }: { event: ProjectedStreamDelta }) {
  if (!event.deltaText && !event.reasoningText) return null
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-indigo-500/10 shrink-0">
        <Brain className="h-3 w-3 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        {event.reasoningText && (
          <div className="text-[9px] text-indigo-400/50 italic mb-0.5">{event.reasoningText}</div>
        )}
        {event.deltaText && (
          <div className="text-[10px] text-white/60 leading-relaxed">{event.deltaText}</div>
        )}
      </div>
    </div>
  )
}

function AgentMessageCard({ event }: { event: ProjectedAgentMessage }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className={cn(
        "flex items-center justify-center h-5 w-5 rounded shrink-0",
        event.role === "user" ? "bg-blue-500/15" : event.role === "assistant" ? "bg-emerald-500/15" : "bg-white/5",
      )}>
        <MessageSquare className={cn(
          "h-3 w-3",
          event.role === "user" ? "text-blue-400" : event.role === "assistant" ? "text-emerald-400" : "text-white/40",
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-white/30 font-medium capitalize mb-0.5">{event.role}</div>
        <div className="text-[10px] text-white/70 leading-relaxed">{event.content}</div>
      </div>
    </div>
  )
}

function VerificationStartedCard({ event }: { event: ProjectedVerificationStarted }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-purple-500/10 shrink-0">
        <FileSearch className="h-3 w-3 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-purple-300/80 font-medium">Verifying: {event.scope}</span>
      </div>
    </div>
  )
}

function VerificationCompletedCard({ event }: { event: ProjectedVerificationCompleted }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className={cn(
        "flex items-center justify-center h-5 w-5 rounded shrink-0",
        event.passed ? "bg-emerald-500/10" : "bg-red-500/10",
      )}>
        {event.passed
          ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          : <XCircle className="h-3 w-3 text-red-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[10px] font-medium",
            event.passed ? "text-emerald-300/80" : "text-red-300/80",
          )}>
            {event.scope}
          </span>
          <span className={cn(
            "text-[9px]",
            event.passed ? "text-emerald-400/60" : "text-red-400/60",
          )}>
            {event.passed ? "passed" : "failed"}
          </span>
        </div>
        {event.diagnostics.length > 0 && (
          <div className="text-[9px] text-red-400/50 font-mono mt-0.5 max-h-12 overflow-y-auto">
            {event.diagnostics.map((d, i) => <div key={i}>{d}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}

function RepairAttemptedCard({ event }: { event: ProjectedRepairAttempted }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-amber-500/10 shrink-0">
        <RotateCcw className="h-3 w-3 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-amber-300/80 font-medium">
          Repair attempt #{event.attempt}: {event.target}
        </span>
      </div>
    </div>
  )
}

function RepairFailedCard({ event }: { event: ProjectedRepairFailed }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-red-500/10 shrink-0">
        <AlertTriangle className="h-3 w-3 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-red-300/80 font-medium">Repair failed: {event.target}</span>
        <div className="text-[9px] text-red-400/50">{event.error}</div>
      </div>
    </div>
  )
}

function RepairResolvedCard({ event }: { event: ProjectedRepairResolved }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-emerald-500/10 shrink-0">
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-emerald-300/80 font-medium">
          Repairs applied: {event.repairsApplied} to {event.target}
        </span>
      </div>
    </div>
  )
}

function ExecutionErrorCard({ event }: { event: ProjectedExecutionError }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-red-500/10 shrink-0">
        <ShieldAlert className="h-3 w-3 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-red-300/80 font-medium">Execution error</span>
        <div className="text-[9px] text-red-400/60">{event.error}</div>
        {event.recoverable && <div className="text-[9px] text-amber-400/50">Recoverable</div>}
      </div>
    </div>
  )
}

function ExecutionHaltedCard({ event }: { event: ProjectedExecutionHalted }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <div className="flex items-center justify-center h-5 w-5 rounded bg-red-500/15 shrink-0">
        <XCircle className="h-3 w-3 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-red-300/80 font-medium">Execution halted</span>
        <div className="text-[9px] text-white/50">{event.reason}</div>
      </div>
    </div>
  )
}

export const RuntimeEventCard = memo(function RuntimeEventCard({ event }: EventCardProps) {
  switch (event.kind) {
    case "state_transition": return <StateTransitionCard event={event} />
    case "tool_requested": return <ToolRequestedCard event={event} />
    case "tool_started": return <ToolStartedCard event={event} />
    case "tool_completed": return <ToolCompletedCard event={event} />
    case "tool_failed": return <ToolFailedCard event={event} />
    case "stream_delta": return <StreamDeltaCard event={event} />
    case "agent_message": return <AgentMessageCard event={event} />
    case "verification_started": return <VerificationStartedCard event={event} />
    case "verification_completed": return <VerificationCompletedCard event={event} />
    case "repair_attempted": return <RepairAttemptedCard event={event} />
    case "repair_failed": return <RepairFailedCard event={event} />
    case "repair_resolved": return <RepairResolvedCard event={event} />
    case "execution_error": return <ExecutionErrorCard event={event} />
    case "execution_halted": return <ExecutionHaltedCard event={event} />
    default: return null
  }
})
