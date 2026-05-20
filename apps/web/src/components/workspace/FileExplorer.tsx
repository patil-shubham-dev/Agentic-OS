"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Plus, FolderPlus, Folder, Loader2 } from "lucide-react";
import { ListSkeleton } from "@/components/skeleton-loader";
import { useWorkspace } from "./workspace-context";

// Quick Search is lazily loaded to avoid bloating the initial bundle
const QuickSearchDialog = dynamic(
  () => import("./QuickSearchDialog").then((m) => ({ default: m.QuickSearchDialog })),
  { ssr: false }
);

export function FileExplorer() {
  const {
    rootPath,
    setRootPath,
    loadFolderTree,
    renderTreeNodes,
    handleCreateFile,
    handleCreateFolder,
    setSearchOpen,
    searchOpen,
  } = useWorkspace();

  return (
    <>
      <div className="h-full flex flex-col border-r border-amber-200/60 bg-amber-50/45">
        <div className="p-3 border-b border-amber-200/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
              File Explorer
            </span>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-amber-700 hover:bg-amber-100 rounded-lg"
                      onClick={() => setSearchOpen(true)}
                    >
                      <Search className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-none text-[10px]">
                    Quick Open (Ctrl+P)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-700 hover:bg-amber-100 rounded-lg"
                onClick={() => handleCreateFile(rootPath)}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-700 hover:bg-amber-100 rounded-lg"
                onClick={() => handleCreateFolder(rootPath)}
              >
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
          {rootPath ? (
            <div className="space-y-1">{renderTreeNodes(rootPath)}</div>
          ) : (
            <div className="p-4">
              <ListSkeleton count={6} />
            </div>
          )}
        </ScrollArea>
      </div>

      {searchOpen && <QuickSearchDialog />}
    </>
  );
}
