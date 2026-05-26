import { create } from "zustand"

interface DesktopState {
  isMaximized: boolean
  isFullscreen: boolean
  sidebarCollapsed: boolean

  toggleMaximized: () => void
  setFullscreen: (v: boolean) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
}

export const useDesktopStore = create<DesktopState>((set) => ({
  isMaximized: false,
  isFullscreen: false,
  sidebarCollapsed: false,
  toggleMaximized: () => set((s) => ({ isMaximized: !s.isMaximized })),
  setFullscreen: (v) => set({ isFullscreen: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
}))
