import { ToolRegistry } from './tools/registry/ToolRegistry'
import { ToolResolver } from './tools/registry/ToolResolver'
import { ToolPoolAssembler } from './tools/registry/ToolPoolAssembler'
import { ToolExecutionPipeline } from './tools/execution/ToolExecutionPipeline'
import { ToolExecutionPolicy } from './tools/policies/ToolExecutionPolicy'
import { ToolConcurrencyPolicy } from './tools/policies/ToolConcurrencyPolicy'

import { MCPRegistry } from './mcp/MCPRegistry'
import { MCPServerManager } from './mcp/MCPServerManager'
import type { MCPClientConfig } from './mcp/MCPClient'

import { PermissionEngine } from './permissions/PermissionEngine'
import { PolicyResolver } from './permissions/PolicyResolver'
import { ApprovalManager } from './permissions/ApprovalManager'

import { SkillRegistry } from './skills/SkillRegistry'
import { SkillLoader } from './skills/SkillLoader'
import { SkillExecutor } from './skills/SkillExecutor'

import { TaskRuntime } from './tasks/TaskRuntime'
import { TaskScheduler } from './tasks/TaskScheduler'
import { TaskCancellation } from './tasks/TaskCancellation'

import { CoordinatorRuntime } from './coordinator/CoordinatorRuntime'
import { TaskDelegator } from './coordinator/TaskDelegator'
import { SharedTaskGraph } from './coordinator/SharedTaskGraph'

import { PluginRegistry } from './plugins/PluginRegistry'
import { PluginLifecycle } from './plugins/PluginLifecycle'
import { PluginLoader } from './plugins/PluginLoader'
import { registerBuiltinTools } from '@/lib/agents/agent-tools'
import { RuntimeCleanupManager } from "./RuntimeCleanupManager"

export class RuntimeOS {
  private static instance: RuntimeOS

  readonly toolRegistry: ToolRegistry
  readonly toolResolver: ToolResolver
  readonly toolPoolAssembler: ToolPoolAssembler
  readonly toolExecutionPipeline: ToolExecutionPipeline
  readonly toolExecutionPolicy: ToolExecutionPolicy
  readonly toolConcurrencyPolicy: ToolConcurrencyPolicy

  readonly mcpRegistry: MCPRegistry
  readonly mcpServerManager: MCPServerManager

  readonly permissionEngine: PermissionEngine
  readonly policyResolver: PolicyResolver
  readonly approvalManager: ApprovalManager

  readonly skillRegistry: SkillRegistry
  readonly skillLoader: SkillLoader
  readonly skillExecutor: SkillExecutor

  readonly taskRuntime: TaskRuntime
  readonly taskScheduler: TaskScheduler
  readonly taskCancellation: TaskCancellation

  readonly coordinator: CoordinatorRuntime
  readonly taskDelegator: TaskDelegator
  readonly sharedTaskGraph: SharedTaskGraph

  readonly pluginRegistry: PluginRegistry
  readonly pluginLifecycle: PluginLifecycle
  readonly pluginLoader: PluginLoader

  private unsubCleanup: (() => void) | null = null

  private constructor() {
    this.toolRegistry = new ToolRegistry()
    this.toolResolver = new ToolResolver(this.toolRegistry)
    this.toolPoolAssembler = new ToolPoolAssembler(this.toolRegistry)

    this.permissionEngine = new PermissionEngine()
    this.policyResolver = this.permissionEngine.getPolicyResolver()
    this.approvalManager = this.permissionEngine.getApprovalManager()

    this.toolExecutionPipeline = new ToolExecutionPipeline(this.toolRegistry, this.permissionEngine)
    this.toolExecutionPolicy = new ToolExecutionPolicy()
    this.toolConcurrencyPolicy = new ToolConcurrencyPolicy()

    this.mcpRegistry = new MCPRegistry()
    this.mcpServerManager = new MCPServerManager(this.mcpRegistry, this.toolRegistry)

    this.skillRegistry = new SkillRegistry()
    this.skillLoader = new SkillLoader(this.skillRegistry)
    this.skillExecutor = new SkillExecutor(this.skillRegistry)

    this.taskRuntime = new TaskRuntime()
    this.taskScheduler = new TaskScheduler(this.taskRuntime)
    this.taskCancellation = new TaskCancellation(this.taskRuntime)

    this.coordinator = new CoordinatorRuntime(this.taskRuntime, this.toolExecutionPipeline, this.permissionEngine)
    this.taskDelegator = new TaskDelegator(this.coordinator, this.taskRuntime)
    this.sharedTaskGraph = new SharedTaskGraph(this.taskRuntime)

    this.pluginRegistry = new PluginRegistry()
    this.pluginLifecycle = new PluginLifecycle(this.pluginRegistry)
    this.pluginLoader = new PluginLoader(this.pluginRegistry, this.pluginLifecycle)

    // Register with cleanup manager
    const cm = RuntimeCleanupManager.getInstance()
    this.unsubCleanup = cm.onShutdown("runtime-os", async () => {
      await this.shutdown()
    })
  }

