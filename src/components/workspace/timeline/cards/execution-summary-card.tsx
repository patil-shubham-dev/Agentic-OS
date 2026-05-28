import { CheckCircle2, XCircle, FileCode, Terminal, Globe, Cpu, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExecutionSummaryCardProps {
  filesEdited: number
  commandsRun: number
  browserActions: number
  durationMs: number
  modelName?: string
  status: "complete" | "error"
}

export function ExecutionSummaryCard({
  filesEdited,
  commandsRun,
  browserActions,
  durationMs,
  modelName,
  status,
}: ExecutionSummaryCardProps) {
  const duration = durationMs < 1000
    ? `${durationMs}ms`
    : `${(durationMs / 1000).toFixed(1)}s`

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        status === "complete"
          ? "border-emerald-500/20 bg-emerald-500/[0.02]"
          : "border-red-500/20 bg-red-500/[0.02]",
      )}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          {status === "complete" ? (
            <>
              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              </div>
              <span className="text-[11px] font-semibold text-emerald-400">Task completed</span>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-red-500/15">
                <XCircle className="h-3 w-3 text-red-400" />
              </div>
              <span className="text-[11px] font-semibold text-red-400">Task failed</span>
            </>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-1.5">
            <FileCode className="h-3 w-3 text-blue-400" />
            <div>
              <div className="text-[9px] text-white/30">Files</div>
              <div className="text-[11px] font-medium text-white/70">{filesEdited}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-1.5">
            <Terminal className="h-3 w-3 text-amber-400" />
            <div>
              <div className="text-[9px] text-white/30">Commands</div>
              <div className="text-[11px] font-medium text-white/70">{commandsRun}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-1.5">
            <Globe className="h-3 w-3 text-sky-400" />
            <div>
              <div className="text-[9px] text-white/30">Browser</div>
              <div className="text-[11px] font-medium text-white/70">{browserActions}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-1.5">
            <Clock className="h-3 w-3 text-purple-400" />
            <div>
              <div className="text-[9px] text-white/30">Duration</div>
              <div className="text-[11px] font-medium text-white/70">{duration}</div>
            </div>
          </div>
        </div>

        {modelName && (
          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-white/25">
            <Cpu className="h-2.5 w-2.5" />
            <span>{modelName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
