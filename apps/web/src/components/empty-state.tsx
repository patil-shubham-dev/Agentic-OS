import { type LucideIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const Icon = icon ?? Sparkles;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-primary] bg-[--bg-tertiary]/40 text-center",
        compact ? "px-4 py-5" : "px-6 py-10",
        className
      )}
    >
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[--accent-primary]/10 border border-[--border-secondary] text-[--accent-primary]">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold text-[--text-primary]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-[10px] text-[--text-muted] leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
