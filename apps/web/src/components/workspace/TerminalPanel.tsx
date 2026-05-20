"use client";

import { ResizablePanel } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
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
    terminalOpen,
    handleAddNewSession,
    handleCloseSession,
  } = useWorkspace();

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  return (
    <ResizablePanel defaultSize={40} minSize={20}>
      <div className="h-full flex flex-col bg-slate-900 text-slate-100">
        {/* Terminal tabs bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/65">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 cursor-pointer text-xs rounded-lg transition-colors border",
                  activeSessionId === s.id
                    ? "bg-slate-800 text-emerald-400 border-emerald-500/40"
                    : "text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200"
                )}
              >
                <TerminalIcon
                  className={cn(
                    "w-3.5 h-3.5",
                    s.running && "text-emerald-400 animate-pulse"
                  )}
                />
                <span className="font-mono text-[11px]">{s.name}</span>
                <button
                  onClick={(e) => handleCloseSession(s.id, e)}
                  className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:bg-slate-800 hover:text-white rounded"
              onClick={handleAddNewSession}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {activeSession.running && (
              <Button
                size="sm"
                className="h-6 bg-red-650 hover:bg-red-700 text-white rounded text-[10px] px-2 shadow"
              >
                <Square className="w-2.5 h-2.5 mr-1" /> Kill Process
              </Button>
            )}
          </div>
        </div>

        {/* Terminal output area */}
        <div className="flex-1 bg-slate-900 relative min-h-0">
          <XtermTerminal
            key={activeSessionId}
            id={activeSessionId}
            cwd="."
          />
        </div>
      </div>
    </ResizablePanel>
  );
}
