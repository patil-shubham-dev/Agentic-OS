import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Cpu,
  ChevronRight,
  Square,
  BrainCircuit,
  FileCode,
  Layers,
  BookOpen,
  Zap,
  Eye,
  Sparkles,
  Search,
  PenLine,
  Terminal,
  CheckCheck,
} from "lucide-react";

export interface AgentEvent {
  type: string;
  text: string;
  sender?: string;
  data?: unknown;
}

export interface AgentActivityBarProps {
  events: AgentEvent[];
  active: boolean;
  onStop?: () => void;
  className?: string;
}

// Pastel stage colors for timeline pills
const STAGE_PILLS: Record<string, { icon: typeof Sparkles; bg: string; text: string; border: string }> = {
  thinking: {
    icon: Sparkles,
    bg: "bg-amber-100/10",
    text: "text-amber-300",
    border: "border-amber-400/20",
  },
  planning: {
    icon: BrainCircuit,
    bg: "bg-purple-100/10",
    text: "text-purple-300",
    border: "border-purple-400/20",
  },
  reading: {
    icon: Search,
    bg: "bg-blue-100/10",
    text: "text-blue-300",
    border: "border-blue-400/20",
  },
  grepping: {
    icon: Search,
    bg: "bg-cyan-100/10",
    text: "text-cyan-300",
    border: "border-cyan-400/20",
  },
  editing: {
    icon: PenLine,
    bg: "bg-pink-100/10",
    text: "text-pink-300",
    border: "border-pink-400/20",
  },
  executing: {
    icon: Terminal,
    bg: "bg-emerald-100/10",
    text: "text-emerald-300",
    border: "border-emerald-400/20",
  },
  completed: {
    icon: CheckCheck,
    bg: "bg-emerald-100/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-rose-100/10",
    text: "text-rose-300",
    border: "border-rose-400/20",
  },
};

function getStageKey(event: AgentEvent): string {
  const type = event.type?.toLowerCase() || "";
  const text = event.text?.toLowerCase() || "";
  const sender = event.sender?.toLowerCase() || "";

  if (type === "error") return "error";
  if (type === "completed") return "completed";
  if (text.includes("think") || sender.includes("think")) return "thinking";
  if (type === "status" && (text.includes("plan") || sender.includes("manager") || sender.includes("plan"))) return "planning";
  if (text.includes("read") || text.includes("search") || text.includes("grep") || sender.includes("research")) return "reading";
  if (text.includes("edit") || text.includes("code") || text.includes("write") || sender.includes("code") || sender.includes("design")) return "editing";
  if (text.includes("exec") || text.includes("term") || text.includes("run") || text.includes("tool")) return "executing";
  return "planning";
}

const roleIcons: Record<string, React.ElementType> = {
  Manager: BrainCircuit,
  Coding: FileCode,
  Design: Layers,
  Research: BookOpen,
  "Fast Inference": Zap,
  Vision: Eye,
};

const roleColors: Record<string, string> = {
  Manager: "text-purple-400",
  Coding: "text-blue-400",
  Design: "text-pink-400",
  Research: "text-cyan-400",
  "Fast Inference": "text-[--accent-primary]",
  Vision: "text-emerald-400",
};

function getEventIcon(event: AgentEvent): { icon: React.ElementType; className: string } {
  switch (event.type) {
    case "status":
      return { icon: Loader2, className: "text-[--accent-primary] animate-spin" };
    case "completed":
      return { icon: CheckCircle, className: "text-[--status-success]" };
    case "error":
      return { icon: AlertCircle, className: "text-[--status-error]" };
    case "agent_message":
      return { icon: Cpu, className: "text-purple-400" };
    default:
      return { icon: ChevronRight, className: "text-[--text-disabled]" };
  }
}

export function AgentActivityBar({
  events,
  active,
  onStop,
  className,
}: AgentActivityBarProps) {
  if (events.length === 0) return null;

  return (
    <div
      className={cn(
        "border-t border-[--border-primary] bg-[--bg-secondary]/40 px-3 py-1.5 max-h-[120px] overflow-y-auto",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] font-bold text-[--text-muted] uppercase tracking-[0.12em] flex items-center gap-1">
          <Cpu className="w-2.5 h-2.5 text-[--accent-primary]" />
          Agent Activity
          {active && (
            <span className="text-[--accent-primary] font-normal normal-case text-[9px] flex items-center gap-0.5">
              <span className="w-1 h-1 rounded-full bg-[--accent-primary] animate-pulse" />
              Running
            </span>
          )}
        </span>
        {active && onStop && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onStop}
            className="h-5 text-[9px] text-rose-400 hover:bg-rose-500/10 rounded px-1.5"
          >
            <Square className="w-2 h-2 mr-1" />
            Stop
          </Button>
        )}
      </div>

      {/* Timeline pills — pastel stages */}
      <div className="flex flex-wrap gap-1.5">
        {events.slice(-8).map((event, idx) => {
          const stageKey = getStageKey(event);
          const pillStyle = STAGE_PILLS[stageKey] || STAGE_PILLS.planning;
          const PillIcon = pillStyle.icon;
          const RoleIcon = event.sender ? roleIcons[event.sender] : null;
          const senderColor = event.sender ? roleColors[event.sender] : "";

          return (
            <div
              key={idx}
              title={event.text}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-medium transition-all hover:opacity-80 max-w-[200px]",
                pillStyle.bg,
                pillStyle.text,
                pillStyle.border
              )}
            >
              {RoleIcon && event.type === "agent_message" ? (
                <RoleIcon className={cn("w-2.5 h-2.5 shrink-0", senderColor)} />
              ) : (
                <PillIcon className="w-2.5 h-2.5 shrink-0" />
              )}
              {event.sender && (
                <span className="font-semibold shrink-0 text-[9px]">{event.sender}</span>
              )}
              <span className="truncate">{event.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
