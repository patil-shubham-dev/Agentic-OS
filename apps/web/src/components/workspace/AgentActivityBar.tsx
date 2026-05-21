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
  "Fast Inference": "text-amber-400",
  Vision: "text-emerald-400",
};

function getEventIcon(event: AgentEvent): { icon: React.ElementType; className: string } {
  switch (event.type) {
    case "status":
      return { icon: Loader2, className: "text-amber-500 animate-spin" };
    case "completed":
      return { icon: CheckCircle, className: "text-emerald-500" };
    case "error":
      return { icon: AlertCircle, className: "text-red-400" };
    case "agent_message":
      return { icon: Cpu, className: "text-purple-400" };
    default:
      return { icon: ChevronRight, className: "text-zinc-500" };
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
        "border-t border-zinc-800 bg-zinc-950/20 px-3 py-2 max-h-[160px] overflow-y-auto",
        className
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold text-zinc-450 uppercase tracking-wider flex items-center gap-1">
          <Cpu className="w-3 h-3 text-amber-500" />
          Agent Activity
          {active && (
            <span className="text-amber-500 font-normal normal-case text-[9px]">
              · Running
            </span>
          )}
        </span>
        {active && onStop && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onStop}
            className="h-5 text-[9px] text-red-400 hover:bg-red-950/45 rounded px-1.5"
          >
            <Square className="w-2.5 h-2.5 mr-1" /> Stop
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {events.map((event, idx) => {
          const { icon: Icon, className: iconClass } = getEventIcon(event);
          const RoleIcon = event.sender ? roleIcons[event.sender] : null;
          const senderColor = event.sender ? roleColors[event.sender] : "text-purple-400";

          return (
            <div
              key={idx}
              className="flex items-start gap-2 text-[10px] font-mono text-zinc-400"
            >
              {RoleIcon && event.type === "agent_message" ? (
                <RoleIcon className={cn("w-3 h-3 mt-0.5 shrink-0", senderColor)} />
              ) : (
                <Icon className={cn("w-3 h-3 mt-0.5 shrink-0", iconClass)} />
              )}
              <div className="flex-1 min-w-0">
                {event.sender && (
                  <span className={cn("font-bold", senderColor)}>
                    [{event.sender}]{' '}
                  </span>
                )}
                <span>{event.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
