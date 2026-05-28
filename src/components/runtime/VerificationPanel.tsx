import { memo } from "react"
import { CheckCircle2, XCircle, FileSearch, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRuntimeProjectionStore } from "@/stores/runtime-projections-store"

interface VerificationPanelProps {
  className?: string
}

export function VerificationPanel({ className }: VerificationPanelProps) {
  const lastResult = useRuntimeProjectionStore((s) => s.lastVerificationResult)

  if (!lastResult) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        lastResult.passed
          ? "border-emerald-500/20 bg-emerald-500/[0.02]"
          : "border-red-500/20 bg-red-500/[0.02]",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8">
        <div className={cn(
          "flex items-center justify-center h-5 w-5 rounded shrink-0",
          lastResult.passed ? "bg-emerald-500/10" : "bg-red-500/10",
        )}>
          {lastResult.passed
            ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            : <XCircle className="h-3 w-3 text-red-400" />
          }
        </div>
        <span className="text-[10px] font-medium text-white/50">Verification</span>
        <span className={cn(
          "text-[9px] font-medium ml-auto",
          lastResult.passed ? "text-emerald-400/70" : "text-red-400/70",
        )}>
          {lastResult.passed ? "passed" : "failed"}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <FileSearch className="h-2.5 w-2.5 text-white/30" />
          <span className="text-[10px] text-white/50 capitalize">{lastResult.scope}</span>
        </div>

        {lastResult.diagnostics.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {lastResult.diagnostics.map((diag, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="h-2.5 w-2.5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-[9px] text-red-400/70 font-mono leading-relaxed">{diag}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
