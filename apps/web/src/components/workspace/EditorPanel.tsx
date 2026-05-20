"use client";

import dynamic from "next/dynamic";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Save, Layers, FileText, X, Code2, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/skeleton-loader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sendJson } from "@/lib/client-api";
import { useWorkspace } from "./workspace-context";
import { useCallback } from "react";

const Editor = dynamic(() => import("./MonacoEditor").then((m) => ({ default: m.LazyEditor })), { ssr: false });
const DiffEditor = dynamic(() => import("./MonacoDiffEditor").then((m) => ({ default: m.LazyDiffEditor })), { ssr: false });

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
    editorOpen,
    addToolResult,
    setOpenTabs,
  } = useWorkspace();

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  // Breadcrumb helper
  const renderBreadcrumb = useCallback((path: string) => {
    const segments = path.split(/[/\\]/);
    return (
      <div className="flex items-center px-4 py-1.5 border-b border-amber-100 bg-amber-50/10 text-[11px] text-amber-700/80 font-medium">
        {segments.map((segment, idx, arr) => (
          <div key={idx} className="flex items-center">
            <span className={idx === arr.length - 1 ? "text-amber-950 font-bold" : ""}>
              {segment}
            </span>
            {idx < arr.length - 1 && (
              <svg className="w-3 h-3 mx-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    );
  }, []);

  return (
    <ResizablePanel defaultSize={60} minSize={20}>
      <div className="h-full flex flex-col bg-white border-b border-amber-200/60">
        {/* Tabs bar */}
        <div className="flex items-center justify-between border-b border-amber-200/60 bg-amber-50/20 px-2 py-1">
          <div className="flex items-center gap-1 overflow-x-auto">
            {openTabs.map((t) => (
              <div
                key={t.path}
                onClick={() => setActiveTabPath(t.path)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs font-semibold cursor-pointer border-t-2 border-x border-transparent transition-all",
                  activeTabPath === t.path
                    ? "bg-white text-amber-900 border-t-amber-600 border-x-amber-200/70 shadow-sm"
                    : "text-amber-700/75 hover:bg-amber-100/40"
                )}
              >
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>{t.name}</span>
                {t.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />}
                <button
                  onClick={(e) => handleCloseTab(t.path, e)}
                  className="p-0.5 hover:bg-amber-100 rounded text-amber-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
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
                "h-8 text-xs border-amber-200 rounded-xl px-3 flex items-center gap-1.5",
                splitActive
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "text-amber-700 hover:bg-amber-50"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              {splitActive ? "Single View" : "Split View"}
            </Button>
            {activeTab && (
              <Button
                size="sm"
                onClick={handleSaveFile}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-8"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save
              </Button>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        {activeTabPath && renderBreadcrumb(activeTabPath)}

        {/* Editor area */}
        <div className="flex-1 flex overflow-hidden">
          {!splitActive ? (
            activeTab ? (
              activeTab.isDiff ? (
                <DiffView tab={activeTab} />
              ) : (
                <div className="flex-1 h-full" onClick={() => setFocusedPane("left")}>
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    path={activeTab.path}
                    value={activeTab.content}
                    onChange={(val) => handleEditorChange(val || "")}
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      padding: { top: 16 },
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

  return (
    <div className="flex-1 flex flex-col relative group">
      <div className="absolute top-2 right-6 z-10 flex gap-2">
        <Button
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white h-7 shadow"
          onClick={() => {
            if (tab.toolCallId)
              addToolResult({ toolCallId: tab.toolCallId, state: "output-available" as const, output: "User rejected the edit.", tool: "reject_edit" });
            setOpenTabs((prev) => prev.filter((t) => t.path !== tab.path));
          }}
        >
          Reject
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 shadow"
          onClick={async () => {
            try {
              await sendJson("/api/files/write", "POST", { path: tab.path, content: tab.content });
              toast.success("Edit applied successfully");
              if (tab.toolCallId)
                addToolResult({ toolCallId: tab.toolCallId, state: "output-available" as const, output: "User approved the edit. It has been applied.", tool: "approve_edit" });
              setOpenTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, isDiff: false, dirty: false } : t)));
            } catch {
              toast.error("Failed to apply edit");
            }
          }}
        >
          Accept and Apply
        </Button>
      </div>
      <DiffEditor
        height="100%"
        theme="vs-dark"
        original={tab.originalContent || ""}
        modified={tab.content}
        options={{ fontSize: 13, minimap: { enabled: false } }}
      />
    </div>
  );
}

function EmptyEditorState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-amber-600/70 bg-amber-50/5 relative overflow-hidden">
      {/* Background skeleton grid */}
      <div className="absolute inset-0 p-6 space-y-4 opacity-25">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <Skeleton className="h-3 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-3 w-5/6 rounded" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-3 w-2/3 rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
      </div>

      {/* Foreground prompt */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-10 h-10 rounded-2xl bg-amber-100/50 flex items-center justify-center mb-3">
          <Code2 className="w-5 h-5 text-amber-600/50" />
        </div>
        <h4 className="font-bold text-amber-950">Code Canvas</h4>
        <p className="max-w-xs mt-1">
          Double-click a file in the sidebar explorer to open it in the editor.
        </p>
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
  } = useWorkspace();

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={50} minSize={20}>
        <div
          className={cn(
            "h-full flex flex-col border-r border-amber-100",
            focusedPane === "left" && "ring-1 ring-amber-500/40"
          )}
          onClick={() => setFocusedPane("left")}
        >
          <div className="flex items-center justify-between px-3 py-1 bg-amber-50/15 border-b border-amber-250/20 text-[10px] font-bold text-amber-900 select-none">
            <span>
              L-PANE{" "}
              {activeTabPath
                ? `(${activeTabPath.split(/[/\\]/).pop()})`
                : "(Empty)"}
            </span>
            {focusedPane === "left" && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          {activeTab ? (
            <Editor
              height="100%"
              theme="vs-dark"
              path={`left-${activeTab.path}`}
              value={activeTab.content}
              onChange={(val) => handleEditorChange(val || "")}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-[11px] text-amber-600/60 bg-amber-50/5">
              Left panel empty. Click a file.
            </div>
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={50} minSize={20}>
        <div
          className={cn(
            "h-full flex flex-col",
            focusedPane === "right" && "ring-1 ring-amber-500/40"
          )}
          onClick={() => setFocusedPane("right")}
        >
          <div className="flex items-center justify-between px-3 py-1 bg-amber-50/15 border-b border-amber-250/20 text-[10px] font-bold text-amber-900 select-none">
            <span>
              R-PANE{" "}
              {activeTabPathRight
                ? `(${activeTabPathRight.split(/[/\\]/).pop()})`
                : "(Empty)"}
            </span>
            {focusedPane === "right" && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          {activeTabPathRight &&
          openTabs.find((t) => t.path === activeTabPathRight) ? (
            <Editor
              height="100%"
              theme="vs-dark"
              path={`right-${activeTabPathRight}`}
              value={
                openTabs.find((t) => t.path === activeTabPathRight)
                  ?.content || ""
              }
              onChange={(val) => handleEditorChangeRight(val || "")}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-[11px] text-amber-600/60 bg-amber-50/5">
              Right panel empty. Focus and click a file to open.
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
