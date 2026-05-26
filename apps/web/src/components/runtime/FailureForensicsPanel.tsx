import { useState, useEffect, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { FailureAnalyzer } from "@/runtime/observability/FailureAnalyzer"
import type { FailureReport, RetryStep } from "@/runtime/observability/ObservabilityTypes"
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Activity,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Search,
  Shield,
  ShieldOff,
  ArrowRight,
  Zap,
  BarChart3,
  Trash2,
} from "lucide-react"

interface FailureForensicsPanelProps {
  className?: string
}

// ── Error Type Badge ──

const ERROR_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  provider: { bg: "bg-red-500/10", text: "text-red-400", label: "Provider" },
  stream: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Stream" },
  tool: { bg: "bg-orange-500/10", text: "text-orange-400", label: "Tool" },
  timeout: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Timeout" },
  rate_limit: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Rate Limit" },
  auth: { bg: "bg-rose-500/10", text: "text-rose-400", label: "Auth" },
  unknown: { bg: "bg-white/[0.04]", text: "text-white/40", label: "Unknown" },
}

function ErrorTypeBadge({ type }: { type: FailureReport["errorType"] }) {
  const style = ERROR_STYLES[type] ?? ERROR_STYLES.unknown
  return (
    <span className={cn("text-[8px] font-medium px-1 rounded whitespace-nowrap", style.bg, style.text)}>
      {style.label}
    </span>
  )
}

// ── Retry Chain Visualization ──

