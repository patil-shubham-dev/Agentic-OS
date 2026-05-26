import { useState, useCallback, useImperativeHandle, forwardRef, useRef, useEffect, type MouseEvent, type KeyboardEvent } from "react"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { readFile, sanitizeFilename } from "@/lib/workspace"
import type { FileEntry } from "@/types"
import { File, Folder, FolderOpen, ChevronRight, ChevronDown, Sparkles, Clock, Star, FolderOpen as FolderOpenIcon, Loader2, Trash2, Edit3 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface FileTreeHandle {
  collapseAll: () => void
}

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.is_dir) return null
  const ext = entry.name.split(".").pop()?.toLowerCase()
  const iconColor = ext === "ts" || ext === "tsx" ? "text-blue-400"
    : ext === "js" || ext === "jsx" ? "text-yellow-400"
    : ext === "css" || ext === "scss" ? "text-pink-400"
    : ext === "html" ? "text-orange-400"
    : ext === "json" ? "text-green-400"
    : ext === "md" ? "text-purple-400"
    : "text-white/30"
  return <File className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
}

interface CreateInputProps {
  parentPath: string
  type: "file" | "folder"
  onSubmit: (fullPath: string, name: string) => void
  onCancel: () => void
}

function CreateInput({ parentPath, type, onSubmit, onCancel }: CreateInputProps) {
  const [value, setValue] = useState("")

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const name = sanitizeFilename(value)
      if (name) {
        const sep = parentPath.endsWith("\\") ? "" : "\\"
        const fullPath = `${parentPath}${sep}${name}`
        onSubmit(fullPath, name)
      }
    } else if (e.key === "Escape") {
      onCancel()
    }
  }

  return (
    <div className="flex items-center gap-1 px-2 py-0.5" style={{ paddingLeft: "24px" }}>
      {type === "folder" ? (
        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
      ) : (
        <File className="h-3.5 w-3.5 shrink-0 text-white/30" />
      )}
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        placeholder={type === "folder" ? "folder name" : "filename.ts"}
        className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded px-1.5 py-0.5 text-[11px] text-white/80 outline-none placeholder-white/20"
      />
    </div>
  )
}

interface RenameInputProps {
  entry: FileEntry
  onSubmit: (newPath: string, newName: string) => void
  onCancel: () => void
}

function RenameInput({ entry, onSubmit, onCancel }: RenameInputProps) {
  const [value, setValue] = useState(entry.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const name = sanitizeFilename(value)
      if (name && name !== entry.name) {
        const parentDir = entry.path.substring(0, entry.path.lastIndexOf("\\"))
        const sep = parentDir.endsWith("\\") ? "" : "\\"
        const newPath = `${parentDir}${sep}${name}`
        onSubmit(newPath, name)
      } else {
        onCancel()
      }
    } else if (e.key === "Escape") {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      className="flex-1 bg-white/[0.06] border border-blue-500/40 rounded px-1.5 py-0 text-[11px] text-white/80 outline-none min-w-0"
      style={{ width: `${Math.max(value.length * 7.5, 60)}px` }}
    />
  )
}

interface TreeNodeProps {
  entry: FileEntry
  depth: number
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  selectedDir: string | null
  onSelectDir: (path: string) => void
  creatingParent: string | null
  creatingType: "file" | "folder" | null
  onCreateSubmit: (fullPath: string, name: string) => void
  onCreateCancel: () => void
  onDeleteEntry: (path: string) => void
  onRenameSubmit?: (oldPath: string, newPath: string, newName: string) => void
}

