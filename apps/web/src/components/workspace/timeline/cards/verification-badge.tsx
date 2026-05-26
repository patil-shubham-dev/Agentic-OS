import { memo } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
export interface FileEditVerification {
  /** Whether TypeScript typecheck passed */
  passed: boolean
  /** Number of TypeScript errors found */
  typeCheckErrors: number
  /** Optional number of ESLint issues found (only available if typecheck passed) */
  lintErrors?: number
  /** One-line summary like "✅ TypeScript & ESLint passed" */
  summary: string
}

interface VerificationBadgeProps {
  verification: FileEditVerification
  size?: "sm" | "xs"
}

/**
 * A compact status badge shown on file edits after auto-verification runs.
 * Displays pass/fail with error counts in a small, non-intrusive format.
 */
export const VerificationBadge = memo(function VerificationBadge({
  verification,
  size = "xs",
}: VerificationBadgeProps) {
  const isCompact = size === "xs"

  if (verification.passed && !verification.lintErrors) {
    // Full pass: TS + lint both clean
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium",
          isCompact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5",
          "bg-emerald-500/10 text-emerald-400",
        )}
        title={verification.summary}
      >
        <CheckCircle2 className={isCompact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {isCompact ? "OK" : "Verified"}
      </span>
    )
  }

  if (verification.passed && (verification.lintErrors ?? 0) > 0) {
    // TS passed, lint has issues
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium",
          isCompact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5",
          "bg-amber-500/10 text-amber-400",
        )}
        title={verification.summary}
      >
        <AlertTriangle className={isCompact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {isCompact ? `${verification.lintErrors}L` : `${verification.lintErrors} lint`}
      </span>
    )
  }

  if (!verification.passed) {
    // TS errors
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium",
          isCompact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5",
          "bg-red-500/10 text-red-400",
        )}
        title={verification.summary}
      >
        <XCircle className={isCompact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {isCompact ? `${verification.typeCheckErrors}E` : `${verification.typeCheckErrors} error${verification.typeCheckErrors !== 1 ? "s" : ""}`}
      </span>
    )
  }

  return null
})


