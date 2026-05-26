import { useState, useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface HydrationGateProps {
  children: ReactNode
  fallback?: ReactNode
  gateName?: string
}

export function HydrationGate({ children, fallback, gateName }: HydrationGateProps) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (!hydrated) {
    if (fallback) return <>{fallback}</>
    return (
      <div className={cn(
        "flex items-center justify-center h-full w-full",
        "bg-[#0a0a0b]",
      )}>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
          <span className="text-[10px] text-white/40">
            {gateName ? `Hydrating ${gateName}...` : "Hydrating..."}
          </span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