function TreeNode({
  entry,
  depth,
  expandedPaths,
  onToggle,
  selectedDir,
  onSelectDir,
  creatingParent,
  creatingType,
  onCreateSubmit,
  onCreateCancel,
  onDeleteEntry,
  onRenameSubmit,
}: TreeNodeProps) {
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath)
  const openFile = useWorkspaceStore((s) => s.openFile)
  const changedFiles = useWorkspaceStore((s) => s.changedFiles)
  const aiContextFiles = useWorkspaceStore((s) => s.aiContextFiles)
  const isActive = activeFilePath === entry.path
  const isChanged = changedFiles.has(entry.path)
  const inAiContext = aiContextFiles.some((f) => f.path === entry.path)
  const expanded = expandedPaths.has(entry.path)
  const [isRenaming, setIsRenaming] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!contextMenu) return
    function handleClick() { setContextMenu(null) }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [contextMenu])

  async function handleClick(e: MouseEvent) {
    e.stopPropagation()
    if (entry.is_dir) {
      onToggle(entry.path)
      onSelectDir(entry.path)
    } else {
      try {
        const rootPath = useWorkspaceStore.getState().rootPath
        const absolutePath = rootPath ? `${rootPath}\\${entry.path.replace(/\//g, "\\")}` : entry.path
        const content = await readFile(absolutePath)
        openFile({ path: entry.path, name: entry.name, content, isDirty: false })
      } catch (err) {
        console.error("Failed to read file:", err)
      }
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      e.stopPropagation()
      onDeleteEntry(entry.path)
    }
    if (e.key === "F2") {
      e.preventDefault()
      e.stopPropagation()
      setIsRenaming(true)
    }
    if (e.key === "Enter") {
      e.preventDefault()
      handleClick(e as unknown as MouseEvent)
    }
  }

  const isCreatingHere = creatingParent === entry.path && creatingType !== null

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        data-tree-path={entry.path}
        data-is-dir={entry.is_dir ? "true" : undefined}
        className={cn(
          "group relative flex w-full items-center gap-1.5 px-2 py-1 text-left text-sm transition-all",
          isActive && "bg-white/[0.06] text-white",
          !isActive && "hover:bg-white/[0.03] text-white/50 hover:text-white/70",
          selectedDir === entry.path && !isActive && "bg-white/[0.02]",
        )}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        {entry.is_dir ? (
          <>
            <span className="text-white/30 w-3.5 flex justify-center">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </span>
            {expanded ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <FileIcon entry={entry} />
          </>
        )}
        {isRenaming ? (
          <RenameInput
            entry={entry}
            onSubmit={(newPath, newName) => {
              setIsRenaming(false)
              onRenameSubmit?.(entry.path, newPath, newName)
            }}
            onCancel={() => setIsRenaming(false)}
          />
        ) : (
          <span className={cn("truncate flex-1 text-xs", inAiContext && "text-blue-400")}>{entry.name}</span>
        )}
        {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-full" />}
        {isChanged && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
        {inAiContext && <Sparkles className="h-2.5 w-2.5 text-blue-400 shrink-0" />}
      </button>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-white/[0.08] bg-[#0d0d0e] shadow-2xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setIsRenaming(true); setContextMenu(null) }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors text-left"
          >
            <Edit3 className="h-3 w-3" />
            Rename
            <span className="ml-auto text-[9px] text-white/20">F2</span>
          </button>
          <div className="h-px bg-white/[0.06] my-0.5" />
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.path); setContextMenu(null) }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400/70 hover:text-red-400 hover:bg-white/[0.06] transition-colors text-left"
          >
            <Trash2 className="h-3 w-3" />
            Delete
            <span className="ml-auto text-[9px] text-white/20">Del</span>
          </button>
        </div>
      )}

      {isCreatingHere && (
        <CreateInput
          parentPath={entry.path}
          type={creatingType!}
          onSubmit={onCreateSubmit}
          onCancel={onCreateCancel}
        />
      )}

      {entry.is_dir && expanded && entry.children.length > 0 && (
        <>
          {entry.children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              selectedDir={selectedDir}
              onSelectDir={onSelectDir}
              creatingParent={creatingParent}
              creatingType={creatingType}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
              onDeleteEntry={onDeleteEntry}
              onRenameSubmit={onRenameSubmit}
            />
          ))}
        </>
      )}
    </div>
  )
}

