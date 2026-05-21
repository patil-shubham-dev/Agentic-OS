"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Activity,
  BookOpen,
  Bot,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { productName } from "@/lib/product-blueprint";
import { getJson } from "@/lib/client-api";
import { LayoutProvider, useLayout } from "@/components/layout-context";

interface SetupStatusResponse {
  ready: boolean;
  needsSetup: boolean;
  hasProject: boolean;
  hasConnectedProvider: boolean;
  projectName: string | null;
}

const navItems = [
  { icon: LayoutDashboard, label: "Home", href: "/dashboard" },
  { icon: MessageSquare, label: "Workspace", href: "/workspace" },
  { icon: Bot, label: "Agents", href: "/agents" },
  { icon: Workflow, label: "Automations", href: "/automations" },
  { icon: BookOpen, label: "Knowledge", href: "/knowledge" },
  { icon: BrainCircuit, label: "Memory", href: "/memory" },
  { icon: Activity, label: "Activity", href: "/activity" },
];

const bottomNavItems = [{ icon: Settings, label: "Settings", href: "/settings" }];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LayoutProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </LayoutProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen, setSearchOpen, searchOpen } = useLayout();
  const pathname = usePathname();
  const router = useRouter();

  const { data: setup } = useQuery<SetupStatusResponse>({
    queryKey: ["setup-status"],
    queryFn: () => getJson<SetupStatusResponse>("/api/setup/status"),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (setup && setup.needsSetup) {
      router.push("/setup");
    }
  }, [setup, router]);

  const projectName = setup?.projectName ?? "My Workspace";
  const providerConnected = Boolean(setup?.hasConnectedProvider);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans select-none">
        {/* Top Command Bar */}
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card/50 px-4 backdrop-blur-xl z-50">
          {/* Left: Logo & Project Details */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" prefetch={true} className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-background p-0.5 shadow-sm overflow-hidden">
                <img src="/apple-touch-icon.png" alt="AgentOS Studio Logo" className="h-full w-full object-contain" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">
                {productName}
              </span>
            </Link>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/65 border border-border/80 text-[10px] text-muted-foreground font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
              <span>{projectName}</span>
            </div>
          </div>

          {/* Center: Command Palette Trigger */}
          <div className="flex-1 max-w-[420px] mx-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border h-7 px-3 text-[11px] rounded-md transition-all cursor-pointer shadow-sm group"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground/75 group-hover:text-foreground transition-colors" />
                <span>Search files, commands...</span>
              </div>
              <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted/80 px-1.5 font-mono text-[9px] font-medium text-muted-foreground opacity-100">
                <span className="text-[10px]">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Right: Setup Status / Provider connectivity */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold transition-all duration-300",
                providerConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", providerConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse")} />
                <span>{providerConnected ? "Connected" : "Configure AI Provider"}</span>
              </div>
              {!providerConnected && (
                <Link
                  href="/settings"
                  className="text-[10px] text-primary/80 hover:text-primary underline underline-offset-2 transition-colors"
                >
                  Setup
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Bottom Area: Left Activity Bar + Main Content */}
        <div className="flex flex-1 min-h-0 relative">
          {/* Left Activity Bar */}
          <aside className="w-14 shrink-0 flex flex-col justify-between items-center py-2.5 border-r border-border bg-card/30 z-40 select-none">
            {/* Top/Middle Icons */}
            <div className="w-full flex flex-col items-center gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <Link href={item.href} prefetch={true} className="relative w-full flex justify-center py-1">
                        <button
                          className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer relative group",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                          <item.icon className="h-4.5 w-4.5" />
                          {isActive && (
                            <motion.div
                              layoutId="activeActivityIndicator"
                              className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-r bg-primary"
                              transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                        </button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border text-[10px] rounded px-2 py-1 shadow-md">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Bottom Items */}
            <div className="w-full flex flex-col items-center gap-2.5">
              {/* Collapsible Sidebar Toggle (only in /workspace) */}
              {pathname === "/workspace" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {sidebarOpen ? (
                        <ChevronLeft className="h-4.5 w-4.5" />
                      ) : (
                        <ChevronRight className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border text-[10px] rounded px-2 py-1 shadow-md">
                    {sidebarOpen ? "Collapse Side Panel" : "Expand Side Panel"}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Settings & Avatar */}
              {bottomNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link href={item.href} prefetch={true} className="relative w-full flex justify-center py-0.5">
                        <button
                          className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer relative group",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className="h-4.5 w-4.5" />
                          {isActive && (
                            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-r bg-primary" />
                          )}
                        </button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border text-[10px] rounded px-2 py-1 shadow-md">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              <div className="h-px w-6 bg-border/60" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-pointer hover:opacity-90 transition-opacity">
                    <Avatar className="h-7 w-7 border border-border/80">
                      <AvatarFallback className="bg-muted text-[10px] text-muted-foreground font-semibold">OP</AvatarFallback>
                    </Avatar>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border text-[10px] rounded p-2.5 shadow-md flex flex-col gap-0.5">
                  <p className="font-semibold text-foreground">Operator</p>
                  <p className="text-[9px] text-muted-foreground">Local Developer Workspace</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background relative z-30">
            {children}
          </main>
        </div>
      </div>

    </TooltipProvider>
  );
}
