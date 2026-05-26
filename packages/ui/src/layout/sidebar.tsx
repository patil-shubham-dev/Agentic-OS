import * as React from "react"
import { cn } from "@agentic-os/shared"
import {
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  Code,
  Settings,
  Smartphone,
  Users,
  AlertCircle,
} from "lucide-react"
import { Button } from "../button"
import { ScrollArea } from "../scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip"

interface SidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  href?: string
  onClick?: () => void
  active?: boolean
  badge?: number
}

interface SidebarGroup {
  label?: string
  items: SidebarItem[]
}

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  groups?: SidebarGroup[]
  className?: string
  footer?: React.ReactNode
}

const defaultGroups: SidebarGroup[] = [
  {
    items: [
      { id: "dashboard", label: "Control Center", icon: <LayoutDashboard className="h-4 w-4" /> },
      { id: "code", label: "Code Canvas", icon: <Code className="h-4 w-4" /> },
      { id: "agents", label: "Agents", icon: <Users className="h-4 w-4" /> },
      { id: "mobile", label: "Mobile Gateway", icon: <Smartphone className="h-4 w-4" /> },
    ],
  },
  {
    label: "System",
    items: [
      { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
      { id: "logs", label: "Logs", icon: <AlertCircle className="h-4 w-4" /> },
    ],
  },
]

function SidebarNavItem({ item, collapsed }: { item: SidebarItem; collapsed: boolean }) {
  const content = (
    <button
      onClick={item.onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
        item.active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && (
        <span className="flex-1 truncate text-left">{item.label}</span>
      )}
      {!collapsed && item.badge !== undefined && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
          {item.badge}
        </span>
      )}
    </button>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.label}
          {item.badge !== undefined && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {item.badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

function Sidebar({
  collapsed = false,
  onToggle,
  groups = defaultGroups,
  className,
  footer,
}: SidebarProps) {
  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex flex-col border-r bg-card transition-all duration-200",
          collapsed ? "w-14" : "w-60",
          className
        )}
      >
        <div className="flex h-14 items-center border-b px-3">
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <span className="text-sm font-semibold">Agentic OS</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-4 p-3">
            {groups.map((group, i) => (
              <div key={i} className="flex flex-col gap-1">
                {group.label && !collapsed && (
                  <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                )}
                {group.items.map((item) => (
                  <SidebarNavItem key={item.id} item={item} collapsed={collapsed} />
                ))}
              </div>
            ))}
          </nav>
        </ScrollArea>
        {footer && (
          <div className="border-t p-3">
            {footer}
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}

export { Sidebar }
export type { SidebarProps, SidebarItem, SidebarGroup }
