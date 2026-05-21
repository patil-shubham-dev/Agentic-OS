"use client";

import dynamic from "next/dynamic";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { 
  Save, Layers, FileText, X, Code2, CheckCircle2, ChevronRight,
  FileCode, FileJson, FileImage, Globe, Terminal 
} from "lucide-react";
import { Skeleton } from "@/components/skeleton-loader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sendJson } from "@/lib/client-api";
import { useWorkspace } from "./workspace-context";
import { useCallback, useState } from "react";

const Editor = dynamic(() => import("./MonacoEditor").then((m) => ({ default: m.LazyEditor })), { ssr: false });
const DiffEditor = dynamic(() => import("./MonacoDiffEditor").then((m) => ({ default: m.LazyDiffEditor })), { ssr: false });

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return <FileCode className="w-3.5 h-3.5 text-yellow-500/90" />;
    case 'ts':
    case 'tsx':
      return <FileCode className="w-3.5 h-3.5 text-sky-400/90" />;
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-amber-500/90" />;
    case 'html':
      return <Globe className="w-3.5 h-3.5 text-orange-500/90" />;
    case 'css':
    case 'scss':
    case 'less':
      return <FileCode className="w-3.5 h-3.5 text-purple-400/90" />;
    case 'md':
      return <FileText className="w-3.5 h-3.5 text-emerald-400/90" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <FileImage className="w-3.5 h-3.5 text-teal-400/90" />;
    case 'sh':
    case 'bash':
    case 'bat':
    case 'cmd':
      return <Terminal className="w-3.5 h-3.5 text-stone-400/90" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-zinc-400/90" />;
  }
};

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
    setCursorPosition,
  } = useWorkspace();

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  // Wire Monaco cursor position changes to the status bar
  const handleEditorMount = useCallback(
    (editor: any) => {
      editor.onDidChangeCursorPosition((e: any) => {
        setCursorPosition({ line: e.position.lineNumber, column: e.position.column });
      });
    },
    [setCursorPosition]
  );

  // Breadcrumb helper
  const renderBreadcrumb = useCallback((path: string) => {
    const segments = path.split(/[/\\]/).filter(Boolean);
    return (
      <div className="flex items-center px-4 py-1.5 border-b border-zinc-800/40 bg-[#1e1e1e]/20 text-[11px] text-zinc-400 font-medium select-none overflow-x-auto whitespace-nowrap">
        {segments.map((segment, idx, arr) => (
          <div key={idx} className="flex items-center flex-shrink-0">
            <span className={idx === arr.length - 1 ? "text-zinc-200 font-bold" : ""}>
              {segment}
            </span>
            {idx < arr.length - 1 && (
              <ChevronRight className="w-3 h-3 mx-1 text-zinc-600 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    );
  }, []);

  return (
    <ResizablePanel defaultSize={60} minSize={20}>
      <div className="h-full flex flex-col bg-[#141416] border-b border-zinc-800">
        {/* Tabs bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-[#18181c] px-2 h-9 select-none">
          <div className="flex items-center gap-px h-full overflow-x-auto scrollbar-none max-w-[80%]">
            {openTabs.map((t) => {
              const isActive = activeTabPath === t.path;
              return (
                <div
                  key={t.path}
                  onClick={() => setActiveTabPath(t.path)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-full cursor-pointer border-t-2 border-r border-r-zinc-800/30 transition-colors text-xs",
                    isActive
                      ? "bg-[#1e1e1e] text-zinc-100 border-t-amber-500/90 font-medium"
                      : "bg-[#18181c]/70 text-zinc-400 border-t-transparent hover:bg-zinc-800/30 hover:text-zinc-200"
                  )}
                >
                  {getFileIcon(t.name)}
                  <span className="truncate max-w-[100px]">{t.name}</span>
                  {t.dirty && !t.isDiff && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse ml-0.5" />
                  )}
                  <button
                    onClick={(e) => handleCloseTab(t.path, e)}
                    className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors ml-1"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
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
                "h-6.5 text-[10px] border-zinc-800 px-2.5 flex items-center gap-1.5 rounded bg-[#1e1e1e] hover:bg-zinc-800",
                splitActive
                  ? "bg-zinc-800 text-white border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              {splitActive ? "Single" : "Split"}
            </Button>
            {activeTab && !activeTab.isDiff && (
              <Button
                size="sm"
                onClick={handleSaveFile}
                className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 text-[10px] rounded px-2.5 h-6.5"
              >
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
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
                <div className="flex-1 h-full" onClick={() => setFocusedPane("left")}>
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    path={activeTab.path}
                    value={activeTab.content}
                    onChange={(val) => handleEditorChange(val || "")}
                    onMount={handleEditorMount}
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      padding: { top: 12 },
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
    <div className="flex-1 flex flex-col relative group h-full">
      {/* Green flash overlay */}
      {flashGreen && (
        <div className="absolute inset-0 z-20 bg-emerald-500/20 animate-flash-green pointer-events-none" />
      )}

      <div className="absolute top-2 right-6 z-10 flex gap-2">
        <Button
          size="sm"
          className="bg-red-650 hover:bg-red-750 text-white h-7 shadow text-xs rounded"
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
          className="bg-emerald-650 hover:bg-emerald-750 text-white h-7 shadow text-xs rounded"
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
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Accept
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
    <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-zinc-500 bg-[#141416] relative overflow-hidden select-none">
      {/* Background skeleton grid */}
      <div className="absolute inset-0 p-6 space-y-4 opacity-10 pointer-events-none">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <Skeleton className="h-3 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-3 w-5/6 rounded" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Keyboard Shortcuts Layout */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/40 border border-zinc-700/20 flex items-center justify-center mb-4">
          <Code2 className="w-6 h-6 text-zinc-400" />
        </div>
        <h4 className="font-bold text-zinc-200 text-sm tracking-wide">AgentOS Code Canvas</h4>
        <p className="max-w-xs mt-1 text-zinc-500 text-[11px] leading-relaxed mb-6">
          Open a file from the explorer or try one of the following operations:
        </p>
        
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 max-w-[280px] text-zinc-400 text-[11px]">
          <div className="flex items-center justify-between gap-4 py-0.5 border-b border-zinc-800/50">
            <span>Quick Open</span>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono text-[9px] border border-zinc-700">Ctrl P</kbd>
          </div>
          <div className="flex items-center justify-between gap-4 py-0.5 border-b border-zinc-800/50">
            <span>AI Composer</span>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono text-[9px] border border-zinc-700">Ctrl K</kbd>
          </div>
          <div className="flex items-center justify-between gap-4 py-0.5 border-b border-zinc-800/50">
            <span>Toggle Sidebar</span>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono text-[9px] border border-zinc-700">Ctrl B</kbd>
          </div>
          <div className="flex items-center justify-between gap-4 py-0.5 border-b border-zinc-800/50">
            <span>Toggle Terminal</span>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono text-[9px] border border-zinc-700">Ctrl J</kbd>
          </div>
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
            "h-full flex flex-col border-r border-zinc-800 relative transition-all",
            focusedPane === "left" && "border-r-2 border-r-amber-500/60"
          )}
          onClick={() => setFocusedPane("left")}
        >
          <div className="flex items-center justify-between px-3 h-7 bg-[#18181c] border-b border-zinc-800 text-[10px] font-bold text-zinc-400 select-none flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-650 border border-zinc-500" />
              L-PANE {activeTabPath ? `(${activeTabPath.split(/[/\\]/).pop()})` : "(Empty)"}
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
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-[11px] text-zinc-500 bg-[#141416]">
              Left panel empty. Click a file.
            </div>
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle className="bg-zinc-800 hover:bg-amber-500/40" />

      <ResizablePanel defaultSize={50} minSize={20}>
        <div
          className={cn(
            "h-full flex flex-col relative transition-all",
            focusedPane === "right" && "border-l-2 border-l-amber-500/60"
          )}
          onClick={() => setFocusedPane("right")}
        >
          <div className="flex items-center justify-between px-3 h-7 bg-[#18181c] border-b border-zinc-800 text-[10px] font-bold text-zinc-400 select-none flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-650 border border-zinc-500" />
              R-PANE {activeTabPathRight ? `(${activeTabPathRight.split(/[/\\]/).pop()})` : "(Empty)"}
            </span>
            {focusedPane === "right" && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
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
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-[11px] text-zinc-500 bg-[#141416]">
              Right panel empty. Focus and click a file to open.
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
