"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Send,
  Square,
  Sparkles,
  Cpu,
  ImageIcon,
  Paperclip,
  X,
  Loader2,
  BookOpen,
  FileText,
  CheckCircle,
  Check,
  ChevronRight,
  Plus,
  Trash2,
  History,
  MessageSquare,
  HelpCircle,
  FileCode,
  Layers,
  AlertCircle,
  RefreshCw,
  Zap,
  Code2,
} from "lucide-react";
import { ListSkeleton } from "@/components/skeleton-loader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sendJson } from "@/lib/client-api";
import { useWorkspace } from "./workspace-context";
import { MessageCard } from "./MessageCard";
import { FileDiffCard } from "./FileDiffCard";
import { AgentActivityBar } from "./AgentActivityBar";

const LazyMarkdown = dynamic(
  () => import("./MarkdownRenderer").then((m) => ({ default: m.MarkdownInner })),
  { ssr: false }
);

function getMessageText(message: any): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text || "")
      .join("\n");
  }
  // Handle AI SDK v6 tool-invocation parts
  if (message.toolInvocations) {
    return "";
  }
  return "";
}

export function ChatPanel() {
  const {
    messages,
    sendMessage,
    status,
    stop,
    chatInput,
    setChatInput,
    isLoading,
    attachments,
    setAttachments,
    contextPaths,
    handleToggleContext,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    handleRemoveAttachment,
    isDraggingFile,
    fileInputRef,
    bridgeStatus,
    dbConnected,
    orchestrateMode,
    setOrchestrateMode,
    orchestrating,
    orchestrationEvents,
    handleOrchestrateSubmit,
    handleStopOrchestration,
    approvingToolId,
    handleApproveTool,
    handleDenyTool,
    dirContents,
  } = useWorkspace();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [streamErrorMsg, setStreamErrorMsg] = useState<string | null>(null);

  // Composer Mode
  const [composerMode, setComposerMode] = useState<"ask" | "agent" | "edit" | "architect">("ask");
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const [atFilter, setAtFilter] = useState("");

  useEffect(() => {
    if (composerMode === "agent") setOrchestrateMode(true);
    else setOrchestrateMode(false);
  }, [composerMode, setOrchestrateMode]);

  // Streaming timeout
  useEffect(() => {
    if (status === "submitted") {
      streamTimeoutRef.current = setTimeout(() => {
        setStreamErrorMsg("Request timed out after 60 seconds. The provider may be unavailable.");
        stop();
      }, 60_000);
    } else {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
        streamTimeoutRef.current = null;
      }
      if (status === "streaming" || status === "ready") setStreamErrorMsg(null);
    }
    return () => {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
        streamTimeoutRef.current = null;
      }
    };
  }, [status, stop]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getAllFiles = useCallback(() => {
    const list: { name: string; path: string }[] = [];
    Object.values(dirContents).forEach((files) => {
      files.forEach((file) => {
        if (!file.isDir) list.push({ name: file.name, path: file.path });
      });
    });
    const seen = new Set<string>();
    return list.filter((item) => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });
  }, [dirContents]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setChatInput(value);
    const atIndex = value.lastIndexOf("@");
    if (atIndex !== -1 && atIndex >= value.length - 15) {
      const query = value.slice(atIndex + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setAtMenuOpen(true);
        setAtFilter(query.toLowerCase());
        return;
      }
    }
    setAtMenuOpen(false);
  };

  const handleSelectAtFile = (filePath: string) => {
    const syntheticEvent = { stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent;
    handleToggleContext(filePath, syntheticEvent);
    const atIndex = chatInput.lastIndexOf("@");
    if (atIndex !== -1) setChatInput(chatInput.slice(0, atIndex));
    setAtMenuOpen(false);
    textareaRef.current?.focus();
  };

  const renderMessageContent = useCallback((message: any) => {
    const content = message.content;
    if (content === undefined || content === null) {
      // Show loading indicator for streaming messages with no content yet
      if (message.role === "assistant") {
        return (
          <div className="flex items-center gap-2 text-[--text-muted]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs">Thinking...</span>
          </div>
        );
      }
      return null;
    }
    if (typeof content === "string") {
      if (!content.trim()) {
        // Show loading indicator for streaming messages with empty content
        if (message.role === "assistant") {
          return (
            <div className="flex items-center gap-2 text-[--text-muted]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          );
        }
        return null;
      }
      return <LazyMarkdown content={content} />;
    }
    if (Array.isArray(content)) {
      const textParts = content.filter((p: any) => p.type === "text" && p.text?.trim());
      if (textParts.length === 0) {
        if (message.role === "assistant") {
          return (
            <div className="flex items-center gap-2 text-[--text-muted]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          );
        }
        return null;
      }
      return textParts.map((p: any, idx: number) => (
        <LazyMarkdown key={idx} content={p.text} />
      ));
    }
    return <LazyMarkdown content={String(content)} />;
  }, []);

  const handleSend = () => {
    const text = chatInput;
    if (!text.trim() && attachments.length === 0) return;
    setChatInput("");
    if (orchestrateMode) {
      handleOrchestrateSubmit(text);
    } else {
      sendMessage({ text });
    }
  };

  const composerModes = [
    { key: "ask" as const, icon: HelpCircle, label: "Ask", shortcut: "⌘+1" },
    { key: "edit" as const, icon: Code2, label: "Edit", shortcut: "⌘+2" },
    { key: "agent" as const, icon: Zap, label: "Agent", shortcut: "⌘+3" },
    { key: "architect" as const, icon: Layers, label: "Arch", shortcut: "⌘+4" },
  ];

  const allFiles = getAllFiles();
  const filteredAtFiles = allFiles.filter((f) => f.name.toLowerCase().includes(atFilter)).slice(0, 5);

  return (
    <div
      className="h-full flex flex-col border-l border-[--border-primary] bg-[--bg-primary] relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDraggingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[--accent-primary]/80 backdrop-blur-sm text-[--bg-primary] p-6 text-center select-none"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-16 h-16 rounded-full bg-[--bg-primary]/20 flex items-center justify-center mb-4"
            >
              <ImageIcon className="w-8 h-8" />
            </motion.div>
            <h3 className="text-base font-bold">Drop Image to Attach</h3>
            <p className="text-xs text-[--bg-primary]/80 max-w-[220px] mt-1 leading-relaxed">
              Attach image reference for Vision routing.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat History Bar */}
      <ChatHistoryBar />

      {/* Messages area */}
      <ScrollArea className="flex-1 bg-[--bg-primary]">
        <div className="pb-4">
          {messages.length === 0 && !orchestrating && (
            <div className="flex flex-col items-center justify-center text-center p-6 pt-16">
              <div className="w-12 h-12 rounded-2xl bg-[--bg-tertiary] flex items-center justify-center mb-4 border border-[--border-primary]">
                <Sparkles className="w-6 h-6 text-[--accent-primary] animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-[--text-primary] tracking-wide">
                AgentOS Composer
              </h3>
              <p className="text-xs text-[--text-muted] max-w-[220px] mt-2 leading-relaxed">
                {composerMode === "ask" && "Ask code architecture questions, inspect definitions, and learn concepts."}
                {composerMode === "edit" && "Make direct targeted editing modifications to your file system."}
                {composerMode === "agent" && "Run autonomous agentic loops to build features, fix bugs, and execute tasks."}
                {composerMode === "architect" && "Design full system modules, structural data models, and database flows."}
              </p>
              <p className="text-[10px] text-[--text-disabled] mt-4 max-w-[200px] border border-[--border-primary] rounded-lg p-1.5 font-mono">
                Type <span className="text-[--accent-primary] font-bold">@</span> to attach files
              </p>
            </div>
          )}

          {messages.map((message) => {
            const messageContent = getMessageText(message);
            const parts = message.parts?.filter(
              (p: any) => p.type === "tool-invocation" || p.type === "dynamic-tool" || p.type.startsWith("tool-")
            );
            const isLastAssistant =
              message.role === "assistant" &&
              messages.indexOf(message) === messages.length - 1 &&
              (status === "streaming" || status === "submitted");

            return (
              <MessageCard
                key={message.id}
                id={message.id}
                role={message.role === "user" ? "user" : "Manager"}
                content={messageContent}
                parts={parts}
                createdAt={message.createdAt}
                isStreaming={isLastAssistant && status === "streaming"}
                renderMessageContent={renderMessageContent}
                renderToolInvocation={(part: any) => (
                  <ToolInvocationCard key={part.toolCallId} part={part} />
                )}
              />
            );
          })}

          {/* Thinking indicator */}
          {(status === "submitted" || status === "streaming") &&
            (messages.length === 0 ||
              messages[messages.length - 1]?.role === "user" ||
              (messages[messages.length - 1]?.role === "assistant" &&
                !messages[messages.length - 1]?.content?.trim?.() &&
                !messages[messages.length - 1]?.parts?.some?.((p: any) => p.type === "text" && p.text?.trim()))
            ) && (
              <div className="px-4 py-3.5 border-b border-[--border-primary] bg-[--bg-secondary]/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[--accent-primary] animate-pulse shadow-[0_0_8px_var(--glow-primary)]" />
                  <span className="text-[10px] font-bold text-[--text-muted]">
                    <Loader2 className="w-3 h-3 animate-spin inline mr-1 text-[--accent-primary]" />
                    Thinking...
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[--text-muted] animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-[--accent-primary]/40" />
                  <span className="w-2 h-2 rounded-full bg-[--accent-primary]/60" />
                  <span className="w-2 h-2 rounded-full bg-[--accent-primary]/80" />
                  <span className="ml-1">Generating response…</span>
                </div>
              </div>
            )}

          {/* Error state */}
          {(status === "error" || streamErrorMsg) && (
            <div className="px-4 py-3 border-b border-rose-500/20 bg-rose-950/10">
              <div className="flex items-start gap-2 text-[11px] text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{streamErrorMsg || "Failed to generate response. Check provider configuration in Settings."}</span>
                  {streamErrorMsg && (
                    <button
                      onClick={() => setStreamErrorMsg(null)}
                      className="ml-2 text-[--text-muted] hover:text-[--text-secondary]"
                    >
                      <X className="w-3 h-3 inline" />
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setStreamErrorMsg(null);
                  const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
                  if (lastUserMsg) {
                    const text = getMessageText(lastUserMsg);
                    if (text.trim()) sendMessage({ text });
                  }
                }}
                className="mt-2 text-[10px] px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-colors"
              >
                <RefreshCw className="w-3 h-3 inline mr-1" />
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* @ autocomplete */}
      {atMenuOpen && filteredAtFiles.length > 0 && (
        <div className="absolute left-3 right-3 bottom-[115px] z-50 agentos-glass-elevated rounded-lg overflow-hidden p-1">
          <div className="text-[9px] font-bold text-[--text-muted] px-2 py-1 uppercase tracking-wider border-b border-[--border-primary]">
            Files in workspace:
          </div>
          {filteredAtFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => handleSelectAtFile(file.path)}
              className="w-full text-left px-2 py-1.5 text-xs text-[--text-secondary] hover:bg-[--bg-tertiary] hover:text-[--text-primary] rounded transition-colors flex items-center gap-2 truncate"
            >
              <FileText className="w-3.5 h-3.5 text-[--text-muted] flex-shrink-0" />
              <span className="truncate flex-1 font-mono text-[11px]">{file.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Context file chips */}
      {contextPaths.size > 0 && (
        <div className="px-3 py-2 border-t border-[--border-primary] bg-[--bg-secondary]/40 flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
          <span className="text-[9px] font-bold text-[--text-muted] flex items-center gap-1 uppercase tracking-wider w-full mb-0.5">
            <BookOpen className="w-3 h-3 text-[--accent-primary]" />
            Context ({contextPaths.size}):
          </span>
          {(() => {
            const paths = Array.from(contextPaths);
            const visible = paths.slice(0, 4);
            const overflow = paths.length - 4;
            return (
              <>
                {visible.map((p) => {
                  const name = p.split(/[/\\]/).pop() || "";
                  return (
                    <Badge
                      key={p}
                      className="bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary] hover:bg-[--bg-elevated] flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg"
                    >
                      <FileText className="w-2.5 h-2.5 text-[--text-muted]" />
                      <span className="max-w-[120px] truncate">{name}</span>
                      <button
                        onClick={(e) => handleToggleContext(p, e)}
                        className="hover:bg-[--bg-elevated] rounded p-0.5 ml-1 transition-colors"
                      >
                        <X className="w-2 h-2 text-[--text-muted] hover:text-[--text-primary]" />
                      </button>
                    </Badge>
                  );
                })}
                {overflow > 0 && (
                  <Badge className="bg-[--bg-tertiary] text-[--text-disabled] border-[--border-primary] text-[10px] px-2 py-0.5 rounded-lg">
                    +{overflow} more
                  </Badge>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Image attachments */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 border-t border-[--border-primary] bg-[--bg-secondary]/30 flex flex-col gap-1">
          <span className="text-[9px] font-bold text-[--text-muted] uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-3 h-3 text-[--accent-primary]" /> Vision ({attachments.length}):
          </span>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="relative w-14 h-14 rounded-lg border border-[--border-primary] overflow-hidden flex-shrink-0 shadow-sm bg-[--bg-tertiary] group"
              >
                <img src={a.base64} alt={a.name} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemoveAttachment(a.id)}
                  className="absolute top-0.5 right-0.5 bg-[--bg-elevated]/90 hover:bg-rose-600 text-white rounded-full p-0.5 shadow transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        type="file"
        multiple
        accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Agent Activity */}
      <AgentActivityBar
        events={orchestrationEvents}
        active={orchestrating}
        onStop={handleStopOrchestration}
      />

      {/* Composer Input — Cursor-style sticky bottom */}
      <div className="border-t border-[--border-primary] bg-[--bg-secondary]/80">
        {/* Mode selector */}
        <div className="flex items-center gap-0.5 px-3 pt-2 pb-1">
          {composerModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = composerMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => setComposerMode(mode.key)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all",
                  isActive
                    ? "bg-[--accent-primary]/15 text-[--accent-primary] shadow-sm"
                    : "text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-glass]"
                )}
              >
                <Icon className="w-3 h-3" />
                {mode.label}
              </button>
            );
          })}
          <div className="flex-1" />
          {isLoading && (
            <button
              onClick={() => stop()}
              className="flex items-center gap-1 px-2 py-0.5 text-[9px] text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
            >
              <Square className="w-2.5 h-2.5 fill-rose-400" />
              Stop
            </button>
          )}
        </div>

        {/* Sticky composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="px-3 pb-3"
        >
          <div className="relative flex flex-col gap-0.5">
            <div className="relative flex items-end gap-1.5 bg-[--bg-primary] border border-[--border-primary] rounded-xl px-3 py-2 focus-within:border-[--accent-primary]/40 focus-within:shadow-[0_0_0_1px_var(--accent-primary)/20] transition-all">
              <textarea
                ref={textareaRef}
                value={chatInput}
                onChange={handleTextareaChange}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  composerMode === "ask" ? "Ask a question... (@ for files)" :
                  composerMode === "edit" ? "Describe the edit... (@ for files)" :
                  composerMode === "agent" ? "Describe the goal... (@ for files)" :
                  "Design architecture... (@ for files)"
                }
                className="flex-1 bg-transparent border-none outline-none resize-none text-[13px] text-[--text-primary] placeholder:text-[--text-disabled] leading-relaxed min-h-[22px] max-h-[120px] scrollbar-none"
                rows={1}
                disabled={isLoading || orchestrating}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
              />
              <div className="flex items-center gap-1 shrink-0 pb-0.5">
                <TooltipProvider delayDuration={600}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || orchestrating}
                        className="h-6 w-6 flex items-center justify-center rounded-md text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-glass] transition-colors disabled:opacity-30"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[--bg-elevated] border border-[--border-primary] text-[--text-primary] text-[9px] rounded-lg px-2 py-1">
                      Attach image
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <button
                  type="submit"
                  disabled={(!chatInput.trim() && attachments.length === 0) || isLoading || orchestrating}
                  className={cn(
                    "h-6 w-6 flex items-center justify-center rounded-md transition-all",
                    (chatInput.trim() || attachments.length > 0) && !isLoading && !orchestrating
                      ? "bg-[--accent-primary] text-[--bg-primary] hover:bg-[--accent-hover] shadow-sm shadow-[--glow-primary]/20"
                      : "bg-[--bg-tertiary] text-[--text-disabled]"
                  )}
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className="text-[9px] text-[--text-disabled]">
                {composerMode === "ask" ? "Ask" : composerMode === "edit" ? "Edit" : composerMode === "agent" ? "Agent" : "Architect"}
                {composerMode === "agent" && (
                  <span className="text-[--accent-primary] ml-1">· multi-agent orchestration</span>
                )}
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Chat History Bar
// ============================================================
function ChatHistoryBar() {
  const {
    chats,
    currentChatId,
    chatHistoryLoading,
    loadChats,
    createNewChat,
    deleteChat,
    selectChat,
    messages,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentChat = chats.find((c: any) => c.id === currentChatId);
  const chatTitle = currentChat?.title || "Active Conversation";

  const handleNewChat = async () => {
    setOpen(false);
    await createNewChat();
  };

  const handleSelectChat = async (id: string) => {
    setOpen(false);
    await selectChat(id);
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    await deleteChat(id);
  };

  const handleSaveCurrentAsChat = async () => {
    if (messages.length === 0) return;
    setOpen(false);
    try {
      const firstMsg = messages.find((m: any) => m.role === "user");
      const title = firstMsg ? (firstMsg.content || "").slice(0, 60).replace(/\n/g, " ") : "New Chat";
      const data = await sendJson<{ chat: any }>("/api/chats", "POST", { title, model: "default" });
      const newChat = data.chat;
      await sendJson(`/api/chats/${newChat.id}`, "PATCH", { messages });
      await loadChats();
      await selectChat(newChat.id);
      toast.success("Chat saved");
    } catch {
      toast.error("Failed to save chat");
    }
  };

  return (
    <div ref={dropdownRef} className="relative border-b border-[--border-primary] shrink-0">
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-[--bg-secondary] hover:bg-[--bg-tertiary] cursor-pointer transition-colors select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <History className="w-3 h-3 text-[--accent-primary] shrink-0" />
          <span className="text-[11px] font-bold text-[--text-secondary] truncate max-w-[180px]">
            {chatTitle}
          </span>
          <ChevronRight className={cn("w-3 h-3 text-[--text-disabled] shrink-0 transition-transform", open && "rotate-90")} />
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-[--text-muted] hover:text-[--text-secondary] hover:bg-[--bg-tertiary] rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="absolute left-0 right-0 z-40 agentos-glass-elevated rounded-b overflow-hidden"
            style={{ top: "100%" }}
          >
            <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5">
              {!currentChatId && messages.length > 0 && (
                <button
                  onClick={handleSaveCurrentAsChat}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-[--text-secondary] hover:bg-[--bg-tertiary] rounded transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium">Save current conversation</span>
                </button>
              )}

              {chatHistoryLoading ? (
                <div className="p-2">
                  <ListSkeleton count={3} />
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-[--text-disabled]">
                  <MessageSquare className="w-5 h-5 mx-auto mb-2 text-[--text-muted]" />
                  <p>No saved chats yet.</p>
                  <p className="text-[10px] text-[--text-disabled] mt-0.5">Your conversations will auto-save here.</p>
                </div>
              ) : (
                chats.map((chat: any) => {
                  const isActive = chat.id === currentChatId;
                  const updatedAt = chat.updated_at
                    ? new Date(chat.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "";
                  const msgCount = (chat.messages || []).length;
                  return (
                    <div
                      key={chat.id}
                      className={cn(
                        "group flex items-center justify-between px-3 py-1.5 rounded cursor-pointer transition-colors",
                        isActive ? "bg-[--bg-tertiary] text-[--text-primary]" : "hover:bg-[--bg-tertiary]/60 text-[--text-muted] hover:text-[--text-secondary]"
                      )}
                      onClick={() => handleSelectChat(chat.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className="w-3.5 h-3.5 text-[--text-disabled] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium truncate max-w-[160px]">{chat.title || "Untitled"}</div>
                          <div className="text-[9px] text-[--text-disabled]">{updatedAt}{msgCount > 0 && ` · ${msgCount} msgs`}</div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[--bg-elevated] rounded transition-all ml-1 shrink-0"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tool Invocation Card
function ToolInvocationCard({ part }: { part: any }) {
  const {
    approvingToolId,
    handleApproveTool,
    handleDenyTool,
    setOpenTabs,
    setActiveTabPath,
    setEditorOpen,
  } = useWorkspace();

  const toolCallId = part.toolCallId;
  const toolName = part.toolName || part.type;
  const state = part.state;
  const args = (part.input || part.args) as any;

  if (toolName === "suggestEdit" && args?.path) {
    return (
      <FileDiffCard
        filePath={args.path}
        originalContent={args.originalContent}
        newContent={args.newContent}
        toolCallId={toolCallId}
        toolName={toolName}
        state={state}
        approving={approvingToolId === toolCallId}
        onApprove={handleApproveTool}
        onDeny={handleDenyTool}
        onReviewDiff={() => {
          setOpenTabs((prev) => [
            ...prev.filter((t) => t.path !== args.path),
            {
              path: args.path,
              name: args.path.split(/[/\\]/).pop() || "Edit",
              content: args.newContent,
              originalContent: args.originalContent,
              dirty: true,
              isDiff: true,
              toolCallId,
            },
          ]);
          setActiveTabPath(args.path);
          setEditorOpen(true);
        }}
      />
    );
  }

  const hasResult = state === "result" || state === "output-available" || state === "output-error";

  return (
    <div className="flex flex-col gap-1.5 p-2.5 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg text-[10px] font-mono text-[--text-muted]">
      <div className="flex items-center gap-2">
        {hasResult ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-[--accent-primary] animate-spin shrink-0" />
        )}
        <span className="font-bold text-[--text-secondary]">{toolName}</span>
        <span className="opacity-70 truncate max-w-[150px]">{JSON.stringify(args)}</span>
      </div>

      {!hasResult && (
        <div className="flex gap-2 mt-1">
          <Button
            size="sm"
            className="flex-1 bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] text-[9px] h-6 flex items-center justify-center gap-1 rounded-lg transition-colors"
            disabled={approvingToolId === toolCallId}
            onClick={() => handleApproveTool(toolCallId, toolName, args)}
          >
            {approvingToolId === toolCallId ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-[--border-primary] bg-[--bg-elevated] hover:bg-[--bg-tertiary] text-[--text-secondary] text-[9px] h-6 flex items-center justify-center gap-1 rounded-lg transition-colors"
            disabled={approvingToolId === toolCallId}
            onClick={() => handleDenyTool(toolCallId)}
          >
            <X className="w-3 h-3" />
            Deny
          </Button>
        </div>
      )}
    </div>
  );
}
