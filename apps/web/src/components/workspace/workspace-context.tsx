"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getJson,
  sendJson,
  readFile,
  writeFile,
  deleteFile,
  renameFile,
  readDirectory,
  createDirectory,
  showOpenDialog,
  isElectron
} from "@/lib/client-api";
import { useContextStore } from "@/stores/context-store";
import { useLayout } from "@/components/layout-context";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { 
  FileCode, 
  FileJson, 
  FileText, 
  FileImage, 
  Globe, 
  Terminal, 
  Folder, 
  FolderOpen,
  ChevronRight,
  ChevronDown
} from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface ImageAttachment {
  id: string;
  name: string;
  base64: string;
  type: string;
}

export interface FileNode {
  name: string;
  path: string;
  relPath: string;
  isDir: boolean;
  size: number;
  updatedAt: string;
}

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  isDiff?: boolean;
  originalContent?: string;
  toolCallId?: string;
}

export interface TerminalSession {
  id: string;
  name: string;
  logs: TerminalLog[];
  running: boolean;
  abortController: AbortController | null;
  cwd?: string;
}

export interface TerminalLog {
  type: "stdout" | "stderr" | "error" | "system";
  text: string;
  timestamp: Date;
}

export interface SearchResult {
  name: string;
  path: string;
  relPath: string;
  matches: Array<{ line: number; text: string }>;
}

export interface BridgeStatus {
  activeRole: string;
  roleAssignments: Record<string, string>;
  security: Record<string, boolean>;
}

export interface OrchestrationEvent {
  type: string;
  text: string;
  sender?: string;
}

// ============================================================
// Context Shape
// ============================================================

