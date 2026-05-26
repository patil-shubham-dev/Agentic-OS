import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  XCircle,
  Info,
  Wrench,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Shield,
  Cpu,
  UserCheck,
} from "lucide-react"
import type { ValidationIssue } from "@/runtime/PreflightValidation"

interface ValidationCenterProps {
  issues: ValidationIssue[]
  onRepair: (issue: ValidationIssue) => void
  onDismiss: (id: string) => void
  className?: string
}

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  provider: Cpu,
  role: UserCheck,
  model: Cpu,
  sandbox: Shield,
  runtime: Shield,
  configuration: Wrench,
}

const CATEGORY_LABELS: Record<string, string> = {
  provider: "Provider Issues",
  role: "Role Mapping Issues",
  model: "Missing Models",
  sandbox: "Sandbox Warnings",
  runtime: "Runtime Health",
  configuration: "Configuration",
}

function ValidationBadge({ count, severity }: { count: number; severity: "error" | "warning" | "info" }) {
  if (count === 0) return null
  const colors = {
    error: "bg-red-500/15 text-red-400 border-red-500/20",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/15",
  }
  const icons = {
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }
  const Icon = icons[severity]
  return (
    <button
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors",
        colors[severity],
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      <span>{count}</span>
    </button>
  )
}

function IssueRow({
  issue,
  onRepair,
  onDismiss,
}: {
  issue: ValidationIssue
  onRepair: (issue: ValidationIssue) => void
  onDismiss: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const severityColors = {
    error: "border-l-red-500/40",
    warning: "border-l-amber-500/40",
    info: "border-l-blue-500/40",
  }

  const severityIcons = {
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }
  const Icon = severityIcons[issue.severity]
  const iconColors = {
    error: "text-red-400",
    warning: "text-amber-400",
    info: "text-blue-400",
  }

  return (
    <div className={cn("border-l-2 pl-2 py-1", severityColors[issue.severity])}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        {expanded ? <ChevronDown className="h-2.5 w-2.5 text-white/30 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 text-white/30 shrink-0" />}
        <Icon className={cn("h-3 w-3 shrink-0", iconColors[issue.severity])} />
        <span className="text-[10px] text-white/70 truncate">{issue.message}</span>
      </button>
      {expanded && (
        <div className="ml-5 mt-1 space-y-1">
          <p className="text-[9px] text-white/40">{issue.detail}</p>
          <div className="flex items-center gap-1.5">
            {issue.repairable && (
              <button
                onClick={() => onRepair(issue)}
                className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
              >
                <RefreshCw className="h-2 w-2" />
                Auto-fix
              </button>
            )}
            <button
              onClick={() => onDismiss(issue.id)}
              className="text-[9px] px-1.5 py-0.5 rounded text-white/30 hover:text-white/50 hover:bg-white/5 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ValidationCenter({ issues, onRepair, onDismiss, className }: ValidationCenterProps) {
  const [open, setOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const errorCount = issues.filter((i) => i.severity === "error").length
  const warningCount = issues.filter((i) => i.severity === "warning").length
  const infoCount = issues.filter((i) => i.severity === "info").length
  const totalIssues = issues.length

  const categories = Array.from(new Set(issues.map((i) => i.category)))
  const filteredIssues = categoryFilter ? issues.filter((i) => i.category === categoryFilter) : issues

  const repairableCount = issues.filter((i) => i.repairable).length

  return (
    <div className={cn("relative", className)}>
      {/* Status bar badge */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all",
          errorCount > 0
            ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/15"
            : warningCount > 0
              ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15"
              : "bg-white/5 text-white/30 border-white/10 hover:bg-white/10",
        )}
      >
        <AlertTriangle className="h-2.5 w-2.5" />
        <span>
          {errorCount > 0
            ? `${errorCount} issue${errorCount > 1 ? "s" : ""}`
            : warningCount > 0
              ? `${warningCount} warning${warningCount > 1 ? "s" : ""}`
              : "All clear"}
        </span>
        {repairableCount > 0 && (
          <span className="text-green-400/60 ml-0.5">({repairableCount} fixable)</span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && totalIssues > 0 && (
        <div className="absolute top-full left-0 mt-1 w-96 max-h-[400px] rounded-lg border border-white/10 bg-[#0d0d0e] shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
            <span className="text-[10px] font-medium text-white/60">Validation Center</span>
            <div className="flex items-center gap-1.5">
              <ValidationBadge count={errorCount} severity="error" />
              <ValidationBadge count={warningCount} severity="warning" />
              <ValidationBadge count={infoCount} severity="info" />
            </div>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5 overflow-x-auto">
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap transition-colors",
                categoryFilter === null ? "bg-blue-500/15 text-blue-400" : "text-white/40 hover:text-white/60",
              )}
            >
              All ({totalIssues})
            </button>
            {categories.map((cat) => {
              const count = issues.filter((i) => i.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap transition-colors",
                    categoryFilter === cat ? "bg-blue-500/15 text-blue-400" : "text-white/40 hover:text-white/60",
                  )}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                  <span className="text-white/30">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Issues list */}
          <div className="overflow-y-auto max-h-[280px] px-3 py-2 space-y-1">
            {filteredIssues.length === 0 && (
              <div className="text-[10px] text-white/30 py-4 text-center">No issues in this category</div>
            )}
            {filteredIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} onRepair={onRepair} onDismiss={onDismiss} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
