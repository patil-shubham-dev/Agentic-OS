import { useState, useRef, useEffect, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface TooltipProps {
  content: string
  children: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  delay?: number
  className?: string
}

export function Tooltip({ content, children, side = "top", delay = 300, className }: TooltipProps) {
  const [show, setShow] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleEnter() {
    timerRef.current = setTimeout(() => setShow(true), delay)
  }

  function handleLeave() {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    setShow(false)
  }

  useEffect(() => {
    return () => { if (timerRef.current !== null) clearTimeout(timerRef.current) }
  }, [])

  const sideStyles: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  return (
    <div className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
              "absolute z-50 pointer-events-none",
              sideStyles[side],
              className
            )}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/90 backdrop-blur-2xl px-2.5 py-1.5 text-[11px] text-white/80 shadow-2xl">
              {content}
              <div className={cn(
                "absolute h-1.5 w-1.5 rotate-45 bg-black/90 border-white/10",
                side === "top" && "top-full left-1/2 -translate-x-1/2 -mt-[3px] border-b border-r",
                side === "bottom" && "bottom-full left-1/2 -translate-x-1/2 -mb-[3px] border-t border-l",
              )} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
