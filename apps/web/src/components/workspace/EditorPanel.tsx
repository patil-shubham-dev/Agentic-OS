"use client";

import dynamic from "next/dynamic";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Save, Layers, FileText, X, Code2, CheckCircle2, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/skeleton-loader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sendJson } from "@/lib/client-api";
import { useWorkspace } from "./workspace-context";
import { useCallback, useState } from "react";

const Editor = dynamic(() => import("./MonacoEditor").then((m) => ({ default: m.LazyEditor })), { ssr: false });
const DiffEditor = dynamic(() => import("./MonacoDiffEditor").then((m) => ({ default: m.LazyDiffEditor })), { ssr: false });

import { getFileIcon } from "@/lib/file-icons";

export function EditorPanel() {
  const {
    openTabs,
    activeTabPath,
    setActiveTabPath,
    activeTabPathRight,
    setActiveTabPathRight,
    splitActive,
    setSplitActive,
    focusedPane,
    setFocusedPane,
    handleCloseTab,
    handleSaveFile,
    handleEditorChange,
    handleEditorChangeRight,
    addToolResult,
    setOpenTabs,
    setCursorPosition,
  } = useWorkspace();

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  const handleEditorMount = useCallback(
    (editor: any) => {
      editor.onDidChangeCursorPosition((e: any) => {
        setCursorPosition({ line: e.position.lineNumber, column: e.position.column });
      });
    },
    [setCursorPosition]
  );

  const renderBreadcrumb = useCallback((path: string) => {
    const segments = path.split(/[/\\]/).filter(Boolean);
    return (
      <div className="flex items-center h-[22px] px-3 border-b border-[--border-primary]/60 bg-[--bg-secondary]/40 text-[10px] text-[--text-muted] font-medium select-none overflow-x-auto whitespace-nowrap scrollbar-none">
        {segments.map((segment, idx, arr) => (
          <div key={idx} className="flex items-center shrink-0">
            <span className={cn(idx === arr.length - 1 ? "text-[--text-secondary] font-semibold" : "text-[--text-muted]")}>
              {segment}
            </span>
            {idx < arr.length - 1 && (
              <ChevronRight className="w-2.5 h-2.5 mx-1 text-[--text-disabled] shrink-0" />
            )}
          </div>
        ))}
      </div>
    );
  }, []);

  return (
    <ResizablePanel defaultSize={60} minSize={15}>
      <div className="h-full flex flex-col bg-[--bg-primary]">
        {/* Tabs bar — compact, IDE-native */}
        <div className="flex items-center justify-between h-[32px] bg-[--bg-secondary] border-b border-[--border-primary] select-none">
          <div className="flex items-center h-full overflow-x-auto scrollbar-none flex-1">
            {openTabs.map((t) => {
              const isActive = activeTabPath === t.path;
              return (
                <div
                  key={t.path}
                  onClick={() => setActiveTabPath(t.path)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 h-full cursor-pointer text-[11px] border-r border-[--border-primary]/40 transition-colors shrink-0",
                    isActive
                      ? "bg-[--bg-primary] text-[--text-primary] shadow-[inset_0_-1px_0_0_var(--accent-primary)] font-medium"
                      : "bg-transparent text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-elevated]/20"
                  )}
                >
                  {getFileIcon(t.name)}
                  <span className="truncate max-w-[90px]">{t.name}</span>
                  {t.dirty && !t.isDiff && (
                    <span className="w-1 h-1 rounded-full bg-[--accent-primary] ml-0.5" />
                  )}
                  <button
                    onClick={(e) => handleCloseTab(t.path, e)}
                    className="p-px hover:bg-[--bg-elevated]/60 rounded text-[--text-disabled] hover:text-[--text-primary] transition-colors ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1 px-2 shrink-0">
            <button
              onClick={() => {
                setSplitActive(!splitActive);
                if (!splitActive) {
                  if (!activeTabPathRight) setActiveTabPathRight(activeTabPath);
                  setFocusedPane("right");
                } else {
                  setFocusedPane("left");
                }
              }}
              className={cn(
                "h-5 px-2 text-[9px] rounded border transition-colors flex items-center gap-1",
                splitActive
                  ? "bg-[--bg-elevated] text-[--text-primary] border-[--border-primary]"
                  : "text-[--text-muted] hover:text-[--text-secondary] border-transparent hover:border-[--border-primary]"
              )}
            >
              <Layers className="w-2.5 h-2.5" />
              {splitActive ? "1" : "||"}
            </button>
            {activeTab && !activeTab.isDiff && (
              <button
                onClick={handleSaveFile}
                className="h-5 px-2 text-[9px] text-[--text-muted] hover:text-[--text-primary] rounded border border-transparent hover:border-[--border-primary] transition-colors flex items-center gap-1"
              >
                <Save className="w-2.5 h-2.5" />
                Save
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        {activeTabPath && !splitActive && renderBreadcrumb(activeTabPath)}

        {/* Editor area */}
        <div className="flex-1 flex overflow-hidden">
          {!splitActive ? (
            activeTab ? (
              activeTab.isDiff ? (
                <DiffView tab={activeTab} />
              ) : (
                <div className="flex-1" onClick={() => setFocusedPane("left")}>
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    path={activeTab.path}
                    value={activeTab.content}
                    onChange={(val) => handleEditorChange(val || "")}
                    onMount={handleEditorMount}
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      padding: { top: 16 },
                      lineNumbers: "on",
                      renderLineHighlight: "line",
                      cursorBlinking: "smooth",
                      smoothScrolling: true,
                      cursorStyle: "line",
                      automaticLayout: true,
                    }}
                  />
                </div>
              )
            ) : (
              <EmptyEditorState />
            )
          ) : (
            <SplitEditorView />
          )}
        </div>
      </div>
    </ResizablePanel>
  );
}

function DiffView({ tab }: { tab: any }) {
  const { addToolResult, setOpenTabs } = useWorkspace();
  const [flashGreen, setFlashGreen] = useState(false);

  return (
    <div className="flex-1 flex flex-col relative h-full">
      {flashGreen && (
        <div className="absolute inset-0 z-20 bg-emerald-500/15 pointer-events-none" />
      )}
      <div className="absolute top-2 right-4 z-10 flex gap-2">
        <button
          className="h-7 px-3 text-[10px] font-medium rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
          onClick={() => {
            if (tab.toolCallId)
              addToolResult({ toolCallId: tab.toolCallId, state: "output-available" as const, output: "User rejected the edit.", tool: "reject_edit" });
            setOpenTabs((prev) => prev.filter((t) => t.path !== tab.path));
          }}
        >
          Reject
        </button>
        <button
          className="h-7 px-3 text-[10px] font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
          onClick={async () => {
            try {
              await sendJson("/api/files/write", "POST", { path: tab.path, content: tab.content });
              toast.success("Edit applied successfully");
              setFlashGreen(true);
              setTimeout(() => setFlashGreen(false), 600);
              if (tab.toolCallId)
                addToolResult({ toolCallId: tab.toolCallId, state: "output-available" as const, output: "User approved the edit. It has been applied.", tool: "approve_edit" });
              setOpenTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, isDiff: false, dirty: false } : t)));
            } catch {
              toast.error("Failed to apply edit");
            }
          }}
        >
          <CheckCircle2 className="w-3 h-3" />
          Accept
        </button>
      </div>
      <DiffEditor
        height="100%"
        theme="vs-dark"
        original={tab.originalContent || ""}
        modified={tab.content}
        options={{ fontSize: 13, minimap: { enabled: false }, fontFamily: "'JetBrains Mono', monospace" }}
      />
    </div>
  );
}

