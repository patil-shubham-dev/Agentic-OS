const BUFFER_PAGE_SIZE = 65536

const HEADER_LEN = 8

export interface SharedBufferDescriptor {
  id: string
  buffer: SharedArrayBuffer
  byteLength: number
  header: Int32Array
  data: Uint8Array
}

export class SharedBufferManager {
  private buffers = new Map<string, SharedBufferDescriptor>()
  private static instance: SharedBufferManager

  static getInstance(): SharedBufferManager {
    if (!SharedBufferManager.instance) {
      SharedBufferManager.instance = new SharedBufferManager()
    }
    return SharedBufferManager.instance
  }

  create(id: string, byteLength: number = BUFFER_PAGE_SIZE): SharedBufferDescriptor {
    if (this.buffers.has(id)) {
      return this.buffers.get(id)!
    }
    const aligned = Math.ceil(byteLength / BUFFER_PAGE_SIZE) * BUFFER_PAGE_SIZE
    const buffer = new SharedArrayBuffer(aligned + HEADER_LEN)
    const desc: SharedBufferDescriptor = {
      id,
      buffer,
      byteLength: aligned,
      header: new Int32Array(buffer, 0, 2),
      data: new Uint8Array(buffer, HEADER_LEN, aligned),
    }
    this.buffers.set(id, desc)
    return desc
  }

  get(id: string): SharedBufferDescriptor | undefined {
    return this.buffers.get(id)
  }

  write(desc: SharedBufferDescriptor, offset: number, data: Uint8Array): number {
    const maxBytes = desc.data.byteLength - offset
    const bytesToWrite = Math.min(data.byteLength, maxBytes)
    const target = new Uint8Array(desc.data.buffer, desc.data.byteOffset + offset, bytesToWrite)
    target.set(data.subarray(0, bytesToWrite))
    Atomics.store(desc.header, 0, bytesToWrite)
    Atomics.notify(desc.header, 0, 1)
    return bytesToWrite
  }

  read(desc: SharedBufferDescriptor, offset: number, length: number): Uint8Array {
    const available = desc.data.byteLength - offset
    const bytesToRead = Math.min(length, available)
    const result = new Uint8Array(bytesToRead)
    const source = new Uint8Array(desc.data.buffer, desc.data.byteOffset + offset, bytesToRead)
    result.set(source)
    return result
  }

  readString(desc: SharedBufferDescriptor, offset: number, length: number): string {
    const bytes = this.read(desc, offset, length)
    return new TextDecoder().decode(bytes)
  }

  writeString(desc: SharedBufferDescriptor, offset: number, text: string): number {
    const encoded = new TextEncoder().encode(text)
    return this.write(desc, offset, encoded)
  }

  clear(): void {
    this.buffers.clear()
  }
}
