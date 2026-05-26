import { forwardRef, type HTMLAttributes, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"

interface CommandProps extends HTMLAttributes<HTMLDivElement> {}

const Command = forwardRef<HTMLDivElement, CommandProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl",
        className
      )}
      {...props}
    />
  )
)
Command.displayName = "Command"

interface CommandInputProps extends InputHTMLAttributes<HTMLInputElement> {}

const CommandInput = forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, ...props }, ref) => (
    <div className="flex items-center border-b border-white/5 px-4 py-3">
      <Search className="mr-3 h-4 w-4 shrink-0 text-white/40" />
      <input
        ref={ref}
        className={cn(
          "flex h-8 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30",
          className
        )}
        {...props}
      />
    </div>
  )
)
CommandInput.displayName = "CommandInput"

interface CommandListProps extends HTMLAttributes<HTMLDivElement> {}

const CommandList = forwardRef<HTMLDivElement, CommandListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("max-h-80 overflow-y-auto p-2", className)}
      {...props}
    />
  )
)
CommandList.displayName = "CommandList"

interface CommandGroupProps extends HTMLAttributes<HTMLDivElement> {
  heading?: string
}

const CommandGroup = forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, heading, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mb-2", className)}
      {...props}
    >
      {heading && (
        <div className="px-3 py-1.5 text-[10px] font-medium text-white/30 uppercase tracking-wider">
          {heading}
        </div>
      )}
      {children}
    </div>
  )
)
CommandGroup.displayName = "CommandGroup"

interface CommandItemProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean
}

const CommandItem = forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, selected, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white",
        selected && "bg-white/10 text-white",
        className
      )}
      {...props}
    />
  )
)
CommandItem.displayName = "CommandItem"

export { Command, CommandInput, CommandList, CommandGroup, CommandItem }
