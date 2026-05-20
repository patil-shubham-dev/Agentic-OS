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
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-200/80 bg-white/40 text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-amber-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-amber-700/70 leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
