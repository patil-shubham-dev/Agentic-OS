"use client";

import { useState, useEffect, Component, type ReactNode } from "react";
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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { productName } from "@/lib/product-blueprint";
import { getJson } from "@/lib/client-api";
import { LayoutProvider, useLayout } from "@/components/layout-context";
import { RuntimeDiagnosticsPanel } from "@/components/settings/runtime-diagnostics";

class DashboardErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[DashboardErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="max-w-md space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-[--text-primary]">Dashboard Error</h3>
            <p className="text-xs text-[--text-muted]">The dashboard encountered an error but the app is still running.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[--accent-primary] text-white hover:opacity-90"
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <DashboardErrorBoundary>
      <LayoutProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </LayoutProvider>
    </DashboardErrorBoundary>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen, setSearchOpen } = useLayout();
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

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-screen overflow-hidden bg-[--bg-primary] text-[--text-primary] font-sans select-none">
        {/* ─── Top Command Bar ─── */}
        <header className="agentos-glass flex h-11 shrink-0 items-center justify-between border-b border-[--border-primary] px-3 z-50">
          {/* Left: Logo & Project Badge */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              prefetch={true}
              className="flex items-center gap-2.5 hover:opacity-85 transition-all duration-200"
            >
              <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg bg-[--accent-primary]/10 border border-[--border-secondary] shadow-sm overflow-hidden">
                <img
                  src="/apple-touch-icon.png"
                  alt="AgentOS Studio Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[--text-primary]">
                {productName}
              </span>
            </Link>

            <div className="h-4 w-px bg-[--border-primary]" />

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[--bg-tertiary] border border-[--border-primary] text-[10px] font-mono text-[--text-secondary] transition-colors hover:border-[--border-hover] group">
              <span className="w-1.5 h-1.5 rounded-full bg-[--accent-primary] animate-pulse shadow-[0_0_6px_var(--glow-primary)]" />
              <span className="group-hover:text-[--text-primary] transition-colors">{projectName}</span>
            </div>
          </div>

          {/* Center: Search / Command Palette Trigger */}
          <div className="flex-1 max-w-[480px] mx-6">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between bg-[--bg-tertiary] hover:bg-[--bg-elevated] text-[--text-muted] hover:text-[--text-secondary] border border-[--border-primary] hover:border-[--border-hover] h-[30px] px-3 text-[11px] rounded-lg transition-all duration-200 cursor-pointer shadow-sm group"
            >
              <div className="flex items-center gap-2.5">
                <Search className="h-3.5 w-3.5 text-[--text-muted] group-hover:text-[--accent-primary] transition-colors" />
                <span className="tracking-wide">Search files, commands...</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex h-[18px] select-none items-center gap-0.5 rounded-md border border-[--border-primary] bg-[--bg-elevated]/60 px-1.5 font-mono text-[9px] font-medium text-[--text-muted]">
                  <span className="text-[10px] text-[--text-muted]">⌘</span>
                  <span className="text-[--text-muted]">K</span>
                </span>
              </div>
            </button>
          </div>

          {/* Right: Provider Status / Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide transition-all duration-300",
                  providerConnected
                    ? "bg-emerald-500/8 text-emerald-400 border-emerald-500/20"
                    : "bg-[--bg-tertiary] text-[--accent-primary] border-[--border-secondary] hover:border-[--border-hover] hover:bg-[--bg-elevated]"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shadow-[0_0_6px]",
                    providerConnected
                      ? "bg-emerald-400 shadow-emerald-400/40"
                      : "bg-[--accent-primary] shadow-[--glow-primary] animate-pulse"
                  )}
                />
                <span>
                  {providerConnected ? "Connected" : "Configure AI"}
                </span>
              </div>
              {!providerConnected && (
                <Link
                  href="/settings"
                  className="flex items-center gap-1 text-[10px] text-[--accent-primary] hover:text-[--accent-hover] underline-offset-2 underline decoration-[--border-secondary] hover:decoration-[--accent-hover] transition-all duration-200"
                >
                  <Sparkles className="w-3 h-3" />
                  Setup
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* ─── Main Area: Activity Bar + Content ─── */}
        <div className="flex flex-1 min-h-0 relative">
          {/* Left Activity Bar */}
          <aside className="w-[56px] shrink-0 flex flex-col justify-between items-center py-3 border-r border-[--border-primary] bg-[--bg-secondary] z-40 select-none">
            {/* Top Navigation Icons */}
            <div className="w-full flex flex-col items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        prefetch={true}
                        className="relative w-full flex justify-center py-0.5"
                      >
                        <button
                          className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group",
                            active
                              ? "bg-[--accent-primary]/10 text-[--accent-primary] shadow-[0_0_12px_var(--glow-soft)]"
                              : "text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-tertiary]"
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-[18px] w-[18px] transition-transform duration-200",
                              active && "scale-110"
                            )}
                          />
                          {active && (
                            <motion.div
                              layoutId="activeActivityIndicator"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-[--accent-primary] shadow-[0_0_8px_var(--glow-primary)]"
                              transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 30,
                              }}
                            />
                          )}
                          {/* Active dot indicator for non-active items */}
                          {!active && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 rounded-r-full bg-[--accent-primary]/0 group-hover:h-6 group-hover:bg-[--accent-primary]/20 transition-all duration-300" />
                          )}
                        </button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="text-[11px] font-medium px-2.5 py-1.5"
                    >
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Bottom Items */}
            <div className="w-full flex flex-col items-center gap-1.5">
              {/* Sidebar Toggle (Workspace only) */}
              {pathname === "/workspace" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer",
                        "text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-tertiary]"
                      )}
                    >
                      {sidebarOpen ? (
                        <ChevronLeft className="h-[18px] w-[18px]" />
                      ) : (
                        <ChevronRight className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </TooltipTrigger>                    <TooltipContent
                      side="right"
                      className="text-[11px] font-medium px-2.5 py-1.5"
                    >
                      {sidebarOpen ? "Collapse Side Panel" : "Expand Side Panel"}
                    </TooltipContent>
                </Tooltip>
              )}

              {/* Settings */}
              {bottomNavItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        prefetch={true}
                        className="relative w-full flex justify-center py-0.5"
                      >
                        <button
                          className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group",
                            active
                              ? "bg-[--accent-primary]/10 text-[--accent-primary] shadow-[0_0_12px_var(--glow-soft)]"
                              : "text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-tertiary]"
                          )}
                        >
                          <item.icon className="h-[18px] w-[18px]" />
                          {active && (
                            <motion.div
                              layoutId="activeBottomIndicator"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-[--accent-primary] shadow-[0_0_8px_var(--glow-primary)]"
                              transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 30,
                              }}
                            />
                          )}
                        </button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="text-[11px] font-medium px-2.5 py-1.5"
                    >
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              <div className="h-px w-5 bg-[--border-primary]" />

              {/* User Avatar */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-pointer hover:opacity-85 transition-all duration-200">
                    <Avatar className="h-[28px] w-[28px] border border-[--border-primary] shadow-sm">
                      <AvatarFallback className="bg-[--bg-tertiary] text-[9px] text-[--text-muted] font-semibold">
                        OP
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </TooltipTrigger>                    <TooltipContent
                      side="right"
                      className="text-[11px] p-2.5 flex flex-col gap-0.5"
                    >
                      <p className="font-semibold text-[--text-primary]">Operator</p>
                      <p className="text-[10px] text-[--text-muted]">
                        Local Developer Workspace
                      </p>
                    </TooltipContent>
              </Tooltip>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[--bg-primary] relative z-30">
            {children}
          </main>
        </div>

        <RuntimeDiagnosticsPanel />
      </div>
    </TooltipProvider>
  );
}