function FileTreeSkeleton() {
  return (
    <div className="py-2 space-y-1.5 px-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${10 + (i % 3) * 14}px` }}>
          <Skeleton className={i % 2 === 0 ? "h-3 w-3" : "h-3 w-3.5"} />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
    </div>
  )
}

interface FileTreeProps {
  onOpenWorkspace?: () => void
  creatingType?: "file" | "folder" | null
  creatingParent?: string | null
  onCreateSubmit?: (fullPath: string, name: string) => void
  onCreateCancel?: () => void
  onDeleteEntry?: (path: string) => void
  onRenameSubmit?: (oldPath: string, newPath: string, newName: string) => void
}

const FileTree = forwardRef<FileTreeHandle, FileTreeProps>(function FileTree(
  { onOpenWorkspace, creatingType = null, creatingParent = null, onCreateSubmit, onCreateCancel, onDeleteEntry, onRenameSubmit },
  ref,
) {
  const fileTree = useWorkspaceStore((s) => s.fileTree)
  const rootPath = useWorkspaceStore((s) => s.rootPath)
  const isLoading = useWorkspaceStore((s) => s.isLoading)
  const aiContextFiles = useWorkspaceStore((s) => s.aiContextFiles)
  const suggestedFiles = useWorkspaceStore((s) => s.suggestedFiles)
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath)
  const [showAiContext, setShowAiContext] = useState(true)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedDir, setSelectedDir] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active file and auto-expand parent directories
  // Normalize paths to use backslashes (same format as data-tree-path from Tauri)
  useEffect(() => {
    if (!activeFilePath) return
    const normalizedPath = activeFilePath.replace(/\//g, '\\')

    // Expand all ancestor directories
    const parts = normalizedPath.split('\\')
    let current = ''
    const ancestors: string[] = []
    for (const part of parts) {
      if (!part) continue
      current = current ? `${current}\\${part}` : part
      ancestors.push(current)
    }
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      for (const ancestor of ancestors) {
        next.add(ancestor)
      }
      return next
    })

    // Scroll to active file after tree renders
    requestAnimationFrame(() => {
      const activeBtn = treeRef.current?.querySelector<HTMLElement>(`button[data-tree-path="${normalizedPath}"]`)
      activeBtn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [activeFilePath])

  useImperativeHandle(ref, () => ({
    collapseAll() {
      console.log("[Explorer] collapse all")
      setExpandedPaths(new Set())
    },
  }), [])

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // VS Code-style keyboard navigation for the tree
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button[data-tree-path]'))
    if (buttons.length === 0) return

    const target = e.target as HTMLElement
    const currentIdx = buttons.findIndex(el => el === target || el.contains(target))
    if (currentIdx === -1) return

    const currentPath = buttons[currentIdx]?.getAttribute('data-tree-path')
    if (!currentPath) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (currentIdx < buttons.length - 1) {
          buttons[currentIdx + 1].focus()
          buttons[currentIdx + 1].scrollIntoView({ block: 'nearest' })
        }
        break
      case "ArrowUp":
        e.preventDefault()
        if (currentIdx > 0) {
          buttons[currentIdx - 1].focus()
          buttons[currentIdx - 1].scrollIntoView({ block: 'nearest' })
        }
        break
      case "ArrowRight": {
        const isDir = buttons[currentIdx]?.getAttribute('data-is-dir') === 'true'
        if (isDir && !expandedPaths.has(currentPath)) {
          e.preventDefault()
          handleToggle(currentPath)
        }
        break
      }
      case "ArrowLeft": {
        if (expandedPaths.has(currentPath)) {
          e.preventDefault()
          handleToggle(currentPath)
        } else {
          // Focus parent directory
          const separator = currentPath.lastIndexOf('\\')
          if (separator > 0) {
            const parentPath = currentPath.substring(0, separator)
            const parentIdx = buttons.findIndex(el => el.getAttribute('data-tree-path') === parentPath)
            if (parentIdx !== -1) {
              e.preventDefault()
              buttons[parentIdx].focus()
              buttons[parentIdx].scrollIntoView({ block: 'nearest' })
            }
          }
        }
        break
      }
    }
  }, [expandedPaths, handleToggle])

  const handleSelectDir = useCallback((path: string) => {
    setSelectedDir(path)
  }, [])

  function handleCreateSubmit(fullPath: string, name: string) {
    onCreateSubmit?.(fullPath, name)
  }

  function handleCreateCancel() {
    onCreateCancel?.()
  }

  const handleDelete = useCallback((path: string) => {
    onDeleteEntry?.(path)
  }, [onDeleteEntry])

  const handleRenameSubmit = useCallback(async (oldPath: string, newPath: string, newName: string) => {
    onRenameSubmit?.(oldPath, newPath, newName)
  }, [onRenameSubmit])

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center py-8 px-4 text-center">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/[0.04] mb-3">
          <FolderOpenIcon className="h-4 w-4 text-white/30" />
        </div>
        <p className="text-xs text-white/40 font-medium mb-1">No workspace open</p>
        <p className="text-[10px] text-white/20 mb-3">Open a folder to explore files</p>
        <button
          onClick={onOpenWorkspace}
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-3 py-1.5 text-[11px] font-medium text-white/50 hover:text-white/70 transition-all"
        >
          <FolderOpenIcon className="h-3 w-3" />
          Open Folder
        </button>
      </div>
    )
  }

  if (isLoading) {
    return <FileTreeSkeleton />
  }

  return (
    <div className="py-0.5" ref={treeRef}>
      {(creatingParent === rootPath || creatingParent === null) && creatingType && (
        <CreateInput
          parentPath={rootPath}
          type={creatingType}
          onSubmit={handleCreateSubmit}
          onCancel={handleCreateCancel}
        />
      )}

      {aiContextFiles.length > 0 && showAiContext && (
        <div className="mb-1.5 px-2">
          <button
            onClick={() => setShowAiContext(false)}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-blue-400/60 hover:text-blue-400 transition-colors w-full text-left"
          >
            <Sparkles className="h-2.5 w-2.5" />
            AI Context
            <span className="text-blue-400/30 ml-auto text-[9px]">{aiContextFiles.length}</span>
          </button>
          {aiContextFiles.slice(0, 5).map((f) => (
            <div key={f.path} className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-blue-400/40 font-mono">
              <Star className="h-2 w-2 shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="text-blue-400/20 ml-auto">{f.relevance}%</span>
            </div>
          ))}
        </div>
      )}

      {suggestedFiles.length > 0 && (
        <div className="mb-1.5 px-2">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-amber-400/60">
            <Clock className="h-2.5 w-2.5" />
            Recent
          </div>
          {suggestedFiles.map((f) => (
            <div key={f} className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-amber-400/30 font-mono">
              <span className="truncate">{f}</span>
            </div>
          ))}
        </div>
      )}

      {fileTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-center px-4">
          <p className="text-xs text-white/40">Workspace is empty</p>
          <p className="text-[10px] text-white/20 mt-0.5">Add files to get started</p>
        </div>
      ) : (
        <div
          role="tree"
          aria-label="File explorer"
          onKeyDown={handleTreeKeyDown}
        >
          {fileTree.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              expandedPaths={expandedPaths}
              onToggle={handleToggle}
              selectedDir={selectedDir}
              onSelectDir={handleSelectDir}
              creatingParent={creatingParent}
              creatingType={creatingType}
              onCreateSubmit={handleCreateSubmit}
              onCreateCancel={handleCreateCancel}
              onDeleteEntry={handleDelete}
              onRenameSubmit={handleRenameSubmit}
            />
          ))}
        </div>
      )}
    </div>
  )
})

export { FileTree }