interface WorkspaceContextType {
  // Agents
  agents: any[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;

  // File System
  rootPath: string;
  setRootPath: (path: string) => void;
  dirContents: Record<string, FileNode[]>;
  expandedPaths: Set<string>;
  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  loadingPaths: Set<string>;
  loadFolderTree: (folderPath: string) => Promise<void>;
  handleToggleFolder: (folderPath: string) => void;
  handleOpenFolder: () => Promise<void>;

  // Editor
  openTabs: OpenTab[];
  setOpenTabs: (tabs: OpenTab[] | ((prev: OpenTab[]) => OpenTab[])) => void;
  activeTabPath: string | null;
  setActiveTabPath: (path: string | null) => void;
  activeTabPathRight: string | null;
  setActiveTabPathRight: (path: string | null) => void;
  splitActive: boolean;
  setSplitActive: (active: boolean) => void;
  focusedPane: "left" | "right";
  setFocusedPane: (pane: "left" | "right") => void;
  editorOpen: boolean;
  setEditorOpen: (open: boolean) => void;
  handleOpenFile: (file: FileNode) => Promise<void>;
  handleCloseTab: (tabPath: string, e: React.MouseEvent) => void;
  handleSaveFile: () => Promise<void>;
  handleEditorChange: (val: string) => void;
  handleEditorChangeRight: (val: string) => void;
  cursorPosition: { line: number; column: number };
  setCursorPosition: (pos: { line: number; column: number }) => void;

  // Terminal
  sessions: TerminalSession[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  handleAddNewSession: () => void;
  handleCloseSession: (id: string, e: React.MouseEvent) => void;

  // Chat
  messages: any[];
  sendMessage: (data: any) => void;
  status: string;
  stop: () => void;
  setMessages: (messages: any[]) => void;
  addToolResult: (result: any) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  isLoading: boolean;

  // Chat History
  chats: any[];
  currentChatId: string | null;
  chatHistoryLoading: boolean;
  loadChats: () => Promise<void>;
  createNewChat: () => Promise<string | null>;
  deleteChat: (id: string) => Promise<void>;
  selectChat: (id: string) => Promise<any>;

  // Attachments
  attachments: ImageAttachment[];
  setAttachments: (attachments: ImageAttachment[]) => void;
  contextPaths: Set<string>;
  handleToggleContext: (path: string, e: React.MouseEvent) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveAttachment: (id: string) => void;
  isDraggingFile: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Bridge / Settings
  bridgeStatus: BridgeStatus | null;
  dbConnected: boolean | null;

  // Orchestration
  orchestrateMode: boolean;
  setOrchestrateMode: (mode: boolean) => void;
  orchestrating: boolean;
  orchestrationEvents: OrchestrationEvent[];
  handleOrchestrateSubmit: (task: string) => Promise<void>;
  handleStopOrchestration: () => void;

  // Search / Command Palette
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  searchQuery: string;
  searchResults: SearchResult[];
  searching: boolean;
  handleSearchChange: (query: string) => Promise<void>;
  handleSelectSearchResult: (filePath: string) => Promise<void>;

  // Layout
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // File tree operations
  renderTreeNodes: (dirPath: string, depth?: number) => React.ReactNode;
  handleCreateFile: (parentFolder: string) => Promise<void>;
  handleCreateFolder: (parentFolder: string) => Promise<void>;
  handleRenameItem: (itemPath: string, parentFolder: string) => Promise<void>;
  handleDeleteItem: (itemPath: string, parentFolder: string) => Promise<void>;
  handleFileTreeDragStart: (e: React.DragEvent, path: string) => void;
  handleFileTreeDragOver: (e: React.DragEvent, item: FileNode) => void;
  handleFileTreeDrop: (e: React.DragEvent, targetFolder: string) => Promise<void>;

  // Tool approval
  approvingToolId: string | null;
  handleApproveTool: (toolCallId: string, toolName: string, args: any) => Promise<void>;
  handleDenyTool: (toolCallId: string, toolName?: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

// ============================================================
// Provider Component
// ============================================================

export function WorkspaceProvider({
  children,
  useChatHook,
}: {
  children: ReactNode;
  useChatHook: () => {
    messages: any[];
    sendMessage: (data: any) => void;
    status: string;
    stop: () => void;
    setMessages: (msgs: any[]) => void;
    addToolResult: (result: any) => void;
  };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const chat = useChatHook();

  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("coding");

  // File System
  const [rootPath, setRootPath] = useState("");
  const [dirContents, setDirContents] = useState<Record<string, FileNode[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Editor
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [splitActive, setSplitActive] = useState(false);
  const [activeTabPathRight, setActiveTabPathRight] = useState<string | null>(null);
  const [focusedPane, setFocusedPane] = useState<"left" | "right">("left");
  const [editorOpen, setEditorOpen] = useState(true);
  const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number }>({ line: 1, column: 1 });

  // Terminal
  const [sessions, setSessions] = useState<TerminalSession[]>([
    { id: "term1", name: "bash-1", logs: [], running: false, abortController: null },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("term1");
  const { terminalOpen, setTerminalOpen, searchOpen, setSearchOpen, sidebarOpen, setSidebarOpen } = useLayout();
  const [chatInput, setChatInput] = useState("");
  const isLoading = chat.status === "submitted" || chat.status === "streaming";

  // Attachments
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [contextPaths, setContextPaths] = useState<Set<string>>(new Set());
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bridge / Settings
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  // Orchestration
  const [orchestrateMode, setOrchestrateMode] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [orchestrationEvents, setOrchestrationEvents] = useState<OrchestrationEvent[]>([]);
  const orchestrationAbortRef = useRef<AbortController | null>(null);

  // Command Palette
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Tool approval
  const [approvingToolId, setApprovingToolId] = useState<string | null>(null);

  // ============================================================
  // Chat History
  // ============================================================
  const [chats, setChats] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Load all chats from the server */
  const loadChats = useCallback(async () => {
    setChatHistoryLoading(true);
    try {
      const data = await getJson<{ chats: any[] }>("/api/chats");
      setChats(data.chats || []);
    } catch {
      // silently fail — likely no DB
      setChats([]);
    } finally {
      setChatHistoryLoading(false);
    }
  }, []);

  /** Create a new chat, set it as current, and clear the messages */
  const createNewChat = useCallback(async () => {
    try {
      const data = await sendJson<{ chat: any }>("/api/chats", "POST", {
        title: "New Chat",
        model: "default",
      });
      const newChat = data.chat;
      setCurrentChatId(newChat.id);
      chat.setMessages([]);
      setChatInput("");
      // Refresh the chat list
      setChats((prev) => [newChat, ...prev]);
      return newChat.id;
    } catch {
      toast.error("Failed to create new chat");
      return null;
    }
  }, [chat]);

  /** Select a chat and load its messages */
  const selectChat = useCallback(async (id: string) => {
    try {
      const data = await getJson<{ chat: any }>(`/api/chats/${id}`);
      if (data.chat) {
        setCurrentChatId(data.chat.id);
        const msgs = (data.chat.messages || []) as any[];
        chat.setMessages(msgs);
        setChatInput("");
        // Auto-update title from first user message if still "New Chat"
        return data.chat;
      }
    } catch {
      toast.error("Failed to load chat");
    }
    return null;
  }, [chat]);

  /** Delete a chat */
  const deleteChat = useCallback(async (id: string) => {
    try {
      await sendJson(`/api/chats/${id}`, "DELETE");
      setChats((prev) => prev.filter((c: any) => c.id !== id));
      if (currentChatId === id) {
        setCurrentChatId(null);
        chat.setMessages([]);
      }
      toast.success("Chat deleted");
    } catch {
      toast.error("Failed to delete chat");
    }
  }, [currentChatId, chat]);

  /** Auto-save messages to the current chat (debounced) */
  const autoSaveChat = useCallback((msgs: any[]) => {
    if (!currentChatId || msgs.length === 0) return;
    if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
    chatSaveTimerRef.current = setTimeout(async () => {
      try {
        // Derive title from first user message
        const firstUserMsg = msgs.find((m: any) => m.role === "user");
        const title = firstUserMsg
          ? (firstUserMsg.content || "").slice(0, 60).replace(/\n/g, " ")
          : undefined;

        await sendJson(`/api/chats/${currentChatId}`, "PATCH", {
          messages: msgs,
          ...(title ? { title } : {}),
        });

        // Update chat title in local list
        if (title) {
          setChats((prev) =>
            prev.map((c: any) =>
              c.id === currentChatId ? { ...c, title, messages: msgs } : { ...c, messages: msgs }
            )
          );
        }
      } catch {
        // Silently fail auto-save
      }
    }, 2000);
  }, [currentChatId]);

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, []);

  // Auto-save when messages change
  useEffect(() => {
    autoSaveChat(chat.messages);
    return () => {
      if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
    };
  }, [chat.messages, currentChatId]);

  // ============================================================
  // Initialization
  // ============================================================
  useEffect(() => {
    getJson<{ agents: Array<Record<string, any>> }>("/api/agents")
      .then((data) => {
        setAgents(
          data.agents.map((agent) => ({
            id: String(agent.id),
            name: String(agent.name),
            description: String(agent.description ?? ""),
            model: String(agent.model ?? ""),
            type: String(agent.type ?? "custom"),
            status: String(agent.status ?? "idle"),
            tools: Array.isArray(agent.tools) ? (agent.tools as string[]) : [],
          }))
        );
      })
      .catch(() => setAgents([]));

    loadBridgeStatus();
  }, []);

  // Auto-sync directory (cwd) of active and idle terminals when rootPath changes
  useEffect(() => {
    if (rootPath) {
      setSessions((prev) =>
        prev.map((s) => (s.cwd ? s : { ...s, cwd: rootPath }))
      );
    }
  }, [rootPath]);

  // Auto-save
  useEffect(() => {
    const dirtyTabs = openTabs.filter((t) => t.dirty && !t.isDiff);
    if (dirtyTabs.length === 0) return;
    const timer = setTimeout(() => {
      dirtyTabs.forEach(async (tab) => {
        try {
          await sendJson("/api/files/write", "POST", { path: tab.path, content: tab.content });
          setOpenTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)));
        } catch { /* ignore */ }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [openTabs]);

  // Global keybindings
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveFile?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  // ============================================================
  // Filesystem Operations
  // ============================================================
  const loadFolderTree = useCallback(async (folderPath: string) => {
    setLoadingPaths((prev) => new Set(prev).add(folderPath || "root"));
    try {
      let activePath = folderPath;
      if (!activePath) {
        // Fallback or read from backend first
        const rootRes = await getJson<{ path: string }>("/api/files/tree");
        activePath = rootRes.path;
      }

      // Read using unified readDirectory helper (handles Electron native calls automatically!)
      const result = await readDirectory(activePath);
      const items: FileNode[] = result.map((item: any) => ({
        name: item.name,
        path: item.path,
        relPath: item.relPath || item.path.replace(activePath, ""),
        isDir: item.isDir,
        size: item.size || 0,
        updatedAt: item.modifiedAt || new Date().toISOString(),
      }));

      if (!rootPath && !folderPath) setRootPath(activePath);
      setDirContents((prev) => ({ ...prev, [folderPath || activePath]: items }));
      if (folderPath) setExpandedPaths((prev) => new Set(prev).add(folderPath));
    } catch {
      toast.error(`Failed to load folder tree`);
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(folderPath || "root");
        return next;
      });
    }
  }, [rootPath]);

  // Load saved root path on mount
  useEffect(() => {
    const savedRoot = localStorage.getItem("agentos_root_path");
    if (savedRoot) {
      setRootPath(savedRoot);
      loadFolderTree(savedRoot);
    } else {
      loadFolderTree("");
    }
  }, [loadFolderTree]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const res = await showOpenDialog({
        properties: ["openDirectory"],
      });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) return;
      const selectedPath = res.filePaths[0];
      setRootPath(selectedPath);
      setExpandedPaths(new Set());
      setDirContents({});
      await loadFolderTree(selectedPath);
      useContextStore.getState().build(selectedPath);
      localStorage.setItem("agentos_root_path", selectedPath);
      toast.success(`Opened folder: ${selectedPath.split(/[/\\]/).pop()}`);
    } catch {
      toast.error("Failed to open folder");
    }
  }, [loadFolderTree]);

  const handleToggleFolder = useCallback((folderPath: string) => {
    if (expandedPaths.has(folderPath)) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.delete(folderPath);
        return next;
      });
    } else {
      loadFolderTree(folderPath);
    }
  }, [expandedPaths, loadFolderTree]);

