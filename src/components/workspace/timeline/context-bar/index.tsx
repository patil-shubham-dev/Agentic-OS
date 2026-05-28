import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  Folder, Bot, Cpu, Zap, Target,
  Globe, UserCheck, Shield, Brain, Loader2,
  AlertTriangle,
} from "lucide-react"
import type { RuntimeRole } from "@/types"
import type { ExecutionMode } from "@/stores/agent-store"

const MODE_ICONS: Record<string, typeof Bot> = {
  autonomous: Brain,
  fastest: Zap,
  most_accurate: Target,
  research_heavy: Globe,
  human_guided: UserCheck,
  safe_mode: Shield,
}

const MODE_COLORS: Record<string, string> = {
  autonomous: "text-blue-400",
  fastest: "text-yellow-400",
  most_accurate: "text-purple-400",
  research_heavy: "text-cyan-400",
  human_guided: "text-orange-400",
  safe_mode: "text-red-400",
}

const ROLE_NAMES: Record<string, string> = {
  manager: "Manager",
  coder: "Coder",
  design: "Designer",
  vision: "Vision",
  research: "Research",
  runtime: "Runtime",
  browser: "Browser",
  qa: "QA",
  memory: "Memory",
  "fast-inference": "Fast Inf",
}

interface ContextBarProps {
  workspaceName: string | null
  activeRole: RuntimeRole
  executionMode: ExecutionMode
  modelName?: string
  isProcessing: boolean
  isReady: boolean
  memoryPressure: number
  tokenUsage: number
  onModeClick?: () => void
}

function AnimatedStatusDot({ isProcessing, isReady }: { isProcessing: boolean; isReady: boolean }) {
  if (isProcessing) {
    return (
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="flex items-center justify-center"
      >
        <Loader2 className="h-2.5 w-2.5 text-blue-400/60" />
      </motion.span>
    )
  }
  return (
    <motion.span
      className="flex items-center justify-center"
      animate={isReady ? undefined : { opacity: [0.4, 1, 0.4] }}
      transition={isReady ? undefined : { duration: 2, repeat: Infinity }}
    >
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {isReady && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-500/20 animate-ping" />
        )}
        <span className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          isReady ? "bg-green-500" : "bg-amber-500",
        )} />
      </span>
    </motion.span>
  )
}

export function ContextBar({
  workspaceName,
  activeRole,
  executionMode,
  modelName,
  isProcessing,
  isReady,
  memoryPressure,
  tokenUsage,
  onModeClick,
}: ContextBarProps) {
  const ModeIcon = MODE_ICONS[executionMode] || Brain
  const modeColor = MODE_COLORS[executionMode] || "text-blue-400"

  return (
    <motion.div
      className="relative flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-white/[0.02] via-white/[0.01] to-transparent border-t border-white/[0.04]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      role="status"
      aria-label={`Workspace context - ${activeRole} mode, ${executionMode} execution`}
    >
      {/* Workspace */}
      <div className="flex items-center gap-1.5 min-w-0 pl-0.5" title={workspaceName || "No workspace"}>
        <Folder className="h-2.5 w-2.5 shrink-0 text-white/30" aria-hidden="true" />
        <span className="text-[9px] text-white/35 truncate max-w-[80px] font-medium">
          {workspaceName || "No workspace"}
        </span>
      </div>

      <SectionDivider />

      {/* Active Agent */}
      <div className="flex items-center gap-1.5">
        <Bot className="h-2.5 w-2.5 text-white/30" aria-hidden="true" />
        <span className="text-[9px] text-white/45 font-medium" aria-label={`Agent: ${ROLE_NAMES[activeRole] || activeRole}`}>
          {ROLE_NAMES[activeRole] || activeRole}
        </span>
      </div>

      <SectionDivider />

      {/* Mode */}
      <button
        onClick={onModeClick}
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all",
          "hover:bg-white/[0.06] active:scale-95",
        )}
        aria-label={`Execution mode: ${executionMode.replace(/_/g, " ")}. Click to change`}
      >
        <ModeIcon className={cn("h-2.5 w-2.5", modeColor)} aria-hidden="true" />
        <span className={cn("text-[9px] font-medium capitalize", modeColor)}>
          {executionMode.replace(/_/g, " ")}
        </span>
      </button>

      <SectionDivider />

      {/* Model Badge */}
      {modelName && (
        <>
          <div className="flex items-center gap-1 rounded-md bg-white/[0.03] border border-white/[0.04] px-1.5 py-0.5" title={`Model: ${modelName}`}>
            <Cpu className="h-2 w-2 text-white/30" aria-hidden="true" />
            <span className="text-[8px] text-white/35 font-mono truncate max-w-[100px]">
              {modelName}
            </span>
          </div>
          <SectionDivider />
        </>
      )}

      {/* Spacer to push right-side items */}
      <div className="flex-1" />

      {/* Token Usage */}
      {tokenUsage > 0 && (
        <div className="flex items-center gap-1.5" title={`${tokenUsage.toLocaleString()} tokens used`}>
          <div className="w-10 h-1 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                tokenUsage > 80000 ? "bg-gradient-to-r from-red-400/60 to-red-500/60" :
                tokenUsage > 50000 ? "bg-gradient-to-r from-amber-400/60 to-amber-500/60" :
                "bg-gradient-to-r from-blue-400/50 to-blue-500/50",
              )}
              initial={false}
              animate={{ width: `${Math.min((tokenUsage / 100000) * 100, 100)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <span className={cn(
            "text-[8px] font-mono",
            tokenUsage > 80000 ? "text-red-400/60" :
            tokenUsage > 50000 ? "text-amber-400/60" :
            "text-white/25",
          )}>
            {(tokenUsage / 1000).toFixed(0)}k
          </span>
        </div>
      )}

      {/* Memory Pressure */}
      {memoryPressure > 0 && (
        <div className="flex items-center gap-1" title={`Memory pressure: ${memoryPressure}%`}>
          <motion.div
            animate={{
              opacity: memoryPressure > 70 ? [0.6, 1, 0.6] : 0.4,
              scale: memoryPressure > 90 ? [1, 1.2, 1] : 1,
            }}
            transition={{ duration: memoryPressure > 90 ? 0.8 : 2, repeat: Infinity }}
          >
            <AlertTriangle className={cn(
              "h-2.5 w-2.5",
              memoryPressure > 80 ? "text-red-400/60" :
              memoryPressure > 50 ? "text-amber-400/60" :
              "text-white/25",
            )} />
          </motion.div>
          <span className={cn(
            "text-[8px] font-mono",
            memoryPressure > 80 ? "text-red-400/60" :
            memoryPressure > 50 ? "text-amber-400/60" :
            "text-white/25",
          )}>
            {memoryPressure}%
          </span>
        </div>
      )}

      {/* Runtime Health Status Dot */}
      <div className="flex items-center gap-1" role="status" aria-label={`Runtime: ${isProcessing ? "processing" : isReady ? "ready" : "warning"}`}>
        <AnimatedStatusDot isProcessing={isProcessing} isReady={isReady} />
      </div>
    </motion.div>
  )
}

function SectionDivider() {
  return <span className="h-3 w-px bg-white/[0.05] shrink-0" aria-hidden="true" />
}
