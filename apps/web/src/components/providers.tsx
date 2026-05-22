"use client";

import { useState, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BootScreen, type BootPhase } from "@/components/boot-screen";
import { CrashRecoveryOverlay, shouldUseSafeMode, resetCrashCount } from "@/components/crash-recovery";
import { RuntimeManager } from "@/lib/runtime/runtime-manager";
import { setupCrashHandler } from "@/lib/runtime/crash-analytics";
import { startHeartbeat, setupDefaultHeartbeats, stopHeartbeat } from "@/lib/runtime/heartbeat-monitor";
import { registerDefaultTasks, pauseAllTasks, resumeAllTasks, clearAllTasks } from "@/lib/runtime/background-task-manager";
import { recordSnapshot } from "@/lib/runtime/runtime-inspector";
import { bootstrapPlatform, registerBuiltinCommands, detectLocalEngines } from "@/lib/platform";

let runtimeManagerInstance: RuntimeManager | null = null;

export function getRuntimeManager(): RuntimeManager {
  if (!runtimeManagerInstance) {
    runtimeManagerInstance = new RuntimeManager();
  }
  return runtimeManagerInstance;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  const [bootPhase, setBootPhase] = useState<BootPhase>("init");
  const [bootProgress, setBootProgress] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [safeMode, setSafeMode] = useState(false);

  useEffect(() => {
    const rm = getRuntimeManager();

    if (shouldUseSafeMode()) {
      setShowRecovery(true);
      return;
    }

    rm.setSafeMode(false);
    bootRuntime(rm);

    return () => {
      pauseAllTasks();
      stopHeartbeat();
    };
  }, []);

  // Record runtime snapshots every 10s after boot
  useEffect(() => {
    if (!booted) return;
    const timer = setInterval(() => recordSnapshot(), 10_000);
    return () => clearInterval(timer);
  }, [booted]);

  async function bootRuntime(rm: RuntimeManager, useSafeMode = false) {
    rm.setSafeMode(useSafeMode);

    const success = await rm.boot();

    if (success) {
      resetCrashCount();
      setBooted(true);

      // Wire crash analytics handler for renderer crashes
      setupCrashHandler();

      // Start health monitoring heartbeats
      setupDefaultHeartbeats();
      startHeartbeat();

      // Register background tasks
      registerDefaultTasks();
      resumeAllTasks();

      // Bootstrap platform layer (kernel, extensions, capabilities)
      try {
        await bootstrapPlatform();
      } catch (err) {
        console.warn("[Providers] Platform bootstrap warning:", err);
      }

      // Register built-in commands for command palette
      try {
        registerBuiltinCommands();
      } catch (err) {
        console.warn("[Providers] Command registration warning:", err);
      }

      // Detect local AI engines (non-blocking)
      detectLocalEngines().catch(() => {});
    } else {
      setBootError(rm.bootError || "Boot failed");
      setBootPhase("error");
    }
  }

  function handleBootPhase(phase: BootPhase, progress: number, error?: string) {
    setBootPhase(phase);
    setBootProgress(progress);
    if (error) setBootError(error);
  }

  function handleRestore() {
    setShowRecovery(false);
    const rm = getRuntimeManager();
    bootRuntime(rm, false);
  }

  function handleSafeMode() {
    setShowRecovery(false);
    setSafeMode(true);
    const rm = getRuntimeManager();
    bootRuntime(rm, true);
  }

  function handleResetUI() {
    // Clear local storage but keep chat/workspace data
    try {
      const keep = ["agentos_root_path"];
      const saved: Record<string, string> = {};
      for (const k of keep) {
        const v = localStorage.getItem(k);
        if (v) saved[k] = v;
      }
      localStorage.clear();
      for (const [k, v] of Object.entries(saved)) {
        localStorage.setItem(k, v);
      }
    } catch {}
    setShowRecovery(false);
    window.location.reload();
  }

  function handleRetry() {
    setBootError(null);
    setBootPhase("init");
    const rm = getRuntimeManager();
    bootRuntime(rm, safeMode);
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {/* Boot screen shows during initialization */}
        {!booted && !showRecovery && (
          <BootScreen
            currentPhase={bootPhase}
            error={bootError}
            onRetry={handleRetry}
            onSafeMode={() => {
              setSafeMode(true);
              const rm = getRuntimeManager();
              bootRuntime(rm, true);
            }}
            progress={bootProgress}
          />
        )}

        {/* Crash recovery overlay */}
        {showRecovery && (
          <CrashRecoveryOverlay
            onRestore={handleRestore}
            onSafeMode={handleSafeMode}
            onReset={handleResetUI}
          />
        )}

        {/* Safe mode banner */}
        {booted && safeMode && (
          <div className="fixed top-0 left-0 right-0 z-[9998] bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center">
            <span className="text-[10px] text-amber-400 font-medium">
              Safe Mode — Some features may be unavailable.{" "}
              <button
                onClick={() => {
                  setSafeMode(false);
                  const rm = getRuntimeManager();
                  bootRuntime(rm, false);
                }}
                className="underline underline-offset-2 hover:text-amber-300"
              >
                Restart normally
              </button>
            </span>
          </div>
        )}

        {/* Content only renders after boot */}
        {booted && children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
