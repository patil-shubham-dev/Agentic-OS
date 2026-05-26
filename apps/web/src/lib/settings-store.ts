import { useAppStore } from "@/stores/app-store"
import { loadConfig, saveConfig, type ConfigData } from "./persistence"
import type { GatewayProvider, AgentRoleConfig, RoleMapping, LedgerEntry } from "@/types"

const LOG_PREFIX = "[SettingsStore]"

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args)
}

function warn(...args: unknown[]) {
  console.warn(LOG_PREFIX, "[WARN]", ...args)
}

function serialize(): string {
  const s = useAppStore.getState()
  const config: ConfigData = {
    version: 1,
    providers: s.providers as unknown as Record<string, unknown>[],
    roleConfigs: s.roleConfigs as unknown as Record<string, unknown>[],
    roleMappings: s.roleMappings as unknown as Record<string, unknown>[],
    ledger: s.ledger as unknown as Record<string, unknown>[],
  }
  return JSON.stringify(config, null, 2)
}

function deserialize(data: string) {
  const parsed = JSON.parse(data)
  const s = useAppStore.getState()

  if (parsed.providers) {
    for (const p of parsed.providers) {
      s.addProvider(p as GatewayProvider)
    }
  }
  if (parsed.roleConfigs) {
    for (const r of parsed.roleConfigs) {
      s.upsertRoleConfig(r as AgentRoleConfig)
    }
  }
  if (parsed.roleMappings) {
    for (const r of parsed.roleMappings) {
      s.setRoleMapping(r as RoleMapping)
    }
  }
  if (parsed.ledger) {
    for (const l of parsed.ledger) {
      s.addLedgerEntry(l as LedgerEntry)
    }
  }

  return parsed
}

export async function persistSettings() {
  try {
    const data = serialize()
    const parsed = JSON.parse(data) as ConfigData
    const saved = await saveConfig(parsed)
    if (!saved) {
      warn("Config save returned false, falling back to direct localStorage")
      localStorage.setItem("settings.json", data)
    }
  } catch (err) {
    console.error("[SettingsStore] Failed to persist settings:", err)
    try {
      const data = serialize()
      localStorage.setItem("settings.json", data)
    } catch {
      // ignore double-failure
    }
  }
}

export async function loadSettings() {
  try {
    const result = await loadConfig(true)

    if (result.migrated && result.migrationResult) {
      log(`Migration applied: ${result.migrationResult.log?.fromVersion} → ${result.migrationResult.log?.toVersion}`)
      for (const action of result.migrationResult.log?.actions || []) {
        log(`  ${action.type}: ${action.description}`)
      }
    }

    const raw = JSON.stringify(result.config)
    if (raw) {
      deserialize(raw)
      log(`Settings loaded: ${result.config.providers?.length || 0} providers, ${result.config.roleConfigs?.length || 0} roles`)
    }
  } catch (err) {
    console.error("[SettingsStore] Failed to load settings:", err)
  }
}
