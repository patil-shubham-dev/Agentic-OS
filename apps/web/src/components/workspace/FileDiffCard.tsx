import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Loader2,
  FileCode,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
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

interface DiffLine {
  type: "equal" | "add" | "remove";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

function computeDiff(original: string, modified: string): DiffLine[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");

  // LCS-based diff for simple line-by-line comparison
  const m = origLines.length;
  const n = modLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = m, j = n;
  const temp: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      temp.push({ type: "equal", content: origLines[i - 1], oldLineNum: i, newLineNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: "add", content: modLines[j - 1], newLineNum: j });
      j--;
    } else {
      temp.push({ type: "remove", content: origLines[i - 1], oldLineNum: i });
      i--;
    }
  }

  // Group consecutive same-type lines into hunks
  for (let k = temp.length - 1; k >= 0; k--) {
    result.push(temp[k]);
  }

  return result;
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

  const diffLines = useMemo(() => {
    if (!originalContent || !newContent) return [];
    return computeDiff(originalContent, newContent);
  }, [originalContent, newContent]);

  const addCount = diffLines.filter((l) => l.type === "add").length;
  const removeCount = diffLines.filter((l) => l.type === "remove").length;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-2.5 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg text-[10px] font-mono",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {hasResult ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-[--accent-primary] animate-spin shrink-0" />
        )}
        <FileCode className="w-3.5 h-3.5 text-[--text-muted] shrink-0" />
        <span className="font-bold text-[--text-primary] truncate max-w-[160px]">{fileName}</span>
        <span className="text-[--text-disabled] truncate max-w-[100px] text-[9px]">{toolName}</span>
        {originalContent && newContent && (
          <span className="ml-auto text-[9px] text-[--text-disabled] shrink-0">
            <span className="text-emerald-400 font-medium">+{addCount}</span>{" "}
            <span className="text-rose-400 font-medium">-{removeCount}</span>
          </span>
        )}
      </div>

      {originalContent && newContent && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[9px] text-[--text-disabled] hover:text-[--text-secondary] transition-colors self-start"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {expanded ? "Hide diff" : "Show diff"}
        </button>
      )}

      {expanded && diffLines.length > 0 && (
        <div className="mt-1 bg-[--bg-primary] rounded-lg border border-[--border-primary] max-h-[300px] overflow-auto shadow-inner">
          <table className="w-full text-[10px] leading-[1.4] border-collapse">
            <tbody>
              {diffLines.map((line, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    "hover:bg-[--bg-glass] transition-colors",
                    line.type === "add" && "bg-emerald-950/20",
                    line.type === "remove" && "bg-rose-950/20",
                  )}
                >
                  <td className="w-8 text-right text-[--text-disabled] select-none px-1.5 py-0 border-r border-[--border-primary]">
                    {line.type === "remove" ? line.oldLineNum : ""}
                  </td>
                  <td className="w-8 text-right text-[--text-disabled] select-none px-1.5 py-0 border-r border-[--border-primary]">
                    {line.type === "add" ? line.newLineNum : ""}
                  </td>
                  <td className="w-4 text-center select-none px-1 py-0">
                    {line.type === "add" ? (
                      <Plus className="w-2.5 h-2.5 text-emerald-400 inline" />
                    ) : line.type === "remove" ? (
                      <Minus className="w-2.5 h-2.5 text-rose-400 inline" />
                    ) : (
                      <span className="text-[--text-disabled]">&nbsp;</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-0 whitespace-pre",
                      line.type === "add" && "text-emerald-300",
                      line.type === "remove" && "text-rose-300",
                      line.type === "equal" && "text-[--text-muted]",
                    )}
                  >
                    {line.content || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!hasResult && onReviewDiff && (
        <Button
          size="sm"
          className="w-full bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] mt-1 h-7 text-xs rounded-lg transition-all shadow-sm shadow-[--glow-primary]/20"
          onClick={() => onReviewDiff(args)}
        >
          Review Code Diff
        </Button>
      )}

      {!hasResult && toolName !== "suggestEdit" && (
        <div className="flex gap-2 mt-1">
          <Button
            size="sm"
            className="flex-1 bg-[--accent-primary] hover:bg-[--accent-hover] text-[--bg-primary] text-[9px] h-6 flex items-center justify-center gap-1 rounded-lg transition-all"
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
            className="flex-1 border-[--border-primary] bg-[--bg-elevated] hover:bg-[--bg-tertiary] text-[--text-secondary] text-[9px] h-6 flex items-center justify-center gap-1 rounded-lg transition-colors"
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
