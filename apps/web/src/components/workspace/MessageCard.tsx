import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, Cpu, BrainCircuit, FileCode, Layers, BookOpen, Eye } from "lucide-react";

export interface MessageCardProps {
  id: string;
  role: string;
  content: string;
  parts?: any[];
  renderMessageContent?: (msg: any) => React.ReactNode;
  renderToolInvocation?: (part: any) => React.ReactNode;
  tokensPerSecond?: number;
  runtime?: number;
  modelUsed?: string;
  createdAt?: string | Date;
  isStreaming?: boolean;
  className?: string;
}

// ── Relative timestamp ──
function formatRelativeTime(date: string | Date): string {
  const ts = typeof date === "string" ? Date.parse(date) : date.getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function RelativeTime({ date }: { date: string | Date }) {
  const [label, setLabel] = useState(() => formatRelativeTime(date));

  useEffect(() => {
    const update = () => setLabel(formatRelativeTime(date));
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [date]);

  return <>{label}</>;
}

// ── Blinking streaming cursor ──
const StreamingCursor = () => (
  <span className="inline-block w-[2px] h-[14px] bg-[--accent-primary] align-text-bottom ml-0.5 animate-pulse" />
);

const roleConfig: Record<string, { label: string; dotColor: string; borderAccent: string; icon: React.ElementType; bgGlow: string }> = {
  user: {
    label: "YOU",
    dotColor: "bg-[--accent-primary]",
    borderAccent: "border-[--border-secondary]/60",
    icon: Zap,
    bgGlow: "shadow-[inset_0_1px_0_var(--border-secondary)]",
  },
  Manager: {
    label: "Manager",
    dotColor: "bg-purple-400",
    borderAccent: "border-purple-500/20",
    icon: BrainCircuit,
    bgGlow: "shadow-[inset_0_1px_0_rgba(168,85,247,0.08)]",
  },
  Coding: {
    label: "Coding",
    dotColor: "bg-blue-400",
    borderAccent: "border-blue-500/20",
    icon: FileCode,
    bgGlow: "shadow-[inset_0_1px_0_rgba(59,130,246,0.08)]",
  },
  Design: {
    label: "Design",
    dotColor: "bg-pink-400",
    borderAccent: "border-pink-500/20",
    icon: Layers,
    bgGlow: "shadow-[inset_0_1px_0_rgba(236,72,153,0.08)]",
  },
  Research: {
    label: "Research",
    dotColor: "bg-cyan-400",
    borderAccent: "border-cyan-500/20",
    icon: BookOpen,
    bgGlow: "shadow-[inset_0_1px_0_rgba(34,211,238,0.08)]",
  },
  "Fast Inference": {
    label: "Fast",
    dotColor: "bg-amber-400",
    borderAccent: "border-amber-500/20",
    icon: Zap,
    bgGlow: "shadow-[inset_0_1px_0_var(--border-secondary)]",
  },
  Vision: {
    label: "Vision",
    dotColor: "bg-emerald-400",
    borderAccent: "border-emerald-500/20",
    icon: Eye,
    bgGlow: "shadow-[inset_0_1px_0_rgba(52,211,153,0.08)]",
  },
};

function getRoleConfig(role: string) {
  return roleConfig[role] || {
    label: role || "Agent",
    dotColor: "bg-[--accent-primary]",
    borderAccent: "border-[--border-secondary]/40",
    icon: Cpu,
    bgGlow: "shadow-[inset_0_1px_0_var(--border-secondary)]",
  };
}

export function MessageCard({
  id,
  role,
  content,
  parts,
  renderMessageContent,
  renderToolInvocation,
  tokensPerSecond,
  runtime,
  modelUsed,
  createdAt,
  isStreaming,
  className,
}: MessageCardProps) {
  const config = getRoleConfig(role);
  const Icon = config.icon;
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "px-4 py-3.5 border-b border-[--border-primary] transition-colors",
        isUser
          ? "bg-[--bg-primary]"
          : "bg-[--bg-secondary]/30",
        !isUser && config.bgGlow,
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-[--text-muted]">
          <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm", config.dotColor)} />
          <Icon className="w-3 h-3 text-[--text-secondary]" />
          <span className="text-[--text-secondary]">{config.label}</span>
          {createdAt && (
            <span className="text-[9px] font-normal text-[--text-disabled] ml-1.5" title={new Date(createdAt).toLocaleString()}>
              <RelativeTime date={createdAt} />
            </span>
          )}
          {modelUsed && (
            <Badge
              variant="outline"
              className="text-[9px] border-[--border-primary] bg-[--bg-tertiary] text-[--text-disabled] font-medium px-1.5 py-0 h-4 ml-0.5 rounded"
            >
              {modelUsed}
            </Badge>
          )}
        </span>
        {(tokensPerSecond || runtime) && (
          <span className="flex items-center gap-2 text-[9px] text-[--text-disabled]">
            {tokensPerSecond && (
              <span className="flex items-center gap-0.5" title="Tokens/sec">
                <Zap className="w-2.5 h-2.5 text-[--accent-primary]" />
                {tokensPerSecond}/s
              </span>
            )}
            {runtime && (
              <span className="flex items-center gap-0.5" title="Runtime">
                <Clock className="w-2.5 h-2.5 text-[--text-disabled]" />
                {(runtime / 1000).toFixed(1)}s
              </span>
            )}
          </span>
        )}
      </div>

      {parts && parts.length > 0 && renderToolInvocation && (
        <div className="mb-3 space-y-1.5">
          {parts.map((part: any) => (
            <div key={part.toolCallId}>{renderToolInvocation(part)}</div>
          ))}
        </div>
      )}

      <div className="text-xs leading-relaxed text-[--text-secondary]">
        {renderMessageContent ? renderMessageContent({ id, role, content }) : content}
        {isStreaming && <StreamingCursor />}
      </div>
    </div>
  );
}
