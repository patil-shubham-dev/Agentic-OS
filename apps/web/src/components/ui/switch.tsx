import { forwardRef, useCallback, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  size?: "sm" | "md"
  onCheckedChange?: (checked: boolean) => void
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, size = "md", onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e)
      onCheckedChange?.(e.target.checked)
    }, [onChange, onCheckedChange])

    return (
      <label className={cn("relative inline-flex cursor-pointer items-center", className)}>
        <input type="checkbox" className="peer sr-only" ref={ref} onChange={handleChange} {...props} />
        <div className={cn(
          "peer rounded-full bg-white/10 transition-all after:absolute after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          size === "md" && "h-5 w-9 after:left-0.5 after:top-0.5 after:h-4 after:w-4 peer-checked:after:translate-x-full",
          size === "sm" && "h-4 w-7 after:left-0.5 after:top-0.5 after:h-3 after:w-3 peer-checked:after:translate-x-full"
        )} />
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
