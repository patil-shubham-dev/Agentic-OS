import { cn } from "@/lib/utils"
import type { ValidationResult } from "@/types"
import { CheckCircle2, Loader2, XCircle, AlertTriangle, RefreshCw } from "lucide-react"

interface ValidationStatusProps {
  state: "idle" | "validating" | "connected" | "failed" | "timeout"
  result: ValidationResult | null
  onRetry?: () => void
  className?: string
}

const ERROR_MESSAGES: Record<string, { message: string; fix: string }> = {
  "Invalid API key": { message: "Invalid API key", fix: "Check your API key and try again" },
  "Endpoint not found": { message: "Endpoint not found", fix: "Verify the base URL is correct" },
  "Connection timed out": { message: "Connection timed out", fix: "Check your internet connection or firewall" },
  "Connection refused": { message: "Connection refused", fix: "Ensure the provider service is running" },
  "No models discovered": { message: "No models returned", fix: "The endpoint is reachable but returned no models" },
  "TIMEOUT_EXCEEDED": { message: "Server not responding", fix: "The provider took too long to respond" },
}

function parseError(error: string): { message: string; fix: string } {
  for (const [key, val] of Object.entries(ERROR_MESSAGES)) {
    if (error.includes(key)) return val
  }
  if (error.toLowerCase().includes("cors")) {
    return { message: "CORS blocked", fix: "This endpoint cannot be accessed from the current environment" }
  }
  if (error.toLowerCase().includes("timeout") || error.toLowerCase().includes("timed out")) {
    return { message: "Request timed out", fix: "Server may be slow or unreachable" }
  }
  if (error.toLowerCase().includes("401") || error.toLowerCase().includes("unauthorized")) {
    return { message: "Unauthorized", fix: "Your API key is invalid or expired" }
  }
  if (error.toLowerCase().includes("404")) {
    return { message: "API endpoint not found", fix: "The URL path may be incorrect" }
  }
  if (error.toLowerCase().includes("500") || error.toLowerCase().includes("internal server")) {
    return { message: "Server error", fix: "The provider's server encountered an error" }
  }
  if (error.toLowerCase().includes("dns")) {
    return { message: "DNS resolution failed", fix: "The hostname could not be resolved" }
  }
  return { message: error.length > 60 ? error.slice(0, 60) + "..." : error, fix: "Check your configuration and try again" }
}

export function ValidationStatus({ state, result, onRetry, className }: ValidationStatusProps) {
  if (state === "idle" || !result) return null

  if (state === "validating") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-6 w-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-blue-300/80 font-medium">Validating connection...</p>
          <p className="text-[9px] text-blue-300/40">Testing endpoint and API key</p>
        </div>
      </div>
    )
  }

  if (state === "timeout") {
    const parsed = parseError(result.error || "TIMEOUT_EXCEEDED")
    return (
      <div className={cn("flex items-start gap-2", className)}>
        <div className="h-6 w-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-px">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-amber-300/80 font-medium">{parsed.message}</p>
          <p className="text-[9px] text-amber-300/40">{parsed.fix}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-1.5 inline-flex items-center gap-1 text-[9px] text-amber-400/60 hover:text-amber-400 transition-colors"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Retry connection
            </button>
          )}
        </div>
      </div>
    )
  }

  if (state === "connected" && result.success) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-6 w-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-3 w-3 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-green-300/80 font-medium">Connected</p>
          <p className="text-[9px] text-green-300/40">{result.latencyMs}ms response time</p>
        </div>
      </div>
    )
  }

  const parsed = parseError(result.error || "Connection failed")

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="h-6 w-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-px">
        <XCircle className="h-3 w-3 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-red-300/80 font-medium">{parsed.message}</p>
        <p className="text-[9px] text-red-300/40">{parsed.fix}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1.5 inline-flex items-center gap-1 text-[9px] text-red-400/60 hover:text-red-400 transition-colors"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            Retry connection
          </button>
        )}
      </div>
    </div>
  )
}
