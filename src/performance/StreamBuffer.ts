import { SharedBufferManager, type SharedBufferDescriptor } from "./SharedBufferManager"

export class StreamBuffer {
  private desc: SharedBufferDescriptor
  private readIndex = 0
  private writeIndex = 0
  private capacity: number

  constructor(id: string, capacity: number = 65536) {
    this.capacity = capacity
    const mgr = SharedBufferManager.getInstance()
    this.desc = mgr.create(id, capacity)
    this.readIndex = Atomics.load(this.desc.header, 0)
    this.writeIndex = Atomics.load(this.desc.header, 1)
  }

  push(data: Uint8Array): number {
    const available = this.capacity - this.writeIndex
    const bytesToWrite = Math.min(data.byteLength, available)
    const target = new Uint8Array(this.desc.data.buffer, this.desc.data.byteOffset + this.writeIndex, bytesToWrite)
    target.set(data.subarray(0, bytesToWrite))
    this.writeIndex += bytesToWrite
    const hdr = this.desc.header
    Atomics.store(hdr, 1, this.writeIndex)
    Atomics.notify(hdr, 1, 1)
    return bytesToWrite
  }

  pushString(text: string): number {
    return this.push(new TextEncoder().encode(text))
  }

  read(size: number): Uint8Array | null {
    const available = this.writeIndex - this.readIndex
    if (available <= 0) return null
    const bytesToRead = Math.min(size, available)
    const result = new Uint8Array(bytesToRead)
    const source = new Uint8Array(this.desc.data.buffer, this.desc.data.byteOffset + this.readIndex, bytesToRead)
    result.set(source)
    this.readIndex += bytesToRead
    const hdr = this.desc.header
    Atomics.store(hdr, 0, this.readIndex)
    return result
  }

  readString(size: number): string | null {
    const bytes = this.read(size)
    return bytes ? new TextDecoder().decode(bytes) : null
  }

  drain(): string {
    const available = this.writeIndex - this.readIndex
    if (available <= 0) return ""
    const result = new Uint8Array(available)
    const source = new Uint8Array(this.desc.data.buffer, this.desc.data.byteOffset + this.readIndex, available)
    result.set(source)
    this.readIndex += available
    const hdr = this.desc.header
    Atomics.store(hdr, 0, this.readIndex)
    return new TextDecoder().decode(result)
  }

  getAvailable(): number {
    return this.writeIndex - this.readIndex
  }

  reset(): void {
    this.readIndex = 0
    this.writeIndex = 0
    const hdr = this.desc.header
    Atomics.store(hdr, 0, 0)
    Atomics.store(hdr, 1, 0)
  }
}

export function createWorkerStreamBuffer(): { buffer: StreamBuffer; worker: Worker } {
  const id = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const buffer = new StreamBuffer(id)

  const workerCode = `
    const HEADER_BYTES = 8
    let writeIdx = 0
    let sab = null
    let hdr = null
    let data = null

    self.onmessage = function(e) {
      const msg = e.data
      if (msg.type === 'init') {
        sab = msg.buffer
        hdr = new Uint32Array(sab, 0, 2)
        data = new Uint8Array(sab, HEADER_BYTES)
        return
      }
      if (msg.type === 'chunk') {
        if (!data) return
        const enc = new TextEncoder().encode(msg.payload)
        const target = new Uint8Array(data.buffer, data.byteOffset + writeIdx, enc.byteLength)
        target.set(enc)
        writeIdx += enc.byteLength
        Atomics.store(hdr, 1, writeIdx)
        Atomics.notify(hdr, 1, 1)
      }
    }
  `

  const blob = new Blob([workerCode], { type: "application/javascript" })
  const worker = new Worker(URL.createObjectURL(blob))

  worker.postMessage({ type: "init", buffer: buffer['desc'].buffer }, [buffer['desc'].buffer])

  return { buffer, worker }
}
