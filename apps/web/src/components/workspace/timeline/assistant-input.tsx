import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Send, Square, Slash, AtSign, Code2, Palette,
  Globe, Bug, Search, RefreshCw, FileText,
  Bot, Terminal, Sparkles, Zap, Brain,
  Command,
} from "lucide-react"

const SLASH_COMMANDS = [
  { id: "/fix", label: "Fix", icon: Bug, description: "Fix bugs or errors in selected code" },
  { id: "/generate", label: "Generate", icon: Code2, description: "Generate new code or components" },
  { id: "/refactor", label: "Refactor", icon: RefreshCw, description: "Refactor existing code" },
  { id: "/explain", label: "Explain", icon: FileText, description: "Explain code or concepts" },
  { id: "/test", label: "Test", icon: Search, description: "Write or run tests" },
  { id: "/design", label: "Design", icon: Palette, description: "Generate UI designs" },
  { id: "/browse", label: "Browse", icon: Globe, description: "Browse or scrape a URL" },
  { id: "/terminal", label: "Terminal", icon: Terminal, description: "Run a terminal command" },
]

const AGENT_MENTIONS = [
  { id: "@coder", label: "Coder", icon: Code2, description: "Senior software engineer" },
  { id: "@designer", label: "Designer", icon: Palette, description: "UI/UX designer" },
  { id: "@browser", label: "Browser", icon: Globe, description: "Browser automation" },
  { id: "@debugger", label: "Debugger", icon: Bug, description: "Debug expert" },
  { id: "@qa", label: "QA", icon: Search, description: "Testing & verification" },
  { id: "@runtime", label: "Runtime", icon: Terminal, description: "Command execution" },
]

interface AssistantInputProps {
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onCancel: () => void
  isProcessing: boolean
  disabled?: boolean
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  placeholder?: string
  modeLabel?: string
  modeColor?: string
  isReady?: boolean
}

