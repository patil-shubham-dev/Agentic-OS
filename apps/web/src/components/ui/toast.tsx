import { useToastStore, type ToastVariant } from "@/stores/toast-store"
import { cn } from "@/lib/utils"
import { X, CheckCircle2, Info, AlertTriangle } from "lucide-react"

const variantStyles: Record<ToastVariant, string> = {
  default: "bg-popover text-popover-foreground border",
  success: "bg-green-600 text-white border-green-700",
  error: "bg-destructive text-destructive-foreground border-destructive",
  info: "bg-primary text-primary-foreground border-primary",
}

const variantIcons: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = variantIcons[toast.variant]
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg animate-slide-up",
              variantStyles[toast.variant]
            )}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
