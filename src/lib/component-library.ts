import type { ComponentDefinition } from "@/types"

export const componentLibrary: ComponentDefinition[] = [
  {
    name: "Button",
    description: "Trigger actions and events",
    category: "form",
    dependencies: ["@radix-ui/react-slot", "class-variance-authority"],
    code: `import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)`,
  },
  {
    name: "Card",
    description: "Container for content sections",
    category: "layout",
    dependencies: [],
    code: `import { cn } from "@/lib/utils"

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props}>
      {children}
    </div>
  )
}`,
  },
  {
    name: "Input",
    description: "Text input field",
    category: "form",
    dependencies: [],
    code: `import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
        className
      )}
      {...props}
    />
  )
)`,
  },
  {
    name: "Dialog",
    description: "Modal overlay for confirmations or forms",
    category: "overlay",
    dependencies: ["@radix-ui/react-dialog", "lucide-react"],
    code: `import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

export function Dialog({ children, open, onOpenChange }: any) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}`,
  },
  {
    name: "Tabs",
    description: "Tabbed content sections",
    category: "navigation",
    dependencies: ["@radix-ui/react-tabs"],
    code: `import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

export const Tabs = TabsPrimitive.Root
export const TabsList = ({ className, ...props }: any) => (
  <TabsPrimitive.List className={cn("inline-flex h-10 items-center rounded-md bg-muted p-1", className)} {...props} />
)
export const TabsTrigger = ({ className, ...props }: any) => (
  <TabsPrimitive.Trigger className={cn("inline-flex items-center rounded-sm px-3 py-1.5 text-sm font-medium", className)} {...props} />
)
export const TabsContent = TabsPrimitive.Content`,
  },
  {
    name: "Avatar",
    description: "User avatar with fallback",
    category: "data-display",
    dependencies: ["@radix-ui/react-avatar"],
    code: `import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib/utils"

export function Avatar({ className, src, fallback }: { className?: string; src?: string; fallback: string }) {
  return (
    <AvatarPrimitive.Root className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>
      <AvatarPrimitive.Image src={src} className="aspect-square h-full w-full" />
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center bg-muted text-sm font-medium">
        {fallback}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}`,
  },
  {
    name: "Badge",
    description: "Status or label indicator",
    category: "data-display",
    dependencies: [],
    code: `import { cn } from "@/lib/utils"

export function Badge({ className, children, variant = "default" }: {
  className?: string
  children: React.ReactNode
  variant?: "default" | "secondary" | "destructive" | "outline"
}) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
      variant === "default" && "bg-primary text-primary-foreground",
      variant === "secondary" && "bg-secondary text-secondary-foreground",
      variant === "destructive" && "bg-destructive text-destructive-foreground",
      variant === "outline" && "border text-foreground",
      className
    )}>
      {children}
    </span>
  )
}`,
  },
  {
    name: "Separator",
    description: "Visual divider between sections",
    category: "layout",
    dependencies: ["@radix-ui/react-separator"],
    code: `import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

export function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) {
  return (
    <SeparatorPrimitive.Root
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
    />
  )
}`,
  },
]
