import { Brain, Check, ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ManagerRoutingCardProps {
  reasoning: string
  selectedRoles: string[]
  context: string
  status: "pending" | "running" | "complete" | "error"
  isCollapsed?: boolean
  onToggle?: () => void
}

const ROLE_COLORS: Record<string, string> = {
  coder: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  design: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  browser: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  vision: "text-pink-400 border-pink-500/30 bg-pink-500/10",
  qa: "text-green-400 border-green-500/30 bg-green-500/10",
  runtime: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  manager: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  research: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
}

export function ManagerRoutingCard({
  reasoning,
  selectedRoles,
  context,
  status,
  isCollapsed,
  onToggle,
}: ManagerRoutingCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        status === "running" && "border-amber-500/30 bg-amber-500/[0.03]",
        status === "complete" && "border-white/8 bg-white/[0.02]",
        status === "error" && "border-red-500/30 bg-red-500/[0.03]",
      )}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-amber-500/15 shrink-0">
            <Brain className="h-3 w-3 text-amber-400" />
          </div>
          <span className="text-[11px] font-semibold text-amber-400/90">Manager</span>
          {status === "running" && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Analyzing...
            </span>
          )}
          {status === "complete" && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400/70">
              <Check className="h-2.5 w-2.5" />
              Routed
            </span>
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {selectedRoles.map((role, i) => (
              <span
                key={role}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium",
                  ROLE_COLORS[role] ?? "text-white/50 border-white/10 bg-white/[0.04]",
                )}
              >
                {i > 0 && <ArrowRight className="h-2 w-2 opacity-50" />}
                {role}
              </span>
            ))}
          </div>

          {reasoning && (
            <p className="text-[10px] text-white/50 leading-relaxed">{reasoning}</p>
          )}

          {context && (
            <div className="flex items-center gap-1 text-[9px] text-white/30">
              <span className="truncate">{context}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
