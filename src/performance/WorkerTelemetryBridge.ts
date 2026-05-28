import { SharedBufferManager } from "./SharedBufferManager"
import { StreamBuffer } from "./StreamBuffer"

export interface WorkerTelemetryMessage {
  type: "chunk" | "flush" | "reset" | "metadata"
  payload: string
  timestamp: number
}

export class WorkerTelemetryBridge {
  private worker: Worker | null = null
  private buffer: StreamBuffer | null = null
  private bufferId: string
  private onData: ((text: string) => void) | null = null
  private flushTimer: ReturnType<typeof setInterval> | null = null

  constructor(bufferId?: string) {
    this.bufferId = bufferId ?? `telemetry_${Date.now()}`
  }

  initialize(): void {
    if (this.worker) return

    this.buffer = new StreamBuffer(this.bufferId)

    const workerCode = `
      const HEADER_BYTES = 8
      let writeIdx = 0
      let hdr = null
      let data = null

      function push(payload) {
        if (!data) return
        const enc = new TextEncoder().encode(payload)
        const target = new Uint8Array(data.buffer, data.byteOffset + writeIdx, enc.byteLength)
        target.set(enc)
        writeIdx += enc.byteLength
        Atomics.store(hdr, 1, writeIdx)
        Atomics.notify(hdr, 1, 1)
      }

      self.onmessage = function(e) {
        const msg = e.data
        if (msg.type === 'init') {
          hdr = new Uint32Array(msg.buffer, 0, 2)
          data = new Uint8Array(msg.buffer, HEADER_BYTES)
          return
        }
        if (msg.type === 'chunk') {
          push(msg.payload)
        }
        if (msg.type === 'flush') {
          push('__FLUSH__')
        }
        if (msg.type === 'reset') {
          writeIdx = 0
          if (hdr) {
            Atomics.store(hdr, 1, 0)
          }
        }
      }
    `

    const blob = new Blob([workerCode], { type: "application/javascript" })
    this.worker = new Worker(URL.createObjectURL(blob))

    const sab = SharedBufferManager.getInstance().get(this.bufferId)
    if (sab) {
      this.worker.postMessage({ type: "init", buffer: sab.buffer }, [sab.buffer])
    }

    this.flushTimer = setInterval(() => this.flush(), 100)
  }

  sendChunk(text: string): void {
    this.worker?.postMessage({ type: "chunk", payload: text })
  }

  flush(): void {
    if (!this.buffer) return
    const text = this.buffer.drain()
    if (text && this.onData) {
      this.onData(text)
    }
  }

  reset(): void {
    this.worker?.postMessage({ type: "reset" })
    this.buffer?.reset()
  }

  onTelemetry(handler: (text: string) => void): () => void {
    this.onData = handler
    return () => {
      this.onData = null
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.worker?.terminate()
    this.worker = null
    this.buffer = null
    this.onData = null
  }
}
