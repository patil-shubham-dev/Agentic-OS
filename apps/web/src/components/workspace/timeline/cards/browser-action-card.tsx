import { useState, memo } from "react"
import { cn } from "@/lib/utils"
import { Globe, ChevronDown, ChevronRight, Camera, MousePointer, AlertTriangle } from "lucide-react"

interface BrowserActionCardProps {
  action: string
  url?: string
  screenshot?: string
  result?: string
}

const ACTION_ICONS: Record<string, typeof Globe> = {
  navigate: Globe,
  screenshot: Camera,
  click: MousePointer,
  detect: AlertTriangle,
}

export const BrowserActionCard = memo(function BrowserActionCard({
  action,
  url,
  screenshot,
  result,
}: BrowserActionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = ACTION_ICONS[action] || Globe

  return (
    <div className="rounded-lg border border-white/8 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />
          )}
          <Icon className="h-3 w-3 shrink-0 text-sky-400" />
          <span className="text-[11px] text-white/70 capitalize">{action}</span>
          {url && (
            <span className="text-[9px] text-white/35 truncate max-w-[200px]">{url}</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/8 p-3 space-y-2">
          {screenshot && (
            <div className="rounded-lg overflow-hidden border border-white/8">
              <img
                src={screenshot}
                alt="Browser screenshot"
                className="w-full h-auto max-h-48 object-contain"
              />
            </div>
          )}
          {result && (
            <p className="text-[10px] text-white/50 leading-relaxed">{result}</p>
          )}
        </div>
      )}
    </div>
  )
})