  static getInstance(): RuntimeOS {
    if (!RuntimeOS.instance) {
      RuntimeOS.instance = new RuntimeOS()
    }
    return RuntimeOS.instance
  }

  static async destroy(): Promise<void> {
    if (RuntimeOS.instance) {
      await RuntimeOS.instance.shutdown()
      RuntimeOS.instance = null as unknown as RuntimeOS
    }
  }

  async initialize(mcpServers?: MCPClientConfig[]): Promise<void> {
    registerBuiltinTools()

    this.toolConcurrencyPolicy.setDefaultLimit(5)
    this.toolExecutionPolicy.setGlobalPolicy({
      maxConcurrent: 5,
      timeoutMs: 60_000,
      allowBackground: true,
    })

    if (mcpServers && mcpServers.length > 0) {
      for (const cfg of mcpServers) {
        this.mcpServerManager.addServer(cfg)
      }
      await this.mcpRegistry.connectAll()
      this.mcpServerManager.syncAllTools()
      this.mcpServerManager.startHealthChecks()
    }

    await this.loadBuiltinPlugins()
    this.registerCoordinatorWorkers()
  }

  private async loadBuiltinPlugins(): Promise<void> {
    // Built-in plugins would be loaded from the filesystem or bundled modules.
    // Currently the plugin system is ready for extensions but has no built-in plugins.
    // Plugins can be registered at any time via pluginRegistry.register().
  }

  private registerCoordinatorWorkers(): void {
    const roles = ['coder', 'design', 'vision', 'research', 'qa', 'browser', 'runtime']
    for (const role of roles) {
      this.coordinator.registerWorker(role, {
        role,
        allowedTools: [],
        isolatedMemory: false,
        executionMode: role === 'research' || role === 'vision' ? 'readonly' : 'default',
      })
    }
  }

  async shutdown(): Promise<void> {
    this.taskScheduler.stop()
    this.mcpServerManager.stopHealthChecks()
    await this.mcpRegistry.disconnectAll()
    this.taskCancellation.cancelAll('Runtime shutdown')
    this.taskRuntime.clear()
    this.toolConcurrencyPolicy.clear()
  }

  health(): {
    tools: { builtin: number; mcp: number; plugin: number; total: number }
    mcp: { servers: number; connected: number }
    skills: Record<string, number>
    tasks: { total: number; running: number; pending: number }
    plugins: { total: number; enabled: number }
    coordinator: { workers: number }
  } {
    const toolSizes = this.toolRegistry.size()
    const mcpClients = this.mcpRegistry.getAll()
    const skillSizes = this.skillRegistry.size()

    return {
      tools: {
        builtin: toolSizes.builtin,
        mcp: toolSizes.mcp,
        plugin: toolSizes.plugin,
        total: toolSizes.total,
      },
      mcp: {
        servers: mcpClients.length,
        connected: this.mcpRegistry.getConnected().length,
      },
      skills: {
        total: skillSizes.total,
        bundled: skillSizes.bundled,
        user: skillSizes.user,
        plugin: skillSizes.plugin,
        mcp: skillSizes.mcp,
      },
      tasks: {
        total: this.taskRuntime.getAll().length,
        running: this.taskRuntime.getRunning().length,
        pending: this.taskRuntime.getPending().length,
      },
      plugins: {
        total: this.pluginRegistry.size(),
        enabled: this.pluginRegistry.getEnabled().length,
      },
      coordinator: {
        workers: this.coordinator.getAllWorkers().length,
      },
    }
  }
}
