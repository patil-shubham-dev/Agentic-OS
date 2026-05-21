"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Command } from "cmdk";
import { useWorkspace } from "./workspace-context";
import {
  Search,
  FileText,
  Loader2,
  Terminal,
  PanelLeft,
  PanelRight,
  Code2,
  GitBranch,
  TestTube,
  Save,
  Settings,
  Component,
  Layers,
  Zap,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
  shortcut?: string;
}

export function QuickSearchDialog() {
  const {
    searchOpen,
    setSearchOpen,
    searchQuery,
    searchResults,
    searching,
    handleSearchChange,
    handleSelectSearchResult,
    sidebarOpen,
    terminalOpen,
    setSidebarOpen,
    setTerminalOpen,
    handleSaveFile,
    setSplitActive,
    splitActive,
  } = useWorkspace();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const commandItems: CommandItem[] = [
    {
      id: "toggle-terminal",
      label: "Toggle Terminal",
      description: "Open or close the terminal panel",
      icon: <Terminal className="w-4 h-4" />,
      category: "View",
      shortcut: "Ctrl+J",
      action: () => { setTerminalOpen(!terminalOpen); setSearchOpen(false); },
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      description: "Show or hide the file explorer sidebar",
      icon: <PanelLeft className="w-4 h-4" />,
      category: "View",
      shortcut: "Ctrl+B",
      action: () => { setSidebarOpen(!sidebarOpen); setSearchOpen(false); },
    },
    {
      id: "toggle-split",
      label: "Toggle Split Editor",
      description: "Switch between single and split editor view",
      icon: <Layers className="w-4 h-4" />,
      category: "View",
      action: () => { setSplitActive(!splitActive); setSearchOpen(false); },
    },
    {
      id: "save-file",
      label: "Save File",
      description: "Save the currently active file",
      icon: <Save className="w-4 h-4" />,
      category: "File",
      shortcut: "Ctrl+S",
      action: () => { handleSaveFile(); setSearchOpen(false); },
    },
    {
      id: "open-file",
      label: "Quick Open File",
      description: "Search and open a file in the workspace",
      icon: <FileText className="w-4 h-4" />,
      category: "File",
      shortcut: "Ctrl+P",
      action: () => { setSearchOpen(false); },
    },
    {
      id: "search-code",
      label: "Search Codebase",
      description: "Search for text across all files",
      icon: <Search className="w-4 h-4" />,
      category: "File",
      shortcut: "Ctrl+Shift+P",
      action: () => { setSearchOpen(false); },
    },
    {
      id: "git-status",
      label: "Git Status",
      description: "View current git status and changes",
      icon: <GitBranch className="w-4 h-4" />,
      category: "Git",
      action: () => { setSearchOpen(false); window.dispatchEvent(new CustomEvent("command:git-status")); },
    },
    {
      id: "run-tests",
      label: "Run Tests",
      description: "Execute test suite for the current project",
      icon: <TestTube className="w-4 h-4" />,
      category: "Dev",
      action: () => { setSearchOpen(false); window.dispatchEvent(new CustomEvent("command:run-tests")); },
    },
    {
      id: "open-settings",
      label: "Open Settings",
      description: "Configure providers, roles, and security",
      icon: <Settings className="w-4 h-4" />,
      category: "Settings",
      action: () => { setSearchOpen(false); window.location.href = "/settings"; },
    },
  ];

  const filteredCommands = commandItems.filter((cmd) => {
    if (activeCategory !== "all" && cmd.category.toLowerCase() !== activeCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  const filteredFileResults = searchQuery
    ? searchResults.filter((res) => {
        const q = searchQuery.toLowerCase();
        return (
          res.name.toLowerCase().includes(q) ||
          res.relPath.toLowerCase().includes(q)
        );
      })
    : [];

  const showCommandsSection = !searchQuery || filteredCommands.length > 0;
  const showFilesSection = filteredFileResults.length > 0;

  const categories = ["all", ...new Set(commandItems.map((c) => c.category.toLowerCase()))];

  const handleSelect = useCallback((value: string) => {
    const cmd = commandItems.find((c) => c.id === value);
    if (cmd) {
      cmd.action();
    }
  }, [commandItems, setSearchOpen]);

  const handleFileSelect = useCallback((path: string) => {
    handleSelectSearchResult(path);
    setSearchOpen(false);
  }, [handleSelectSearchResult, setSearchOpen]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setSearchOpen(false)}
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="relative w-full max-w-[580px] bg-[#0f1117] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command Palette" shouldFilter={false}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <Command.Input
              ref={inputRef}
              value={searchQuery}
              onValueChange={handleSearchChange}
              placeholder="Search commands, files, settings..."
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 outline-none border-none"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800/50 px-1.5 font-mono text-[9px] text-zinc-500">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[350px] overflow-y-auto p-2">
            {searching && (
              <div className="flex items-center justify-center py-8 text-xs text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-zinc-500" />
                Searching...
              </div>
            )}

            {/* Category pills */}
            {searchQuery && categories.length > 1 && (
              <div className="flex gap-1.5 px-1 py-2 overflow-x-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 text-[10px] rounded-full border transition-colors ${
                      activeCategory === cat
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {cat === "all" ? "All" : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Commands section */}
            {showCommandsSection && (
              <Command.Group heading={
                <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider px-2 py-1.5">
                  Commands
                </div>
              }>
                {filteredCommands.length === 0 ? (
                  <div className="px-2 py-4 text-xs text-zinc-500 text-center">
                    No matching commands
                  </div>
                ) : (
                  filteredCommands.map((cmd) => (
                    <Command.Item
                      key={cmd.id}
                      value={cmd.id}
                      onSelect={() => handleSelect(cmd.id)}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 rounded-lg cursor-pointer aria-selected:bg-zinc-800/80 aria-selected:text-zinc-100 transition-colors group"
                    >
                      <span className="text-zinc-500 group-aria-selected:text-zinc-300 transition-colors">
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs truncate">{cmd.label}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{cmd.description}</div>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800/50 px-1.5 font-mono text-[9px] text-zinc-500 shrink-0">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))
                )}
              </Command.Group>
            )}

            {/* File results section */}
            {showFilesSection && (
              <Command.Group heading={
                <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider px-2 py-1.5">
                  Files
                </div>
              }>
                {filteredFileResults.map((res) => (
                  <Command.Item
                    key={res.path}
                    value={res.path}
                    onSelect={() => handleFileSelect(res.path)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 rounded-lg cursor-pointer aria-selected:bg-zinc-800/80 aria-selected:text-zinc-100 transition-colors group"
                  >
                    <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate">{res.name}</div>
                      <div className="text-[10px] text-zinc-500 truncate">{res.relPath}</div>
                    </div>
                    <span className="text-[9px] text-zinc-600 font-mono">{res.path.split(".").pop()}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Empty state */}
            {!searching && !showCommandsSection && !showFilesSection && searchQuery && (
              <div className="flex flex-col items-center py-10 text-zinc-500">
                <Search className="w-8 h-8 mb-2 opacity-30" />
                <div className="text-xs">No results for &ldquo;{searchQuery}&rdquo;</div>
                <div className="text-[10px] text-zinc-600 mt-1">Try a different search term</div>
              </div>
            )}
          </Command.List>

          <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
              <span><kbd className="text-zinc-400">↑↓</kbd> Navigate</span>
              <span><kbd className="text-zinc-400">↵</kbd> Open</span>
              <span><kbd className="text-zinc-400">Esc</kbd> Close</span>
            </div>
            <div className="text-[9px] text-zinc-600">
              {searchQuery ? `${filteredCommands.length + filteredFileResults.length} results` : `${commandItems.length} commands`}
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
