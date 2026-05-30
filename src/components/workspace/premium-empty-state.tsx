import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  MessageSquare, FileCode, Globe, Palette,
  Sparkles, Terminal, Search, MousePointer,
  type LucideIcon,
} from "lucide-react"

export interface EmptyStateConfig {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  iconBorder: string
  title: string
  description: string
  features?: { label: string; icon: LucideIcon }[]
  actions?: { label: string; icon: LucideIcon; onClick: () => void; primary?: boolean; disabled?: boolean }[]
  hint?: string
}

interface PremiumEmptyStateProps {
  config: EmptyStateConfig
  className?: string
}

export function PremiumEmptyState({ config, className }: PremiumEmptyStateProps) {
  const Icon = config.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex h-full items-center justify-center bg-gradient-to-b from-black/20 via-transparent to-black/10",
        className,
      )}
    >
      <div className="flex flex-col items-center text-center max-w-sm px-6">
        {/* Icon with glow */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
          className={cn(
            "relative flex items-center justify-center h-16 w-16 rounded-2xl border backdrop-blur-xl mb-5",
            config.iconBg,
            config.iconBorder,
          )}
        >
          <div className={cn(
            "absolute inset-0 rounded-2xl opacity-20 blur-xl",
            config.iconBg,
          )} />
          <Icon className={cn("h-7 w-7 relative z-10", config.iconColor)} />
        </motion.div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
          className="text-sm font-semibold text-white/70 mb-1.5"
        >
          {config.title}
        </motion.h3>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.2 }}
          className="text-[11px] text-white/30 leading-relaxed mb-5"
        >
          {config.description}
        </motion.p>

        {/* Features list */}
        {config.features && config.features.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.2 }}
            className="flex flex-wrap justify-center gap-1.5 mb-5"
          >
            {config.features.map((f, i) => {
              const FeatIcon = f.icon
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] px-3 py-1"
                >
                  <FeatIcon className="h-2.5 w-2.5 text-white/30" />
                  <span className="text-[9px] text-white/35 font-medium">{f.label}</span>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* Action buttons */}
        {config.actions && config.actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {config.actions.map((action, i) => {
              const ActionIcon = action.icon
              return (
                <button
                  key={i}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-all",
                    action.primary
                      ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/20 text-blue-400 hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-500/30 shadow-lg shadow-blue-600/10"
                      : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.06] hover:border-white/[0.12]",
                    action.disabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <ActionIcon className={cn("h-3 w-3", action.primary && "text-blue-400")} />
                  <span>{action.label}</span>
                </button>
              )
            })}
          </motion.div>
        )}

        {/* Hint */}
        {config.hint && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.2 }}
            className="text-[9px] text-white/20 mt-4"
          >
            {config.hint}
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}

/** Pre-built empty state configs for each workspace mode */
export function getCodeEmptyState(
  hasOpenFiles: boolean,
  onOpenWorkspace?: () => void,
) {
  return {
    icon: FileCode as LucideIcon,
    iconColor: "text-blue-400/60",
    iconBg: "bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10",
    iconBorder: "border-white/[0.06]",
    title: hasOpenFiles ? "No file selected" : "Get Started",
    description: hasOpenFiles
      ? "Select an open file tab or click a file in the explorer to start editing."
      : "Open a project folder to start working. I'll help you read, edit, and navigate code with AI assistance.",
    features: hasOpenFiles ? undefined : [
      { label: "Syntax Highlighting", icon: FileCode },
      { label: "AI Editing", icon: Sparkles },
      { label: "File Navigation", icon: Search },
    ],
    actions: !hasOpenFiles && onOpenWorkspace ? [
      { label: "Open Project", icon: Terminal, onClick: onOpenWorkspace, primary: true },
    ] : undefined,
    hint: hasOpenFiles ? "⌘P to search files · ⌘S to save" : undefined,
  } satisfies EmptyStateConfig
}

export function getBrowserEmptyState(
  onLaunch?: () => void,
  isLaunching?: boolean,
  url?: string,
) {
  return {
    icon: Globe as LucideIcon,
    iconColor: "text-sky-400/60",
    iconBg: "bg-gradient-to-br from-sky-500/10 via-cyan-500/10 to-blue-500/10",
    iconBorder: "border-white/[0.06]",
    title: "Browser Automation",
    description: "Launch a headless browser session to inspect, interact, and automate web pages. The browser runs in a sandboxed environment with full DevTools support.",
    features: [
      { label: "Screenshot & Zoom", icon: Search },
      { label: "Click & Fill", icon: MousePointer },
      { label: "Console Monitor", icon: Terminal },
      { label: "JS Execution", icon: Sparkles },
    ],
    actions: [
      {
        label: isLaunching ? "Launching..." : "Launch Browser",
        icon: Globe,
        onClick: onLaunch || (() => {}),
        primary: true,
        disabled: isLaunching,
      },
    ],
    hint: "Enter a URL above and press Launch, or ⌘↵ to launch quickly",
  } satisfies EmptyStateConfig
}

export function getDesignEmptyState(
  onCreateNew?: () => void,
  onImportClipboard?: () => void,
  onGenerateSample?: () => void,
) {
  return {
    icon: Palette as LucideIcon,
    iconColor: "text-purple-400/60",
    iconBg: "bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-pink-500/10",
    iconBorder: "border-white/[0.06]",
    title: "Design Workspace",
    description: "Create, preview, version, and apply design artifacts to your codebase. Generate UI components visually or import existing code.",
    features: [
      { label: "Version History", icon: FileCode },
      { label: "Live Preview", icon: Search },
      { label: "Code Export", icon: Sparkles },
      { label: "Apply to Code", icon: Terminal },
    ],
    actions: [
      ...(onCreateNew ? [{ label: "New Artifact", icon: Palette, onClick: onCreateNew, primary: true as const }] : []),
      ...(onImportClipboard ? [{ label: "Import Code", icon: Globe, onClick: onImportClipboard }] : []),
      ...(onGenerateSample ? [{ label: "Sample", icon: Sparkles, onClick: onGenerateSample }] : []),
    ],
    hint: "Or select an artifact from the sidebar to preview",
  } satisfies EmptyStateConfig
}

export function getTimelineEmptyState(
  onSuggestionClick?: (text: string) => void,
) {
  return {
    icon: MessageSquare as LucideIcon,
    iconColor: "text-emerald-400/60",
    iconBg: "bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10",
    iconBorder: "border-white/[0.06]",
    title: "Execution Timeline",
    description: "Describe what you want to build, fix, or explore. The orchestrator will route your request to the right AI agents and show live progress here.",
    features: [
      { label: "Multi-Agent", icon: Sparkles },
      { label: "Live Streaming", icon: Terminal },
      { label: "File Edits", icon: FileCode },
      { label: "Browser Actions", icon: Globe },
    ],
    actions: onSuggestionClick ? [
      { label: "Fix the login system", icon: Sparkles, onClick: () => onSuggestionClick("Fix the login system") },
      { label: "Generate a dashboard UI", icon: Palette, onClick: () => onSuggestionClick("Generate a dashboard UI") },
    ] : undefined,
    hint: "Try /commands · @agents · or just describe what you need",
  } satisfies EmptyStateConfig
}
