import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  Folder, Bot, Cpu, Zap, Target,
  Globe, UserCheck, Shield, Brain, Loader2,
  CheckCircle2, AlertTriangle,
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
      className="relative flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-white/[0.02] via-white/[0.01] to-transparent border-t border-white/[0.04]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      role="status"
      aria-label={`Workspace context — ${activeRole} mode, ${executionMode} execution`}
    >
      {/* Subtle gradient accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/20 via-purple-500/10 to-transparent" />
      {/* Workspace */}
      <div className="flex items-center gap-1.5 min-w-0 pl-1" title={workspaceName || "No workspace"}>
        <Folder className="h-2.5 w-2.5 shrink-0 text-white/30" aria-hidden="true" />
        <span className="text-[9px] text-white/35 truncate max-w-[80px] font-medium">
          {workspaceName || "No workspace"}
        </span>
      </div>

      <span className="text-white/[0.06] select-none" aria-hidden="true">|</span>

      {/* Active Agent */}
      <div className="flex items-center gap-1.5">
        <Bot className="h-2.5 w-2.5 text-white/30" aria-hidden="true" />
        <span className="text-[9px] text-white/45 font-medium" aria-label={`Agent: ${ROLE_NAMES[activeRole] || activeRole}`}>
          {ROLE_NAMES[activeRole] || activeRole}
        </span>
      </div>

      <span className="text-white/[0.06] select-none" aria-hidden="true">|</span>

      {/* Mode */}
      <button
        onClick={onModeClick}
        className="flex items-center gap-1 hover:bg-white/[0.06] px-1 py-0.5 rounded transition-colors"
        aria-label={`Execution mode: ${executionMode.replace(/_/g, " ")}. Click to change`}
      >
        <ModeIcon className={cn("h-2.5 w-2.5", modeColor)} aria-hidden="true" />
        <span className={cn("text-[9px] font-medium capitalize opacity-80", modeColor)}>
          {executionMode.replace(/_/g, " ")}
        </span>
      </button>

      <span className="text-white/[0.06] select-none" aria-hidden="true">|</span>

      {/* Model */}
      {modelName && (
        <>
          <div className="flex items-center gap-1" title={`Model: ${modelName}`}>
            <Cpu className="h-2.5 w-2.5 text-white/30" aria-hidden="true" />
            <span className="text-[9px] text-white/35 font-mono truncate max-w-[120px]">
              {modelName}
            </span>
          </div>
          <span className="text-white/[0.06] select-none" aria-hidden="true">|</span>
        </>
      )}

      {/* Token Usage Progress Bar — premium gradient */}
      {tokenUsage > 0 && (
        <div className="flex items-center gap-1.5 ml-auto" title={`${tokenUsage.toLocaleString()} tokens used`}>
          <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full transition-colors",
                tokenUsage > 80000 ? "bg-red-400/50" :
                tokenUsage > 50000 ? "bg-amber-400/50" :
                "bg-blue-400/40",
              )}
              initial={{ width: 0 }}
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

      {/* Memory Pressure Visual */}
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

      {/* Runtime Health */}
      <div className="flex items-center gap-1" role="status" aria-label={`Runtime: ${isProcessing ? "processing" : isReady ? "ready" : "warning"}`}>
        {isProcessing ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-2.5 w-2.5 text-blue-400/60" aria-hidden="true" />
          </motion.span>
        ) : isReady ? (
          <CheckCircle2 className="h-2.5 w-2.5 text-green-500/40" aria-hidden="true" />
        ) : (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertTriangle className="h-2.5 w-2.5 text-amber-500/40" aria-hidden="true" />
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}
