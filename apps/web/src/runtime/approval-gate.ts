import { create } from "zustand"

export interface PendingApproval {
  id: string
  command: string
  operationType?: "tool_execution" | "file_write" | "file_edit" | "command_run" | "browser_launch" | "design_create"
  toolName?: string
  args?: Record<string, unknown>
  resolve: (approved: boolean) => void
}

interface ApprovalStore {
  pending: PendingApproval | null
  alwaysAllow: boolean
  requestApproval: (opts: {
    command: string
    operationType?: PendingApproval["operationType"]
    toolName?: string
    args?: Record<string, unknown>
  }) => Promise<boolean>
  approve: () => void
  reject: () => void
  setAlwaysAllow: (value: boolean) => void
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  pending: null,
  alwaysAllow: false,
  requestApproval: (opts) => {
    // Auto-approve if alwaysAllow is set
    if (get().alwaysAllow) {
      return Promise.resolve(true)
    }

    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        set({ pending: null })
        resolve(false)
      }, 60_000)

      set({
        pending: {
          id: Date.now().toString(),
          command: opts.command,
          operationType: opts.operationType,
          toolName: opts.toolName,
          args: opts.args,
          resolve: (result: boolean) => {
            clearTimeout(timeoutId)
            resolve(result)
          }
        }
      })
    })
  },
  approve: () => {
    const { pending } = get()
    if (pending) {
      pending.resolve(true)
      set({ pending: null })
    }
  },
  reject: () => {
    const { pending } = get()
    if (pending) {
      pending.resolve(false)
      set({ pending: null })
    }
  },
  setAlwaysAllow: (value) => set({ alwaysAllow: value }),
}))

export async function requestCommandApproval(opts: {
  command: string
  operationType?: PendingApproval["operationType"]
  toolName?: string
  args?: Record<string, unknown>
}): Promise<boolean> {
  return useApprovalStore.getState().requestApproval(opts)
}
