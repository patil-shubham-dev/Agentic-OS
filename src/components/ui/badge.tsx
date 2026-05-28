import { forwardRef, type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "purple"
  size?: "sm" | "md"
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "sm", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium ring-1 ring-inset",
          size === "sm" && "px-1.5 py-0.5 text-[10px]",
          size === "md" && "px-2.5 py-1 text-xs",
          variant === "default" && "bg-white/5 text-white/60 ring-white/10",
          variant === "success" && "bg-green-500/10 text-green-400 ring-green-500/20",
          variant === "warning" && "bg-amber-500/10 text-amber-400 ring-amber-500/20",
          variant === "error" && "bg-red-500/10 text-red-400 ring-red-500/20",
          variant === "info" && "bg-blue-500/10 text-blue-400 ring-blue-500/20",
          variant === "purple" && "bg-purple-500/10 text-purple-400 ring-purple-500/20",
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
