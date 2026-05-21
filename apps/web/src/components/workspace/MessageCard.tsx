import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, Zap, Clock, Cpu, BrainCircuit, FileCode, Layers, BookOpen, Eye } from "lucide-react";

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
  className?: string;
}

const roleConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  user: { label: "USER", color: "bg-sky-400", icon: Zap },
  Manager: { label: "Manager", color: "bg-purple-400", icon: BrainCircuit },
  Coding: { label: "Coding", color: "bg-blue-400", icon: FileCode },
  Design: { label: "Design", color: "bg-pink-400", icon: Layers },
  Research: { label: "Research", color: "bg-cyan-400", icon: BookOpen },
  "Fast Inference": { label: "Fast", color: "bg-amber-400", icon: Zap },
  Vision: { label: "Vision", color: "bg-emerald-400", icon: Eye },
};

function getRoleConfig(role: string) {
  return roleConfig[role] || { label: role || "Agent", color: "bg-amber-500", icon: Cpu };
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
  className,
}: MessageCardProps) {
  const config = getRoleConfig(role);
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "px-4 py-3.5 border-b border-zinc-900/50",
        role === "user" ? "bg-[#141416]" : "bg-[#18181c]/40",
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400">
          <span className={cn("w-1.5 h-1.5 rounded-full", config.color)} />
          <Icon className="w-3 h-3" />
          {config.label}
          {modelUsed && (
            <span className="text-[9px] text-zinc-500 font-normal ml-1">
              via {modelUsed}
            </span>
          )}
        </span>
        {(tokensPerSecond || runtime) && (
          <span className="flex items-center gap-2 text-[9px] text-zinc-500">
            {tokensPerSecond && (
              <span className="flex items-center gap-0.5" title="Tokens/sec">
                <Zap className="w-2.5 h-2.5" />
                {tokensPerSecond}/s
              </span>
            )}
            {runtime && (
              <span className="flex items-center gap-0.5" title="Runtime">
                <Clock className="w-2.5 h-2.5" />
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

      <div className="text-xs leading-relaxed text-zinc-300">
        {renderMessageContent ? renderMessageContent({ id, role, content }) : content}
      </div>
    </div>
  );
}
