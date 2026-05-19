"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Paperclip,
  Image,
  Mic,
  Square,
  Bot,
  User,
  Sparkles,
  Code2,
  Terminal,
  Eye,
  FileText,
  Settings,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  RotateCcw,
  GitBranch,
  Wand2,
  Cpu,
  Zap,
  Clock,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Loader2,
  Lightbulb,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  topBarModelRoles,
  workspaceContextFiles,
  workspaceToolActivity,
} from "@/lib/product-blueprint";
import { getJson, sendJson } from "@/lib/client-api";

// Types
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  tokens?: number;
  timestamp: Date;
  status?: "streaming" | "complete" | "error";
  toolCalls?: ToolCall[];
  artifacts?: Artifact[];
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: string;
  status: "pending" | "running" | "complete" | "error";
}

interface Artifact {
  id: string;
  type: "code" | "design" | "file" | "terminal";
  title: string;
  content: string;
  language?: string;
}

// Mock data
const mockMessages: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Create a landing page for an AI SaaS product called AgentOS. It should have a hero section, features grid, pricing, and a CTA. Use a modern dark theme with gradient accents.",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "2",
    role: "assistant",
    content: `I'll create a stunning landing page for AgentOS with a modern dark theme. Let me start by generating the design and then implement the code.

## Plan
1. **Hero Section** - Bold headline with gradient text and animated background
2. **Features Grid** - 6 feature cards with icons
3. **Pricing Section** - 3-tier pricing with highlighted Pro plan
4. **CTA Section** - Final call-to-action with email capture

Let me generate the React components:`,
    model: "Claude Opus",
    tokens: 1247,
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
    toolCalls: [
      {
        id: "tc1",
        name: "generate_design",
        args: { prompt: "Modern dark SaaS landing page with gradient accents", style: "minimalist" },
        status: "complete",
        result: "Design generated successfully",
      },
      {
        id: "tc2",
        name: "write_file",
        args: { path: "/workspace/landing-page.tsx", content: "..." },
        status: "complete",
        result: "File written: landing-page.tsx (2.4KB)",
      },
    ],
    artifacts: [
      {
        id: "a1",
        type: "code",
        title: "LandingPage.tsx",
        content: `export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <section className="relative pt-32 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950" />
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Build with AI
          </h1>
        </div>
      </section>
    </div>
  );
}`,
        language: "tsx",
      },
    ],
  },
  {
    id: "3",
    role: "user",
    content: "Looks great! Can you also add a testimonials section and make the navbar sticky with a blur effect?",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
  },
  {
    id: "4",
    role: "assistant",
    content: `Absolutely! I'll add a testimonials section with a carousel and make the navbar sticky with a glassmorphism blur effect. Let me update the code:

### Changes Made:
- **Sticky Navbar** with backdrop blur and semi-transparent background
- **Testimonials Section** with auto-playing carousel
- **Glassmorphism cards** for testimonial quotes
- **Star ratings** with Lucide icons

Here's the updated component:`,
    model: "Claude Opus",
    tokens: 892,
    timestamp: new Date(Date.now() - 1000 * 60 * 1),
    status: "complete",
    artifacts: [
      {
        id: "a2",
        type: "code",
        title: "Navbar.tsx",
        content: `"use client";

import { useState, useEffect } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  return (
    <nav className={\`fixed top-0 w-full z-50 transition-all duration-300 \${
      scrolled ? "bg-slate-950/80 backdrop-blur-xl border-b border-white/10" : ""
    }\`}>
      {/* ... */}
    </nav>
  );
}`,
        language: "tsx",
      },
    ],
  },
];

