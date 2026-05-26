import { create } from "zustand"

type Theme = "light" | "dark" | "system"

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark")
  document.documentElement.classList.toggle("light", resolved === "light")
}

applyTheme(getSystemTheme())

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: "system",
  setTheme: (theme) => {
    let resolved: "light" | "dark"
    if (theme === "system") {
      resolved = getSystemTheme()
    } else {
      resolved = theme
    }
    applyTheme(resolved)
    set({ theme })
  },
}))

if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const state = useThemeStore.getState()
    if (state.theme === "system") {
      applyTheme(getSystemTheme())
    }
  })
}
