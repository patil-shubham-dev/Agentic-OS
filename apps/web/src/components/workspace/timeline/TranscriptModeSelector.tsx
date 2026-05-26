import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AlignJustify, AlignCenter } from "lucide-react"

export type TranscriptMode = "normal" | "summary"

const MODES: { id: TranscriptMode; label: string; icon: typeof AlignJustify; description: string }[] = [
  {
    id: "summary",
    label: "Summary",
    icon: AlignCenter,
    description: "Show only final responses and summaries",
  },
  {
    id: "normal",
    label: "Normal",
    icon: AlignJustify,
    description: "Full transcript with all tool calls",
  },
]

interface TranscriptModeSelectorProps {
  mode: TranscriptMode
  onChange: (mode: TranscriptMode) => void
}

export function TranscriptModeSelector({ mode, onChange }: TranscriptModeSelectorProps) {
  return (
    <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
      {MODES.map((m) => {
        const Icon = m.icon
        const isActive = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            title={m.description}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
              isActive
                ? "text-white bg-white/[0.08] shadow-sm"
                : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="transcript-mode-bg"
                className="absolute inset-0 rounded-md bg-white/[0.08]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className={cn(
              "h-3 w-3 relative z-10",
              isActive ? "text-blue-400" : "text-white/30",
            )} />
            <span className="relative z-10">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
