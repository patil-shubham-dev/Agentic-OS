"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Toaster } from "sonner";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { FileExplorer } from "@/components/workspace/FileExplorer";
import { EditorPanel } from "@/components/workspace/EditorPanel";
import { TerminalPanel } from "@/components/workspace/TerminalPanel";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { StatusBar } from "@/components/workspace/StatusBar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

/**
 * WorkspacePage — thin shell that wires up the useChat hook
 * and delegates all panel rendering to modular subcomponents.
 */
export default function WorkspacePage() {
  // AI SDK v6 useChat — transport with api endpoint
  const chat = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  return (
    <WorkspaceProvider useChatHook={() => chat}>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-amber-50/10 overflow-hidden font-sans">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Sidebar: File Explorer */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={28} className="min-w-[220px]">
            <FileExplorer />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Center: Editor (top) + Terminal (bottom) */}
          <ResizablePanel defaultSize={52} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              <EditorPanel />
              <ResizableHandle withHandle />
              <TerminalPanel />
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: AI Chat */}
          <ResizablePanel defaultSize={30} minSize={18} maxSize={40} className="min-w-[260px]">
            <ChatPanel />
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Bottom Status Bar */}
        <StatusBar />

        <Toaster position="bottom-right" />
      </div>
    </WorkspaceProvider>
  );
}
