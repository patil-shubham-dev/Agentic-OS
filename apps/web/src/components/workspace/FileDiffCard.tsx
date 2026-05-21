import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Loader2,
  FileCode,
  CheckCircle,
} from "lucide-react";

export interface FileDiffCardProps {
  filePath: string;
  originalContent?: string;
  newContent?: string;
  toolCallId: string;
  toolName?: string;
  state?: string;
  onApprove?: (toolCallId: string, toolName: string, args: any) => void;
  onDeny?: (toolCallId: string) => void;
  onReviewDiff?: (args: any) => void;
  approving?: boolean;
  className?: string;
}

export function FileDiffCard({
  filePath = "",
  originalContent,
  newContent,
  toolCallId,
  toolName = "suggestEdit",
  state = "call",
  onApprove,
  onDeny,
  onReviewDiff,
  approving = false,
  className,
}: FileDiffCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = state === "result" || state === "output-available" || state === "output-error";
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const args = { path: filePath, originalContent, newContent };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-2.5 bg-[#18181c] border border-zinc-800/80 rounded text-[10px] font-mono",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {hasResult ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
        )}
        <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span className="font-bold text-zinc-200 truncate max-w-[160px]">{fileName}</span>
        <span className="opacity-70 truncate max-w-[100px] text-[9px] text-zinc-400">{toolName}</span>
      </div>

      {expanded && newContent && (
        <div className="mt-1 p-2 bg-zinc-950 rounded border border-zinc-800 max-h-[200px] overflow-auto">
          <pre className="text-[9px] text-zinc-300 whitespace-pre-wrap">{newContent}</pre>
        </div>
      )}

      {originalContent && newContent && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors self-start"
        >
          {expanded ? "Hide diff" : "Show diff"}
        </button>
      )}

      {!hasResult && onReviewDiff && (
        <Button
          size="sm"
          className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 mt-1 h-7 text-xs rounded transition-colors"
          onClick={() => onReviewDiff(args)}
        >
          Review Code Diff
        </Button>
      )}

      {!hasResult && toolName !== "suggestEdit" && (
        <div className="flex gap-2 mt-1">
          <Button
            size="sm"
            className="flex-1 bg-[#dcb45c] hover:bg-amber-400 text-zinc-950 text-[9px] h-6 flex items-center justify-center gap-1 rounded transition-colors"
            disabled={approving}
            onClick={() => onApprove?.(toolCallId, toolName, args)}
          >
            {approving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-zinc-800 bg-[#1e1e24] hover:bg-zinc-800 text-zinc-300 text-[9px] h-6 flex items-center justify-center gap-1 rounded transition-colors"
            disabled={approving}
            onClick={() => onDeny?.(toolCallId)}
          >
            <X className="w-3 h-3" />
            Deny
          </Button>
        </div>
      )}
    </div>
  );
}
