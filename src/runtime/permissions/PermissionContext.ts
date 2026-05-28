import type { PermissionMode, ToolPermissions } from '../tools/core/ToolPermissions'

export type PermissionContext = {
  mode: PermissionMode
  role: string
  workspacePath?: string
  workspaceTrusted: boolean
  permissions: ToolPermissions
}

export function createPermissionContext(overrides?: Partial<PermissionContext>): PermissionContext {
  return {
    mode: 'default',
    role: 'coder',
    workspaceTrusted: false,
    permissions: { mode: 'default', alwaysAllow: [], alwaysDeny: [], alwaysAsk: [] },
    ...overrides,
  }
}
