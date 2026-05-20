"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/client-api";
import { Skeleton } from "@/components/skeleton-loader";
import { useWorkspace } from "./workspace-context";

export function StatusBar() {
  const { cursorPosition } = useWorkspace();
  const [gitInfo, setGitInfo] = useState<{ branch: string; changes: number } | null>(null);
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>("gpt-4o");

  useEffect(() => {
    // Load git info
    getJson<{ branch: string; changes: number }>("/api/git/status")
      .then((data) => setGitInfo(data))
      .catch(() => setGitInfo(null));

    // Load provider/model info from settings bridge
    getJson<{ roles: Record<string, string> }>("/api/settings/roles")
      .then((data) => {
        if (data.roles?.Coding) {
          setActiveModel(data.roles.Coding);
          setProviderStatus("connected");
        }
      })
      .catch(() => setProviderStatus("disconnected"));
  }, []);

  return (
    <div className="flex items-center justify-between h-6 px-4 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-400 font-mono select-none">
      <div className="flex items-center gap-4">
        {/* Git branch */}
        {!gitInfo ? (
          <Skeleton className="h-3 w-24 rounded" />
        ) : (
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span className="text-emerald-400">{gitInfo.branch}</span>
            {gitInfo.changes > 0 && (
              <span className="text-amber-400">+{gitInfo.changes}</span>
            )}
          </div>
        )}

        {/* Problems count (placeholder) */}
        <div className="flex items-center gap-1">
          <span className="text-emerald-400">✓</span>
          <span>Ready</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Provider status */}
        {!providerStatus ? (
          <Skeleton className="h-3 w-20 rounded" />
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                providerStatus === "connected"
                  ? "bg-emerald-400"
                  : "bg-amber-500"
              )}
            />
            <span>
              {providerStatus === "connected" ? "Provider OK" : "No Provider"}
            </span>
          </div>
        )}

        {/* Active model */}
        <span className="text-slate-500">{activeModel}</span>

        {/* Encoding */}
        <span className="text-slate-500">UTF-8</span>

        {/* Line/Column */}
        <span className="text-slate-500">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
      </div>
    </div>
  );
}
