export type QueuePriority = "high" | "normal" | "low"

export interface QueueItem {
  id: string
  executionId: string
  agentId: string
  priority: QueuePriority
  enqueuedAt: number
  command: string
  payload: unknown
}

export class RuntimeQueue {
  private items: QueueItem[] = []
  private maxSize: number
  private listeners: Set<(items: QueueItem[]) => void> = new Set()

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
  }

  enqueue(item: Omit<QueueItem, "enqueuedAt">, priority?: QueuePriority): boolean {
    if (this.items.length >= this.maxSize) {
      return false
    }

    const queueItem: QueueItem = {
      ...item,
      priority: priority ?? item.priority,
      enqueuedAt: Date.now(),
    }

    this.items.push(queueItem)
    this.items.sort(this.comparePriority)
    this.notify()
    return true
  }

  enqueueFront(item: Omit<QueueItem, "enqueuedAt">): boolean {
    const enqueued: QueueItem = {
      ...item,
      enqueuedAt: Date.now(),
    }
    this.items.unshift(enqueued)
    if (this.items.length > this.maxSize) {
      this.items = this.items.slice(0, this.maxSize)
    }
    this.notify()
    return true
  }

  dequeue(): QueueItem | null {
    const item = this.items.shift() ?? null
    if (item) {
      this.notify()
    }
    return item
  }

  peek(): QueueItem | null {
    return this.items[0] ?? null
  }

  remove(id: string): boolean {
    const index = this.items.findIndex((i) => i.id === id)
    if (index !== -1) {
      this.items.splice(index, 1)
      this.notify()
      return true
    }
    return false
  }

  clear(): void {
    this.items = []
    this.notify()
  }

  getItems(): readonly QueueItem[] {
    return this.items
  }

  getLength(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  isFull(): boolean {
    return this.items.length >= this.maxSize
  }

  getMaxSize(): number {
    return this.maxSize
  }

  setMaxSize(size: number): void {
    this.maxSize = size
    if (this.items.length > this.maxSize) {
      this.items = this.items.slice(0, this.maxSize)
      this.notify()
    }
  }

  subscribe(listener: (items: QueueItem[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  snapshot(): QueueItem[] {
    return [...this.items]
  }

  restore(items: QueueItem[]): void {
    this.items = [...items]
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener([...this.items])
      } catch {
        // listener error silently swallowed
      }
    }
  }

  private comparePriority(a: QueueItem, b: QueueItem): number {
    const order = { high: 0, normal: 1, low: 2 }
    const pa = order[a.priority] ?? 1
    const pb = order[b.priority] ?? 1
    if (pa !== pb) return pa - pb
    return a.enqueuedAt - b.enqueuedAt
  }
}
