import { PluginRegistry } from './PluginRegistry'
import type { RuntimePlugin } from './RuntimePlugin'

export type PluginLifecycleEvent = 'install' | 'activate' | 'deactivate' | 'uninstall' | 'upgrade'

export type LifecycleHook = (plugin: RuntimePlugin) => Promise<void>

export class PluginLifecycle {
  private registry: PluginRegistry
  private hooks: Map<PluginLifecycleEvent, LifecycleHook[]> = new Map()
  private installedPlugins: Set<string> = new Set()

  constructor(registry: PluginRegistry) {
    this.registry = registry
  }

  on(event: PluginLifecycleEvent, hook: LifecycleHook): void {
    const existing = this.hooks.get(event) ?? []
    existing.push(hook)
    this.hooks.set(event, existing)
  }

  async install(plugin: RuntimePlugin): Promise<void> {
    this.registry.register(plugin)
    this.installedPlugins.add(plugin.name)
    await plugin.onInstall?.()
    await this.runHooks('install', plugin)

    if (plugin.enabled) {
      await plugin.onActivate?.()
      await this.runHooks('activate', plugin)
    }
  }

  async uninstall(name: string): Promise<void> {
    const plugin = this.registry.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)

    if (this.registry.isEnabled(name)) {
      await plugin.onDeactivate?.()
      await this.runHooks('deactivate', plugin)
    }

    await plugin.onUninstall?.()
    await this.runHooks('uninstall', plugin)
    this.registry.unregister(name)
    this.installedPlugins.delete(name)
  }

  async activate(name: string): Promise<void> {
    const plugin = this.registry.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)
    this.registry.enable(name)
    await plugin.onActivate?.()
    await this.runHooks('activate', plugin)
  }

  async deactivate(name: string): Promise<void> {
    const plugin = this.registry.get(name)
    if (!plugin) throw new Error(`Plugin "${name}" not found`)
    this.registry.disable(name)
    await plugin.onDeactivate?.()
    await this.runHooks('deactivate', plugin)
  }

  async upgrade(name: string, newPlugin: RuntimePlugin): Promise<void> {
    const old = this.registry.get(name)
    if (old) {
      await this.uninstall(name)
    }
    newPlugin.name = name
    await this.install(newPlugin)
    await this.runHooks('upgrade', newPlugin)
  }

  isInstalled(name: string): boolean {
    return this.installedPlugins.has(name)
  }

  getInstalled(): string[] {
    return [...this.installedPlugins]
  }

  private async runHooks(event: PluginLifecycleEvent, plugin: RuntimePlugin): Promise<void> {
    const eventHooks = this.hooks.get(event) ?? []
    await Promise.allSettled(eventHooks.map(hook => hook(plugin).catch(err => {
      console.warn(`[PluginLifecycle] Hook error for ${event}:${plugin.name}:`, err)
    })))
  }
}
