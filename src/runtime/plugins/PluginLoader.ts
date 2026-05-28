import { PluginRegistry } from './PluginRegistry'
import { PluginLifecycle } from './PluginLifecycle'
import type { RuntimePlugin, PluginManifest } from './RuntimePlugin'

export type PluginSource = 'builtin' | 'marketplace' | 'local' | 'remote'

export class PluginLoader {
  private registry: PluginRegistry
  private lifecycle: PluginLifecycle
  private loaded: Map<string, PluginSource> = new Map()

  constructor(registry: PluginRegistry, lifecycle: PluginLifecycle) {
    this.registry = registry
    this.lifecycle = lifecycle
  }

  async loadBuiltin(plugins: RuntimePlugin[]): Promise<void> {
    for (const plugin of plugins) {
      await this.lifecycle.install(plugin)
      this.loaded.set(plugin.name, 'builtin')
    }
  }

  async loadFromManifest(manifest: PluginManifest, factory: () => Promise<RuntimePlugin>): Promise<RuntimePlugin> {
    const plugin = await factory()
    await this.lifecycle.install(plugin)
    this.loaded.set(plugin.name, 'marketplace')
    return plugin
  }

  async loadFromUrl(url: string): Promise<RuntimePlugin | null> {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to load plugin: ${response.statusText}`)
      const plugin: RuntimePlugin = await response.json()
      await this.lifecycle.install(plugin)
      this.loaded.set(plugin.name, 'remote')
      return plugin
    } catch (err) {
      console.warn(`[PluginLoader] Failed to load plugin from ${url}:`, err)
      return null
    }
  }

  async unload(name: string): Promise<void> {
    await this.lifecycle.uninstall(name)
    this.loaded.delete(name)
  }

  reloadAll(): void {
    // Individual plugins would need to define reload logic
  }

  getSource(name: string): PluginSource | undefined {
    return this.loaded.get(name)
  }

  getLoaded(): Array<{ name: string; source: PluginSource }> {
    return [...this.loaded.entries()].map(([name, source]) => ({ name, source }))
  }
}
