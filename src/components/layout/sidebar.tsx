import { useNavigate, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useThemeStore } from "@/stores/theme-store"
import {
  LayoutDashboard,
  Code2,
  Settings,
  Smartphone,
  Moon,
  Sun,
} from "lucide-react"

const navItems: { path: string; label: string; icon: typeof LayoutDashboard }[] = [
  { path: "/control-center", label: "Dashboard", icon: LayoutDashboard },
  { path: "/code-canvas", label: "Workspace", icon: Code2 },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/mobile-gateway", label: "Mobile Gateway", icon: Smartphone },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useThemeStore()

  const currentPath = location.pathname

  function toggleTheme() {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"]
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % order.length])
  }

  const ThemeIcon = theme === "dark" ? Moon : theme === "system" ? Sun : Sun

  function isActive(path: string): boolean {
    if (path === "/control-center") return currentPath === "/" || currentPath === "/control-center"
    return currentPath === path
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card animate-fade-in">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold tracking-tight">AgenticOS</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
                isActive(item.path)
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className="border-t p-3 space-y-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ThemeIcon className="h-3.5 w-3.5" />
          {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System"}
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          System Ready
        </div>
      </div>
    </aside>
  )
}
