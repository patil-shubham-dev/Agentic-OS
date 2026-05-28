import { memo, useRef, useEffect } from "react"
import { Loader2, FileText, Terminal, Globe, Search, Code } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCallRecord } from "../step-card"

const TOOL_ICONS: Record<string, typeof Code> = {
  grep_files: Search,
  glob_files: Search,
  read_file: FileText,
  write_file: FileText,
  edit_file: FileText,
  run_command: Terminal,
  launch_browser: Globe,
  browser_navigate: Globe,
  browser_screenshot: Globe,
  browser_click: Globe,
  browser_fill: Globe,
  delegate_subtask: Code,
  run_skill: Code,
}

function getToolIcon(name: string) {
  const Icon = TOOL_ICONS[name]
  if (Icon) return <Icon className="h-2.5 w-2.5" />
  return <Code className="h-2.5 w-2.5" />
}

function parseToolArgs(args: string, toolName: string): Record<string, string> {
  try {
    const parsed = JSON.parse(args)
    if (typeof parsed === "object" && parsed !== null) {
      const entries = Object.entries(parsed).map(([k, v]) => [
        k,
        typeof v === "string" ? v : JSON.stringify(v),
      ])
      return Object.fromEntries(entries.slice(0, 3))
    }
  } catch {}
  const pathMatch = args.match(/(?:path|file|pattern)["=:]+\s*"([^"]+)"/)
  if (pathMatch) return { target: pathMatch[1] }
  return {}
}

/**
 * Synchronized spinner hook: all spinners blink at the same phase
 * using a shared clock rather than independent CSS animations.
 */
function useSyncPhase(): boolean {
  const phaseRef = useRef(true)
  useEffect(() => {
    const interval = setInterval(() => {
      phaseRef.current = !phaseRef.current
    }, 600)
    return () => clearInterval(interval)
  }, [])
  return phaseRef.current
}

export const LiveToolStream = memo(function LiveToolStream({ toolCalls }: { toolCalls: ToolCallRecord[] }) {
  const runningTools = toolCalls.filter((tc) => tc.status === "running")
  if (runningTools.length === 0) return null
  const phase = useSyncPhase()

  return (
    <div className="border-t border-blue-500/10 bg-blue-500/[0.02] px-3 py-1.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className={cn(
            "absolute inline-flex h-full w-full rounded-full bg-blue-400 transition-opacity duration-300",
            phase ? "opacity-75" : "opacity-30",
          )} />
          <span className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500 transition-opacity duration-300",
            phase ? "opacity-100" : "opacity-50",
          )} />
        </span>
        <span className="text-[9px] text-blue-400/60 font-medium">Executing tools</span>
      </div>
      <div className="space-y-1">
        {runningTools.map((tc) => {
          const structured = parseToolArgs(tc.args, tc.name)
          const argPreview = Object.entries(structured)
            .map(([k, v]) => `${k}=${v.slice(0, 40)}`)
            .join(" ")

          return (
            <div key={tc.id} className="flex items-center gap-2 py-0.5">
              <span className={cn(
                "shrink-0 text-blue-400 transition-opacity duration-300",
                phase ? "opacity-100" : "opacity-40",
              )}>
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              </span>
              <span className="text-[9px] font-mono text-blue-400/70 shrink-0">{getToolIcon(tc.name)}</span>
              <span className="text-[10px] font-mono text-blue-400/80 font-medium shrink-0">{tc.name}</span>
              {argPreview && (
                <span className="text-[9px] text-white/30 font-mono truncate">{argPreview}</span>
              )}
              {tc.durationMs && (
                <span className="text-[8px] text-white/20 font-mono ml-auto shrink-0">
                  {(tc.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})
