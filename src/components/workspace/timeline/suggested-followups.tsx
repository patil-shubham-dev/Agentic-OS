import { memo, useMemo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Bug, FileCode, RefreshCw, Shield, Terminal, Search,
  BookOpen, type LucideIcon,
} from "lucide-react"
import type { ToolCallRecord, FileEditRecord, TerminalRecord } from "./step-card"

interface Suggestion {
  id: string
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
  prompt: string
}

function generateSuggestions(
  toolCalls: ToolCallRecord[],
  fileEdits: FileEditRecord[],
  terminalOutputs: TerminalRecord[],
): Suggestion[] {
  const suggestions: Suggestion[] = []

  // File-based suggestions
  const editedFiles = fileEdits.map((f) => f.path)
  if (editedFiles.length === 1) {
    suggestions.push({
      id: "explain-changes",
      label: "Explain changes",
      icon: BookOpen,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      prompt: `Explain the changes made to ${editedFiles[0]}`,
    })
    suggestions.push({
      id: "suggest-fixes",
      label: "Suggest improvements",
      icon: Bug,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      prompt: `Suggest improvements for the changes in ${editedFiles[0]}`,
    })
  } else if (editedFiles.length > 1) {
    suggestions.push({
      id: "summary-changes",
      label: "Summarize all edits",
      icon: FileCode,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      prompt: "Summarize all file edits and their impact",
    })
  }

  // Command-based suggestions
  const hasTerminalCommands = terminalOutputs.some((t) => t.status === "success" || t.status === "running")
  if (hasTerminalCommands) {
    suggestions.push({
      id: "run-tests",
      label: "Run tests",
      icon: Shield,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      prompt: "Run tests to verify changes",
    })
  }

  // Generic follow-ups
  if (suggestions.length < 3) {
    suggestions.push({
      id: "check-lint",
      label: "Check for issues",
      icon: Search,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      prompt: "Check for any lint errors or code quality issues",
    })
  }

  if (suggestions.length < 3) {
    suggestions.push({
      id: "next-steps",
      label: "What's next?",
      icon: RefreshCw,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      prompt: "What would be the most productive next step?",
    })
  }

  return suggestions.slice(0, 4)
}

export const SuggestedFollowups = memo(function SuggestedFollowups({
  toolCalls,
  fileEdits,
  terminalOutputs,
  onSelect,
}: {
  toolCalls: ToolCallRecord[]
  fileEdits: FileEditRecord[]
  terminalOutputs: TerminalRecord[]
  onSelect: (prompt: string) => void
}) {
  const suggestions = useMemo(
    () => generateSuggestions(toolCalls, fileEdits, terminalOutputs),
    [toolCalls, fileEdits, terminalOutputs],
  )

  if (suggestions.length === 0) return null

  return (
    <div className="border-t border-foreground/4 px-3 py-2">
      <span className="text-[8px] text-foreground/25 font-medium uppercase tracking-wider block mb-1.5">
        Suggested follow-ups
      </span>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((suggestion, i) => {
          const Icon = suggestion.icon
          return (
            <motion.button
              key={suggestion.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.15 }}
              onClick={() => onSelect(suggestion.prompt)}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium transition-all",
                "border-foreground/6 hover:border-foreground/12",
                "bg-foreground/[0.02] hover:bg-foreground/[0.04]",
                "text-foreground/50 hover:text-foreground/70",
              )}
            >
              <Icon className={cn("h-2.5 w-2.5", suggestion.color)} />
              {suggestion.label}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
})
