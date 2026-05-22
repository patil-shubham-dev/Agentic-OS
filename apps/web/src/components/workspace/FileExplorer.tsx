"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, Plus, FolderPlus, Folder, Loader2, RefreshCw, FolderOpen,
  Minimize2, FileCode, FileJson, FileText, FileImage, Globe, Terminal,
  ChevronRight, ChevronDown, PanelLeft, PanelRight,
} from "lucide-react";
import { useWorkspace } from "./workspace-context";

const QuickSearchDialog = dynamic(
  () => import("./QuickSearchDialog").then((m) => ({ default: m.QuickSearchDialog })),
  { ssr: false }
);

export function FileExplorer() {
  const {
    rootPath,
    loadFolderTree,
    renderTreeNodes,
    handleCreateFile,
    handleCreateFolder,
    setSearchOpen,
    searchOpen,
    handleOpenFolder,
    setExpandedPaths,
    sidebarOpen,
    setSidebarOpen,
  } = useWorkspace();

  const handleCollapseAll = () => setExpandedPaths(new Set());
  const handleRefresh = () => { if (rootPath) loadFolderTree(rootPath); };

  return (
    <>
      <div className="h-full flex flex-col bg-[--bg-primary] border-r border-[--border-primary]">
        {/* Minimal header — compact, no uppercase tracking clutter */}
        <div className="flex items-center justify-between h-[32px] px-3 border-b border-[--border-primary]">
          <span className="text-[10px] font-semibold text-[--text-muted] select-none tracking-wide">
            Explorer
          </span>
          <div className="flex items-center gap-px">
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCollapseAll}
                    disabled={!rootPath}
                    className="h-5 w-5 flex items-center justify-center rounded text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated]/50 disabled:opacity-30 transition-colors"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[--bg-elevated] border border-[--border-primary] text-[--text-primary] text-[9px] px-2 py-1 rounded">
                  Collapse All
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRefresh}
                    disabled={!rootPath}
                    className="h-5 w-5 flex items-center justify-center rounded text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated]/50 disabled:opacity-30 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[--bg-elevated] border border-[--border-primary] text-[--text-primary] text-[9px] px-2 py-1 rounded">
                  Refresh
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="h-5 w-5 flex items-center justify-center rounded text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated]/50 transition-colors"
                  >
                    <Search className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[--bg-elevated] border border-[--border-primary] text-[--text-primary] text-[9px] px-2 py-1 rounded">
                  Quick Open (Ctrl+P)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleCreateFile(rootPath)}
                    disabled={!rootPath}
                    className="h-5 w-5 flex items-center justify-center rounded text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated]/50 disabled:opacity-30 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[--bg-elevated] border border-[--border-primary] text-[--text-primary] text-[9px] px-2 py-1 rounded">
                  New File
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleCreateFolder(rootPath)}
                    disabled={!rootPath}
                    className="h-5 w-5 flex items-center justify-center rounded text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-elevated]/50 disabled:opacity-30 transition-colors"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-[--bg-elevated] border border-[--border-primary] text-[--text-primary] text-[9px] px-2 py-1 rounded">
                  New Folder
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* File Tree / Empty State */}
        <ScrollArea className="flex-1">
          {rootPath ? (
            <div className="py-1">
              {/* Root folder indicator */}
              <div
                onClick={handleOpenFolder}
                className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-elevated]/30 cursor-pointer transition-colors border-b border-[--border-primary]/50 mx-2 mb-1"
              >
                <Folder className="w-3 h-3 text-[--accent-primary]/70" />
                <span className="truncate font-medium">
                  {rootPath.split(/[/\\]/).pop() || rootPath}
                </span>
              </div>
              <div className="select-none">
                {renderTreeNodes(rootPath)}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
              <div className="w-10 h-10 rounded-xl bg-[--bg-elevated]/30 border border-[--border-primary] flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-[--text-muted]" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-[--text-secondary]">No folder opened</p>
                <p className="text-[10px] text-[--text-muted] mt-1 max-w-[200px] leading-relaxed">
                  Open a folder to start exploring your project files.
                </p>
              </div>
              <button
                onClick={handleOpenFolder}
                className="text-[11px] font-semibold px-4 py-1.5 rounded-lg bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] transition-colors shadow-sm"
              >
                Open Folder
              </button>
            </div>
          )}
        </ScrollArea>
      </div>

      {searchOpen && <QuickSearchDialog />}
    </>
  );
}
