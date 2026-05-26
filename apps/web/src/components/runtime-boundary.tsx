import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw, Bug, ServerCrash } from "lucide-react"
import { cn } from "@/lib/utils"
import { cancelPendingRefresh } from "@/runtime/runtime-coordinator"

interface RuntimeBoundaryProps {
  children: ReactNode
  name?: string
  fallback?: ReactNode
  onRecover?: () => void
}

interface RuntimeBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class RuntimeBoundary extends Component<RuntimeBoundaryProps, RuntimeBoundaryState> {
  constructor(props: RuntimeBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): RuntimeBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info })
  }

  handleRetry = () => {
    if (import.meta.env.DEV) {
      console.log(`[RuntimeBoundary:${this.props.name}] Retrying — cleaning runtime state`)
    }
    cancelPendingRefresh()
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onRecover?.()
  }

  handleSafeMode = () => {
    cancelPendingRefresh()
    try {
      sessionStorage.setItem("opencode-safe-mode", "true")
    } catch {}
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const name = this.props.name ?? "Runtime Panel"
      const isInitError = this.state.error?.message?.toLowerCase().includes("init")
        || this.state.error?.message?.toLowerCase().includes("initialize")
        || this.state.error?.message?.toLowerCase().includes("hydration")
      const isStateError = this.state.error?.message?.toLowerCase().includes("undefined")
        || this.state.error?.message?.toLowerCase().includes("cannot read")
        || this.state.error?.message?.toLowerCase().includes("null")

      return (
        <div className="flex h-full w-full items-center justify-center p-8 bg-background">
          <div className="flex max-w-sm flex-col items-center gap-5 text-center">
            <div className={cn(
              "rounded-full p-4",
              isInitError ? "bg-red-500/10" : isStateError ? "bg-amber-500/10" : "bg-muted",
            )}>
              <ServerCrash className={cn(
                "h-8 w-8",
                isInitError ? "text-red-500" : isStateError ? "text-amber-500" : "text-muted-foreground",
              )} />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold tracking-tight">
                {name} — Degraded
              </h2>
              <p className="text-sm text-muted-foreground">
                {isInitError
                  ? "Runtime initialisation failed. The system is running in safe mode."
                  : isStateError
                    ? "The runtime encountered an unexpected state. This is typically recoverable."
                    : "A runtime error occurred. The panel has been isolated to protect the application."}
              </p>
              {this.state.error?.message && (
                <div className="mt-2 rounded-lg bg-muted/50 border p-2.5 text-left">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mb-1">
                    <Bug className="h-2.5 w-2.5" />
                    Error Details
                  </div>
                  <code className="text-[11px] text-destructive break-all font-mono">
                    {this.state.error.message}
                  </code>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
              <button
                onClick={this.handleSafeMode}
                className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Restart in Safe Mode
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
