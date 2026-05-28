import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AlignJustify, AlignCenter, AlignLeft } from "lucide-react"

export type TranscriptMode = "normal" | "verbose" | "summary"

const MODES: { id: TranscriptMode; label: string; icon: typeof AlignJustify; description: string }[] = [
  {
    id: "verbose",
    label: "Verbose",
    icon: AlignLeft,
    description: "Every tool call, file read, and intermediate step",
  },
  {
    id: "normal",
    label: "Normal",
    icon: AlignJustify,
    description: "Tool calls collapsed into summaries, full text responses",
  },
  {
    id: "summary",
    label: "Summary",
    icon: AlignCenter,
    description: "Only final responses and summaries",
  },
]

interface TranscriptModeSelectorProps {
  mode: TranscriptMode
  onChange: (mode: TranscriptMode) => void
}

export function TranscriptModeSelector({ mode, onChange }: TranscriptModeSelectorProps) {
  return (
    <div className="flex items-center rounded-lg border border-foreground/6 bg-foreground/[0.02] p-0.5">
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
                ? "text-foreground/80 bg-foreground/[0.08] shadow-sm"
                : "text-foreground/35 hover:text-foreground/60 hover:bg-foreground/[0.03]",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="transcript-mode-bg"
                className="absolute inset-0 rounded-md bg-foreground/[0.08]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className={cn(
              "h-3 w-3 relative z-10",
              isActive ? "text-blue-400" : "text-foreground/30",
            )} />
            <span className="relative z-10">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
