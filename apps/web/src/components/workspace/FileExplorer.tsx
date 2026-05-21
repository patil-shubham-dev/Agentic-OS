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
  Search, Plus, FolderPlus, Folder, Loader2, RefreshCw, FolderOpen, Minimize2 
} from "lucide-react";
import { useWorkspace } from "./workspace-context";

// Quick Search is lazily loaded to avoid bloating the initial bundle
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
  } = useWorkspace();

  const handleCollapseAll = () => {
    setExpandedPaths(new Set());
  };

  const handleRefresh = () => {
    if (rootPath) {
      loadFolderTree(rootPath);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col border-r border-zinc-800 bg-[#141416]">
        {/* Header */}
        <div className="p-3 border-b border-zinc-800 flex flex-col gap-2 bg-[#18181c]/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider select-none">
              Explorer
            </span>
            <div className="flex items-center gap-0.5">
              <TooltipProvider delayDuration={400}>
                {/* Collapse All */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded"
                      onClick={handleCollapseAll}
                      disabled={!rootPath}
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border border-zinc-800 text-white text-[10px]">
                    Collapse All
                  </TooltipContent>
                </Tooltip>

                {/* Refresh */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded"
                      onClick={handleRefresh}
                      disabled={!rootPath}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border border-zinc-800 text-white text-[10px]">
                    Refresh Tree
                  </TooltipContent>
                </Tooltip>

                {/* Search */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded"
                      onClick={() => setSearchOpen(true)}
                    >
                      <Search className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border border-zinc-800 text-white text-[10px]">
                    Quick Open (Ctrl+P)
                  </TooltipContent>
                </Tooltip>

                {/* New File */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded"
                      onClick={() => handleCreateFile(rootPath)}
                      disabled={!rootPath}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border border-zinc-800 text-white text-[10px]">
                    New File
                  </TooltipContent>
                </Tooltip>

                {/* New Folder */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded"
                      onClick={() => handleCreateFolder(rootPath)}
                      disabled={!rootPath}
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-900 border border-zinc-800 text-white text-[10px]">
                    New Folder
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Root Folder Path Bar */}
          {rootPath && (
            <div 
              onClick={handleOpenFolder}
              className="flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-800 rounded-md px-2 py-1 cursor-pointer hover:bg-zinc-900 hover:border-zinc-700 transition-colors shadow-inner"
            >
              <Folder className="w-3.5 h-3.5 text-amber-500/90 flex-shrink-0" />
              <span className="text-[11px] font-medium text-zinc-300 truncate select-none flex-1">
                {rootPath.split(/[/\\]/).pop() || rootPath}
              </span>
              <span className="text-[9px] text-zinc-500 font-mono scale-90">Open</span>
            </div>
          )}
        </div>

        {/* File Tree / Empty State */}
        <ScrollArea className="flex-1 p-2">
          {rootPath ? (
            <div className="space-y-0.5 select-none">{renderTreeNodes(rootPath)}</div>
          ) : (
            <div className="h-[250px] flex flex-col items-center justify-center text-center p-4">
              <FolderOpen className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" />
              <p className="text-xs text-zinc-400 font-medium mb-3">No active project workspace</p>
              <Button
                onClick={handleOpenFolder}
                className="text-xs font-semibold px-4 py-1.5 h-8 bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-all rounded shadow-md"
              >
                Open Folder
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>

      {searchOpen && <QuickSearchDialog />}
    </>
  );
}
