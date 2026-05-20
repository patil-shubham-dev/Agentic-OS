"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Send,
  Square,
  Bot,
  Sparkles,
  Code2,
  Terminal as TerminalIcon,
  FileText,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  Save,
  Plus,
  FolderPlus,
  Trash2,
  Edit2,
  Search,
  Folder,
  FolderOpen,
  Terminal,
  Cpu,
  HelpCircle,
  Play,
  RotateCcw,
  BookOpen,
  CheckCircle,
  Layers,
  Sparkle,
  Image as ImageIcon,
  Paperclip,
  Copy,
  ChevronRight as BreadcrumbSeparator,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getJson, sendJson } from "@/lib/client-api";
import { toast } from "sonner";
import Editor, { DiffEditor } from "@monaco-editor/react";
const XtermTerminal = dynamic(() => import("@/components/workspace/XtermTerminal"), { ssr: false });
import { DefaultChatTransport } from "ai";
// Types
interface ImageAttachment {
  id: string;
  name: string;
  base64: string;
  type: string;
}

interface DbAgent {
  id: string;
  name: string;
  description: string;
  model: string;
  type: string;
  status: string;
  tools: string[];
}

interface FileNode {
  name: string;
  path: string;
  relPath: string;
  isDir: boolean;
  size: number;
  updatedAt: string;
}

interface OpenTab {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  isDiff?: boolean;
  originalContent?: string;
  toolCallId?: string;
}

interface TerminalLog {
  type: "stdout" | "stderr" | "error" | "system";
  text: string;
  timestamp: Date;
}

interface TerminalSession {
  id: string;
  name: string;
  logs: TerminalLog[];
  running: boolean;
  abortController: AbortController | null;
}

interface SearchResult {
  name: string;
  path: string;
  relPath: string;
  matches: Array<{ line: number; text: string }>;
}

