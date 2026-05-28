export type ToolContext = {
  role: string
  executionMode?: string
  provider?: string
  model?: string
  signal?: AbortSignal
  env?: Record<string, string>
  cwd?: string
  traceId?: string
  messageHistory?: Array<{ role: string; content: string }>
  setProgress?: (msg: string) => void
  appendSystemMessage?: (msg: string) => void
}
