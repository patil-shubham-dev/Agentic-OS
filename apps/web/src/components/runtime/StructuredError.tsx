import { cn } from "@/lib/utils"
import { XCircle, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react"

export interface StructuredErrorProps {
  title: string
  provider?: string
  model?: string
  cause: string
  suggestedFixes: string[]
  onRetry?: () => void
  onNavigate?: () => void
  className?: string
}

export function StructuredError({
  title,
  provider,
  model,
  cause,
  suggestedFixes,
  onRetry,
  onNavigate,
  className,
}: StructuredErrorProps) {
  return (
    <div className={cn("rounded-lg border border-red-500/20 bg-red-500/[0.03] overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-red-500/10 bg-red-500/[0.05]">
        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span className="text-[10px] font-medium text-red-300">{title}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {provider && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/40 w-12 shrink-0">Provider:</span>
            <span className="text-[10px] text-white/70">{provider}</span>
          </div>
        )}
        {model && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/40 w-12 shrink-0">Model:</span>
            <span className="text-[10px] text-white/70">{model}</span>
          </div>
        )}

        <div className="flex items-start gap-1.5">
          <AlertTriangle className="h-2.5 w-2.5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-[9px] text-white/40">Cause:</span>
            <p className="text-[10px] text-white/60 mt-0.5">{cause}</p>
          </div>
        </div>

        {suggestedFixes.length > 0 && (
          <div className="pt-1">
            <span className="text-[9px] text-white/40 block mb-1">Suggested Fixes:</span>
            <ul className="space-y-0.5">
              {suggestedFixes.map((fix, i) => (
                <li key={i} className="flex items-center gap-1 text-[10px] text-white/50">
                  <span className="h-1 w-1 rounded-full bg-cyan-400/50 shrink-0" />
                  {fix}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Retry
            </button>
          )}
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-white/5 text-white/40 hover:text-white/60 transition-colors"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Settings
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
