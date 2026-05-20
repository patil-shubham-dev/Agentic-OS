"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, FileText, Loader2 } from "lucide-react";
import { useWorkspace } from "./workspace-context";

export function QuickSearchDialog() {
  const {
    searchOpen,
    setSearchOpen,
    searchQuery,
    searchResults,
    searching,
    handleSearchChange,
    handleSelectSearchResult,
  } = useWorkspace();

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-w-2xl bg-white border border-amber-200 rounded-3xl shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-amber-950 flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-600" /> Quick Search Codebase
          </DialogTitle>
          <DialogDescription className="text-xs text-amber-600/70">
            Instantly search text matches or find files inside the workspace (Ctrl+P).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="relative">
            <Input
              autoFocus
              className="pl-9 border-amber-200 text-amber-950 bg-amber-50/10 rounded-xl"
              placeholder="Type your search query..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-amber-600/70" />
          </div>
          <ScrollArea className="max-h-[300px] border border-amber-100 rounded-2xl overflow-hidden bg-amber-50/5 p-2">
            {searching ? (
              <div className="flex items-center justify-center p-8 text-xs text-amber-750">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500 mr-2" />
                Scanning codebase...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-amber-600/60">
                {searchQuery
                  ? "No matching files or snippets found."
                  : "Type a query above to search files and code content."}
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((res) => (
                  <div
                    key={res.path}
                    onClick={() => handleSelectSearchResult(res.path)}
                    className="p-3 bg-white border border-amber-100 rounded-xl hover:border-amber-400 hover:shadow-sm cursor-pointer transition-all duration-150 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <span>{res.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-600/70">
                        {res.relPath}
                      </span>
                    </div>
                    <div className="pl-5 space-y-1">
                      {res.matches.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex gap-2 text-[10px] font-mono text-amber-800/80 leading-relaxed bg-amber-50/45 p-1 rounded"
                        >
                          <span className="text-amber-500 font-bold select-none w-6 text-right">
                            L{m.line}:
                          </span>
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
  );
}
