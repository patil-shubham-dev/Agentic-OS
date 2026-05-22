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
  Layers,
  Save,
  Settings,
  GitBranch,
  TestTube,
  Sparkles,
  Command as CommandIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const commandItems: CommandItem[] = [
    {
      id: "toggle-terminal",
      label: "Toggle Terminal",
      description: "Open or close the terminal panel",
      icon: <Terminal className="w-3.5 h-3.5" />,
      category: "View",
      shortcut: "Ctrl+J",
      action: () => { setTerminalOpen(!terminalOpen); setSearchOpen(false); },
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      description: "Show or hide the file explorer sidebar",
      icon: <PanelLeft className="w-3.5 h-3.5" />,
      category: "View",
      shortcut: "Ctrl+B",
      action: () => { setSidebarOpen(!sidebarOpen); setSearchOpen(false); },
    },
    {
      id: "toggle-split",
      label: "Toggle Split Editor",
      description: "Switch between single and split editor view",
      icon: <Layers className="w-3.5 h-3.5" />,
      category: "View",
      action: () => { setSplitActive(!splitActive); setSearchOpen(false); },
    },
    {
      id: "save-file",
      label: "Save File",
      description: "Save the currently active file",
      icon: <Save className="w-3.5 h-3.5" />,
      category: "File",
      shortcut: "Ctrl+S",
      action: () => { handleSaveFile(); setSearchOpen(false); },
    },
    {
      id: "open-file",
      label: "Quick Open File",
      description: "Search and open a file in the workspace",
      icon: <FileText className="w-3.5 h-3.5" />,
      category: "File",
      shortcut: "Ctrl+P",
      action: () => { setSearchOpen(false); },
    },
    {
      id: "search-code",
      label: "Search Codebase",
      description: "Search for text across all files",
      icon: <Search className="w-3.5 h-3.5" />,
      category: "File",
      shortcut: "Ctrl+Shift+P",
      action: () => { setSearchOpen(false); },
    },
    {
      id: "git-status",
      label: "Git Status",
      description: "View current git status and changes",
      icon: <GitBranch className="w-3.5 h-3.5" />,
      category: "Git",
      action: () => { setSearchOpen(false); window.dispatchEvent(new CustomEvent("command:git-status")); },
    },
    {
      id: "run-tests",
      label: "Run Tests",
      description: "Execute test suite for the current project",
      icon: <TestTube className="w-3.5 h-3.5" />,
      category: "Dev",
      action: () => { setSearchOpen(false); window.dispatchEvent(new CustomEvent("command:run-tests")); },
    },
    {
      id: "open-settings",
      label: "Open Settings",
      description: "Configure providers, roles, and security",
      icon: <Settings className="w-3.5 h-3.5" />,
      category: "Settings",
      action: () => { setSearchOpen(false); window.location.href = "/settings"; },
    },
  ];

  const filteredCommands = commandItems.filter((cmd) => {
    if (activeCategory !== "all" && cmd.category.toLowerCase() !== activeCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q);
  });

  const filteredFileResults = searchQuery
    ? searchResults.filter((res) => {
        const q = searchQuery.toLowerCase();
        return res.name.toLowerCase().includes(q) || res.relPath.toLowerCase().includes(q);
      })
    : [];

  const categories = ["all", ...new Set(commandItems.map((c) => c.category.toLowerCase()))];

  const handleSelect = useCallback((value: string) => {
    const cmd = commandItems.find((c) => c.id === value);
    if (cmd) cmd.action();
  }, [commandItems, setSearchOpen]);

  const handleFileSelect = useCallback((path: string) => {
    handleSelectSearchResult(path);
    setSearchOpen(false);
  }, [handleSelectSearchResult, setSearchOpen]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      onClick={() => setSearchOpen(false)}
    >
      {/* Blurred backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />

      {/* Raycast-inspired overlay */}
      <div
        className="relative w-full max-w-[580px] bg-[--bg-primary] border border-[--border-primary] rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command Palette" shouldFilter={false} loop>
          {/* Search input — Raycast-style */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[--border-primary]">
            <Search className="w-4 h-4 text-[--text-muted] shrink-0" />
            <Command.Input
              ref={inputRef}
              value={searchQuery}
              onValueChange={handleSearchChange}
              placeholder="Search commands, files, settings..."
              className="flex-1 bg-transparent text-sm text-[--text-primary] placeholder:text-[--text-disabled] outline-none border-none"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-[--border-primary] bg-[--bg-elevated]/60 px-1.5 font-mono text-[9px] text-[--text-muted]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[320px] overflow-y-auto p-1.5">
            {searching && (
              <div className="flex items-center justify-center py-8 text-xs text-[--text-secondary]">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-[--accent-primary]" />
                Searching...
              </div>
            )}

            {/* Category filter chips */}
            {searchQuery && (
              <div className="flex gap-1.5 px-1 py-1.5 overflow-x-auto border-b border-[--border-primary]/50">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-2 py-0.5 text-[9px] font-medium rounded-full border transition-all",
                      activeCategory === cat
                        ? "bg-[--accent-primary]/15 text-[--accent-primary] border-[--accent-primary]/30"
                        : "bg-[--bg-tertiary] text-[--text-muted] border-[--border-primary] hover:text-[--text-secondary] hover:border-[--border-hover]"
                    )}
                  >
                    {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* Commands */}
            {filteredCommands.length > 0 && (
              <Command.Group heading={
                <div className="px-2 py-1.5 text-[9px] font-semibold text-[--text-disabled] uppercase tracking-[0.1em]">
                  Commands
                </div>
              }>
                {filteredCommands.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.id}
                    onSelect={() => handleSelect(cmd.id)}
                    className="flex items-center gap-3 px-3 py-2.5 text-[12px] text-[--text-primary] rounded-lg cursor-pointer aria-selected:bg-[--bg-elevated]/60 aria-selected:text-[--text-primary] transition-colors group"
                  >
                    <span className="text-[--text-muted] group-aria-selected:text-[--accent-primary] transition-colors shrink-0">
                      {cmd.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{cmd.label}</div>
                      <div className="text-[10px] text-[--text-muted] truncate">{cmd.description}</div>
                    </div>
                    {cmd.shortcut && (
                      <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-[--border-primary] bg-[--bg-elevated]/50 px-1.5 font-mono text-[9px] text-[--text-disabled] shrink-0">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* File results */}
            {filteredFileResults.length > 0 && (
              <Command.Group heading={
                <div className="px-2 py-1.5 text-[9px] font-semibold text-[--text-disabled] uppercase tracking-[0.1em]">
                  Files
                </div>
              }>
                {filteredFileResults.map((res) => (
                  <Command.Item
                    key={res.path}
                    value={res.path}
                    onSelect={() => handleFileSelect(res.path)}
                    className="flex items-center gap-3 px-3 py-2.5 text-[12px] text-[--text-primary] rounded-lg cursor-pointer aria-selected:bg-[--bg-elevated]/60 aria-selected:text-[--text-primary] transition-colors group"
                  >
                    <FileText className="w-3.5 h-3.5 text-[--text-muted] group-aria-selected:text-[--accent-primary] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{res.name}</div>
                      <div className="text-[10px] text-[--text-muted] truncate">{res.relPath}</div>
                    </div>
                    <span className="text-[9px] text-[--text-disabled] font-mono shrink-0">
                      .{res.path.split(".").pop()}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Empty state */}
            {!searching && searchQuery && filteredCommands.length === 0 && filteredFileResults.length === 0 && (
              <div className="flex flex-col items-center py-8 text-[--text-muted]">
                <Search className="w-6 h-6 mb-2 opacity-30" />
                <div className="text-xs">No results for &ldquo;{searchQuery}&rdquo;</div>
                <div className="text-[10px] text-[--text-disabled] mt-1">Try a different search term</div>
              </div>
            )}
          </Command.List>

          {/* Footer — Raycast-style key hints */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[--border-primary] bg-[--bg-secondary]/40">
            <div className="flex items-center gap-3 text-[10px] text-[--text-disabled]">
              <span className="flex items-center gap-1">
                <ArrowUp className="w-2.5 h-2.5" />
                <ArrowDown className="w-2.5 h-2.5" />
                <span className="ml-0.5">Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-[--bg-elevated]/60 rounded text-[9px] font-mono text-[--text-muted]">↵</kbd>
                <span>Open</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-[--bg-elevated]/60 rounded text-[9px] font-mono text-[--text-muted]">Esc</kbd>
                <span>Close</span>
              </span>
            </div>
            <div className="text-[9px] text-[--text-disabled]">
              {searchQuery ? `${filteredCommands.length + filteredFileResults.length} results` : `${commandItems.length} commands`}
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
