import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logCrash } from '../crash-handling'
import { EventBus } from '@/runtime/EventBus'
import { cancelPendingRefresh } from '@/runtime/runtime-coordinator'
import { useWorkspaceRuntime } from '@/runtime/workspace-runtime'

interface Props {
  children: ReactNode
  name: string
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class SafeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    logCrash({
      timestamp: new Date().toISOString(),
      type: 'renderer',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      metadata: { boundary: this.props.name },
    })

    console.error(`[SafeErrorBoundary:${this.props.name}]`, error.message)

    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    if (import.meta.env.DEV) {
      console.log(`[SafeErrorBoundary:${this.props.name}] Resetting — cleaning runtime state`)
    }
    cancelPendingRefresh()
    useWorkspaceRuntime.getState().reset()
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          padding: '24px',
          margin: '8px',
          background: '#1a1a1f',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          fontFamily: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ color: '#ef4444', fontSize: '18px' }}>!</span>
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '13px' }}>
              {this.props.name} crashed
            </span>
          </div>

          <div style={{
            background: '#0d0d10',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#e2e8f0',
            maxHeight: '120px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack?.split('\n').slice(0, 6).join('\n')}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '6px 16px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              Reload Panel
            </button>
            <button
              onClick={() => window.location.hash = '#/logs'}
              style={{
                padding: '6px 16px',
                background: 'transparent',
                color: '#888',
                border: '1px solid #555',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              Open Logs
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