function RetryChain({ steps }: { steps: RetryStep[] }) {
  if (steps.length === 0) return null

  return (
    <div className="space-y-0.5">
      <span className="text-[8px] font-medium text-white/30 uppercase tracking-wider block mb-0.5">
        <RefreshCw className="h-2 w-2 inline mr-0.5" /> Retry Chain ({steps.length})
      </span>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[8px]">
          <span className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            step.success ? "bg-green-400" : "bg-red-400",
          )} />
          <span className="text-white/30 font-mono shrink-0">#{step.attempt}</span>
          <span className="text-white/40">{step.durationMs}ms</span>
          {step.error && (
            <span className="text-red-400/60 truncate">— {step.error}</span>
          )}
          {step.success && (
            <CheckCircle2 className="h-2 w-2 text-green-400 shrink-0 ml-auto" />
          )}
          {i < steps.length - 1 && (
            <ArrowRight className="h-2 w-2 text-white/15 shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Failure Report Card ──

function FailureReportCard({ report }: { report: FailureReport }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      "rounded-lg border transition-all",
      report.recoverySucceeded ? "border-green-500/20 bg-green-500/[0.02]" :
      report.recoverable ? "border-amber-500/20 bg-amber-500/[0.02]" :
      "border-red-500/20 bg-red-500/[0.02]",
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-2 text-[10px] transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-white/30" /> : <ChevronRight className="h-3 w-3 text-white/30" />}
        <div className={cn(
          "flex items-center justify-center h-4 w-4 rounded shrink-0",
          report.recoverySucceeded ? "bg-green-500/15" : report.recoverable ? "bg-amber-500/15" : "bg-red-500/15",
        )}>
          {report.recoverySucceeded
            ? <Shield className="h-2.5 w-2.5 text-green-400" />
            : report.recoverable
              ? <RefreshCw className="h-2.5 w-2.5 text-amber-400" />
              : <ShieldOff className="h-2.5 w-2.5 text-red-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-white/70 truncate">{report.phase}</span>
            <ErrorTypeBadge type={report.errorType} />
          </div>
          <div className="text-[8px] text-white/30 mt-0.5 truncate">{report.errorMessage}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {report.retryCount > 0 && (
            <span className="text-[8px] text-amber-400/60 font-mono">{report.retryCount}r</span>
          )}
          <span className="text-[8px] text-white/20 font-mono">{report.durationMs}ms</span>
        </div>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-2 border-t border-white/[0.04] pt-1.5">
          {/* Retry chain */}
          {report.retryChain.length > 0 && (
            <RetryChain steps={report.retryChain} />
          )}

          {/* Recovery info */}
          <div className="grid grid-cols-2 gap-1 text-[8px]">
            <div className="bg-white/[0.03] rounded px-1.5 py-1">
              <span className="text-white/25 block text-[7px] uppercase">Recoverable</span>
              <span className={report.recoverable ? "text-green-400" : "text-red-400"}>
                {report.recoverable ? "Yes" : "No"}
              </span>
            </div>
            <div className="bg-white/[0.03] rounded px-1.5 py-1">
              <span className="text-white/25 block text-[7px] uppercase">Recovered</span>
              <span className={report.recoverySucceeded ? "text-green-400" : "text-red-400"}>
                {report.recoverySucceeded ? "Yes" : report.recoveryAttempted ? "Failed" : "Not attempted"}
              </span>
            </div>
            {report.recoveryStrategy && (
              <div className="bg-white/[0.03] rounded px-1.5 py-1 col-span-2">
                <span className="text-white/25 block text-[7px] uppercase">Strategy</span>
                <span className="text-white/50">{report.recoveryStrategy}</span>
              </div>
            )}
            {report.fallbackActivated && (
              <div className="bg-white/[0.03] rounded px-1.5 py-1 col-span-2">
                <span className="text-white/25 block text-[7px] uppercase">Fallback Provider</span>
                <span className="text-amber-400">{report.fallbackProvider ?? "Auto"}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Recovery Stats ──

function RecoveryStats({ reports }: { reports: FailureReport[] }) {
  const total = reports.length
  const recovered = reports.filter((r) => r.recoverySucceeded).length
  const failed = reports.filter((r) => !r.recoverySucceeded && r.recoveryAttempted).length
  const unattempted = reports.filter((r) => !r.recoveryAttempted).length
  const rate = total > 0 ? (recovered / total) * 100 : 0

  const errorsByType = new Map<string, number>()
  for (const r of reports) {
    errorsByType.set(r.errorType, (errorsByType.get(r.errorType) ?? 0) + 1)
  }
  const topError = [...errorsByType.entries()].sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 gap-1 text-[8px]">
        <div className="text-center bg-white/[0.02] rounded px-1 py-1">
          <span className="text-white/60 block">{total}</span>
          <span className="text-white/20">total</span>
        </div>
        <div className="text-center bg-white/[0.02] rounded px-1 py-1">
          <span className="text-green-400 block">{recovered}</span>
          <span className="text-white/20">recovered</span>
        </div>
        <div className="text-center bg-white/[0.02] rounded px-1 py-1">
          <span className="text-red-400 block">{failed}</span>
          <span className="text-white/20">failed</span>
        </div>
        <div className="text-center bg-white/[0.02] rounded px-1 py-1">
          <span className={cn("block", rate > 80 ? "text-green-400" : rate > 50 ? "text-amber-400" : "text-red-400")}>
            {rate.toFixed(0)}%
          </span>
          <span className="text-white/20">rate</span>
        </div>
      </div>
      {topError && (
        <div className="flex items-center gap-1 text-[8px] text-white/30">
          <BarChart3 className="h-2 w-2" />
          Most common: <span className="text-white/50">{topError[0]}</span>
          <span className="text-white/20">({topError[1]})</span>
        </div>
      )}
    </div>
  )
}

// ── Main Component ──

export function FailureForensicsPanel({ className }: FailureForensicsPanelProps) {
  const analyzer = FailureAnalyzer.getInstance()
  const [reports, setReports] = useState<FailureReport[]>([])
  const [filterType, setFilterType] = useState<string | null>(null)
  const [showRecovered, setShowRecovered] = useState(true)
  const [showFailed, setShowFailed] = useState(true)

  useEffect(() => {
    const refresh = () => setReports(analyzer.getAllReports())
    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [analyzer])

  const errorTypes = Array.from(new Set(reports.map((r) => r.errorType)))
  const filtered = reports.filter((r) => {
    if (filterType && r.errorType !== filterType) return false
    if (!showRecovered && r.recoverySucceeded) return false
    if (!showFailed && !r.recoverySucceeded && r.recoveryAttempted) return false
    return true
  })

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-red-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Failures</span>
          {reports.length > 0 && (
            <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">{reports.length} events</span>
          )}
        </div>
      </div>

      {/* Recovery stats */}
      {reports.length > 0 && (
        <div className="px-2 py-1.5 border-b border-white/[0.04]">
          <RecoveryStats reports={reports} />
        </div>
      )}

      {/* Empty state */}
      {reports.length === 0 && (
        <div className="flex-1 flex items-center justify-center min-h-[120px]">
          <div className="text-center px-4">
            <Shield className="h-5 w-5 text-white/15 mx-auto mb-1" />
            <p className="text-[10px] text-white/25">No failures recorded</p>
            <p className="text-[8px] text-white/15 mt-0.5">
              Failure reports and retry chains appear here
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      {reports.length > 0 && (
        <div className="px-2 py-1 border-b border-white/[0.04] space-y-1">
          {/* Error type filter */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setFilterType(null)}
              className={cn(
                "text-[8px] px-1.5 py-0.5 rounded font-medium transition-all shrink-0",
                !filterType ? "bg-white/[0.08] text-white/70" : "text-white/30 hover:text-white/50",
              )}
            >
              All
            </button>
            {errorTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "text-[8px] px-1.5 py-0.5 rounded font-medium transition-all shrink-0",
                  filterType === type ? "bg-white/[0.08] text-white/70" : "text-white/30 hover:text-white/50",
                )}
              >
                {type}
              </button>
            ))}
          </div>
          {/* Recovery toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[8px] text-white/30 cursor-pointer">
              <input
                type="checkbox"
                checked={showRecovered}
                onChange={(e) => setShowRecovered(e.target.checked)}
                className="h-2.5 w-2.5 accent-green-500"
              />
              Show recovered
            </label>
            <label className="flex items-center gap-1 text-[8px] text-white/30 cursor-pointer">
              <input
                type="checkbox"
                checked={showFailed}
                onChange={(e) => setShowFailed(e.target.checked)}
                className="h-2.5 w-2.5 accent-red-500"
              />
              Show failed
            </label>
          </div>
        </div>
      )}

      {/* Failure report list */}
      {filtered.length > 0 && (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
          {filtered.map((report) => (
            <FailureReportCard key={report.traceId} report={report} />
          ))}
        </div>
      )}
    </div>
  )
}