// Components
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase">{language || "code"}</span>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={copyToClipboard}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language || "typescript"}
        style={oneDark}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: "13px" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 rounded-lg border bg-muted/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              tool.status === "complete" && "bg-green-500",
              tool.status === "running" && "bg-blue-500 animate-pulse",
              tool.status === "error" && "bg-destructive",
              tool.status === "pending" && "bg-muted-foreground"
            )}
          />
          <Wrench className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{tool.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {tool.status}
          </Badge>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              <div className="text-xs">
                <span className="text-muted-foreground font-medium">Arguments:</span>
                <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-x-auto">
                  {JSON.stringify(tool.args, null, 2)}
                </pre>
              </div>
              {tool.result && (
                <div className="text-xs">
                  <span className="text-muted-foreground font-medium">Result:</span>
                  <pre className="mt-1 p-2 rounded bg-muted text-xs">{tool.result}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <div className="my-4 rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {artifact.type === "code" && <Code2 className="w-4 h-4 text-primary" />}
          {artifact.type === "design" && <Eye className="w-4 h-4 text-purple-500" />}
          {artifact.type === "file" && <FileText className="w-4 h-4 text-blue-500" />}
          {artifact.type === "terminal" && <Terminal className="w-4 h-4 text-green-500" />}
          <span className="text-sm font-medium">{artifact.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <Copy className="w-3 h-3" /> Copy
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <GitBranch className="w-3 h-3" /> Apply
          </Button>
        </div>
      </div>
      <div className="p-0">
        {artifact.type === "code" && (
          <CodeBlock code={artifact.content} language={artifact.language} />
        )}
        {artifact.type === "design" && (
          <div className="p-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L3N2Zz4=')]">
            <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center text-white/20 text-sm">
              Design Preview
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("py-6", isUser ? "bg-transparent" : "bg-muted/30")}
    >
      <div className="max-w-4xl mx-auto px-4 flex gap-4">
        {/* Avatar */}
        <div className="shrink-0 mt-1">
          {isUser ? (
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">JD</AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-agentos-500 to-agentos-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{isUser ? "You" : message.model || "AgentOS"}</span>
            {!isUser && message.tokens && (
              <span className="text-xs text-muted-foreground">{message.tokens.toLocaleString()} tokens</span>
            )}
            <span className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Message Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <CodeBlock code={String(children).replace(/\n$/, "")} language={match[1]} />
                  ) : (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Tool Calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Tool Calls ({message.toolCalls.length})
              </p>
              {message.toolCalls.map((tool) => (
                <ToolCallCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}

          {/* Artifacts */}
          {message.artifacts && message.artifacts.length > 0 && (
            <div className="mt-3 space-y-3">
              {message.artifacts.map((artifact) => (
                <ArtifactCard key={artifact.id} artifact={artifact} />
              ))}
            </div>
          )}

          {/* Streaming indicator */}
          {message.status === "streaming" && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-typing" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-typing" style={{ animationDelay: "200ms" }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-typing" style={{ animationDelay: "400ms" }} />
              </div>
              <span className="text-xs text-muted-foreground">Generating response...</span>
            </div>
          )}

          {/* Message actions */}
          {!isUser && message.status === "complete" && (
            <div className="flex items-center gap-1 mt-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerate</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <GitBranch className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Branch</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function WorkspacePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    getJson<{ chats: Array<{ messages?: Array<Record<string, unknown>> }> }>("/api/chat")
      .then((data) => {
        const latestChat = data.chats[0];
        if (!latestChat?.messages?.length) {
          setMessages([]);
          return;
        }
        setMessages(
          latestChat.messages.map((message, index) => ({
            id: String(message.id ?? `msg-${index}`),
            role: (message.role as Message["role"]) ?? "assistant",
            content: String(message.content ?? ""),
            model: message.model ? String(message.model) : undefined,
            tokens: message.tokens ? Number(message.tokens) : undefined,
            timestamp: message.timestamp ? new Date(String(message.timestamp)) : new Date(),
            status: "complete",
            toolCalls: Array.isArray(message.toolCalls) ? (message.toolCalls as ToolCall[]) : undefined,
          }))
        );
      })
      .catch(() => setMessages(mockMessages));
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await sendJson<{ chat: { messages: Array<Record<string, unknown>> } }>("/api/chat", "POST", {
        messages: [
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
            model: message.model,
          })),
          { role: "user", content: userMessage.content },
        ],
        model: topBarModelRoles[0]?.name ?? "Claude Opus",
        agent: "coding",
      });

      const latestMessages = response.chat.messages;
      setMessages(
        latestMessages.map((message, index) => ({
          id: String(message.id ?? `msg-${index}`),
          role: (message.role as Message["role"]) ?? "assistant",
          content: String(message.content ?? ""),
          model: message.model ? String(message.model) : undefined,
          tokens: message.tokens ? Number(message.tokens) : undefined,
          timestamp: message.timestamp ? new Date(String(message.timestamp)) : new Date(),
          status: "complete",
          toolCalls: Array.isArray(message.toolCalls) ? (message.toolCalls as ToolCall[]) : undefined,
        }))
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Sidebar - Context */}
        {sidebarOpen && (
          <>
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="min-w-[200px]">
              <div className="h-full flex flex-col border-r bg-card/50">
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">Context</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(false)}>
                    <PanelLeftClose className="w-4 h-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Files</p>
                      <div className="space-y-1">
                        {workspaceContextFiles.map((file) => (
                          <div
                            key={file.path}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                          >
                            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="truncate">{file.path}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Active Agents</p>
                      <div className="space-y-2">
                        {topBarModelRoles.slice(0, 3).map((agent, index) => (
                          <div key={agent.name} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer">
                            <div className={cn("w-2 h-2 rounded-full", index === 0 ? "bg-green-500" : "bg-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">{agent.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Memory</p>
                      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
                        <p>• User prefers dark themes</p>
                        <p>• React + TypeScript stack</p>
                        <p>• Tailwind for styling</p>
                        <p>• Framer Motion for animations</p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* Main Chat Area */}
        <ResizablePanel defaultSize={sidebarOpen ? (rightPanelOpen ? 50 : 80) : (rightPanelOpen ? 70 : 100)}>
          <div className="h-full flex flex-col">
            <ScrollArea className="flex-1">
              <div className="pb-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t bg-card/50 p-4">
              <div className="max-w-4xl mx-auto">
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything... (Cmd+K for commands)"
                    className="min-h-[80px] pr-24 resize-none bg-background"
                    disabled={isStreaming}
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Paperclip className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Attach file</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Image className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Upload image</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Mic className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Voice input</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      size="sm"
                      className="h-8 gap-1"
                      onClick={handleSend}
                      disabled={!input.trim() || isStreaming}
                    >
                      {isStreaming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {!sidebarOpen && (
                      <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => setSidebarOpen(true)}>
                        <PanelLeftOpen className="w-3 h-3" /> Context
                      </Button>
                    )}
                    <span>Claude Opus can make mistakes. Consider checking important information.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>0 tokens</span>
                    <span>$0.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>

        {/* Right Panel - Task Plan & Tools */}
        {rightPanelOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={20} maxSize={40} className="min-w-[250px]">
              <div className="h-full flex flex-col border-l bg-card/50">
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">Task Plan</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightPanelOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        <span className="text-sm font-medium">Generating Landing Page</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { step: "Analyze requirements", status: "complete" },
                          { step: "Generate design tokens", status: "complete" },
                          { step: "Create component structure", status: "running" },
                          { step: "Implement animations", status: "pending" },
                          { step: "Add responsive styles", status: "pending" },
                        ].map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <div
                              className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center",
                                step.status === "complete" && "bg-green-500/20 text-green-500",
                                step.status === "running" && "bg-primary/20 text-primary",
                                step.status === "pending" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {step.status === "complete" ? (
                                <Check className="w-3 h-3" />
                              ) : step.status === "running" ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <span className="text-[10px]">{i + 1}</span>
                              )}
                            </div>
                            <span className={cn(step.status === "pending" && "text-muted-foreground")}>
                              {step.step}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Tool Activity</p>
                      <div className="space-y-2">
                        {workspaceToolActivity.map((activity) => (
                          <div key={activity.tool} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs">
                            <div className="flex items-center gap-2">
                              <Wrench className="w-3 h-3 text-muted-foreground" />
                              <span>{activity.tool}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>{activity.source}</span>
                              <Clock className="w-3 h-3" />
                              <span>{activity.duration}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Model Configuration</p>
                      <div className="space-y-2">
                        {topBarModelRoles.map((model, index) => (
                          <div
                            key={model.name}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                              index === 0 ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                            )}
                          >
                            <Cpu className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{model.name}</p>
                              <p className="text-xs text-muted-foreground">{model.role}</p>
                            </div>
                            {index === 0 && <Badge className="text-[10px]">Active</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
