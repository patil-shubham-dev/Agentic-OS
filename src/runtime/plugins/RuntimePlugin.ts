import type { AgentTool } from '../tools/core/AgentTool'
import type { SkillDefinition } from '../skills/Skill'
import type { SectionDefinition } from '../prompting/registry/SectionDefinition'
import type { PreExecutionHook, PostExecutionHook } from '../tools/execution/ToolExecutionContext'
import type { MCPClientConfig } from '../mcp/MCPClient'
import type { ProviderCapabilities } from '../prompting/providers/ProviderCapabilities'

export type PluginCapability = 'tools' | 'skills' | 'prompt-sections' | 'hooks' | 'mcp-servers' | 'providers' | 'execution-policies' | 'runtime-agents'

export type RuntimePlugin = {
  name: string
  description: string
  version: string
  capabilities: PluginCapability[]
  enabled: boolean

  tools?: AgentTool[]
  skills?: SkillDefinition[]
  promptSections?: SectionDefinition[]
  preHooks?: PreExecutionHook[]
  postHooks?: PostExecutionHook[]
  mcpServers?: MCPClientConfig[]

  onActivate?: () => Promise<void>
  onDeactivate?: () => Promise<void>
  onInstall?: () => Promise<void>
  onUninstall?: () => Promise<void>
}

export type PluginManifest = {
  name: string
  description: string
  version: string
  author?: string
  capabilities: PluginCapability[]
  minRuntimeVersion?: string
}
