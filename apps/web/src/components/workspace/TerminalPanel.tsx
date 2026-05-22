"use client";

import { ResizablePanel } from "@/components/ui/resizable";
import { Terminal as TerminalIcon, X, Plus, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useWorkspace } from "./workspace-context";

const XtermTerminal = dynamic(() => import("./XtermTerminal"), { ssr: false });

export function TerminalPanel() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    handleAddNewSession,
    handleCloseSession,
  } = useWorkspace();

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  return (
    <ResizablePanel defaultSize={35} minSize={15}>
      <div className="h-full flex flex-col bg-[--terminal-bg]">
        {/* Terminal tabs — compact, dark */}
        <div className="flex items-center justify-between h-[28px] px-2 bg-[--terminal-panel] border-b border-[--terminal-border]">
          <div className="flex items-center gap-px overflow-x-auto scrollbar-none">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2 h-full cursor-pointer text-[10px] border-r border-[--terminal-border] transition-all",
                  activeSessionId === s.id
                    ? "bg-[--terminal-bg] text-[--accent-primary]"
                    : "bg-transparent text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-glass]"
                )}
              >
                <TerminalIcon className={cn("w-2.5 h-2.5", s.running && "text-[--accent-primary]")} />
                <span className="font-mono">{s.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCloseSession(s.id, e); }}
                  className="p-px hover:bg-[--bg-elevated]/50 rounded text-[--text-disabled] hover:text-[--text-secondary] transition-colors"
                >
                  <X className="w-2 h-2" />
                </button>
              </div>
            ))}
            <button
              onClick={handleAddNewSession}
              className="h-full px-1.5 text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-glass] transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>

          {activeSession?.running && (
            <button className="h-4 px-1.5 text-[8px] text-rose-400/70 border border-rose-500/10 rounded flex items-center gap-1 hover:bg-rose-500/5">
              <Square className="w-2 h-2" /> Kill
            </button>
          )}
        </div>

        {/* Terminal output */}
        <div className="flex-1 bg-[--terminal-bg] relative min-h-0">
          <XtermTerminal
            key={activeSession?.id}
            id={activeSession?.id || "term1"}
            cwd="."
          />
        </div>
      </div>
    </ResizablePanel>
  );
}
