"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Bot,
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
  AlertCircle,
  ChevronRight,
  Plus,
  Trash2,
  History,
  MessageSquare,
} from "lucide-react";
import { ListSkeleton } from "@/components/skeleton-loader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sendJson } from "@/lib/client-api";
import { useWorkspace } from "./workspace-context";

const LazyMarkdown = dynamic(
  () => import("./MarkdownRenderer").then((m) => ({ default: m.MarkdownInner })),
  { ssr: false }
);

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
    addToolResult,
    setOpenTabs,
    setActiveTabPath,
    setEditorOpen,
  } = useWorkspace();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Render message content handling AI SDK v6 format (string, array, or empty) */
  const renderMessageContent = useCallback((message: any) => {
    const content = message.content;
    // AI SDK v6: content can be undefined, null, empty string, string, or array of content parts
    if (content === undefined || content === null) return null;
    if (typeof content === "string") {
      if (!content.trim()) return null;
      return <LazyMarkdown content={content} />;
    }
    // Array format: [{ type: "text", text: "..." }, { type: "image", ... }]
    if (Array.isArray(content)) {
      const textParts = content.filter((p: any) => p.type === "text" && p.text?.trim());
      if (textParts.length === 0) return null;
      return textParts.map((p: any, idx: number) => (
        <LazyMarkdown key={idx} content={p.text} />
      ));
    }
    // Fallback: try to render as string
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

  return (
    <div
      className="h-full flex flex-col border-l border-amber-200/60 bg-white relative"
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
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-amber-500/80 backdrop-blur-sm text-white p-6 text-center select-none"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4"
            >
              <ImageIcon className="w-8 h-8 text-white" />
            </motion.div>
            <h3 className="text-base font-bold">Drop Image to Attach</h3>
            <p className="text-xs text-white/95 max-w-[220px] mt-1 leading-relaxed">
              Release to attach reference context for the Vision multimodal model.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat History Bar */}
      <ChatHistoryBar />

      {/* Header */}
      <div className="p-3 border-b border-amber-200/60 bg-amber-50/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {orchestrateMode ? (
            <Cpu className="w-4 h-4 text-purple-600 animate-pulse" />
          ) : (
            <Bot className="w-4 h-4 text-amber-700 animate-pulse" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold text-amber-950">
              {orchestrateMode
                ? "Orchestrator"
                : bridgeStatus?.activeRole || "AgentOS"}
            </span>
            <span className="text-[9px] text-amber-600/60">
              {orchestrateMode
                ? "Multi-agent mode"
                : `Role: ${bridgeStatus?.activeRole || "Coding"}`}
            </span>
          </div>
          {dbConnected === false && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-none text-[10px] max-w-[200px]">
                  Database offline — role routing & security will use defaults.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-6 text-[9px] border rounded-lg px-2",
                    orchestrateMode
                      ? "bg-purple-100 border-purple-300 text-purple-700"
                      : "border-amber-200 text-amber-700 hover:bg-amber-50"
                  )}
                  onClick={() => setOrchestrateMode(!orchestrateMode)}
                >
                  <Cpu className="w-3 h-3 mr-1" />
                  {orchestrateMode ? "Single" : "Orchestrate"}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">
                {orchestrateMode
                  ? "Switch to single-agent chat"
                  : "Enable multi-agent orchestration"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isLoading && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => stop()}
              className="h-5 px-1.5 text-[9px] text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 rounded"
            >
              <Square className="w-2.5 h-2.5 mr-1" /> Stop
            </Button>
          )}
          <Badge
            variant="outline"
            className="text-[9px] border-amber-300/40 bg-amber-100 text-amber-800 font-medium"
          >
            {orchestrateMode
              ? "Multi-Agent"
              : bridgeStatus?.activeRole || "Coding"}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-white">
        <div className="pb-4">
          {messages.length === 0 && !orchestrating && (
            <div className="flex flex-col items-center justify-center text-center p-6 pt-12">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center mb-3 shadow">
                <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
              </div>
              <h3 className="text-sm font-bold text-amber-950">
                AgentOS Assistant
              </h3>
              <p className="text-xs text-amber-600/70 max-w-[200px] mt-1 leading-relaxed">
                Ask your active role model to make directory edits or index
                search paths. Drag or paste reference images to trigger Vision
                auto-routing!
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "px-4 py-3 border-b border-amber-200/20",
                message.role === "user" ? "bg-white" : "bg-amber-50/15"
              )}
            >
              <div className="flex items-center justify-between mb-2 text-[11px] font-semibold text-amber-900">
                <span>
                  {message.role === "user" ? "You" : "Agent"}
                </span>
              </div>

              {/* Tool invocations */}
              {message.parts &&
                message.parts.filter(
                  (p: any) =>
                    p.type === "tool-invocation" || p.type === "dynamic-tool"
                ).length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {message.parts
                      .filter(
                        (p: any) =>
                          p.type === "tool-invocation" ||
                          p.type === "dynamic-tool"
                      )
                      .map((part: any) => (
                        <ToolInvocationCard key={part.toolCallId} part={part} />
                      ))}
                  </div>
                )}

              {renderMessageContent(message)}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Context file chips */}
      {contextPaths.size > 0 && (
        <div className="px-3 py-2 border-t border-amber-200/40 bg-amber-50/20 flex flex-wrap gap-1.5">
          <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1 uppercase tracking-wider w-full mb-0.5">
            <BookOpen className="w-3 h-3 text-amber-650" />
            Prompt File Context:
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
                      className="bg-amber-600/10 text-amber-900 border-amber-300 hover:bg-amber-600/20 flex items-center gap-1 text-[10px] px-2 py-0.5 shadow-none rounded-xl"
                    >
                      <FileText className="w-2.5 h-2.5 text-amber-600" />
                      <span className="max-w-[120px] truncate">{name}</span>
                      <button
                        onClick={(e) => handleToggleContext(p, e)}
                        className="hover:bg-amber-200/60 rounded p-0.5"
                      >
                        <X className="w-2 h-2 text-amber-800" />
                      </button>
                    </Badge>
                  );
                })}
                {overflow > 0 && (
                  <Badge className="bg-amber-100/70 text-amber-700 border-amber-200 text-[10px] px-2 py-0.5 shadow-none rounded-xl">
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
        <div className="px-3 py-2 border-t border-amber-200/40 bg-amber-50/30 flex flex-col gap-1">
          <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-3 h-3 text-amber-600" /> Multimodal Vision
            Context ({attachments.length}):
          </span>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="relative w-14 h-14 rounded-xl border border-amber-200/80 overflow-hidden flex-shrink-0 shadow-sm bg-white group"
              >
                <img
                  src={a.base64}
                  alt={a.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemoveAttachment(a.id)}
                  className="absolute top-0.5 right-0.5 bg-slate-900/85 hover:bg-red-650 text-white rounded-full p-0.5 shadow transition-colors"
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

      {/* Orchestration events */}
      {orchestrateMode && orchestrationEvents.length > 0 && (
        <div className="border-t border-purple-200/40 bg-purple-50/20 px-3 py-2 max-h-[200px] overflow-y-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Orchestration Events
            </span>
            {orchestrating && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStopOrchestration}
                className="h-5 text-[9px] text-red-500 hover:bg-red-50 rounded px-1.5"
              >
                <Square className="w-2.5 h-2.5 mr-1" /> Stop
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {orchestrationEvents.map((event, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-[10px] font-mono"
              >
                {event.type === "status" && (
                  <Loader2 className="w-3 h-3 text-amber-500 animate-spin mt-0.5 shrink-0" />
                )}
                {event.type === "completed" && (
                  <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                )}
                {event.type === "error" && (
                  <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                )}
                {event.type === "agent_message" && (
                  <Cpu className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                )}
                {(event.type === "text" ||
                  event.type === "plan_update" ||
                  event.type === "tool_call" ||
                  event.type === "tool_result") && (
                  <ChevronRight className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {event.sender && (
                    <span className="font-bold text-purple-700">
                      [{event.sender}]{' '}
                    </span>
                  )}
                  <span className="text-amber-900">{event.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="border-t border-amber-200/60 bg-amber-50/20 p-3 flex flex-col gap-2"
      >
        <div className="relative flex flex-col gap-1">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Send instructions to agent..."
            className="min-h-[70px] pr-12 pl-2 resize-none bg-white border-amber-200 focus-visible:ring-amber-500 text-amber-950 text-xs rounded-xl"
            disabled={isLoading || orchestrating}
          />

          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-amber-700 hover:bg-amber-100 rounded-lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || orchestrating}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-none text-[9px]">
                  Attach Screenshot
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              type="submit"
              size="icon"
              className="h-7 w-7 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
              disabled={
                (!chatInput.trim() && attachments.length === 0) ||
                isLoading ||
                orchestrating
              }
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Chat History Bar — dropdown selector for saved conversations
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
    setMessages,
    chatInput,
    setChatInput,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentChat = chats.find((c: any) => c.id === currentChatId);
  const chatTitle = currentChat?.title || "Select or create a chat";

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
      const title = firstMsg
        ? (firstMsg.content || "").slice(0, 60).replace(/\n/g, " ")
        : "New Chat";
      const data = await sendJson<{ chat: any }>("/api/chats", "POST", {
        title,
        model: "default",
      });
      const newChat = data.chat;
      // Save the current messages to the new chat
      await sendJson(`/api/chats/${newChat.id}`, "PATCH", {
        messages: messages,
      });
      // Refresh and select
      await loadChats();
      await selectChat(newChat.id);
      toast.success("Chat saved");
    } catch {
      toast.error("Failed to save chat");
    }
  };

  return (
    <div ref={dropdownRef} className="relative border-b border-amber-200/40">
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-amber-50/10 hover:bg-amber-50/30 cursor-pointer transition-colors select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <History className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="text-[11px] font-bold text-amber-900 truncate max-w-[180px]">
            {chatTitle}
          </span>
          <ChevronRight
            className={cn(
              "w-3 h-3 text-amber-400 shrink-0 transition-transform",
              open && "rotate-90"
            )}
          />
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-700 hover:text-amber-900 hover:bg-amber-100/60 rounded-lg transition-colors"
            title="New chat"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="absolute left-0 right-0 z-40 bg-white border-x border-b border-amber-200/60 shadow-lg rounded-b-xl overflow-hidden"
            style={{ top: "100%" }}
          >
            <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5">
              {/* Unsaved messages prompt */}
              {!currentChatId && messages.length > 0 && (
                <button
                  onClick={handleSaveCurrentAsChat}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-amber-800 hover:bg-amber-100/60 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-medium">Save current conversation</span>
                </button>
              )}

              {chatHistoryLoading ? (
                <div className="p-2">
                  <ListSkeleton count={3} />
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center py-4 text-[11px] text-amber-600/60">
                  <MessageSquare className="w-5 h-5 mx-auto mb-1.5 text-amber-400/50" />
                  <p>No saved chats yet.</p>
                  <p className="text-[10px]">Start a conversation and it will auto-save.</p>
                </div>
              ) : (
                chats.map((chat: any) => {
                  const isActive = chat.id === currentChatId;
                  const updatedAt = chat.updated_at
                    ? new Date(chat.updated_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  const msgCount = (chat.messages || []).length;

                  return (
                    <div
                      key={chat.id}
                      className={cn(
                        "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors",
                        isActive
                          ? "bg-amber-200/40 text-amber-950"
                          : "hover:bg-amber-50/80 text-amber-800"
                      )}
                      onClick={() => handleSelectChat(chat.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium truncate max-w-[160px]">
                            {chat.title || "Untitled"}
                          </div>
                          <div className="text-[9px] text-amber-600/60">
                            {updatedAt}
                            {msgCount > 0 && ` · ${msgCount} msgs`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-md transition-all"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
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
    addToolResult,
    setOpenTabs,
    setActiveTabPath,
    setEditorOpen,
  } = useWorkspace();

  const toolCallId = part.toolCallId;
  const toolName = part.toolName || part.type;
  const state = part.state;
  const hasResult =
    state === "result" ||
    state === "output-available" ||
    state === "output-error";

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-amber-100/50 border border-amber-200/70 rounded-xl text-[10px] font-mono text-amber-900">
      <div className="flex items-center gap-2">
        {hasResult ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
        )}
        <span className="font-bold">{toolName}</span>
        <span className="opacity-70 truncate max-w-[150px]">
          {JSON.stringify(part.input || part.args)}
        </span>
      </div>

      {toolName === "suggestEdit" && !hasResult && (
        <Button
          size="sm"
          className="w-full bg-amber-600 hover:bg-amber-700 text-white mt-1 h-7"
          onClick={() => {
            const args = (part.input || part.args) as any;
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
        >
          Review Code Diff
        </Button>
      )}

      {toolName !== "suggestEdit" && !hasResult && (
        <div className="flex gap-2 mt-1">
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] h-6 flex items-center justify-center gap-1"
            disabled={approvingToolId === toolCallId}
            onClick={() =>
              handleApproveTool(
                toolCallId,
                toolName,
                part.input || part.args
              )
            }
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
            className="flex-1 border-amber-300 text-amber-900 text-[9px] h-6 hover:bg-amber-100 flex items-center justify-center gap-1"
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
