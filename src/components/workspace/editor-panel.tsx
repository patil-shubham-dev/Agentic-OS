import { useState, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { OpenFile } from "@/types"
import { cn } from "@/lib/utils"
import { Badge, TooltipSimple as Tooltip } from "@agentic-os/ui"
import { WrapText, Minus, Plus, X, FileCode, Sparkles, Brain, Check } from "lucide-react"

const EXT_LANG_MAP: Record<string, string> = {
  ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX",
  css: "CSS", scss: "SCSS", html: "HTML", json: "JSON",
  md: "Markdown", py: "Python", rs: "Rust", toml: "TOML",
  yaml: "YAML", yml: "YAML", sh: "Shell", bash: "Shell",
  sql: "SQL", go: "Go", java: "Java", rb: "Ruby",
}

function getLang(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return EXT_LANG_MAP[ext] ?? "Text"
}

function EditorTabs({ openFiles, activeFilePath, onOpen, onClose }: {
  openFiles: OpenFile[]
  activeFilePath: string | null
  onOpen: (f: OpenFile) => void
  onClose: (path: string) => void
}) {
  return (
    <div className="flex items-center border-b border-white/5 bg-black/20 overflow-x-auto">
      {openFiles.map((file) => (
        <div
          key={file.path}
          className={cn(
            "group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-white/5 transition-all",
            file.path === activeFilePath
              ? "bg-white/[0.04] text-white shadow-[inset_0_-1px_0_0] shadow-blue-500"
              : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
          )}
          onClick={() => onOpen(file)}
        >
          <span className={cn(
            "text-[10px] font-medium uppercase",
            getLang(file.name) === "TypeScript" && "text-blue-500",
            getLang(file.name) === "TSX" && "text-blue-500",
            getLang(file.name) === "JavaScript" && "text-yellow-500",
            getLang(file.name) === "CSS" && "text-pink-500",
            getLang(file.name) === "HTML" && "text-orange-500",
            getLang(file.name) === "JSON" && "text-green-500",
            getLang(file.name) === "Python" && "text-blue-400",
            getLang(file.name) === "Rust" && "text-orange-600",
          )}>
            {file.name.split(".").pop()}
          </span>
          <span className="truncate max-w-24">{file.name}</span>
          {file.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse-soft shrink-0" />}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(file.path) }}
            className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-white/30 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function EditorPanel() {
  const openFiles = useWorkspaceStore((s) => s.openFiles)
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath)
  const openFile = useWorkspaceStore((s) => s.openFile)
  const closeFile = useWorkspaceStore((s) => s.closeFile)
  const updateFileContent = useWorkspaceStore((s) => s.updateFileContent)
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty)
  const aiContextFiles = useWorkspaceStore((s) => s.aiContextFiles)
  const addAiContextFile = useWorkspaceStore((s) => s.addAiContextFile)
  const removeAiContextFile = useWorkspaceStore((s) => s.removeAiContextFile)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [saved, setSaved] = useState(false)
  const [wordWrap, setWordWrap] = useState(false)
  const [fontSize, setFontSize] = useState(13)
  const [showLineNumbers, setShowLineNumbers] = useState(true)

  const activeFile = openFiles.find((f) => f.path === activeFilePath)
  const isInAiContext = activeFile ? aiContextFiles.some((f) => f.path === activeFile.path) : false

  const lineCount = activeFile ? activeFile.content.split("\n").length : 0
  const lineNumWidth = useMemo(() => `${Math.max(2, String(lineCount).length)}ch`, [lineCount])

  function handleChange(value: string) {
    if (!activeFile) return
    updateFileContent(activeFile.path, value)
  }

  async function handleSave() {
    if (!activeFile) return
    try {
      const absolutePath = useWorkspaceStore.getState().rootPath
        ? `${useWorkspaceStore.getState().rootPath}\\${activeFile.path.replace(/\//g, "\\")}`
        : activeFile.path
      const { invoke } = await import("@tauri-apps/api/core")
      await invoke("write_text_file", { path: absolutePath, content: activeFile.content })
      try {
        await invoke("save_snapshot", {
          path: absolutePath,
          content: activeFile.content,
          description: `Saved ${activeFile.name}`,
        })
      } catch (_) {}
      markFileDirty(activeFile.path, false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      console.error("Failed to save:", err)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault()
      handleSave()
    }
  }

  function incrementFont(delta: number) {
    setFontSize((s) => Math.max(10, Math.min(24, s + delta)))
  }

  function toggleAiContext() {
    if (!activeFile) return
    if (isInAiContext) {
      removeAiContextFile(activeFile.path)
    } else {
      addAiContextFile(activeFile.path, activeFile.name, 100)
    }
  }

  if (!activeFile) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-b from-black/30 to-transparent">
        <div className="text-center space-y-3 animate-fade-in">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 mx-auto">
            <FileCode className="h-7 w-7 text-blue-400/60" />
          </div>
          <p className="text-sm text-white/50">
            {openFiles.length === 0 ? "Select a file from the file explorer" : "No file selected"}
          </p>
          {openFiles.length === 0 && (
            <p className="text-xs text-white/30">Open a workspace and click a file to begin</p>
          )}
        </div>
      </div>
    )
  }

  const lines = activeFile.content.split("\n")

  return (
    <div className="flex h-full flex-col">
      <EditorTabs openFiles={openFiles} activeFilePath={activeFilePath} onOpen={openFile} onClose={closeFile} />

      {/* Editor toolbar */}
      <div className="flex items-center justify-between border-b border-white/5 bg-black/10 px-3 py-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-medium text-white/40 uppercase">{getLang(activeFile.name)}</span>
          <span className="text-[10px] text-white/20">|</span>
          <span className="text-[10px] text-white/30">{lineCount} lines</span>
          <span className="text-[10px] text-white/20">|</span>
          <span className="text-[10px] text-white/30">{(activeFile.content.length / 1024).toFixed(1)} KB</span>
          {isInAiContext && (
            <Badge variant="info" size="sm">
              <Brain className="h-2.5 w-2.5 mr-0.5" /> AI Context
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip content={isInAiContext ? "Remove from AI context" : "Add to AI context"}>
            <button
              onClick={toggleAiContext}
              className={cn("rounded p-1 transition-all", isInAiContext ? "text-blue-400 bg-blue-500/10" : "text-white/30 hover:text-white/60")}
            >
              <Brain className="h-3 w-3" />
            </button>
          </Tooltip>
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={cn("rounded p-1 transition-colors", showLineNumbers ? "text-white/60" : "text-white/20 hover:text-white/40")}
          >
            <span className="text-[10px] font-mono font-bold">#</span>
          </button>
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={cn("rounded p-1 transition-colors", wordWrap ? "text-white/60 bg-white/10" : "text-white/20 hover:text-white/40")}
          >
            <WrapText className="h-3 w-3" />
          </button>
          <span className="text-[10px] text-white/20">|</span>
          <button onClick={() => incrementFont(-1)} className="rounded p-1 text-white/20 hover:text-white/40"><Minus className="h-3 w-3" /></button>
          <span className="text-[10px] font-mono text-white/40 w-5 text-center">{fontSize}</span>
          <button onClick={() => incrementFont(1)} className="rounded p-1 text-white/20 hover:text-white/40"><Plus className="h-3 w-3" /></button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-black/40 to-transparent">
        <div className="h-full overflow-auto font-mono" style={{ fontSize: `${fontSize}px` }}>
          <div className="flex">
            {showLineNumbers && (
              <div className="select-none text-right pr-3 pt-4 text-white/20 border-r border-white/5 bg-black/10 shrink-0" style={{ width: lineNumWidth, minWidth: "2.5rem", paddingRight: "0.75rem" }}>
                {lines.map((_, i) => (
                  <div key={i} className="leading-relaxed text-[0.9em]">{i + 1}</div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={activeFile.content}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "h-full w-full resize-none border-none bg-transparent p-4 outline-none leading-relaxed text-white/80 selection:bg-blue-500/20",
                !wordWrap && "overflow-x-auto whitespace-pre"
              )}
              style={{ fontSize: `${fontSize}px`, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* AI overlay indicator */}
        {isInAiContext && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 text-[9px] text-blue-400">
              <Sparkles className="h-2.5 w-2.5" />
              AI Aware
            </div>
          </div>
        )}

        {/* Save indicator */}
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-green-500/20 border border-green-500/30 px-3 py-1.5 text-[10px] text-green-400 shadow-lg"
            >
              <Check className="h-3 w-3" /> Saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
