import type { RuntimePlugin } from './RuntimePlugin'

export class PluginRegistry {
  private plugins: Map<string, RuntimePlugin> = new Map()
  private enabled: Set<string> = new Set()

  register(plugin: RuntimePlugin): void {
    this.plugins.set(plugin.name, plugin)
    if (plugin.enabled) this.enabled.add(plugin.name)
  }

  unregister(name: string): boolean {
    this.enabled.delete(name)
    return this.plugins.delete(name)
  }

  get(name: string): RuntimePlugin | undefined {
    return this.plugins.get(name)
  }

  getAll(): RuntimePlugin[] {
    return [...this.plugins.values()]
  }

  getEnabled(): RuntimePlugin[] {
    return this.getAll().filter(p => this.enabled.has(p.name))
  }

  getDisabled(): RuntimePlugin[] {
    return this.getAll().filter(p => !this.enabled.has(p.name))
  }

  enable(name: string): boolean {
    const plugin = this.plugins.get(name)
    if (!plugin) return false
    this.enabled.add(name)
    plugin.enabled = true
    plugin.onActivate?.().catch(() => {})
    return true
  }

  disable(name: string): boolean {
    const plugin = this.plugins.get(name)
    if (!plugin) return false
    this.enabled.delete(name)
    plugin.enabled = false
    plugin.onDeactivate?.().catch(() => {})
    return true
  }

  isEnabled(name: string): boolean {
    return this.enabled.has(name)
  }

  getByCapability(capability: string): RuntimePlugin[] {
    return this.getEnabled().filter(p => p.capabilities.includes(capability as any))
  }

  getTools(): RuntimePlugin[] {
    return this.getByCapability('tools').filter(p => p.tools && p.tools.length > 0)
  }

  getSkills(): RuntimePlugin[] {
    return this.getByCapability('skills').filter(p => p.skills && p.skills.length > 0)
  }

  getPromptSections(): RuntimePlugin[] {
    return this.getByCapability('prompt-sections').filter(p => p.promptSections && p.promptSections.length > 0)
  }

  getMcpServers(): RuntimePlugin[] {
    return this.getByCapability('mcp-servers').filter(p => p.mcpServers && p.mcpServers.length > 0)
  }

  size(): number {
    return this.plugins.size
  }

  clear(): void {
    this.plugins.clear()
    this.enabled.clear()
  }
}
