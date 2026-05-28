import { create } from "zustand"
import type { FileEntry, OpenFile, FileChangeEvent, RuntimeConfig } from "@/types"
import { requestRefresh } from "@/runtime/runtime-coordinator"

export type ExecutionMode = "autonomous" | "fastest" | "most_accurate" | "research_heavy" | "human_guided" | "safe_mode"
export type OrchestrationState = "idle" | "analyzing" | "planning" | "executing" | "reviewing" | "error"
export type AiContextFile = { path: string; name: string; relevance: number; addedAt: number }

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  sandboxEnabled: true,
  workspacePath: "",
  executionTimeout: 60000,
  maxConcurrency: 3,
  autoApprovePatterns: [],
  blockPatterns: [],
}

interface WorkspaceStore {
  rootPath: string | null
  fileTree: FileEntry[]
  openFiles: OpenFile[]
  activeFilePath: string | null
  changedFiles: Set<string>
  isLoading: boolean

  // Orchestration state (runtime state lives in workspace-runtime)
  executionMode: ExecutionMode
  orchestrationState: OrchestrationState
  aiContextFiles: AiContextFile[]
  suggestedFiles: string[]
  recentlyModified: string[]

  // Workspace config
  runtimeConfig: RuntimeConfig
  workspaceLoaded: boolean

  setRootPath: (path: string | null) => void
  setFileTree: (tree: FileEntry[]) => void
  setLoading: (loading: boolean) => void
  openFile: (file: OpenFile) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  updateFileContent: (path: string, content: string) => void
  markFileDirty: (path: string, dirty: boolean) => void
  handleFileChange: (event: FileChangeEvent) => void
  clearChangedFiles: () => void

  // Orchestration actions
  setExecutionMode: (mode: ExecutionMode) => void
  setOrchestrationState: (state: OrchestrationState) => void
  addAiContextFile: (path: string, name: string, relevance: number) => void
  removeAiContextFile: (path: string) => void
  clearAiContext: () => void
  setSuggestedFiles: (files: string[]) => void
  setRecentlyModified: (files: string[]) => void

  // Workspace config
  loadWorkspaceConfig: (path: string) => Promise<void>
  updateWorkspaceRuntimeConfig: (config: Partial<RuntimeConfig>) => void

  // File edit notification (for auto-open after AI edits)
  notifyFileEdited: (path: string, newContent: string) => void
  lastEditedFile: string | null
  recordFileEdit: (path: string) => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  rootPath: null,
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  changedFiles: new Set(),
  isLoading: false,

  executionMode: "autonomous",
  orchestrationState: "idle",
  aiContextFiles: [],
  suggestedFiles: [],
  recentlyModified: [],

  runtimeConfig: { ...DEFAULT_RUNTIME_CONFIG },
  workspaceLoaded: false,

  setRootPath: async (path) => {
    set({
      rootPath: path,
      fileTree: [],
      openFiles: [],
      activeFilePath: null,
      aiContextFiles: [],
      suggestedFiles: [],
      workspaceLoaded: false,
    })
    if (path) {
      await get().loadWorkspaceConfig(path)
      requestRefresh("workspace_change")
    }
  },

  setFileTree: (tree) => set({ fileTree: tree, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  openFile: (file) =>
    set((store) => {
      const exists = store.openFiles.find((f) => f.path === file.path)
      if (exists) return { activeFilePath: file.path }
      return { openFiles: [...store.openFiles, file], activeFilePath: file.path }
    }),

  closeFile: (path) =>
    set((store) => {
      const filtered = store.openFiles.filter((f) => f.path !== path)
      const newActive = store.activeFilePath === path
        ? (filtered.length > 0 ? filtered[filtered.length - 1].path : null)
        : store.activeFilePath
      return { openFiles: filtered, activeFilePath: newActive }
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) =>
    set((store) => ({
      openFiles: store.openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f
      ),
    })),

  markFileDirty: (path, dirty) =>
    set((store) => ({
      openFiles: store.openFiles.map((f) =>
        f.path === path ? { ...f, isDirty: dirty } : f
      ),
    })),

  handleFileChange: (event) => {
    const store = get()
    const newChanged = new Set(store.changedFiles)
    if (event.kind === "removed") {
      newChanged.delete(event.path)
    } else {
      newChanged.add(event.path)
    }
    set({ changedFiles: newChanged })
  },

  clearChangedFiles: () => set({ changedFiles: new Set() }),

  setExecutionMode: (mode) => set({ executionMode: mode }),
  setOrchestrationState: (state) => set({ orchestrationState: state }),
  addAiContextFile: (path, name, relevance) =>
    set((store) => {
      if (store.aiContextFiles.some((f) => f.path === path)) return store
      return {
        aiContextFiles: [...store.aiContextFiles, { path, name, relevance, addedAt: Date.now() }]
          .sort((a, b) => b.relevance - a.relevance),
      }
    }),
  removeAiContextFile: (path) =>
    set((store) => ({
      aiContextFiles: store.aiContextFiles.filter((f) => f.path !== path),
    })),
  clearAiContext: () => set({ aiContextFiles: [] }),
  setSuggestedFiles: (files) => set({ suggestedFiles: files }),
  setRecentlyModified: (files) => set({ recentlyModified: files }),

  loadWorkspaceConfig: async (path: string) => {
    const key = `agentic-workspace-config:${path}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const config = JSON.parse(raw)
        set({
          runtimeConfig: { ...DEFAULT_RUNTIME_CONFIG, ...config.runtimeConfig },
          workspaceLoaded: true,
        })
        return
      }
    } catch { /* config may not exist */ }
    set({
      runtimeConfig: { ...DEFAULT_RUNTIME_CONFIG, workspacePath: path },
      workspaceLoaded: true,
    })
  },

  updateWorkspaceRuntimeConfig: (config) =>
    set((store) => ({
      runtimeConfig: { ...store.runtimeConfig, ...config },
    })),

  lastEditedFile: null,

  notifyFileEdited: (path, newContent) => {
    set((state) => {
      const existingFile = state.openFiles.find(f => f.path === path)
      if (existingFile) {
        return {
          openFiles: state.openFiles.map(f =>
            f.path === path ? { ...f, content: newContent, isDirty: false } : f
          ),
          activeFilePath: path,
          lastEditedFile: path,
        }
      } else {
        const name = path.split('/').pop() ?? path.split('\\').pop() ?? path
        return {
          openFiles: [...state.openFiles, { path, name, content: newContent, isDirty: false }],
          activeFilePath: path,
          lastEditedFile: path,
        }
      }
    })
  },

  recordFileEdit: (path) => set({ lastEditedFile: path }),
}))