export function AssistantInput({
  input,
  onInputChange,
  onSend,
  onCancel,
  isProcessing,
  disabled,
  inputRef: externalRef,
  placeholder = "Describe what you want to build, fix, or explore...",
  modeLabel,
  modeColor = "text-blue-400",
  isReady,
}: AssistantInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = externalRef || internalRef
  const [showCommands, setShowCommands] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [commandFilter, setCommandFilter] = useState("")
  const [mentionFilter, setMentionFilter] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 140) + "px"
    }
  }, [input, textareaRef])

  // Close menus on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCommands(false)
        setShowMentions(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [commandFilter, mentionFilter])

  function handleChange(value: string) {
    onInputChange(value)

    // Detect /commands
    const lastWord = value.split(/\s/).pop() || ""
    if (lastWord.startsWith("/") && lastWord.length > 0) {
      setShowCommands(true)
      setCommandFilter(lastWord.slice(1).toLowerCase())
      setShowMentions(false)
    } else if (lastWord.startsWith("@") && lastWord.length > 0) {
      setShowMentions(true)
      setMentionFilter(lastWord.slice(1).toLowerCase())
      setShowCommands(false)
    } else {
      setShowCommands(false)
      setShowMentions(false)
    }
  }

  function insertCommand(command: string) {
    const words = input.split(/\s/)
    words[words.length - 1] = command + " "
    onInputChange(words.join(" ") + " ")
    setShowCommands(false)
    textareaRef.current?.focus()
  }

  function insertMention(mention: string) {
    const words = input.split(/\s/)
    words[words.length - 1] = mention + " "
    onInputChange(words.join(" ") + " ")
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.id.slice(1).startsWith(commandFilter)
  )
  const filteredMentions = AGENT_MENTIONS.filter((m) =>
    m.id.slice(1).startsWith(mentionFilter)
  )

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((p) => Math.min(p + 1, filteredCommands.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((p) => Math.max(p - 1, 0))
        return
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault()
        insertCommand(filteredCommands[selectedIndex]?.id || "")
        return
      }
      if (e.key === "Escape") {
        setShowCommands(false)
        return
      }
    }

    if (showMentions && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((p) => Math.min(p + 1, filteredMentions.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((p) => Math.max(p - 1, 0))
        return
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault()
        insertMention(filteredMentions[selectedIndex]?.id || "")
        return
      }
      if (e.key === "Escape") {
        setShowMentions(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Slash Commands Dropup */}
      <AnimatePresence>
        {showCommands && filteredCommands.length > 0 && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            role="listbox"
            aria-label="Commands"
            aria-activedescendant={filteredCommands[selectedIndex]?.id ? `cmd-${filteredCommands[selectedIndex].id}` : undefined}
            className="absolute bottom-full left-2 right-2 mb-2 rounded-2xl border border-white/[0.08] bg-[#0c0c0d]/98 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden z-50"
          >
            <div className="px-3 py-2 text-[9px] text-white/20 font-medium uppercase tracking-wider border-b border-white/[0.04]">
              Commands
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon
                return (
                  <button
                    key={cmd.id}
                    id={`cmd-${cmd.id}`}
                    role="option"
                    aria-selected={idx === selectedIndex}
                    onClick={() => insertCommand(cmd.id)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left rounded-xl transition-all",
                      idx === selectedIndex ? "bg-blue-500/10" : "hover:bg-white/[0.03]"
                    )}
                  >
                    <div className="flex items-center justify-center h-7 w-7 rounded-xl bg-blue-500/10 shrink-0 border border-blue-500/10">
                      <Icon className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white/70 font-mono">{cmd.id}</span>
                        <span className="text-[10px] text-white/30">{cmd.label}</span>
                      </div>
                      <p className="text-[9px] text-white/25 truncate mt-0.5">{cmd.description}</p>
                    </div>
                    <kbd className="hidden group-hover:flex items-center justify-center h-5 w-5 rounded-md bg-white/[0.04] text-[9px] text-white/20 font-mono border border-white/[0.06]">
                      ↵
                    </kbd>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Mentions Dropup */}
      <AnimatePresence>
        {showMentions && filteredMentions.length > 0 && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            role="listbox"
            aria-label="Agent mentions"
            aria-activedescendant={filteredMentions[selectedIndex]?.id ? `mention-${filteredMentions[selectedIndex].id}` : undefined}
            className="absolute bottom-full left-2 right-2 mb-2 rounded-2xl border border-white/[0.08] bg-[#0c0c0d]/98 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden z-50"
          >
            <div className="px-3 py-2 text-[9px] text-white/20 font-medium uppercase tracking-wider border-b border-white/[0.04]">
              Agents
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {filteredMentions.map((agent, idx) => {
                const Icon = agent.icon
                return (
                  <button
                    key={agent.id}
                    id={`mention-${agent.id}`}
                    role="option"
                    aria-selected={idx === selectedIndex}
                    onClick={() => insertMention(agent.id)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left rounded-xl transition-all",
                      idx === selectedIndex ? "bg-purple-500/10" : "hover:bg-white/[0.03]"
                    )}
                  >
                    <div className="flex items-center justify-center h-7 w-7 rounded-xl bg-purple-500/10 shrink-0 border border-purple-500/10">
                      <Icon className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white/70 font-mono">{agent.id}</span>
                        <span className="text-[10px] text-white/30">{agent.label}</span>
                      </div>
                      <p className="text-[9px] text-white/25 truncate mt-0.5">{agent.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main command bar container */}
      <motion.div
        animate={{
          borderColor: isProcessing
            ? "rgba(59, 130, 246, 0.3)"
            : isFocused
              ? "rgba(59, 130, 246, 0.2)"
              : "rgba(255, 255, 255, 0.06)",
        }}
        className={cn(
          "relative rounded-2xl border transition-shadow duration-300",
          isFocused && !isProcessing
            ? "shadow-lg shadow-blue-500/5"
            : isProcessing
              ? "shadow-lg shadow-blue-500/10"
              : "shadow-none",
        )}
      >
        {/* Background glow gradient */}
        <div className={cn(
          "absolute inset-0 rounded-2xl opacity-[0.03] transition-opacity duration-500",
          isFocused ? "opacity-[0.06]" : "opacity-0",
        )}>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />
        </div>

        {/* Input area */}
        <div className="relative px-4 pt-3 pb-2">
          {/* Mode indicator chip */}
          {modeLabel && !isProcessing && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                "border-white/[0.06] bg-white/[0.03]",
              )}>
                <Zap className={cn("h-2.5 w-2.5", modeColor)} />
                <span className={cn("text-[9px] font-medium", modeColor)}>{modeLabel}</span>
              </span>
              {isReady !== undefined && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px]",
                  isReady
                    ? "text-green-400/60 bg-green-500/5"
                    : "text-amber-400/60 bg-amber-500/5"
                )}>
                  <span className={cn(
                    "h-1 w-1 rounded-full",
                    isReady ? "bg-green-500" : "bg-amber-500"
                  )} />
                  {isReady ? "Ready" : "Standby"}
                </span>
              )}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isProcessing ? "Processing..." : placeholder}
            disabled={disabled || isProcessing}
            aria-label="Assistant command input"
            aria-expanded={showCommands || showMentions}
            aria-controls={showCommands ? "commands-list" : showMentions ? "mentions-list" : undefined}
            aria-autocomplete="list"
            aria-haspopup={showCommands || showMentions ? "listbox" : undefined}
            className={cn(
              "w-full resize-none bg-transparent text-sm text-white/85 outline-none transition-all placeholder:text-white/15 font-normal leading-relaxed",
              "scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent",
              input ? "min-h-[24px]" : "min-h-[24px]",
            )}
            rows={1}
          />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 pb-2.5">
          {/* Left: Contextual chips / hints */}
          <div className="flex items-center gap-1.5">
            {!isProcessing && !input && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5">
                  <Slash className="h-2.5 w-2.5 text-white/20" />
                  <span className="text-[8px] text-white/20 font-medium">commands</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5">
                  <AtSign className="h-2.5 w-2.5 text-white/20" />
                  <span className="text-[8px] text-white/20 font-medium">agents</span>
                </span>
              </div>
            )}
            {input.length > 0 && (
              <span className="text-[9px] text-white/15 font-mono">
                {input.length}
              </span>
            )}
          </div>

          {/* Right: Send/Cancel button */}
          <div className="flex items-center gap-2">
            {input.length > 0 && (
              <span className="text-[9px] text-white/15 font-mono hidden sm:inline">
                ↵ send  ·  ⇧↵ newline
              </span>
            )}
            <AnimatePresence mode="wait">
              <motion.button
                key={isProcessing ? "cancel" : "send"}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={isProcessing ? onCancel : onSend}
                disabled={!isProcessing && (!input.trim() || disabled)}
                aria-label={isProcessing ? "Cancel" : "Send"}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-xl transition-all",
                  isProcessing
                    ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                    : input.trim()
                      ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-600/20 hover:from-blue-500 hover:to-purple-500 hover:shadow-blue-500/30 active:scale-95"
                      : "bg-white/[0.03] text-white/20 border border-white/[0.06]",
                )}
              >
                {isProcessing ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </motion.button>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
