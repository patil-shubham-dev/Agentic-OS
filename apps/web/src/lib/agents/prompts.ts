import { getSystemPromptForRole, getRoleByRuntimeRole, ALL_ROLES } from "@/runtime/runtime-role-registry"
import type { RuntimeRole } from "@/types"

export function getSystemPrompt(role: string): string {
  return getSystemPromptForRole(role)
}

export function getRoleLabel(role: RuntimeRole): string {
  const def = getRoleByRuntimeRole(role)
  return def ? `${def.name} Agent` : `${role} Agent`
}

export const agentRoles: { value: RuntimeRole; label: string; description: string }[] =
  ALL_ROLES.map((r) => ({
    value: r.runtimeRole,
    label: r.name,
    description: r.description,
  }))
