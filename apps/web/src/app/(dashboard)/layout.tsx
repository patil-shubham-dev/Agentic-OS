"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Plus,
  Search,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { productName } from "@/lib/product-blueprint";
import { Badge } from "@/components/ui/badge";
import { getJson } from "@/lib/client-api";

interface SetupStatusResponse {
  ready: boolean;
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
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const { data: setup } = useQuery<SetupStatusResponse>({
    queryKey: ["setup-status"],
    queryFn: () => getJson<SetupStatusResponse>("/api/setup/status"),
    staleTime: 60_000,
  });

  const projectName = setup?.projectName ?? "My Workspace";
  const providerConnected = Boolean(setup?.hasConnectedProvider);

  // Memoize nav items to prevent re-renders on pathname change affecting static items
  const navContent = useMemo(() => (
    <nav className="space-y-0.5">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
        return collapsed ? (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Link href={item.href} prefetch={true}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-9 w-full justify-center text-amber-700/70 hover:bg-amber-100 hover:text-amber-900",
                    isActive && "bg-amber-100 text-amber-900 font-medium"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          <Link key={item.label} href={item.href} prefetch={true}>
            <Button
              variant="ghost"
              className={cn(
                "h-9 w-full justify-start gap-2.5 rounded-xl text-sm text-amber-800/70 hover:bg-amber-100 hover:text-amber-900",
                isActive && "bg-amber-100 text-amber-900 font-medium"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <motion.div layoutId="activeNav" className="absolute left-0 h-5 w-1 rounded-r-full bg-amber-500" />
              )}
            </Button>
          </Link>
        );
      })}
    </nav>
  ), [pathname, collapsed]);

  // Memoize bottom nav items
  const bottomNavContent = useMemo(() => (
    <div className="space-y-1 border-t border-amber-200/60 p-3">
      {bottomNavItems.map((item) => {
        const isActive = pathname === item.href;
        return collapsed ? (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link href={item.href} prefetch={true}>
                <Button variant={isActive ? "secondary" : "ghost"} size="icon" className="h-9 w-full justify-center text-amber-700/70 hover:bg-amber-100">
                  <item.icon className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          <Link key={item.href} href={item.href} prefetch={true}>
            <Button variant="ghost" className="h-9 w-full justify-start gap-2 text-sm text-amber-700/70 hover:bg-amber-100 hover:text-amber-900">
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Button>
          </Link>
        );
      })}

      <div className="mt-2 rounded-xl border border-amber-200 bg-white/60 px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src="" />
            <AvatarFallback className="bg-amber-100 text-xs text-amber-700 font-semibold">OP</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-amber-900">Operator</p>
              <p className="truncate text-xs text-amber-600/70">Local workspace</p>
            </div>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className={cn("w-full gap-2 text-amber-700/60 hover:bg-amber-100 hover:text-amber-900 text-xs mt-1", collapsed && "justify-center px-0")}
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            <span>Collapse</span>
          </>
        )}
      </Button>
    </div>
  ), [pathname, collapsed]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen agentos-shell text-foreground">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 72 : 272 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="flex shrink-0 flex-col border-r border-amber-200/70 bg-amber-50/80 backdrop-blur-xl"
        >
          {/* Logo */}
          <div className="flex h-14 items-center border-b border-amber-200/60 px-4">
            <Link href="/dashboard" prefetch={true} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-400 to-orange-400 shadow-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              {!collapsed && (
                <span className="overflow-hidden whitespace-nowrap text-sm font-semibold uppercase tracking-[0.20em] text-amber-900">
                  {productName}
                </span>
              )}
            </Link>
          </div>

          {/* Project badge */}
          {!collapsed && (
            <div className="px-3 pt-3">
              <div className="rounded-xl border border-amber-200 bg-white/60 px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600/70">Project</p>
                    <p className="truncate text-sm font-medium text-amber-900">{projectName}</p>
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      providerConnected
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
                    )}
                  >
                    {providerConnected ? "Ready" : "Setup"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="p-3">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start gap-2 border-amber-200 bg-white/50 text-amber-700/70 hover:bg-white/80 hover:text-amber-900 text-sm",
                collapsed && "justify-center px-0"
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm">Search...</span>}
            </Button>
          </div>

          {/* New Chat */}
          <div className="px-3 pb-2">
            <Link href="/workspace" prefetch={true}>
              <Button className={cn("w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm", collapsed && "justify-center px-0")}>
                <Plus className="h-4 w-4 shrink-0" />
                {!collapsed && <span>New Chat</span>}
              </Button>
            </Link>
          </div>

          {/* Nav items */}
          <ScrollArea className="flex-1 px-3">
            {navContent}
            <Separator className="my-3 bg-amber-200/60" />
          </ScrollArea>

          {/* Bottom */}
          {bottomNavContent}
        </motion.aside>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-amber-200/60 bg-amber-50/70 px-4 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "text-[10px]",
                  providerConnected
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
                )}
              >
                {providerConnected ? "Provider connected" : "No provider connected"}
              </Badge>
              {!providerConnected ? (
                <Link
                  href="/settings"
                  className="text-xs text-amber-700/80 underline-offset-2 hover:underline"
                >
                  Configure
                </Link>
              ) : null}
            </div>
          </header>

          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
