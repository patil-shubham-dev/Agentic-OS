import { useState, memo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  MessageSquare, ChevronDown, ChevronRight, Copy, RefreshCw, ThumbsUp, ThumbsDown,
  Clock, User, Bot, Sparkles,
} from "lucide-react"
import type { UserMessageEvent } from "./types"

interface TurnGroupProps {
  userEvent: UserMessageEvent
  children: React.ReactNode
  isLatest?: boolean
  onRetry?: (content: string) => void
}

export const TurnGroup = memo(function TurnGroup({
  userEvent,
  children,
  isLatest,
  onRetry,
}: TurnGroupProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rated, setRated] = useState<"up" | "down" | null>(null)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userEvent.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [userEvent.content])

  const time = new Date(userEvent.timestamp)
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group rounded-xl border transition-all duration-200",
        isLatest
          ? "border-blue-500/20 bg-gradient-to-b from-blue-500/[0.03] to-transparent shadow-lg shadow-blue-500/[0.03]"
          : "border-white/[0.06] bg-white/[0.02]",
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* User message header — premium glass style */}
      <div
        className={cn(
          "flex items-start gap-3 px-3 py-3 cursor-pointer select-none",
          "border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors",
        )}
        onClick={() => setCollapsed(!collapsed)}
      >
        {/* Collapse toggle */}
        <div className="flex items-center justify-center h-5 w-5 mt-0.5">
          <motion.div
            animate={{ rotate: collapsed ? 0 : 90 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="h-3 w-3 text-white/20" />
          </motion.div>
        </div>

        {/* Premium avatar with gradient */}
        <div className="flex items-center justify-center h-7 w-7 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 shrink-0 border border-blue-500/10">
          <User className="h-3 w-3 text-blue-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-blue-400/80">You</span>
            {isLatest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[7px] font-medium text-blue-400/60 border border-blue-500/10">
                <Sparkles className="h-2 w-2" />
                Latest
              </span>
            )}
          </div>
          <p className={cn(
            "text-[12px] leading-relaxed whitespace-pre-wrap",
            collapsed ? "text-white/40 line-clamp-1" : "text-white/80",
          )}>
            {userEvent.content}
          </p>
        </div>

        {/* Timestamp right-aligned */}
        <span className="text-[8px] text-white/15 font-mono mt-0.5 shrink-0">{timeStr}</span>

        {/* Actions overlay */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="flex items-center gap-0.5 shrink-0 ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleCopy}
                className={cn(
                  "rounded-lg p-1.5 text-[9px] transition-all",
                  copied
                    ? "text-emerald-400/70 bg-emerald-500/10"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.06]",
                )}
                title={copied ? "Copied!" : "Copy message"}
              >
                {copied ? (
                  <motion.span
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  >
                    <Copy className="h-3 w-3" />
                  </motion.span>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
              {onRetry && (
                <button
                  onClick={() => onRetry(userEvent.content)}
                  className="rounded-lg p-1.5 text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                  title="Retry with same prompt"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
              <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-white/[0.06]">
                <button
                  onClick={() => setRated(rated === "up" ? null : "up")}
                  className={cn(
                    "rounded-lg p-1.5 transition-all",
                    rated === "up"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-white/20 hover:text-white/50 hover:bg-white/[0.04]",
                  )}
                  title="Good response"
                >
                  <ThumbsUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setRated(rated === "down" ? null : "down")}
                  className={cn(
                    "rounded-lg p-1.5 transition-all",
                    rated === "down"
                      ? "text-red-400 bg-red-500/10"
                      : "text-white/20 hover:text-white/50 hover:bg-white/[0.04]",
                  )}
                  title="Bad response"
                >
                  <ThumbsDown className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Collapsible response area */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
          >
            <div className="px-3 py-2.5 space-y-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})
