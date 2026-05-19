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
  Activity,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Cpu,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { productName, topBarModelRoles } from "@/lib/product-blueprint";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { icon: LayoutDashboard, label: "Home", href: "/dashboard" },
  { icon: MessageSquare, label: "Workspace", href: "/workspace" },
  { icon: Bot, label: "Agents", href: "/agents" },
  { icon: Workflow, label: "Automations", href: "/automations" },
  { icon: BookOpen, label: "Knowledge", href: "/knowledge" },
  { icon: BrainCircuit, label: "Memory", href: "/knowledge" },
  { icon: Activity, label: "Activity", href: "/dashboard" },
];

const bottomNavItems = [{ icon: Settings, label: "Settings", href: "/settings" }];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen agentos-shell text-foreground">
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 76 : 288 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex shrink-0 flex-col border-r border-white/10 bg-black/20 backdrop-blur-2xl"
        >
          <div className="flex h-16 items-center border-b border-white/10 px-4">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/30 via-slate-900 to-emerald-500/20 shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap text-lg font-semibold uppercase tracking-[0.22em]"
                  >
                    {productName}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>

          {!collapsed && (
            <div className="px-3 pt-3">
              <div className="agentos-card agentos-border-glow p-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project</p>
                    <p className="text-sm font-medium">Dream Project</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">Live</Badge>
                </div>
              </div>
            </div>
          )}

          <div className="p-3">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start gap-2 border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
                collapsed && "justify-center px-0"
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm">
                    Search...
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>

          <div className="px-3 pb-2">
            <Link href="/workspace">
              <Button className={cn("w-full gap-2", collapsed && "justify-center px-0")}>
                <Plus className="h-4 w-4 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                          className={cn("h-10 w-full justify-center border-white/5", isActive && "bg-white/[0.08]")}
                        >
                          <item.icon className="h-5 w-5" />
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
                        "h-10 w-full justify-start gap-3 rounded-xl text-slate-200 hover:bg-white/[0.05]",
                        isActive && "bg-white/[0.08] font-medium"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {isActive && <motion.div layoutId="activeNav" className="absolute left-0 h-6 w-1 rounded-r-full bg-emerald-400" />}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            <Separator className="my-4" />

            {!collapsed && (
              <div className="space-y-1">
                <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Assets</p>
                {[
                  { name: "GitHub", status: "Connected" },
                  { name: "Supabase", status: "Connected" },
                  { name: "Vercel", status: "Connected" },
                  { name: "Stripe", status: "Connected" },
                  { name: "OpenAI", status: "Connected" },
                ].map((asset) => (
                  <Button
                    key={asset.name}
                    variant="ghost"
                    className="h-9 w-full justify-between rounded-xl px-3 text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  >
                    <div className="flex items-center gap-3">
                      <FolderKanban className="h-4 w-4 shrink-0" />
                      <span className="truncate">{asset.name}</span>
                    </div>
                    <span className="text-[10px] text-emerald-300">{asset.status}</span>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="space-y-1 border-t border-white/10 p-3">
            {bottomNavItems.map((item) => {
              const isActive = pathname === item.href;
              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>
                      <Button variant={isActive ? "secondary" : "ghost"} size="icon" className="h-10 w-full justify-center">
                        <item.icon className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <Link key={item.href} href={item.href}>
                  <Button variant={isActive ? "secondary" : "ghost"} className="h-10 w-full justify-start gap-3">
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}

            <div className="agentos-card agentos-border-glow mt-3 px-3 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">OP</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Operator</p>
                    <p className="truncate text-xs text-muted-foreground">Admin</p>
                  </div>
                )}
              </div>
              {!collapsed && (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">System</p>
                  <p className="mt-1 text-sm font-medium">All systems operational</p>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className={cn("w-full gap-2 text-muted-foreground", collapsed && "justify-center px-0")}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-xs">Collapse</span>
                </>
              )}
            </Button>
          </div>
        </motion.aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-black/10 px-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              {[
                { label: "Environment", value: "Local", accent: "text-emerald-300" },
                { label: "Manager Model", value: topBarModelRoles[0]?.name ?? "Claude Opus" },
                { label: "Active Agent", value: "Hermes Operator" },
              ].map((item) => (
                <div key={item.label} className="hidden min-w-[170px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 lg:flex">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04]">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                    <p className={cn("text-sm font-medium", item.accent)}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 md:flex">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <div className="text-xs">
                  <p className="uppercase tracking-[0.18em] text-muted-foreground">Usage</p>
                  <div className="flex items-center gap-3">
                    <span>12.4M tokens</span>
                    <span>$24.41</span>
                  </div>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-muted-foreground xl:flex">
                <Zap className="h-3 w-3" />
                <span>+8.2%</span>
                <CreditCard className="ml-2 h-3 w-3" />
                <span>+11.3%</span>
              </div>
              <Button className="hidden border border-emerald-500/20 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20 md:inline-flex">
                Run
              </Button>
              <Button variant="outline" className="hidden border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15 md:inline-flex">
                Stop
              </Button>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              </Button>
              <Button variant="ghost" size="icon">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto px-2 pb-2">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
