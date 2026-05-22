"use client";

import { useEffect, useState } from "react";

export type BootPhase =
  | "init"
  | "runtime"
  | "store"
  | "providers"
  | "models"
  | "roles"
  | "workspace"
  | "chat"
  | "session"
  | "ready"
  | "error";

interface BootStep {
  phase: BootPhase;
  label: string;
}

const BOOT_STEPS: BootStep[] = [
  { phase: "runtime", label: "Initializing runtime..." },
  { phase: "store", label: "Validating state integrity..." },
  { phase: "providers", label: "Restoring providers..." },
  { phase: "models", label: "Discovering models..." },
  { phase: "roles", label: "Configuring roles..." },
  { phase: "workspace", label: "Restoring workspace..." },
  { phase: "chat", label: "Recovering sessions..." },
  { phase: "session", label: "Finalizing..." },
];

interface BootScreenProps {
  currentPhase: BootPhase;
  error?: string | null;
  onRetry?: () => void;
  onSafeMode?: () => void;
  progress?: number;
}

export function BootScreen({
  currentPhase,
  error,
  onRetry,
  onSafeMode,
  progress,
}: BootScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (currentPhase === "ready") {
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [currentPhase]);

  if (!visible) return null;

  const isError = currentPhase === "error";
  const currentStepIndex = BOOT_STEPS.findIndex((s) => s.phase === currentPhase);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0C0C0E] transition-opacity duration-500"
      style={{
        opacity: currentPhase === "ready" ? 0 : 1,
      }}
    >
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${
              isError
                ? "border-red-500/30 bg-red-500/10"
                : "border-[--border-secondary] bg-[--bg-tertiary]"
            }`}
          >
            <img
              src="/apple-touch-icon.png"
              alt="AgentOS Studio"
              className="w-10 h-10"
            />
          </div>
          {!isError && currentPhase !== "ready" && (
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[--accent-primary] border-2 border-[#0C0C0E]" />
          )}
        </div>
        <h1 className="text-lg font-bold text-[--text-primary] tracking-tight">
          AgentOS Studio
        </h1>
      </div>

      {/* Progress */}
      {!isError && currentPhase !== "ready" && (
        <div className="w-64 mb-6">
          <div className="h-1 rounded-full bg-[--bg-tertiary] overflow-hidden">
            <div
              className="h-full rounded-full bg-[--accent-primary] transition-all duration-500 ease-out"
              style={{
                width: `${progress ?? ((currentStepIndex + 1) / BOOT_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="flex flex-col gap-2 w-64">
        {BOOT_STEPS.map((step, i) => {
          const isActive = i === currentStepIndex && !isError;
          const isDone = i < currentStepIndex || currentPhase === "ready";
          const isFailed = i === currentStepIndex && isError;

          return (
            <div
              key={step.phase}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all duration-300 ${
                isActive
                  ? "text-[--text-primary]"
                  : isDone
                    ? "text-[--text-muted]"
                    : isFailed
                      ? "text-red-400"
                      : "text-[--text-muted] opacity-40"
              }`}
            >
              <div className="w-4 flex justify-center">
                {isDone ? (
                  <svg
                    className="w-3.5 h-3.5 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-[--accent-primary] animate-pulse" />
                ) : isFailed ? (
                  <svg
                    className="w-3.5 h-3.5 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                )}
              </div>
              <span className="text-xs font-mono">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {isError && (
        <div className="mt-6 w-64 space-y-3">
          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
            <p className="text-[10px] text-red-400/80 leading-relaxed">
              {error || "Boot sequence failed"}
            </p>
          </div>
          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 px-3 py-2 text-[10px] font-medium rounded-lg bg-[--accent-primary] text-white hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
            )}
            {onSafeMode && (
              <button
                onClick={onSafeMode}
                className="flex-1 px-3 py-2 text-[10px] font-medium rounded-lg bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary] border border-[--border-primary] transition-colors"
              >
                Safe Mode
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
