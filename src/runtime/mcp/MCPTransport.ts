export type MCPTransportType = 'stdio' | 'sse' | 'websocket' | 'http'

export type MCPTransportConfig = {
  type: MCPTransportType
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
  env?: Record<string, string>
}

export interface MCPTransport {
  type: MCPTransportType
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(message: unknown): Promise<void>
  onMessage(handler: (msg: unknown) => void): void
  onError(handler: (err: Error) => void): void
  onClose(handler: () => void): void
  isConnected(): boolean
}

export class StdioMCPTransport implements MCPTransport {
  readonly type: MCPTransportType = 'stdio'
  private config: MCPTransportConfig
  private connected = false

  constructor(config: MCPTransportConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async send(message: unknown): Promise<void> {
    if (!this.connected) throw new Error('Transport not connected')
  }

  onMessage(_handler: (msg: unknown) => void): void {}
  onError(_handler: (err: Error) => void): void {}
  onClose(_handler: () => void): void {}
  isConnected(): boolean { return this.connected }
}

export class SSEMCPTransport implements MCPTransport {
  readonly type: MCPTransportType = 'sse'
  private config: MCPTransportConfig
  private connected = false

  constructor(config: MCPTransportConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async send(message: unknown): Promise<void> {
    if (!this.connected) throw new Error('Transport not connected')
  }

  onMessage(_handler: (msg: unknown) => void): void {}
  onError(_handler: (err: Error) => void): void {}
  onClose(_handler: () => void): void {}
  isConnected(): boolean { return this.connected }
}

export class WebSocketMCPTransport implements MCPTransport {
  readonly type: MCPTransportType = 'websocket'
  private config: MCPTransportConfig
  private connected = false

  constructor(config: MCPTransportConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async send(message: unknown): Promise<void> {
    if (!this.connected) throw new Error('Transport not connected')
  }

  onMessage(_handler: (msg: unknown) => void): void {}
  onError(_handler: (err: Error) => void): void {}
  onClose(_handler: () => void): void {}
  isConnected(): boolean { return this.connected }
}

export class HTTPMCPTransport implements MCPTransport {
  readonly type: MCPTransportType = 'http'
  private config: MCPTransportConfig
  private connected = false

  constructor(config: MCPTransportConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async send(message: unknown): Promise<void> {
    if (!this.connected) throw new Error('Transport not connected')
  }

  onMessage(_handler: (msg: unknown) => void): void {}
  onError(_handler: (err: Error) => void): void {}
  onClose(_handler: () => void): void {}
  isConnected(): boolean { return this.connected }
}

export function createTransport(config: MCPTransportConfig): MCPTransport {
  switch (config.type) {
    case 'stdio': return new StdioMCPTransport(config)
    case 'sse': return new SSEMCPTransport(config)
    case 'websocket': return new WebSocketMCPTransport(config)
    case 'http': return new HTTPMCPTransport(config)
    default: throw new Error(`Unsupported MCP transport type: ${config.type}`)
  }
}
