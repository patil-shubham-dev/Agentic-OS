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
  HelpCircle,
  FileCode,
  Layers,
  ChevronDown
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

  // Composer Mode State
  const [composerMode, setComposerMode] = useState<"ask" | "agent" | "edit" | "architect">("ask");
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const [atFilter, setAtFilter] = useState("");

  // Sync composerMode and orchestrateMode
  useEffect(() => {
    if (composerMode === "agent") {
      setOrchestrateMode(true);
    } else {
      setOrchestrateMode(false);
    }
  }, [composerMode, setOrchestrateMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract all files from tree to support @ autocomplete
  const getAllFiles = useCallback(() => {
    const list: { name: string; path: string }[] = [];
    Object.values(dirContents).forEach((files) => {
      files.forEach((file) => {
        if (!file.isDir) {
          list.push({ name: file.name, path: file.path });
        }
      });
    });
    // Deduplicate
    const uniqueList: { name: string; path: string }[] = [];
    const seen = new Set<string>();
    list.forEach((item) => {
      if (!seen.has(item.path)) {
        seen.add(item.path);
        uniqueList.push(item);
      }
    });
    return uniqueList;
  }, [dirContents]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setChatInput(value);

    // Simple @ check
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
    handleToggleContext(filePath, { stopPropagation: () => {} } as any);
    const atIndex = chatInput.lastIndexOf("@");
    if (atIndex !== -1) {
      setChatInput(chatInput.slice(0, atIndex));
    }
    setAtMenuOpen(false);
    textareaRef.current?.focus();
  };

  const renderMessageContent = useCallback((message: any) => {
    const content = message.content;
    if (content === undefined || content === null) return null;
    if (typeof content === "string") {
      if (!content.trim()) return null;
      return <LazyMarkdown content={content} />;
    }
    if (Array.isArray(content)) {
      const textParts = content.filter((p: any) => p.type === "text" && p.text?.trim());
      if (textParts.length === 0) return null;
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

  // Filtered files for @ menu
  const allFiles = getAllFiles();
  const filteredAtFiles = allFiles.filter(f => f.name.toLowerCase().includes(atFilter)).slice(0, 5);

  return (
    <div
      className="h-full flex flex-col border-l border-zinc-800 bg-[#141416] relative text-zinc-300"
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
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-amber-500/80 backdrop-blur-sm text-zinc-950 p-6 text-center select-none"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-16 h-16 rounded-full bg-zinc-950/20 flex items-center justify-center mb-4"
            >
              <ImageIcon className="w-8 h-8 text-zinc-950" />
            </motion.div>
            <h3 className="text-base font-bold">Drop Image to Attach</h3>
            <p className="text-xs text-zinc-900/90 max-w-[220px] mt-1 leading-relaxed">
              Attach image reference for Vision routing.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat History Bar */}
      <ChatHistoryBar />

      {/* Mode Selector Panel */}
      <div className="px-3 py-2 border-b border-zinc-800/80 bg-[#18181c]/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5">
          <span className="text-[10px] text-zinc-500 font-bold uppercase select-none mr-1.5">Mode:</span>
          <button
            onClick={() => setComposerMode("ask")}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1",
              composerMode === "ask" ? "bg-zinc-800 text-amber-500" : "text-zinc-450 hover:text-zinc-200"
            )}
          >
            <HelpCircle className="w-3 h-3" />
            Ask
          </button>
          <button
            onClick={() => setComposerMode("edit")}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1",
              composerMode === "edit" ? "bg-zinc-800 text-amber-500" : "text-zinc-450 hover:text-zinc-200"
            )}
          >
            <FileCode className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={() => setComposerMode("agent")}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1",
              composerMode === "agent" ? "bg-zinc-800 text-amber-500" : "text-zinc-450 hover:text-zinc-200"
            )}
          >
            <Cpu className="w-3 h-3" />
            Agent
          </button>
          <button
            onClick={() => setComposerMode("architect")}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1",
              composerMode === "architect" ? "bg-zinc-800 text-amber-500" : "text-zinc-450 hover:text-zinc-200"
            )}
          >
            <Layers className="w-3 h-3" />
            Arch
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {isLoading && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => stop()}
              className="h-5 px-1.5 text-[9px] text-red-400 hover:bg-red-950/40 border border-red-900/50 rounded"
            >
              <Square className="w-2.5 h-2.5 mr-1 fill-red-450" /> Stop
            </Button>
          )}
          <Badge
            variant="outline"
            className="text-[9px] border-zinc-800 bg-zinc-900 text-zinc-400 font-medium px-2 py-0.5"
          >
            {composerMode.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-[#141416]">
        <div className="pb-4">
          {messages.length === 0 && !orchestrating && (
            <div className="flex flex-col items-center justify-center text-center p-6 pt-16">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4 border border-zinc-700/30">
                <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200 tracking-wide">
                AgentOS Composer ({composerMode})
              </h3>
              <p className="text-xs text-zinc-500 max-w-[220px] mt-2 leading-relaxed">
                {composerMode === "ask" && "Ask code architecture questions, inspect definitions, and learn concepts."}
                {composerMode === "edit" && "Make direct targeted editing modifications to your file system."}
                {composerMode === "agent" && "Run autonomous agentic loops to build features, fix bugs, and execute tasks."}
                {composerMode === "architect" && "Design full system modules, structural data models, and database flows."}
              </p>
              <p className="text-[10px] text-zinc-650 mt-4 max-w-[200px] border border-zinc-900 rounded p-1.5 font-mono">
                Type <span className="text-amber-500 font-bold">@</span> to attach specific workspace files directly to prompt context.
              </p>
            </div>
          )}

          {messages.map((message) => {
            const parts = message.parts?.filter(
              (p: any) => p.type === "tool-invocation" || p.type === "dynamic-tool"
            );
            return (
              <MessageCard
                key={message.id}
                id={message.id}
                role={message.role === "user" ? "user" : "Manager"}
                content={typeof message.content === "string" ? message.content : ""}
                parts={parts}
                renderMessageContent={renderMessageContent}
                renderToolInvocation={(part: any) => (
                  <ToolInvocationCard key={part.toolCallId} part={part} />
                )}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Autocomplete Menu for @ references */}
      {atMenuOpen && filteredAtFiles.length > 0 && (
        <div className="absolute left-3 right-3 bottom-[115px] z-50 bg-[#1e1e24] border border-zinc-800 shadow-2xl rounded-lg overflow-hidden p-1">
          <div className="text-[9px] font-bold text-zinc-500 px-2 py-1 uppercase tracking-wider border-b border-zinc-800">
            Files in workspace:
          </div>
          {filteredAtFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => handleSelectAtFile(file.path)}
              className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition-colors flex items-center gap-2 truncate"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span className="truncate flex-1 font-mono text-[11px]">{file.name}</span>
              <span className="text-[9px] text-zinc-500 truncate max-w-[120px]">{file.path.split(/[/\\]/).slice(-2, -1)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Context file chips */}
      {contextPaths.size > 0 && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-[#18181c]/60 flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
          <span className="text-[9px] font-bold text-zinc-400 flex items-center gap-1 uppercase tracking-wider w-full mb-0.5">
            <BookOpen className="w-3 h-3 text-amber-500" />
            Prompt File Context ({contextPaths.size}):
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
                      className="bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 flex items-center gap-1 text-[10px] px-2 py-0.5 shadow-none rounded"
                    >
                      <FileText className="w-2.5 h-2.5 text-zinc-450" />
                      <span className="max-w-[120px] truncate">{name}</span>
                      <button
                        onClick={(e) => handleToggleContext(p, e)}
                        className="hover:bg-zinc-700 rounded p-0.5 ml-1 transition-colors"
                      >
                        <X className="w-2 h-2 text-zinc-400 hover:text-white" />
                      </button>
                    </Badge>
                  );
                })}
                {overflow > 0 && (
                  <Badge className="bg-zinc-900 text-zinc-500 border-zinc-800 text-[10px] px-2 py-0.5 shadow-none rounded">
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
        <div className="px-3 py-2 border-t border-zinc-800 bg-[#18181c]/40 flex flex-col gap-1">
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-3 h-3 text-amber-500" /> Vision Context ({attachments.length}):
          </span>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="relative w-14 h-14 rounded border border-zinc-850 overflow-hidden flex-shrink-0 shadow bg-[#18181c] group"
              >
                <img
                  src={a.base64}
                  alt={a.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemoveAttachment(a.id)}
                  className="absolute top-0.5 right-0.5 bg-zinc-900/90 hover:bg-red-600 text-white rounded-full p-0.5 shadow transition-colors"
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

      {/* Input area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="border-t border-zinc-800 bg-[#18181c]/80 p-3 flex flex-col gap-2"
      >
        <div className="relative flex flex-col gap-1">
          <Textarea
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
              composerMode === "ask" ? "Ask a question about the project... (type @ for files)" :
              composerMode === "edit" ? "Instruct modifications... (type @ for files)" :
              composerMode === "agent" ? "Describe a complex goal... (type @ for files)" :
              "Design high-level architecture... (type @ for files)"
            }
            className="min-h-[70px] pr-14 pl-2 resize-none bg-[#141416] border-zinc-800 focus-visible:ring-amber-500/30 text-zinc-200 text-xs rounded shadow-inner"
            disabled={isLoading || orchestrating}
          />

          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || orchestrating}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-900 border border-zinc-800 text-white text-[9px]">
                  Attach Screenshot
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              type="submit"
              size="icon"
              className="h-7 w-7 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded transition-colors"
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
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      const title = firstMsg
        ? (firstMsg.content || "").slice(0, 60).replace(/\n/g, " ")
        : "New Chat";
      const data = await sendJson<{ chat: any }>("/api/chats", "POST", {
        title,
        model: "default",
      });
      const newChat = data.chat;
      await sendJson(`/api/chats/${newChat.id}`, "PATCH", {
        messages: messages,
      });
      await loadChats();
      await selectChat(newChat.id);
      toast.success("Chat saved");
    } catch {
      toast.error("Failed to save chat");
    }
  };

  return (
    <div ref={dropdownRef} className="relative border-b border-zinc-800/80">
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-[#18181c] hover:bg-zinc-800/20 cursor-pointer transition-colors select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <History className="w-3 h-3 text-[#dcb45c] shrink-0" />
          <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[180px]">
            {chatTitle}
          </span>
          <ChevronRight
            className={cn(
              "w-3 h-3 text-zinc-500 shrink-0 transition-transform",
              open && "rotate-90"
            )}
          />
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
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
            className="absolute left-0 right-0 z-40 bg-[#1e1e24] border-x border-b border-zinc-800 shadow-2xl rounded-b overflow-hidden"
            style={{ top: "100%" }}
          >
            <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5">
              {!currentChatId && messages.length > 0 && (
                <button
                  onClick={handleSaveCurrentAsChat}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
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
                <div className="text-center py-6 text-[11px] text-zinc-500">
                  <MessageSquare className="w-5 h-5 mx-auto mb-2 text-zinc-650" />
                  <p>No saved chats yet.</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Your conversations will auto-save here.</p>
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
                        "group flex items-center justify-between px-3 py-1.5 rounded cursor-pointer transition-colors",
                        isActive
                          ? "bg-zinc-800 text-white"
                          : "hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200"
                      )}
                      onClick={() => handleSelectChat(chat.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium truncate max-w-[160px]">
                            {chat.title || "Untitled"}
                          </div>
                          <div className="text-[9px] text-zinc-500">
                            {updatedAt}
                            {msgCount > 0 && ` · ${msgCount} msgs`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all ml-1 shrink-0"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
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
    <div className="flex flex-col gap-1.5 p-2.5 bg-[#18181c] border border-zinc-800/80 rounded text-[10px] font-mono text-zinc-350">
      <div className="flex items-center gap-2">
        {hasResult ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
        )}
        <span className="font-bold text-zinc-200">{toolName}</span>
        <span className="opacity-70 truncate max-w-[150px]">
          {JSON.stringify(args)}
        </span>
      </div>

      {!hasResult && (
        <div className="flex gap-2 mt-1">
          <Button
            size="sm"
            className="flex-1 bg-[#dcb45c] hover:bg-amber-400 text-zinc-950 text-[9px] h-6 flex items-center justify-center gap-1 rounded transition-colors"
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
            className="flex-1 border-zinc-800 bg-[#1e1e24] hover:bg-zinc-800 text-zinc-300 text-[9px] h-6 flex items-center justify-center gap-1 rounded transition-colors"
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
