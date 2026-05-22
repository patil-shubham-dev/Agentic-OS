"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  Plus,
  Minus,
  FileCode,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  Loader2,
  Check,
  X,
} from "lucide-react";

interface GitStatus {
  branch: string;
  changes: number;
  changesList: { status: string; file: string }[];
  log: { hash: string; message: string }[];
  ahead: number;
  behind: number;
  error?: string;
}

export function GitPanel({ className }: { className?: string }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/git/status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    setCommitResult(null);
    try {
      const res = await fetch("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMsg, stageAll: true }),
      });
      const data = await res.json();
      setCommitResult(data);
      if (data.success) {
        setCommitMsg("");
        fetchStatus();
      }
    } catch (err) {
      setCommitResult({ success: false, message: String(err) });
    } finally {
      setCommitting(false);
    }
  };

  const statusIcon = (code: string) => {
    if (code === "M" || code === "MM") return <FileCode className="w-3 h-3 text-[--accent-primary]" />;
    if (code === "??") return <Plus className="w-3 h-3 text-emerald-400" />;
    if (code === "D") return <Minus className="w-3 h-3 text-red-400" />;
    if (code.includes("R")) return <GitPullRequest className="w-3 h-3 text-blue-400" />;
    return <FileCode className="w-3 h-3 text-[--text-muted]" />;
  };

  if (loading && !status) {
    return (
      <div className={cn("flex items-center justify-center h-full text-xs text-[--text-muted]", className)}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading git status...
      </div>
    );
  }

  if (status?.error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full gap-2 p-4", className)}>
        <GitBranch className="w-8 h-8 text-[--text-disabled]" />
        <div className="text-xs text-[--text-muted] text-center">{status.error}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-[--bg-primary]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[--border-primary]">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[--text-secondary]" />
          <span className="text-xs font-mono font-bold text-[--text-primary]">{status?.branch || "unknown"}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[--text-muted]">
          {status && (
            <>
              <span className="flex items-center gap-0.5">
                <ArrowUp className="w-3 h-3" /> {status.ahead}
              </span>
              <span className="flex items-center gap-0.5">
                <ArrowDown className="w-3 h-3" /> {status.behind}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Changes */}
      <div className="flex-1 overflow-hidden">
        {status && status.changesList.length > 0 ? (
          <ScrollArea className="h-full">
            <div className="px-2 py-1 text-[9px] font-semibold text-[--text-muted] uppercase tracking-wider">
              Changes ({status.changesList.length})
            </div>
            {status.changesList.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-[--text-secondary] hover:bg-[--bg-elevated]/30 cursor-pointer transition-colors"
              >
                {statusIcon(c.status)}
                <span className="truncate">{c.file}</span>
                <span className="ml-auto text-[8px] text-[--text-disabled] uppercase">{c.status}</span>
              </div>
            ))}
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-xs text-[--text-disabled] gap-2">
            <Check className="w-6 h-6 text-emerald-500/50" />
            <span>Working tree clean</span>
          </div>
        )}
      </div>

      {/* Recent commits */}
      {status && status.log.length > 0 && (
        <div className="border-t border-[--border-primary]">
          <div className="px-2 py-1 text-[9px] font-semibold text-[--text-muted] uppercase tracking-wider">
            Recent Commits
          </div>
          <div className="max-h-[120px] overflow-y-auto">
            {status.log.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1 text-[10px] font-mono text-[--text-muted]"
              >
                <GitCommit className="w-3 h-3 text-[--text-disabled] shrink-0" />
                <span className="text-[--text-disabled] shrink-0">{c.hash.slice(0, 7)}</span>
                <span className="truncate">{c.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commit form */}
      <div className="p-2 border-t border-[--border-primary]">
        <div className="flex gap-1.5">
          <Input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Commit message..."
            className="h-7 text-[10px] bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] placeholder-[--text-disabled] flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCommit()}
          />
          <Button
            size="sm"
            onClick={handleCommit}
            disabled={committing || !commitMsg.trim()}
            className="h-7 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px]"
          >
            {committing ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitCommit className="w-3 h-3" />}
          </Button>
        </div>
        {commitResult && (
          <div className={cn(
            "mt-1 text-[9px]",
            commitResult.success ? "text-emerald-400" : "text-red-400"
          )}>
            {commitResult.message || (commitResult.success ? "Committed successfully" : "Commit failed")}
          </div>
        )}
      </div>
    </div>
  );
}
