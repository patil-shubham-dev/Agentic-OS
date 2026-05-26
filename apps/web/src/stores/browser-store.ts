import { create } from "zustand"

interface BrowserSession {
  id: string
  url: string
  title: string
  screenshot: string | null
  logs: string[]
}

interface BrowserStore {
  sessions: BrowserSession[]
  activeSessionId: string | null
  isLaunching: boolean
  addSession: (session: BrowserSession) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string | null) => void
  updateSession: (id: string, updates: Partial<BrowserSession>) => void
  setLaunching: (launching: boolean) => void
  clearLogs: (id: string) => void
}

export const useBrowserStore = create<BrowserStore>((set) => ({
  sessions: [],
  activeSessionId: null,
  isLaunching: false,

  addSession: (session) =>
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
    })),

  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((ss) => ss.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    })),

  setActiveSession: (id) => set({ activeSessionId: id }),

  updateSession: (id, updates) =>
    set((s) => ({
      sessions: s.sessions.map((ss) => (ss.id === id ? { ...ss, ...updates } : ss)),
    })),

  setLaunching: (launching) => set({ isLaunching: launching }),

  clearLogs: (id) =>
    set((s) => ({
      sessions: s.sessions.map((ss) => (ss.id === id ? { ...ss, logs: [] } : ss)),
    })),
}))
