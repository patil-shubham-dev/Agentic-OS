import type { TaskDefinition, TaskState, TaskStatus, TaskType, TaskExecutionContext, TaskHandle } from './Task'
import { generateTaskId } from './TaskState'

export class TaskRuntime {
  private tasks: Map<string, TaskState> = new Map()
  private definitions: Map<TaskType, TaskDefinition> = new Map()
  private runningAbortControllers: Map<string, AbortController> = new Map()
  private completionCallbacks: Map<string, Array<(state: TaskState) => void>> = new Map()
  private errorCallbacks: Map<string, Array<(error: string) => void>> = new Map()
  private maxConcurrentTasks: number = 10

  register(def: TaskDefinition): void {
    this.definitions.set(def.type, def)
  }

  registerMany(defs: TaskDefinition[]): void {
    for (const def of defs) this.register(def)
  }

  unregister(type: TaskType): boolean {
    return this.definitions.delete(type)
  }

  async start(type: TaskType, description: string, options?: {
    priority?: TaskState['priority']
    parentTaskId?: string
    agentId?: string
    toolUseId?: string
    metadata?: Record<string, unknown>
  }): Promise<TaskHandle> {
    const def = this.definitions.get(type)
    if (!def) throw new Error(`No task definition registered for type: ${type}`)

    const id = generateTaskId(type)
    const abortController = new AbortController()

    const state: TaskState = {
      id,
      type,
      status: 'pending',
      description,
      priority: options?.priority ?? 'normal',
      parentTaskId: options?.parentTaskId,
      agentId: options?.agentId,
      toolUseId: options?.toolUseId,
      startTime: Date.now(),
      progress: 0,
      metadata: options?.metadata,
    }

    this.tasks.set(id, state)
    this.runningAbortControllers.set(id, abortController)

    const ctx: TaskExecutionContext = {
      signal: abortController.signal,
      setProgress: (progress: number) => {
        const s = this.tasks.get(id)
        if (s) s.progress = progress
      },
      setMetadata: (meta: Record<string, unknown>) => {
        const s = this.tasks.get(id)
        if (s) s.metadata = { ...s.metadata, ...meta }
      },
      appendLog: (msg: string) => {
        const s = this.tasks.get(id)
        if (s) s.metadata = { ...s.metadata, lastLog: msg }
      },
    }

    state.status = 'running'
    const handle: TaskHandle = {
      taskId: id,
      type,
      abort: () => this.cancel(id),
      onComplete: (cb) => {
        const callbacks = this.completionCallbacks.get(id) ?? []
        callbacks.push(cb)
        this.completionCallbacks.set(id, callbacks)
      },
      onError: (cb) => {
        const callbacks = this.errorCallbacks.get(id) ?? []
        callbacks.push(cb)
        this.errorCallbacks.set(id, callbacks)
      },
    }

    def.execute(state, ctx)
      .then((result) => {
        state.status = 'completed'
        state.endTime = Date.now()
        state.result = result
        state.progress = 100
        this.runningAbortControllers.delete(id)
        this.completionCallbacks.get(id)?.forEach(cb => cb(state))
      })
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err)
        state.status = 'failed'
        state.endTime = Date.now()
        state.error = errMsg
        this.runningAbortControllers.delete(id)
        this.errorCallbacks.get(id)?.forEach(cb => cb(errMsg))
      })

    return handle
  }

  cancel(id: string): boolean {
    const state = this.tasks.get(id)
    if (!state || state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') return false

    const ac = this.runningAbortControllers.get(id)
    if (ac) ac.abort()

    state.status = 'cancelled'
    state.endTime = Date.now()
    this.runningAbortControllers.delete(id)
    return true
  }

  get(id: string): TaskState | undefined {
    return this.tasks.get(id)
  }

  getAll(): TaskState[] {
    return [...this.tasks.values()]
  }

  getByStatus(status: TaskStatus): TaskState[] {
    return this.getAll().filter(t => t.status === status)
  }

  getByParent(parentTaskId: string): TaskState[] {
    return this.getAll().filter(t => t.parentTaskId === parentTaskId)
  }

  getRunning(): TaskState[] {
    return this.getByStatus('running')
  }

  getPending(): TaskState[] {
    return this.getByStatus('pending')
  }

  getActiveCount(): number {
    return this.getRunning().length + this.getPending().length
  }

  canAcceptMore(): boolean {
    return this.getActiveCount() < this.maxConcurrentTasks
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrentTasks = max
  }

  cleanup(): void {
    const terminal = this.getByStatus('completed').concat(
      this.getByStatus('failed'),
      this.getByStatus('cancelled'),
    )
    for (const t of terminal) {
      this.tasks.delete(t.id)
      this.completionCallbacks.delete(t.id)
      this.errorCallbacks.delete(t.id)
    }
  }

  clear(): void {
    this.tasks.clear()
    this.runningAbortControllers.clear()
    this.completionCallbacks.clear()
    this.errorCallbacks.clear()
  }
}