function EmptyEditorState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center bg-[--bg-primary] select-none">
      <div className="flex flex-col items-center gap-4 max-w-[280px]">
        <div className="w-12 h-12 rounded-2xl bg-[--bg-elevated]/20 border border-[--border-primary] flex items-center justify-center">
          <Code2 className="w-6 h-6 text-[--text-muted]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[--text-primary]">AgentOS Code Canvas</h3>
          <p className="text-[11px] text-[--text-muted] mt-1 leading-relaxed">
            Open a file from the explorer or press shortcuts to get started.
          </p>
        </div>

        <div className="w-full space-y-1 border border-[--border-primary] rounded-lg p-3 bg-[--bg-secondary]/30">
          {[
            { label: "Quick Open", shortcut: "Ctrl+P" },
            { label: "AI Composer", shortcut: "Ctrl+K" },
            { label: "Toggle Sidebar", shortcut: "Ctrl+B" },
            { label: "Toggle Terminal", shortcut: "Ctrl+J" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-[11px] text-[--text-secondary]">{item.label}</span>
              <kbd className="px-1.5 py-0.5 bg-[--bg-elevated]/50 text-[--text-muted] rounded font-mono text-[9px] border border-[--border-primary]">
                {item.shortcut}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SplitEditorView() {
  const {
    openTabs,
    activeTabPath,
    activeTabPathRight,
    focusedPane,
    setFocusedPane,
    handleEditorChange,
    handleEditorChangeRight,
    setCursorPosition,
  } = useWorkspace();

  const handleEditorMount = useCallback(
    (editor: any) => {
      editor.onDidChangeCursorPosition((e: any) => {
        setCursorPosition({ line: e.position.lineNumber, column: e.position.column });
      });
    },
    [setCursorPosition]
  );

  const activeTab = openTabs.find((t) => t.path === activeTabPath);
  const activeTabRight = openTabs.find((t) => t.path === activeTabPathRight);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={50} minSize={20}>
        <div
          className={cn(
            "h-full flex flex-col border-r border-[--border-primary]/50 transition-all",
            focusedPane === "left" && "shadow-[inset_-1px_0_0_0_var(--accent-primary)]"
          )}
          onClick={() => setFocusedPane("left")}
        >
          <div className="flex items-center px-3 h-[22px] bg-[--bg-secondary]/50 border-b border-[--border-primary] text-[9px] font-semibold text-[--text-muted] select-none shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[--accent-primary]" />
              {activeTabPath ? activeTabPath.split(/[/\\]/).pop() : "Empty"}
            </span>
          </div>
          {activeTab ? (
            <Editor
              height="100%"
              theme="vs-dark"
              path={`left-${activeTab.path}`}
              value={activeTab.content}
              onChange={(val) => handleEditorChange(val || "")}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                lineNumbers: "on",
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[11px] text-[--text-muted]">
              Click a file to open
            </div>
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle className="w-[3px] bg-transparent hover:bg-[--accent-primary]/20 data-[resize-handle-active]:bg-[--accent-primary]/30" />

      <ResizablePanel defaultSize={50} minSize={20}>
        <div
          className={cn(
            "h-full flex flex-col transition-all",
            focusedPane === "right" && "shadow-[inset_-1px_0_0_0_var(--accent-primary)]"
          )}
          onClick={() => setFocusedPane("right")}
        >
          <div className="flex items-center px-3 h-[22px] bg-[--bg-secondary]/50 border-b border-[--border-primary] text-[9px] font-semibold text-[--text-muted] select-none shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
              {activeTabPathRight ? activeTabPathRight.split(/[/\\]/).pop() : "Empty"}
            </span>
          </div>
          {activeTabRight ? (
            <Editor
              height="100%"
              theme="vs-dark"
              path={`right-${activeTabPathRight}`}
              value={activeTabRight.content}
              onChange={(val) => handleEditorChangeRight(val || "")}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                lineNumbers: "on",
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[11px] text-[--text-muted]">
              Right panel empty. Select a file.
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
