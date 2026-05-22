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
  const [activeModel, setActiveModel] = useState<string>("—");

  useEffect(() => {
    getJson<{ branch: string; changes: number }>("/api/git/status")
      .then((data) => setGitInfo(data))
      .catch(() => setGitInfo(null));

    getJson<{ roles: Record<string, string> }>("/api/settings/roles")
      .then((data) => {
        if (data.roles?.Coding) {
          const codingVal = data.roles.Coding;
          // Format: "providerId:modelId" — extract the model portion for display
          const colonIdx = codingVal.indexOf(":");
          const displayModel = colonIdx >= 0 ? codingVal.substring(colonIdx + 1) : codingVal;
          setActiveModel(displayModel);
          setProviderStatus("connected");
        }
      })
      .catch(() => setProviderStatus("disconnected"));
  }, []);

  return (
    <div className="flex items-center justify-between h-[24px] px-3 bg-[--bg-tertiary] border-t border-[--border-primary] text-[10px] text-[--text-muted] font-mono select-none">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Git branch */}
        {!gitInfo ? (
          <Skeleton className="h-2.5 w-20 rounded" />
        ) : (
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-[--text-muted]" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span className="text-[--status-success] font-semibold">{gitInfo.branch}</span>
            {gitInfo.changes > 0 && (
              <span className="text-[--status-warning] font-medium">+{gitInfo.changes}</span>
            )}
          </div>
        )}

        {/* Ready indicator */}
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[--status-success] shadow-[0_0_4px_rgba(43,203,127,0.4)]" />
          <span className="text-[--text-secondary]">Ready</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Provider status */}
        {!providerStatus ? (
          <Skeleton className="h-2.5 w-16 rounded" />
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-1 h-1 rounded-full shadow-[0_0_4px]",
                providerStatus === "connected"
                  ? "bg-[--status-success] shadow-[--status-success]/40"
                  : "bg-[--status-warning] shadow-[--glow-primary]"
              )}
            />
            <span className="text-[--text-secondary]">
              {providerStatus === "connected" ? "Provider OK" : "No Provider"}
            </span>
          </div>
        )}

        {/* Active model */}
        <span className="text-[--text-disabled] font-medium">{activeModel}</span>

        {/* Separator */}
        <span className="text-[--border-primary]">|</span>

        {/* Encoding */}
        <span className="text-[--text-disabled]">UTF-8</span>

        {/* Separator */}
        <span className="text-[--border-primary]">|</span>

        {/* Cursor position */}
        <span className="text-[--text-disabled]">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
      </div>
    </div>
  );
}
