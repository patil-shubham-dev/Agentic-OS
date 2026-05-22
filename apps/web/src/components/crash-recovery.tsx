"use client";

import { useState, useEffect } from "react";

interface CrashRecoveryProps {
  onRestore: () => void;
  onSafeMode: () => void;
  onReset: () => void;
}

const CRASH_COUNT_KEY = "agentos_crash_count";
const MAX_CRASHES = 3;

export function getCrashCount(): number {
  try {
    return parseInt(localStorage.getItem(CRASH_COUNT_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

export function incrementCrashCount(): void {
  try {
    const count = getCrashCount() + 1;
    localStorage.setItem(CRASH_COUNT_KEY, String(count));
  } catch {
    /* ignore */
  }
}

export function resetCrashCount(): void {
  try {
    localStorage.removeItem(CRASH_COUNT_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldUseSafeMode(): boolean {
  return getCrashCount() >= MAX_CRASHES;
}

export function CrashRecoveryOverlay({
  onRestore,
  onSafeMode,
  onReset,
}: CrashRecoveryProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    incrementCrashCount();
  }, []);

  if (!visible) return null;

  const isFrequent = getCrashCount() >= MAX_CRASHES;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0C0C0E]/95 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4 p-6 rounded-xl bg-[--bg-secondary] border border-[--border-primary] shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[--text-primary]">
              Recovery Required
            </h3>
            <p className="text-[10px] text-[--text-muted]">
              {isFrequent
                ? "The application has crashed multiple times. Safe mode is recommended."
                : "The application recovered from a previous crash."}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => {
              resetCrashCount();
              onRestore();
              setVisible(false);
            }}
            className="w-full px-4 py-2.5 text-xs font-medium rounded-lg bg-[--accent-primary] text-white hover:opacity-90 transition-opacity"
          >
            Restore Previous Session
          </button>

          <button
            onClick={() => {
              onSafeMode();
              setVisible(false);
            }}
            className="w-full px-4 py-2.5 text-xs font-medium rounded-lg bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary] border border-[--border-primary] transition-colors"
          >
            {isFrequent ? "Recommended: Safe Mode" : "Safe Mode"}
          </button>

          <button
            onClick={() => {
              try {
                localStorage.clear();
              } catch {}
              onReset();
              setVisible(false);
            }}
            className="w-full px-4 py-2.5 text-xs font-medium rounded-lg bg-red-500/5 text-red-400 hover:bg-red-500/10 border border-red-500/10 transition-colors"
          >
            Reset UI Only (Keep Data)
          </button>
        </div>

        <p className="mt-4 text-[9px] text-[--text-muted] text-center">
          Your workspaces and chat history are preserved.
        </p>
      </div>
    </div>
  );
}
