import * as React from "react"
import { cn } from "@agentic-os/shared"
import { Sidebar } from "./sidebar"
import { ScrollArea } from "../scroll-area"

interface AppLayoutProps {
  children?: React.ReactNode
  sidebar?: React.ReactNode
  topBar?: React.ReactNode
  className?: string
  sidebarCollapsed?: boolean
  onSidebarToggle?: () => void
}

function AppLayout({
  children,
  sidebar,
  topBar,
  className,
  sidebarCollapsed = false,
  onSidebarToggle,
}: AppLayoutProps) {
  const content = children

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {sidebar || (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={onSidebarToggle}
        />
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        {topBar && (
          <header className="flex h-14 items-center gap-4 border-b px-6">
            {topBar}
          </header>
        )}
        <main className={cn("flex-1 overflow-hidden", className)}>
          <ScrollArea className="h-full">
            <div className="container mx-auto p-6">{content}</div>
          </ScrollArea>
        </main>
      </div>
    </div>
  )
}

export { AppLayout }
export type { AppLayoutProps }
