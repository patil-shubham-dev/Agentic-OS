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

/**
 * WorkspacePage — clean page shell that consumes the global
 * workspace context and sets up the native desktop IDE panel layout.
 */
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
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Sidebar: File Explorer */}
        {sidebarOpen && (
          <>
            <ResizablePanel defaultSize={18} minSize={12} maxSize={28} className="min-w-[220px]">
              <FileExplorer />
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* Center: Editor (top) + Terminal (bottom) */}
        <ResizablePanel defaultSize={52} minSize={30}>
          <ResizablePanelGroup direction="vertical">
            <EditorPanel />
            {terminalOpen && (
              <>
                <ResizableHandle withHandle />
                <TerminalPanel />
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel: AI Chat */}
        <ResizablePanel defaultSize={30} minSize={18} maxSize={40} className="min-w-[260px]">
          <ChatPanel />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Execution Graph (collapsible, shows live agent execution) */}
      <ExecutionGraph />

      {/* Bottom Status Bar */}
      <StatusBar />

      <Toaster position="bottom-right" />

      {searchOpen && <QuickSearchDialog />}
    </div>
  );
}
