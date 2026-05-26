import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw, ShieldAlert, Bug, FileWarning } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info)
    this.setState({ errorInfo: info })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  handleSafeMode = () => {
    try {
      sessionStorage.setItem("opencode-safe-mode", "true")
      window.location.reload()
    } catch {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const isRouterError = this.state.error?.message?.toLowerCase().includes("router") ||
        this.state.error?.message?.toLowerCase().includes("usenavigate") ||
        this.state.error?.message?.toLowerCase().includes("browserrouter")

      return (
        <div className="flex h-full w-full items-center justify-center p-8 bg-background">
          <div className="flex max-w-md flex-col items-center gap-5 text-center">
            <div className="rounded-full bg-destructive/10 p-4">
              {isRouterError ? (
                <ShieldAlert className="h-8 w-8 text-destructive" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-destructive" />
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">
                {isRouterError ? "Navigation System Offline" : "Control Center Encountered an Issue"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isRouterError
                  ? "The application routing layer failed to initialize. This may be caused by an unstable workspace session."
                  : "A runtime error occurred while rendering this panel. The system has isolated the failure to prevent a full crash."
                }
              </p>
              {this.state.error?.message && (
                <div className="mt-3 rounded-lg bg-muted/50 border p-3 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                    <Bug className="h-3 w-3" />
                    Detected Issue
                  </div>
                  <code className="text-xs text-destructive break-all font-mono">
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={this.handleSafeMode}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Safe Mode
                </button>
                <button
                  onClick={() => {
                    try { sessionStorage.setItem("opencode-diagnostics", "true") } catch {}
                    window.location.reload()
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Bug className="h-3.5 w-3.5" />
                  Open Logs
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
              <FileWarning className="h-3 w-3" />
              <span>Workspace session preserved — no data lost</span>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}
