"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  LayoutDashboard,
  MessageSquare,
  Bot,
  Workflow,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Bell,
  Cpu,
  Zap,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: MessageSquare, label: "Workspace", href: "/workspace" },
  { icon: Bot, label: "Agents", href: "/agents" },
  { icon: Workflow, label: "Automations", href: "/automations" },
  { icon: BookOpen, label: "Knowledge Base", href: "/knowledge" },
];

const bottomNavItems = [
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 72 : 260 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex flex-col border-r bg-card shrink-0"
        >
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-agentos-500 to-agentos-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-bold text-lg whitespace-nowrap overflow-hidden"
                  >
                    AgentOS
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>

          {/* Search */}
          <div className="p-3">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start gap-2 text-muted-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Search className="w-4 h-4 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm"
                  >
                    Search...
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && (
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              )}
            </Button>
          </div>

          {/* New Chat Button */}
          <div className="px-3 pb-2">
            <Link href="/workspace">
              <Button
                className={cn(
                  "w-full gap-2",
                  collapsed && "justify-center px-0"
                )}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      New Chat
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </Link>
          </div>

          <ScrollArea className="flex-1 px-3">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link href={item.href}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          size="icon"
                          className={cn(
                            "w-full h-10 justify-center",
                            isActive && "bg-secondary"
                          )}
                        >
                          <item.icon className="w-5 h-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 h-10",
                        isActive && "bg-secondary font-medium"
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                        />
                      )}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            <Separator className="my-4" />

            {/* Recent Chats */}
            {!collapsed && (
              <div className="space-y-1">
                <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Recent
                </p>
                {[
                  "Landing Page Design",
                  "API Integration",
                  "Database Schema",
                  "Auth Flow Review",
                ].map((chat) => (
                  <Button
                    key={chat}
                    variant="ghost"
                    className="w-full justify-start gap-3 h-9 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate">{chat}</span>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Bottom */}
          <div className="p-3 border-t space-y-1">
            {bottomNavItems.map((item) => {
              const isActive = pathname === item.href;
              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        size="icon"
                        className="w-full h-10 justify-center"
                      >
                        <item.icon className="w-5 h-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3 h-10"
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}

            {/* User */}
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  JD
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">John Doe</p>
                  <p className="text-xs text-muted-foreground truncate">Pro Plan</p>
                </div>
              )}
            </div>

            {/* Collapse toggle */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full gap-2 text-muted-foreground",
                collapsed && "justify-center px-0"
              )}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-xs">Collapse</span>
                </>
              )}
            </Button>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar */}
          <header className="h-14 border-b bg-card/50 backdrop-blur flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Claude Opus</span>
                <span className="text-xs text-muted-foreground">Manager</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>2,847 tokens</span>
                <CreditCard className="w-3 h-3 ml-2" />
                <span>$0.42</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
              </Button>
              <Button variant="ghost" size="icon">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