  // ============================================================
  // Editor Operations
  // ============================================================
  const handleOpenFile = useCallback(async (file: FileNode) => {
    if (pathname !== "/workspace") {
      router.push("/workspace");
    }
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
      const content = await readFile(file.path);
      setOpenTabs((prev) => [...prev, { path: file.path, name: file.name, content, dirty: false }]);
      if (focusedPane === "left" || !splitActive) {
        setActiveTabPath(file.path);
      } else {
        setActiveTabPathRight(file.path);
      }
      setEditorOpen(true);
      // Auto-add the opened file to AI context
      setContextPaths((prev) => {
        const next = new Set(prev);
        next.add(file.path);
        return next;
      });
    } catch {
      toast.error(`Failed to read file: ${file.name}`);
    }
  }, [openTabs, focusedPane, splitActive, pathname, router]);

  const handleCloseTab = useCallback((tabPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tab = openTabs.find((t) => t.path === tabPath);
    // Prompt user to save if dirty
    if (tab?.dirty && !tab.isDiff) {
      const shouldSave = window.confirm(`Save changes to "${tab.name}" before closing?`);
      if (shouldSave) {
        // Save then close
        writeFile(tab.path, tab.content)
          .then(() => {
            toast.success(`Saved ${tab.name}`);
          })
          .catch(() => toast.error(`Failed to save ${tab.name}`));
      }
    }
    const tabIndex = openTabs.findIndex((t) => t.path === tabPath);
    const newTabs = openTabs.filter((t) => t.path !== tabPath);
    setOpenTabs(newTabs);
    if (activeTabPath === tabPath) {
      setActiveTabPath(newTabs.length > 0 ? newTabs[Math.max(0, tabIndex - 1)].path : null);
    }
  }, [openTabs, activeTabPath]);

  const handleSaveFile = useCallback(async () => {
    const savePath = splitActive && focusedPane === "right" ? activeTabPathRight : activeTabPath;
    if (!savePath) return;
    const tabToSave = openTabs.find((t) => t.path === savePath);
    if (!tabToSave) return;
    try {
      await writeFile(tabToSave.path, tabToSave.content);
      setOpenTabs((prev) => prev.map((t) => (t.path === savePath ? { ...t, dirty: false } : t)));
      toast.success(`Saved changes to ${tabToSave.name}`);
    } catch {
      toast.error(`Failed to save file: ${tabToSave.name}`);
    }
  }, [splitActive, focusedPane, activeTabPath, activeTabPathRight, openTabs]);

  const handleEditorChange = useCallback((val: string) => {
    if (!activeTabPath) return;
    setOpenTabs((prev) => prev.map((t) => (t.path === activeTabPath ? { ...t, content: val, dirty: true } : t)));
  }, [activeTabPath]);

  const handleEditorChangeRight = useCallback((val: string) => {
    if (!activeTabPathRight) return;
    setOpenTabs((prev) => prev.map((t) => (t.path === activeTabPathRight ? { ...t, content: val, dirty: true } : t)));
  }, [activeTabPathRight]);

  // ============================================================
  // File Tree Operations
  // ============================================================
  const handleCreateFile = useCallback(async (parentFolder: string) => {
    const fileName = prompt("Enter new file name:");
    if (!fileName) return;
    const sep = parentFolder.includes("\\") ? "\\" : "/";
    const fullPath = parentFolder.endsWith(sep) ? `${parentFolder}${fileName}` : `${parentFolder}${sep}${fileName}`;
    try {
      await writeFile(fullPath, "");
      toast.success(`File ${fileName} created.`);
      loadFolderTree(parentFolder);
    } catch {
      toast.error("Failed to create file.");
    }
  }, [loadFolderTree]);

  const handleCreateFolder = useCallback(async (parentFolder: string) => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    const sep = parentFolder.includes("\\") ? "\\" : "/";
    const fullPath = parentFolder.endsWith(sep) ? `${parentFolder}${folderName}` : `${parentFolder}${sep}${folderName}`;
    try {
      await createDirectory(fullPath);
      toast.success(`Folder ${folderName} created.`);
      loadFolderTree(parentFolder);
    } catch {
      toast.error("Failed to create folder.");
    }
  }, [loadFolderTree]);

  const handleRenameItem = useCallback(async (itemPath: string, parentFolder: string) => {
    const originalName = itemPath.split(/[/\\]/).pop() || "";
    const newName = prompt("Enter new name:", originalName);
    if (!newName) return;
    const sep = itemPath.includes("\\") ? "\\" : "/";
    const parentDir = itemPath.substring(0, itemPath.lastIndexOf(sep));
    const newFullPath = parentDir.endsWith(sep) ? `${parentDir}${newName}` : `${parentDir}${sep}${newName}`;
    try {
      await renameFile(itemPath, newFullPath);
      toast.success("Renamed successfully.");
      loadFolderTree(parentFolder);
      setOpenTabs((prev) => prev.map((t) => (t.path === itemPath ? { ...t, path: newFullPath, name: newName } : t)));
      if (activeTabPath === itemPath) setActiveTabPath(newFullPath);
    } catch {
      toast.error("Rename failed.");
    }
  }, [loadFolderTree, activeTabPath]);

  const handleDeleteItem = useCallback(async (itemPath: string, parentFolder: string) => {
    const name = itemPath.split(/[/\\]/).pop() || "";
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await deleteFile(itemPath);
      toast.success("Deleted successfully.");
      loadFolderTree(parentFolder);
      setOpenTabs((prev) => prev.filter((t) => t.path !== itemPath));
      if (activeTabPath === itemPath) setActiveTabPath(null);
    } catch {
      toast.error("Failed to delete target.");
    }
  }, [loadFolderTree, activeTabPath]);

  const handleFileTreeDragStart = useCallback((e: React.DragEvent, path: string) => {
    e.dataTransfer.setData("text/plain", path);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleFileTreeDragOver = useCallback((e: React.DragEvent, item: FileNode) => {
    if (item.isDir) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const handleFileTreeDrop = useCallback(async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    const sourcePath = e.dataTransfer.getData("text/plain");
    if (!sourcePath || sourcePath === targetFolder) return;
    const name = sourcePath.split(/[/\\]/).pop();
    if (!name) return;
    const sep = targetFolder.includes("\\") ? "\\" : "/";
    const destinationPath = targetFolder.endsWith(sep) ? `${targetFolder}${name}` : `${targetFolder}${sep}${name}`;
    if (sourcePath === destinationPath) return;
    try {
      await renameFile(sourcePath, destinationPath);
      toast.success(`Moved ${name} successfully.`);
      const sourceSep = sourcePath.includes("\\") ? "\\" : "/";
      const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf(sourceSep));
      if (sourceParent) loadFolderTree(sourceParent);
      else loadFolderTree(rootPath);
      loadFolderTree(targetFolder);
      setOpenTabs((prev) => prev.map((t) => (t.path === sourcePath ? { ...t, path: destinationPath } : t)));
      if (activeTabPath === sourcePath) setActiveTabPath(destinationPath);
      if (activeTabPathRight === sourcePath) setActiveTabPathRight(destinationPath);
    } catch {
      toast.error("Failed to move file/folder.");
    }
  }, [rootPath, loadFolderTree, activeTabPath, activeTabPathRight]);

  // ============================================================
  // Bridge Status
  // ============================================================
  const loadBridgeStatus = useCallback(async () => {
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
  }, []);

  // ============================================================
  // Orchestration
  // ============================================================
  const handleOrchestrateSubmit = useCallback(async (task: string) => {
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
        setOrchestrationEvents((prev) => [...prev, { type: "error", text: `Orchestration failed: ${errText}` }]);
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
                setOrchestrationEvents((prev) => [...prev, { type: event.type, text: event.text || "", sender: event.sender }]);
              } catch { /* ignore parse errors */ }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setOrchestrationEvents((prev) => [...prev, { type: "error", text: `Orchestration error: ${err.message}` }]);
      }
    } finally {
      setOrchestrating(false);
      orchestrationAbortRef.current = null;
    }
  }, [orchestrating, rootPath]);

  const handleStopOrchestration = useCallback(() => {
    orchestrationAbortRef.current?.abort();
    setOrchestrating(false);
  }, []);

  // ============================================================
  // Context / Attachments
  // ============================================================
  const handleToggleContext = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDraggingFile(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((file, idx) => {
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
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Terminal
  const handleAddNewSession = useCallback(() => {
    const newId = `term_${Date.now()}`;
    setSessions((prev) => [...prev, { id: newId, name: `bash-${prev.length + 1}`, logs: [], running: false, abortController: null, cwd: rootPath || "." }]);
    setActiveSessionId(newId);
  }, [rootPath]);

  const handleCloseSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      toast.warning("Must maintain at least one terminal session active.");
      return;
    }
    const session = sessions.find((s) => s.id === id);
    if (session?.abortController) session.abortController.abort();
    const nextSessions = sessions.filter((s) => s.id !== id);
    setSessions(nextSessions);
    if (activeSessionId === id) setActiveSessionId(nextSessions[0].id);
  }, [sessions, activeSessionId]);

  // Command Palette
  const handleSearchChange = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query?.trim?.()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await getJson<{ results: SearchResult[] }>(`/api/files/search?q=${encodeURIComponent(query)}&root=${encodeURIComponent(rootPath)}`);
      setSearchResults(data.results);
    } catch { /* ignore */ }
    finally { setSearching(false); }
  }, [rootPath]);

  const handleSelectSearchResult = useCallback(async (filePath: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    const name = filePath.split(/[/\\]/).pop() || "";
    await handleOpenFile({ name, path: filePath, relPath: "", isDir: false, size: 0, updatedAt: new Date().toISOString() });
  }, [handleOpenFile]);

  // Tool approval
  const handleApproveTool = useCallback(async (toolCallId: string, toolName: string, args: any) => {
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
        chat.addToolResult({
          toolCallId,
          state: "output-available" as const,
          output: typeof data.data === "string" ? data.data : JSON.stringify(data.data),
          tool: toolName,
        });
      } else {
        toast.error(`Tool execution failed: ${data.error}`);
        chat.addToolResult({
          toolCallId,
          state: "output-error" as const,
          errorText: `Failed to execute: ${data.error}`,
          tool: toolName,
        });
      }
    } catch (err: any) {
      toast.error(`Error approving tool: ${err.message}`);
      chat.addToolResult({
        toolCallId,
        state: "output-error" as const,
        errorText: `Error executing approved tool: ${err.message}`,
        tool: toolName,
      });
    } finally {
      setApprovingToolId(null);
    }
  }, [chat]);

  const handleDenyTool = useCallback((toolCallId: string, toolName: string = "unknown") => {
    toast.warning("Tool execution denied by user.");
    chat.addToolResult({
      toolCallId,
      state: "output-available" as const,
      output: "User denied execution of this tool.",
      tool: toolName,
    });
  }, [chat]);

  // ============================================================
  // Render Tree Nodes (File Explorer)
  // ============================================================
  const renderTreeNodes = useCallback((dirPath: string, depth = 0) => {
    const items = dirContents[dirPath] || [];

    const getFileIcon = (fileName: string) => {
      const ext = fileName.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'js':
        case 'jsx':
          return <FileCode className="w-3.5 h-3.5 text-yellow-500/90 flex-shrink-0" />;
        case 'ts':
        case 'tsx':
          return <FileCode className="w-3.5 h-3.5 text-sky-400/90 flex-shrink-0" />;
        case 'json':
          return <FileJson className="w-3.5 h-3.5 text-amber-500/90 flex-shrink-0" />;
        case 'html':
          return <Globe className="w-3.5 h-3.5 text-orange-500/90 flex-shrink-0" />;
        case 'css':
        case 'scss':
        case 'less':
          return <FileCode className="w-3.5 h-3.5 text-purple-400/90 flex-shrink-0" />;
        case 'md':
          return <FileText className="w-3.5 h-3.5 text-emerald-400/90 flex-shrink-0" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
          return <FileImage className="w-3.5 h-3.5 text-teal-400/90 flex-shrink-0" />;
        case 'sh':
        case 'bash':
        case 'bat':
        case 'cmd':
          return <Terminal className="w-3.5 h-3.5 text-stone-400/90 flex-shrink-0" />;
        default:
          return <FileText className="w-3.5 h-3.5 text-zinc-400/90 flex-shrink-0" />;
      }
    };

    return items.map((item) => {
      const isExpanded = expandedPaths.has(item.path);
      const isLoading = loadingPaths.has(item.path);
      const isContextSelected = contextPaths.has(item.path);
      const isOpenTab = openTabs.find((t) => t.path === item.path);
      const isDirty = isOpenTab?.dirty;

      return (
        <ContextMenu key={item.path}>
          <ContextMenuTrigger
            style={{ paddingLeft: `${depth * 8}px` }}
            className="select-none block"
          >
            <div
              draggable
              onDragStart={(e) => handleFileTreeDragStart(e, item.path)}
              onDragOver={(e) => handleFileTreeDragOver(e, item)}
              onDrop={(e) => handleFileTreeDrop(e, item.isDir ? item.path : dirPath)}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-800/60 cursor-pointer text-xs transition-colors group text-zinc-300 hover:text-white"
              onClick={() => (item.isDir ? handleToggleFolder(item.path) : handleOpenFile(item))}
            >
              {item.isDir ? (
                isLoading ? (
                  <span className="w-3.5 h-3.5 border border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <>
                    <span className="text-zinc-500 mr-0.5 group-hover:text-zinc-300 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </span>
                    {isExpanded ? (
                      <FolderOpen className="w-3.5 h-3.5 text-[#dcb45c] flex-shrink-0" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-[#dcb45c] flex-shrink-0" />
                    )}
                  </>
                )
              ) : (
                getFileIcon(item.name)
              )}
              <span className="truncate flex-1">{item.name}</span>
              {isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1 flex-shrink-0" title="Unsaved changes" />
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48 bg-[#18181c] border border-zinc-800 shadow-xl rounded-lg p-1 text-zinc-300">
            {item.isDir ? (
              <>
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-zinc-800 focus:text-white"
                  onClick={() => handleToggleFolder(item.path)}
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-zinc-800 my-0.5" />
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-zinc-800 focus:text-white"
                  onClick={() => handleCreateFile(item.path)}
                >
                  New File
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-zinc-800 focus:text-white"
                  onClick={() => handleCreateFolder(item.path)}
                >
                  New Folder
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-zinc-800 my-0.5" />
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-zinc-800 focus:text-white"
                  onClick={() => handleRenameItem(item.path, dirPath)}
                >
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-rose-950 focus:text-rose-200 text-rose-400"
                  onClick={() => handleDeleteItem(item.path, dirPath)}
                >
                  Delete
                </ContextMenuItem>
              </>
            ) : (
              <>
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-zinc-800 focus:text-white"
                  onClick={() => handleOpenFile(item)}
                >
                  Open
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-zinc-800 focus:text-white"
                  onClick={(e) => handleToggleContext(item.path, e as unknown as React.MouseEvent)}
                >
                  {isContextSelected ? "Remove from Context" : "Add to Context"}
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-zinc-800 my-0.5" />
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-zinc-800 focus:text-white"
                  onClick={() => handleRenameItem(item.path, dirPath)}
                >
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-xs cursor-pointer rounded px-3 py-1.5 focus:bg-rose-950 focus:text-rose-200 text-rose-400"
                  onClick={() => handleDeleteItem(item.path, dirPath)}
                >
                  Delete
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
          {item.isDir && isExpanded && (
            <div className="border-l border-zinc-800 ml-2.5 pl-1.5 my-0.5">
              {renderTreeNodes(item.path, depth + 1)}
            </div>
          )}
        </ContextMenu>
      );
    });
  }, [dirContents, expandedPaths, loadingPaths, contextPaths, openTabs, handleFileTreeDragStart, handleFileTreeDragOver, handleFileTreeDrop, handleToggleFolder, handleOpenFile, handleCreateFile, handleCreateFolder, handleRenameItem, handleDeleteItem, handleToggleContext]);

  // ============================================================
  // Context Value
  // ============================================================
  const value: WorkspaceContextType = {
    agents,
    selectedAgentId,
    setSelectedAgentId,
    rootPath,
    setRootPath,
    dirContents,
    expandedPaths,
    setExpandedPaths,
    loadingPaths,
    loadFolderTree,
    handleToggleFolder,
    handleOpenFolder,
    openTabs,
    setOpenTabs,
    activeTabPath,
    setActiveTabPath,
    activeTabPathRight,
    setActiveTabPathRight,
    splitActive,
    setSplitActive,
    focusedPane,
    setFocusedPane,
    editorOpen,
    setEditorOpen,
    handleOpenFile,
    handleCloseTab,
    handleSaveFile,
    handleEditorChange,
    handleEditorChangeRight,
    cursorPosition,
    setCursorPosition,
    sessions,
    activeSessionId,
    setActiveSessionId,
    terminalOpen,
    setTerminalOpen,
    handleAddNewSession,
    handleCloseSession,
    messages: chat.messages,
    sendMessage: chat.sendMessage,
    status: chat.status,
    stop: chat.stop,
    setMessages: chat.setMessages,
    addToolResult: chat.addToolResult,
    chatInput,
    setChatInput,
    isLoading,
    chats,
    currentChatId,
    chatHistoryLoading,
    loadChats,
    createNewChat,
    deleteChat,
    selectChat,
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
    searchOpen,
    setSearchOpen,
    searchQuery,
    searchResults,
    searching,
    handleSearchChange,
    handleSelectSearchResult,
    sidebarOpen,
    setSidebarOpen,
    renderTreeNodes,
    handleCreateFile,
    handleCreateFolder,
    handleRenameItem,
    handleDeleteItem,
    handleFileTreeDragStart,
    handleFileTreeDragOver,
    handleFileTreeDrop,
    approvingToolId,
    handleApproveTool,
    handleDenyTool,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
