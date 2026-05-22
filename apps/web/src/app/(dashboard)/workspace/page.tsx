"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Toaster } from "sonner";
import { FileExplorer } from "@/components/workspace/FileExplorer";
import { EditorPanel } from "@/components/workspace/EditorPanel";
import { TerminalPanel } from "@/components/workspace/TerminalPanel";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { StatusBar } from "@/components/workspace/StatusBar";
import { ExecutionGraph } from "@/components/workspace/ExecutionGraph";
import { QuickSearchDialog } from "@/components/workspace/QuickSearchDialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace/workspace-context";

export default function WorkspacePage() {
  const chat = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  return (
    <WorkspaceProvider useChatHook={() => chat}>
      <WorkspacePageInner />
    </WorkspaceProvider>
  );
}

function WorkspacePageInner() {
  const { sidebarOpen, terminalOpen, searchOpen } = useWorkspace();

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel: Explorer */}
          {sidebarOpen && (
            <>
              <ResizablePanel defaultSize={18} minSize={12} maxSize={30} className="!overflow-visible">
                <FileExplorer />
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="w-[3px] bg-transparent hover:bg-[--accent-primary]/20 transition-colors data-[resize-handle-active]:bg-[--accent-primary]/30"
              />
            </>
          )}

          {/* Center: Editor (top) + Terminal (bottom) */}
          <ResizablePanel defaultSize={55} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              <EditorPanel />
              {terminalOpen && (
                <>
                  <ResizableHandle
                    withHandle
                    className="h-[3px] bg-transparent hover:bg-[--accent-primary]/20 transition-colors data-[resize-handle-active]:bg-[--accent-primary]/30"
                  />
                  <TerminalPanel />
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle
            withHandle
            className="w-[3px] bg-transparent hover:bg-[--accent-primary]/20 transition-colors data-[resize-handle-active]:bg-[--accent-primary]/30"
          />

          {/* Right Panel: AI Chat */}
          <ResizablePanel defaultSize={27} minSize={16} maxSize={45}>
            <ChatPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Execution Graph (collapsible agent timeline) */}
      <ExecutionGraph />

      {/* Bottom Status Bar */}
      <StatusBar />

      <Toaster position="bottom-right" />

      {searchOpen && <QuickSearchDialog />}
    </div>
  );
}