export default function WorkspacePage() {
  const [agents, setAgents] = useState<DbAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("coding");

  // Active Context / Prompt Reference Files
  const [contextPaths, setContextPaths] = useState<Set<string>>(new Set());

  // Image Attachments State (Vision multimodal context!)
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat input state (managed locally with new AI SDK v6 API)
  const [chatInput, setChatInput] = useState("");

  // Vercel AI SDK useChat (v6 API - uses sendMessage instead of handleSubmit)
  const { messages, sendMessage, status, stop, setMessages, addToolResult } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    onFinish: () => {
      setAttachments([]);
    },
    onError: (err) => {
      toast.error("Chat execution failed");
    },
    sendAutomaticallyWhen: () => false,
  });
  const isLoading = status === 'submitted' || status === 'streaming';

  // Filesystem States
  const [rootPath, setRootPath] = useState("");
  const [dirContents, setDirContents] = useState<Record<string, FileNode[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Monaco Editor Canvas
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // Split Monaco Editor Pane States
  const [splitActive, setSplitActive] = useState(false);
  const [activeTabPathRight, setActiveTabPathRight] = useState<string | null>(null);
  const [focusedPane, setFocusedPane] = useState<"left" | "right">("left");

  // Shell Terminal Sessions state
  const [sessions, setSessions] = useState<TerminalSession[]>([
    { id: "term1", name: "bash-1", logs: [], running: false, abortController: null }
  ]);
  const [activeSessionId, setActiveSessionId] = useState("term1");
  const [shellCommand, setShellCommand] = useState("");

  // Global Command Palette & Search States
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // UI Panels
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);

  // Orchestration mode state
  const [orchestrateMode, setOrchestrateMode] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [orchestrationEvents, setOrchestrationEvents] = useState<Array<{type: string; text: string; sender?: string}>>([]);
  const orchestrationAbortRef = useRef<AbortController | null>(null);

  // Settings bridge status (loaded from API)
  const [bridgeStatus, setBridgeStatus] = useState<{
    activeRole: string;
    roleAssignments: Record<string, string>;
    security: Record<string, boolean>;
  } | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const [approvingToolId, setApprovingToolId] = useState<string | null>(null);

  const handleApproveTool = async (toolCallId: string, toolName: string, args: any) => {
    setApprovingToolId(toolCallId);
    try {
      const res = await fetch("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName, args }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Approved tool ${toolName} executed successfully.`);
        addToolResult({
          toolCallId,
          state: 'output-available' as const,
          output: typeof data.data === "string" ? data.data : JSON.stringify(data.data),
          tool: toolName,
        });
      } else {
        toast.error(`Tool execution failed: ${data.error}`);
        addToolResult({
          toolCallId,
          state: 'output-error' as const,
          errorText: `Failed to execute: ${data.error}`,
          tool: toolName,
        });
      }
    } catch (err: any) {
      toast.error(`Error approving tool: ${err.message}`);
      addToolResult({
        toolCallId,
        state: 'output-error' as const,
        errorText: `Error executing approved tool: ${err.message}`,
        tool: toolName,
      });
    } finally {
      setApprovingToolId(null);
    }
  };

  const handleDenyTool = (toolCallId: string, toolName: string = "unknown") => {
    toast.warning("Tool execution denied by user.");
    addToolResult({
      toolCallId,
      state: 'output-available' as const,
      output: "User denied execution of this tool.",
      tool: toolName,
    });
  };

  const activeAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  const activeTab = openTabs.find((t) => t.path === activeTabPath);
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // 1. Initial Load
  useEffect(() => {
    getJson<{ agents: Array<Record<string, any>> }>("/api/agents")
      .then((data) => {
        const mapped = data.agents.map((agent) => ({
          id: String(agent.id),
          name: String(agent.name),
          description: String(agent.description ?? ""),
          model: String(agent.model ?? ""),
          type: String(agent.type ?? "custom"),
          status: String(agent.status ?? "idle"),
          tools: Array.isArray(agent.tools) ? (agent.tools as string[]) : [],
        }));
        setAgents(mapped);
      })
      .catch(() => setAgents([]));

    loadFolderTree("");
    loadBridgeStatus();
  }, []);

  // Debounced Auto-Save
  useEffect(() => {
    const dirtyTabs = openTabs.filter(t => t.dirty && !t.isDiff);
    if (dirtyTabs.length === 0) return;

    const timer = setTimeout(() => {
      dirtyTabs.forEach(async (tab) => {
        try {
          await sendJson("/api/files/write", "POST", { path: tab.path, content: tab.content });
          setOpenTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)));
        } catch { /* ignore auto-save errors */ }
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [openTabs]);

  // Global Keybindings
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Ctrl+P / Cmd+P: Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      // Ctrl+S / Cmd+S: Save active file
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveFile();
      }
      // Ctrl+B / Cmd+B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // Ctrl+J / Cmd+J: Toggle Terminal
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  // Sync scroll positions
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.logs]);

  // Multimodal Drag-and-Drop + Clipboard Paste Handlers
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const fileReader = event.target as FileReader;
            if (fileReader?.result) {
              const base64 = fileReader.result as string;
              if (file.size > 5 * 1024 * 1024) {
                toast.warning("Image exceeds 5MB. Large attachments may be slow to process.");
              }
              setAttachments((prev) => [
                ...prev,
                { id: `img_${Date.now()}_${i}`, name: file.name || "Pasted Image", base64, type: file.type },
              ]);
              toast.success("Image pasted from clipboard.");
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
  const handleDragLeave = () => { setIsDraggingFile(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer.files);
    let attachedCount = 0;
    files.forEach((file, idx) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const fileReader = event.currentTarget as FileReader;
          if (fileReader?.result) {
            const base64 = fileReader.result as string;
            setAttachments((prev) => [
              ...prev,
              { id: `img_${Date.now()}_${idx}`, name: file.name, base64, type: file.type },
            ]);
            attachedCount++;
            if (idx === files.length - 1 || attachedCount > 0) toast.success(`Attached reference image: ${file.name}`);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach((file, idx) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const fileReader = event.currentTarget as FileReader;
          if (fileReader?.result) {
            setAttachments((prev) => [
              ...prev,
              { id: `img_${Date.now()}_${idx}`, name: file.name, base64: fileReader.result as string, type: file.type },
            ]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Filesystem Operations
  const loadFolderTree = async (folderPath: string) => {
    const url = folderPath ? `/api/files/tree?path=${encodeURIComponent(folderPath)}` : "/api/files/tree";
    setLoadingPaths((prev) => new Set(prev).add(folderPath || "root"));
    try {
      const data = await getJson<{ path: string; items: FileNode[] }>(url);
      if (!rootPath && !folderPath) setRootPath(data.path);
      setDirContents((prev) => ({ ...prev, [folderPath || data.path]: data.items }));
      if (folderPath) setExpandedPaths((prev) => new Set(prev).add(folderPath));
    } catch {
      toast.error(`Failed to load folder tree for ${folderPath || "root"}`);
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(folderPath || "root");
        return next;
      });
    }
  };

  const handleToggleFolder = (folderPath: string) => {
    if (expandedPaths.has(folderPath)) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.delete(folderPath);
        return next;
      });
    } else {
      loadFolderTree(folderPath);
    }
  };

  const handleOpenFile = async (file: FileNode) => {
    const alreadyOpen = openTabs.find((t) => t.path === file.path);
    if (alreadyOpen) {
      if (focusedPane === "left" || !splitActive) {
        setActiveTabPath(file.path);
      } else {
        setActiveTabPathRight(file.path);
      }
      setEditorOpen(true);
      return;
    }
    try {
      const res = await getJson<{ content: string }>(`/api/files/read?path=${encodeURIComponent(file.path)}`);
      setOpenTabs((prev) => [...prev, { path: file.path, name: file.name, content: res.content, dirty: false }]);
      if (focusedPane === "left" || !splitActive) {
        setActiveTabPath(file.path);
      } else {
        setActiveTabPathRight(file.path);
      }
      setEditorOpen(true);
    } catch {
      toast.error(`Failed to read file: ${file.name}`);
    }
  };

  const handleCloseTab = (tabPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabIndex = openTabs.findIndex((t) => t.path === tabPath);
    const newTabs = openTabs.filter((t) => t.path !== tabPath);
    setOpenTabs(newTabs);
    if (activeTabPath === tabPath) {
      setActiveTabPath(newTabs.length > 0 ? newTabs[Math.max(0, tabIndex - 1)].path : null);
    }
  };

  const handleSaveFile = async () => {
    const savePath = (splitActive && focusedPane === "right") ? activeTabPathRight : activeTabPath;
    if (!savePath) return;
    const tabToSave = openTabs.find((t) => t.path === savePath);
    if (!tabToSave) return;
    try {
      await sendJson("/api/files/write", "POST", { path: tabToSave.path, content: tabToSave.content });
      setOpenTabs((prev) => prev.map((t) => (t.path === savePath ? { ...t, dirty: false } : t)));
      toast.success(`Saved changes to ${tabToSave.name}`);
    } catch {
      toast.error(`Failed to save file: ${tabToSave.name}`);
    }
  };

  const handleEditorChange = (val: string) => {
    if (!activeTabPath) return;
    setOpenTabs((prev) => prev.map((t) => (t.path === activeTabPath ? { ...t, content: val, dirty: true } : t)));
  };

  const handleEditorChangeRight = (val: string) => {
    if (!activeTabPathRight) return;
    setOpenTabs((prev) => prev.map((t) => (t.path === activeTabPathRight ? { ...t, content: val, dirty: true } : t)));
  };

  // Drag and Drop File/Folder Moving Handlers
  const handleFileTreeDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.setData("text/plain", path);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFileTreeDragOver = (e: React.DragEvent, item: FileNode) => {
    if (item.isDir) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleFileTreeDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    const sourcePath = e.dataTransfer.getData("text/plain");
    if (!sourcePath || sourcePath === targetFolder) return;

    const name = sourcePath.split(/[/\\]/).pop();
    if (!name) return;

    const destinationPath = `${targetFolder}/${name}`;
    if (sourcePath === destinationPath) return;

    try {
      await sendJson("/api/files/rename", "POST", { oldPath: sourcePath, newPath: destinationPath });
      toast.success(`Moved ${name} successfully.`);
      
      const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf("/"));
      if (sourceParent) {
        loadFolderTree(sourceParent);
      } else {
        loadFolderTree(rootPath);
      }
      loadFolderTree(targetFolder);

      setOpenTabs((prev) =>
        prev.map((t) => (t.path === sourcePath ? { ...t, path: destinationPath } : t))
      );
      if (activeTabPath === sourcePath) {
        setActiveTabPath(destinationPath);
      }
      if (activeTabPathRight === sourcePath) {
        setActiveTabPathRight(destinationPath);
      }
    } catch {
      toast.error("Failed to move file/folder.");
    }
  };

  const handleCreateFile = async (parentFolder: string) => {
    const fileName = prompt("Enter new file name:");
    if (!fileName) return;
    const fullPath = `${parentFolder}/${fileName}`;
    try {
      await sendJson("/api/files/write", "POST", { path: fullPath, content: "" });
      toast.success(`File ${fileName} created.`);
      loadFolderTree(parentFolder);
    } catch {
      toast.error("Failed to create file.");
    }
  };

  const handleCreateFolder = async (parentFolder: string) => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    const fullPath = `${parentFolder}/${folderName}`;
    try {
      await sendJson("/api/files/mkdir", "POST", { path: fullPath });
      toast.success(`Folder ${folderName} created.`);
      loadFolderTree(parentFolder);
    } catch {
      toast.error("Failed to create folder.");
    }
  };

  const handleRenameItem = async (itemPath: string, parentFolder: string) => {
    const newName = prompt("Enter new name:", itemPath.split("/").pop());
    if (!newName) return;
    const parentDir = itemPath.substring(0, itemPath.lastIndexOf("/"));
    const newFullPath = `${parentDir}/${newName}`;
    try {
      await sendJson("/api/files/rename", "POST", { oldPath: itemPath, newPath: newFullPath });
      toast.success("Renamed successfully.");
      loadFolderTree(parentFolder);
      setOpenTabs((prev) => prev.map((t) => (t.path === itemPath ? { ...t, path: newFullPath, name: newName } : t)));
      if (activeTabPath === itemPath) setActiveTabPath(newFullPath);
    } catch {
      toast.error("Rename failed.");
    }
  };

  const handleDeleteItem = async (itemPath: string, parentFolder: string) => {
    if (!confirm(`Are you sure you want to delete ${itemPath.split("/").pop()}?`)) return;
    try {
      await sendJson("/api/files/delete", "POST", { path: itemPath });
      toast.success("Deleted successfully.");
      loadFolderTree(parentFolder);
      setOpenTabs((prev) => prev.filter((t) => t.path !== itemPath));
      if (activeTabPath === itemPath) setActiveTabPath(null);
    } catch {
      toast.error("Failed to delete target.");
    }
  };

  // Load bridge status (role assignments + security from settings)
  const loadBridgeStatus = async () => {
    try {
      const [rolesRes, secRes] = await Promise.all([
        getJson<{ roles: Record<string, string> }>("/api/settings/roles"),
        getJson<{ security: Record<string, boolean> }>("/api/settings/security"),
      ]);
      setBridgeStatus({
        activeRole: "Coding",
        roleAssignments: rolesRes.roles,
        security: secRes.security,
      });
      setDbConnected(true);
    } catch {
      setDbConnected(false);
    }
  };

  // Orchestration: send task to /api/chat/orchestrate and stream SSE events
  const handleOrchestrateSubmit = async (task: string) => {
    if (orchestrating) return;
    setOrchestrating(true);
    setOrchestrationEvents([{ type: "status", text: "Initializing multi-agent control plane..." }]);

    const abortController = new AbortController();
    orchestrationAbortRef.current = abortController;

    try {
      const res = await fetch("/api/chat/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, workspaceRoot: rootPath || process.cwd() }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        setOrchestrationEvents(prev => [...prev, { type: "error", text: `Orchestration failed: ${errText}` }]);
        setOrchestrating(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            if (part.startsWith("data: ")) {
              try {
                const event = JSON.parse(part.substring(6));
                setOrchestrationEvents(prev => [...prev, {
                  type: event.type,
                  text: event.text || "",
                  sender: event.sender,
                }]);
              } catch {}
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setOrchestrationEvents(prev => [...prev, { type: "error", text: `Orchestration error: ${err.message}` }]);
      }
    } finally {
      setAttachments([]);
      setOrchestrating(false);
      orchestrationAbortRef.current = null;
    }
  };

  const handleStopOrchestration = () => {
    orchestrationAbortRef.current?.abort();
    setOrchestrating(false);
  };

  const handleToggleContext = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    if (!query?.trim?.()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await getJson<{ results: SearchResult[] }>(`/api/files/search?q=${encodeURIComponent(query)}&root=${encodeURIComponent(rootPath)}`);
      setSearchResults(data.results);
    } catch {
    } finally { setSearching(false); }
  };

  const handleSelectSearchResult = async (filePath: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    const name = filePath.split(/[/\\]/).pop() || "";
    await handleOpenFile({ name, path: filePath, relPath: "", isDir: false, size: 0, updatedAt: new Date().toISOString() });
  };

  const handleAddNewSession = () => {
    const newId = `term_${Date.now()}`;
    setSessions((prev) => [...prev, { id: newId, name: `bash-${prev.length + 1}`, logs: [], running: false, abortController: null }]);
    setActiveSessionId(newId);
  };

  const handleCloseSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length === 1) return toast.warning("Must maintain at least one terminal session active.");
    const session = sessions.find((s) => s.id === id);
    if (session?.abortController) session.abortController.abort();
    const nextSessions = sessions.filter((s) => s.id !== id);
    setSessions(nextSessions);
    if (activeSessionId === id) setActiveSessionId(nextSessions[0].id);
  };

  const handleExecuteCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!shellCommand?.trim?.() || activeSession.running) return;
    const commandToRun = shellCommand;
    setShellCommand("");
    setTerminalOpen(true);
    setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, running: true, logs: [...s.logs, { type: "system", text: `> ${commandToRun}`, timestamp: new Date() }] } : s));
    const abortController = new AbortController();
    setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, abortController } : s)));
    try {
      const response = await fetch("/api/terminal/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: commandToRun, cwd: rootPath }),
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error(`Execution error: ${response.statusText}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            if (part.startsWith("data: ")) {
              try {
                const eventData = JSON.parse(part.substring(6));
                if (eventData.type === "stdout" || eventData.type === "stderr") {
                  setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, logs: [...s.logs, { type: eventData.type, text: eventData.text, timestamp: new Date() }] } : s));
                } else if (eventData.type === "exit") {
                  setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, running: false, logs: [...s.logs, { type: "system", text: `Process exited with code ${eventData.code}`, timestamp: new Date() }] } : s));
                } else if (eventData.type === "error") {
                  setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, logs: [...s.logs, { type: "error", text: eventData.text, timestamp: new Date() }] } : s));
                }
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error && err.name === "AbortError" ? "Command terminated by user." : (err instanceof Error ? err.message : "Execution failed.");
      setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, running: false, logs: [...s.logs, { type: "error", text: errMsg, timestamp: new Date() }] } : s));
    } finally {
      setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, running: false, abortController: null } : s)));
    }
  };

  const handleStopCommand = () => {
    if (activeSession.abortController) activeSession.abortController.abort();
  };

  // Interactive Folder Tree Renderer with Context Menus!
  const renderTreeNodes = (dirPath: string, depth = 0) => {
    const items = dirContents[dirPath] || [];

    return items.map((item) => {
      const isExpanded = expandedPaths.has(item.path);
      const isLoading = loadingPaths.has(item.path);
      const isContextSelected = contextPaths.has(item.path);

      return (
        <ContextMenu key={item.path}>
          <ContextMenuTrigger>
            <div
              style={{ paddingLeft: `${depth * 10}px` }}
              className="select-none"
              draggable={true}
              onDragStart={(e) => handleFileTreeDragStart(e, item.path)}
              onDragOver={(e) => handleFileTreeDragOver(e, item)}
              onDrop={(e) => handleFileTreeDrop(e, item.isDir ? item.path : dirPath)}
            >
              <div
                className={cn(
                  "flex items-center justify-between group px-2 py-1 rounded-md hover:bg-amber-100/50 cursor-pointer text-xs transition-colors",
                  activeTabPath === item.path ? "bg-amber-100 text-amber-900 font-semibold" : "text-amber-800"
                )}
                onClick={() => (item.isDir ? handleToggleFolder(item.path) : handleOpenFile(item))}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {item.isDir ? (
                    isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> : isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-amber-600" /> : <Folder className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>
              </div>
              {item.isDir && isExpanded && (
                <div className="border-l border-amber-200/50 ml-3.5 pl-1.5 my-0.5">
                  {renderTreeNodes(item.path, depth + 1)}
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48 text-xs bg-white border border-amber-200 rounded-xl shadow-xl">
            {item.isDir && (
              <>
                <ContextMenuItem onClick={() => handleCreateFile(item.path)} className="focus:bg-amber-100 cursor-pointer">
                  <Plus className="w-3.5 h-3.5 mr-2 text-amber-600" /> New File
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCreateFolder(item.path)} className="focus:bg-amber-100 cursor-pointer">
                  <FolderPlus className="w-3.5 h-3.5 mr-2 text-amber-600" /> New Folder
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-amber-100" />
              </>
            )}
            <ContextMenuItem onClick={() => {
              navigator.clipboard.writeText(item.path);
              toast.success("Path copied to clipboard.");
            }} className="focus:bg-amber-100 cursor-pointer">
              <Copy className="w-3.5 h-3.5 mr-2 text-amber-600" /> Copy Path
            </ContextMenuItem>
            {!item.isDir && (
              <ContextMenuItem onClick={() => {
                handleToggleContext(item.path, { stopPropagation: () => {} } as any);
              }} className="focus:bg-amber-100 cursor-pointer">
                <BookOpen className="w-3.5 h-3.5 mr-2 text-amber-600" /> Toggle Prompt Context
              </ContextMenuItem>
            )}
            <ContextMenuSeparator className="bg-amber-100" />
            <ContextMenuItem onClick={() => handleRenameItem(item.path, dirPath)} className="focus:bg-amber-100 cursor-pointer">
              <Edit2 className="w-3.5 h-3.5 mr-2 text-amber-600" /> Rename
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleDeleteItem(item.path, dirPath)} className="focus:bg-red-50 text-red-600 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-amber-50/10 overflow-hidden font-sans">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        
        {/* Left Panel: Filesystem Workspace Tree Explorer */}
        {sidebarOpen && (
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="min-w-[240px]">
            <div className="h-full flex flex-col border-r border-amber-200/60 bg-amber-50/45">
              <div className="p-3 border-b border-amber-200/60 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">File Explorer</span>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-700 hover:bg-amber-100 rounded-lg" onClick={() => setSearchOpen(true)}>
                            <Search className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">Quick Open (Ctrl + P)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-700 hover:bg-amber-100 rounded-lg" onClick={() => handleCreateFile(rootPath)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-700 hover:bg-amber-100 rounded-lg" onClick={() => handleCreateFolder(rootPath)}>
                      <FolderPlus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-amber-200/80 rounded-xl px-2 py-1 shadow-sm">
                  <Folder className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <Input
                    className="h-6 text-[11px] font-semibold border-none bg-transparent shadow-none p-0 focus-visible:ring-0 text-amber-900 truncate"
                    value={rootPath}
                    onChange={(e) => setRootPath(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadFolderTree(rootPath)}
                  />
                </div>
              </div>

              <ScrollArea className="flex-1 p-2">
                {rootPath ? <div className="space-y-1">{renderTreeNodes(rootPath)}</div> : <div className="flex items-center justify-center p-8 text-center text-xs text-amber-600/70"><Loader2 className="w-4 h-4 animate-spin text-amber-500 mr-1.5" /> Indexing codebase...</div>}
              </ScrollArea>
            </div>
          </ResizablePanel>
        )}

        <ResizableHandle withHandle />

        {/* Center Panel: Code Editor / Live Multi-Terminal */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <ResizablePanelGroup direction="vertical">
            {editorOpen && (
              <ResizablePanel defaultSize={60} minSize={20}>
                <div className="h-full flex flex-col bg-white border-b border-amber-200/60">
                  <div className="flex items-center justify-between border-b border-amber-200/60 bg-amber-50/20 px-2 py-1">
                    <div className="flex items-center gap-1 overflow-x-auto">
                      {openTabs.map((t) => (
                        <div
                          key={t.path}
                          onClick={() => setActiveTabPath(t.path)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs font-semibold cursor-pointer border-t-2 border-x border-transparent transition-all",
                            activeTabPath === t.path ? "bg-white text-amber-900 border-t-amber-600 border-x-amber-200/70 shadow-sm" : "text-amber-700/75 hover:bg-amber-100/40"
                          )}
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t.name}</span>
                          {t.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />}
                          <button onClick={(e) => handleCloseTab(t.path, e)} className="p-0.5 hover:bg-amber-100 rounded text-amber-600"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!splitActive) {
                            if (!activeTabPathRight) setActiveTabPathRight(activeTabPath);
                            setFocusedPane("right");
                          } else {
                            setFocusedPane("left");
                          }
                          setSplitActive(!splitActive);
                        }}
                        className={cn(
                          "h-8 text-xs border-amber-200 rounded-xl px-3 flex items-center gap-1.5",
                          splitActive ? "bg-amber-100 text-amber-900 border-amber-300" : "text-amber-700 hover:bg-amber-50"
                        )}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        {splitActive ? "Single View" : "Split View"}
                      </Button>
                      {activeTab && (
                        <Button size="sm" onClick={handleSaveFile} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-8">
                          <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Breadcrumb Navigation */}
                  {activeTabPath && (
                    <div className="flex items-center px-4 py-1.5 border-b border-amber-100 bg-amber-50/10 text-[11px] text-amber-700/80 font-medium">
                      {activeTabPath.split(/[/\\]/).map((segment, idx, arr) => (
                        <div key={idx} className="flex items-center">
                          <span className={idx === arr.length - 1 ? "text-amber-950 font-bold" : ""}>{segment}</span>
                          {idx < arr.length - 1 && <BreadcrumbSeparator className="w-3 h-3 mx-1 opacity-50" />}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex-1 flex overflow-hidden">
                    {!splitActive ? (
                      activeTab ? (
                        activeTab.isDiff ? (
                          <div className="flex-1 flex flex-col relative group">
                            <div className="absolute top-2 right-6 z-10 flex gap-2">
                              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 shadow" onClick={() => {
                                if (activeTab.toolCallId) addToolResult({ toolCallId: activeTab.toolCallId, state: 'output-available' as const, output: 'User rejected the edit.', tool: 'reject_edit' });
                                setOpenTabs(prev => prev.filter(t => t.path !== activeTab.path));
                              }}>Reject</Button>
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 shadow" onClick={async () => {
                                try {
                                  await sendJson("/api/files/write", "POST", { path: activeTab.path, content: activeTab.content });
                                  toast.success("Edit applied successfully");
                                  if (activeTab.toolCallId) addToolResult({ toolCallId: activeTab.toolCallId, state: 'output-available' as const, output: 'User approved the edit. It has been applied.', tool: 'approve_edit' });
                                  setOpenTabs(prev => prev.map(t => t.path === activeTab.path ? { ...t, isDiff: false, dirty: false } : t));
                                } catch (e) {
                                  toast.error("Failed to apply edit");
                                  if (activeTab.toolCallId) addToolResult({ toolCallId: activeTab.toolCallId, state: 'output-error' as const, errorText: 'Failed to apply edit.', tool: 'apply_edit' });
                                }
                              }}>Accept and Apply</Button>
                            </div>
                            <DiffEditor
                              height="100%"
                              theme="vs-dark"
                              original={activeTab.originalContent || ""}
                              modified={activeTab.content}
                              options={{ fontSize: 13, minimap: { enabled: false } }}
                            />
                          </div>
                        ) : (
                          <div className="flex-1 h-full" onClick={() => setFocusedPane("left")}>
                            <Editor
                              height="100%"
                              theme="vs-dark"
                              path={activeTab.path}
                              value={activeTab.content}
                              onChange={(val) => handleEditorChange(val || "")}
                              options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 16 } }}
                            />
                          </div>
                        )
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-amber-600/70 bg-amber-50/5">
                          <Code2 className="w-10 h-10 text-amber-600/50 mb-3" />
                          <h4 className="font-bold text-amber-950">Code Canvas</h4>
                          <p className="max-w-xs mt-1">Double click a file in the sidebar explorer to open inside Monaco editor.</p>
                        </div>
                      )
                    ) : (
                      <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel defaultSize={50} minSize={20}>
                          <div className={cn("h-full flex flex-col border-r border-amber-100", focusedPane === "left" && "ring-1 ring-amber-500/40")} onClick={() => setFocusedPane("left")}>
                            <div className="flex items-center justify-between px-3 py-1 bg-amber-50/15 border-b border-amber-250/20 text-[10px] font-bold text-amber-900 select-none">
                              <span>L-PANE {activeTabPath ? `(${activeTabPath.split(/[/\\]/).pop()})` : "(Empty)"}</span>
                              {focusedPane === "left" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            </div>
                            {activeTab ? (
                              <Editor
                                height="100%"
                                theme="vs-dark"
                                path={`left-${activeTab.path}`}
                                value={activeTab.content}
                                onChange={(val) => handleEditorChange(val || "")}
                                options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 12 } }}
                              />
                            ) : (
                              <div className="flex-1 flex items-center justify-center text-center text-[11px] text-amber-600/60 bg-amber-50/5">Left panel empty. Click a file.</div>
                            )}
                          </div>
                        </ResizablePanel>
                        
                        <ResizableHandle withHandle />

                        <ResizablePanel defaultSize={50} minSize={20}>
                          <div className={cn("h-full flex flex-col", focusedPane === "right" && "ring-1 ring-amber-500/40")} onClick={() => setFocusedPane("right")}>
                            <div className="flex items-center justify-between px-3 py-1 bg-amber-50/15 border-b border-amber-250/20 text-[10px] font-bold text-amber-900 select-none">
                              <span>R-PANE {activeTabPathRight ? `(${activeTabPathRight.split(/[/\\]/).pop()})` : "(Empty)"}</span>
                              {focusedPane === "right" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            </div>
                            {activeTabPathRight && openTabs.find(t => t.path === activeTabPathRight) ? (
                              <Editor
                                height="100%"
                                theme="vs-dark"
                                path={`right-${activeTabPathRight}`}
                                value={openTabs.find(t => t.path === activeTabPathRight)?.content || ""}
                                onChange={(val) => handleEditorChangeRight(val || "")}
                                options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 12 } }}
                              />
                            ) : (
                              <div className="flex-1 flex items-center justify-center text-center text-[11px] text-amber-600/60 bg-amber-50/5">Right panel empty. Focus and click a file to open.</div>
                            )}
                          </div>
                        </ResizablePanel>
                      </ResizablePanelGroup>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            )}

            <ResizableHandle withHandle />

            {/* Bottom Resizable Panel: Live Terminal shell logs */}
            {terminalOpen && (
              <ResizablePanel defaultSize={40} minSize={20}>
                <div className="h-full flex flex-col bg-slate-900 text-slate-100">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/65">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {sessions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => setActiveSessionId(s.id)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1 cursor-pointer text-xs rounded-lg transition-colors border",
                            activeSessionId === s.id ? "bg-slate-800 text-emerald-400 border-emerald-500/40" : "text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200"
                          )}
                        >
                          <TerminalIcon className={cn("w-3.5 h-3.5", s.running && "text-emerald-400 animate-pulse")} />
                          <span className="font-mono text-[11px]">{s.name}</span>
                          <button onClick={(e) => handleCloseSession(s.id, e)} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"><X className="w-2.5 h-2.5" /></button>
                        </div>
                      ))}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:bg-slate-850 hover:text-white rounded" onClick={handleAddNewSession}><Plus className="w-3.5 h-3.5" /></Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeSession.running && (
                        <Button size="sm" onClick={handleStopCommand} className="h-6 bg-red-650 hover:bg-red-700 text-white rounded text-[10px] px-2 shadow">
                          <Square className="w-2.5 h-2.5 mr-1" /> Kill Process
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, logs: [] } : s)))}>
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 bg-slate-900 relative">
                    <XtermTerminal
                      key={activeSessionId}
                      id={activeSessionId}
                      cwd={rootPath || "."}
                    />
                  </div>
                </div>
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel: Workspace Agent Chat (AI SDK `useChat` enabled) */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40} className="min-w-[280px]">
          <div
            className="h-full flex flex-col border-l border-amber-200/60 bg-white relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <AnimatePresence>
              {isDraggingFile && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-amber-500/80 backdrop-blur-sm text-white p-6 text-center select-none">
                  <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4"><ImageIcon className="w-8 h-8 text-white" /></motion.div>
                  <h3 className="text-base font-bold">Drop Image to Attach</h3>
                  <p className="text-xs text-white/95 max-w-[220px] mt-1 leading-relaxed">Release to attach reference context for the Vision multimodal model.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-3 border-b border-amber-200/60 bg-amber-50/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {orchestrateMode ? (
                  <Cpu className="w-4 h-4 text-purple-600 animate-pulse" />
                ) : (
                  <Bot className="w-4 h-4 text-amber-700 animate-pulse" />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-amber-950">
                    {orchestrateMode ? "Orchestrator" : (bridgeStatus?.activeRole || "AgentOS")}
                  </span>
                  <span className="text-[9px] text-amber-600/60">
                    {orchestrateMode ? "Multi-agent mode" : `Role: ${bridgeStatus?.activeRole || "Coding"}`}
                  </span>
                </div>
                {dbConnected === false && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-none text-[10px] max-w-[200px]">
                        Database offline — role routing & security will use defaults. Configure providers in Settings to restore full functionality.
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
                        onClick={() => {
                          if (!orchestrateMode && attachments.length > 0) {
                            setAttachments([]);
                          }
                          setOrchestrateMode(!orchestrateMode);
                        }}
                      >
                        <Cpu className="w-3 h-3 mr-1" />
                        {orchestrateMode ? "Single" : "Orchestrate"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">
                      {orchestrateMode ? "Switch to single-agent chat" : "Enable multi-agent orchestration"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {isLoading && (
                  <Button size="sm" variant="ghost" onClick={() => stop()} className="h-5 px-1.5 text-[9px] text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 rounded">
                    <Square className="w-2.5 h-2.5 mr-1" /> Stop
                  </Button>
                )}
                <Badge variant="outline" className="text-[9px] border-amber-300/40 bg-amber-100 text-amber-800 font-medium">
                  {orchestrateMode ? "Multi-Agent" : (bridgeStatus?.activeRole || "Coding")}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 bg-white">
              <div className="pb-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center p-6 pt-12">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center mb-3 shadow"><Sparkle className="w-5 h-5 text-white animate-spin-slow" /></div>
                    <h3 className="text-sm font-bold text-amber-950">AgentOS Assistant</h3>
                    <p className="text-xs text-amber-600/70 max-w-[200px] mt-1 leading-relaxed">Ask your active role model to make directory edits or index search paths. Drag or paste reference images to trigger Vision auto-routing!</p>
                  </div>
                )}
                
                {messages.map((message) => (
                  <div key={message.id} className={cn("px-4 py-3 border-b border-amber-200/20", message.role === "user" ? "bg-white" : "bg-amber-50/15")}>
                    <div className="flex items-center justify-between mb-2 text-[11px] font-semibold text-amber-900">
                      <span>{message.role === "user" ? "You" : "Agent"}</span>
                    </div>
                    
                    {/* Render tool invocations dynamically from message parts */}
                    {message.parts && message.parts.filter((p: any) => p.type === 'tool-invocation' || p.type === 'dynamic-tool').length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        {message.parts.filter((p: any) => p.type === 'tool-invocation' || p.type === 'dynamic-tool').map((part: any) => {
                          const toolCallId = part.toolCallId;
                          const toolName = part.toolName || (part.type as string).replace('tool-', '');
                          const state = part.state;
                          const hasResult = state === 'result' || state === 'output-available' || state === 'output-error';
                          return (
                          <div key={toolCallId} className="flex flex-col gap-1.5 p-2 bg-amber-100/50 border border-amber-200/70 rounded-xl text-[10px] font-mono text-amber-900">
                            <div className="flex items-center gap-2">
                              {hasResult ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
                              <span className="font-bold">{toolName}</span>
                              <span className="opacity-70 truncate max-w-[150px]">{JSON.stringify(part.input || part.args)}</span>
                            </div>
                            {toolName === 'suggestEdit' && !hasResult && (
                              <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white mt-1 h-7" onClick={() => {
                                const args = (part.input || part.args) as any;
                                setOpenTabs(prev => [...prev.filter(t => t.path !== args.path), {
                                  path: args.path, name: args.path.split(/[/\\]/).pop() || 'Edit',
                                  content: args.newContent, originalContent: args.originalContent,
                                  dirty: true, isDiff: true, toolCallId
                                }]);
                                setActiveTabPath(args.path);
                                setEditorOpen(true);
                              }}>Review Code Diff</Button>
                            )}
                            {toolName !== 'suggestEdit' && !hasResult && (
                              <div className="flex gap-2 mt-1">
                                <Button
                                  size="sm"
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] h-6 flex items-center justify-center gap-1"
                                  disabled={approvingToolId === toolCallId}
                                  onClick={() => handleApproveTool(toolCallId, toolName, part.input || part.args)}
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
                        })}
                      </div>
                    )}
                    
                    {(message as any).content && (
                      <div className="text-xs text-amber-950 prose prose-sm leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{(message as any).content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {contextPaths.size > 0 && (
              <div className="px-3 py-2 border-t border-amber-200/40 bg-amber-50/20 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1 uppercase tracking-wider w-full mb-0.5"><BookOpen className="w-3 h-3 text-amber-650" /> Prompt File Context:</span>
                {Array.from(contextPaths).map((p) => {
                  const name = p.split(/[/\\]/).pop() || "";
                  return (
                    <Badge key={p} className="bg-amber-600/10 text-amber-900 border-amber-300 hover:bg-amber-600/20 flex items-center gap-1 text-[10px] px-2 py-0.5 shadow-none rounded-xl">
                      <FileText className="w-2.5 h-2.5 text-amber-600" />
                      <span className="max-w-[120px] truncate">{name}</span>
                      <button onClick={(e) => handleToggleContext(p, e)} className="hover:bg-amber-200/60 rounded p-0.5"><X className="w-2 h-2 text-amber-800" /></button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {attachments.length > 0 && (
              <div className="px-3 py-2 border-t border-amber-200/40 bg-amber-50/30 flex flex-col gap-1">
                <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5"><ImageIcon className="w-3 h-3 text-amber-600" /> Multimodal Vision Context ({attachments.length}):</span>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {attachments.map((a) => (
                    <div key={a.id} className="relative w-14 h-14 rounded-xl border border-amber-200/80 overflow-hidden flex-shrink-0 shadow-sm bg-white group">
                      <img src={a.base64} alt={a.name} className="w-full h-full object-cover" />
                      <button onClick={() => handleRemoveAttachment(a.id)} className="absolute top-0.5 right-0.5 bg-slate-900/85 hover:bg-red-650 text-white rounded-full p-0.5 shadow transition-colors"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input type="file" multiple accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

            {/* Orchestration Events Panel */}
            {orchestrateMode && orchestrationEvents.length > 0 && (
              <div className="border-t border-purple-200/40 bg-purple-50/20 px-3 py-2 max-h-[200px] overflow-y-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> Orchestration Events
                  </span>
                  {orchestrating && (
                    <Button size="sm" variant="ghost" onClick={handleStopOrchestration}
                      className="h-5 text-[9px] text-red-500 hover:bg-red-50 rounded px-1.5">
                      <Square className="w-2.5 h-2.5 mr-1" /> Stop
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  {orchestrationEvents.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[10px] font-mono">
                      {event.type === "status" && <Loader2 className="w-3 h-3 text-amber-500 animate-spin mt-0.5 shrink-0" />}
                      {event.type === "completed" && <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />}
                      {event.type === "error" && <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />}
                      {event.type === "agent_message" && <Cpu className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />}
                      {(event.type === "text" || event.type === "plan_update" || event.type === "tool_call" || event.type === "tool_result") &&
                        <ChevronRight className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        {event.sender && <span className="font-bold text-purple-700">[{event.sender}] </span>}
                        <span className="text-amber-900">{event.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={(e) => {
                e.preventDefault();
                if (!chatInput.trim() && attachments.length === 0) return;
                const text = chatInput;
                setChatInput("");
                if (orchestrateMode) {
                  handleOrchestrateSubmit(text);
                } else {
                  sendMessage({ text });
                }
              }} className="border-t border-amber-200/60 bg-amber-50/20 p-3 flex flex-col gap-2">
              <div className="relative flex flex-col gap-1">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!chatInput.trim() && attachments.length === 0) return;
                      const text = chatInput;
                      setChatInput("");
                      if (orchestrateMode) {
                        handleOrchestrateSubmit(text);
                      } else {
                        sendMessage({ text });
                      }
                    }
                  }}
                  placeholder={`Send instructions to agent (type @ to reference paths, paste or drag screenshots)...`}
                  className="min-h-[70px] pr-12 pl-2 resize-none bg-white border-amber-200 focus-visible:ring-amber-500 text-amber-950 text-xs rounded-xl"
                  disabled={isLoading}
                />
                
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-amber-700 hover:bg-amber-100 rounded-lg" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><Paperclip className="w-3.5 h-3.5" /></Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 text-white border-none text-[9px]">Attach Screenshot</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button type="submit" size="icon" className="h-7 w-7 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm" disabled={(!chatInput.trim() && attachments.length === 0) || isLoading}>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Quick Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl bg-white border border-amber-200 rounded-3xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-amber-950 flex items-center gap-2"><Search className="w-5 h-5 text-amber-600" /> Quick Search Codebase</DialogTitle>
            <DialogDescription className="text-xs text-amber-600/70">Instantly search text matches or find files inside the workspace (Ctrl + P).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Input autoFocus className="pl-9 border-amber-200 text-amber-950 bg-amber-50/10 rounded-xl" placeholder="Type your search query (e.g. function handleOpenFile)..." value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} />
              <Search className="absolute left-3 top-3 w-4 h-4 text-amber-600/70" />
            </div>
            <ScrollArea className="max-h-[300px] border border-amber-100 rounded-2xl overflow-hidden bg-amber-50/5 p-2">
              {searching ? (
                <div className="flex items-center justify-center p-8 text-xs text-amber-750"><Loader2 className="w-4 h-4 animate-spin text-amber-500 mr-2" /> Scanning codebase...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-amber-600/60">{searchQuery ? "No matching files or snippets found." : "Type a query above to search files and code content."}</div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((res) => (
                    <div key={res.path} onClick={() => handleSelectSearchResult(res.path)} className="p-3 bg-white border border-amber-100 rounded-xl hover:border-amber-400 hover:shadow-sm cursor-pointer transition-all duration-150 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950"><FileText className="w-4 h-4 text-amber-600" /><span>{res.name}</span></div>
                        <span className="text-[10px] font-mono text-amber-600/70">{res.relPath}</span>
                      </div>
                      <div className="pl-5 space-y-1">
                        {res.matches.map((m, idx) => (
                          <div key={idx} className="flex gap-2 text-[10px] font-mono text-amber-800/80 leading-relaxed bg-amber-50/45 p-1 rounded">
                            <span className="text-amber-500 font-bold select-none w-6 text-right">L{m.line}:</span>
                            <span className="truncate">{m.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
