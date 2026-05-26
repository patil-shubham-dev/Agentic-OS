import { ProviderCapabilityRegistry, type ProviderRegistration } from "@/providers/ProviderCapabilityRegistry"
import { ProviderHealthMonitor, type HealthRecord } from "@/providers/ProviderHealthMonitor"
import { ProviderRegistry } from "@/runtime/ProviderRegistry"
import type { ProviderInstance } from "@/runtime/ProviderInstance"
import { ProviderInspector } from "./ProviderInspector"
import type { ProviderHealthCheck } from "./ObservabilityTypes"
import { getAllProviderHealth as getLibHealth } from "@/lib/provider-health"
import { getAllPresets } from "@/lib/provider-registry"
import type { ProviderPreset } from "@/lib/provider-registry"
import type { ModelInfo } from "@/providers/BaseProviderAdapter"
import type { RoleAssignment } from "@/runtime/ProviderInstance"
import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId } from "../telemetry/TraceTypes"

// ── Types ──

export interface CapabilityEntry {
  streaming: boolean
  toolCalls: boolean
  vision: boolean
  reasoning: boolean
  maxContext: number
  maxOutput: number
  supportsSystemMessages: boolean
  supportsFunctionCalling: boolean
}

export interface ProviderComparisonRow {
  id: string
  name: string
  type: "registered" | "preset" | "discovered" | "runtime"
  baseUrl: string
  isLocal: boolean
  isOpenAiCompatible: boolean
  healthy: boolean
  latencyMs: number
  models: string[]
  capabilities: CapabilityEntry | null
  health: HealthRecord | null
  lastChecked: number
  lastError: string | null
  samples: number
  failures: number
}

export interface ProviderCapabilityMatrix {
  label: string
  key: keyof CapabilityEntry
  providers: { id: string; supported: boolean; value?: string | number }[]
}

export interface FallbackChain {
  id: string
  name: string
  providerIds: string[]
  description: string
}

export interface RoutingDecision {
  id: string
  timestamp: number
  source: "auto_assign" | "manual" | "fallback" | "retry"
  role: string
  selectedProvider: string
  selectedModel: string
  reason: string
  previousProvider: string | null
  previousModel: string | null
  successful: boolean
}

export interface RoleCapabilityGap {
  role: string
  provider: string
  model: string
  gaps: string[]
  isCompatible: boolean
}

export interface UnifiedProviderSnapshot {
  providers: ProviderComparisonRow[]
  capabilityMatrix: ProviderCapabilityMatrix[]
  fallbackChains: FallbackChain[]
  routingDecisions: RoutingDecision[]
  roleGaps: RoleCapabilityGap[]
  summary: {
    totalProviders: number
    healthyCount: number
    unhealthyCount: number
    totalModels: number
    avgLatencyMs: number
    rolesCovered: number
    rolesUncovered: number
    fallbacksConfigured: number
    routingDecisions: number
  }
  timestamp: number
}

// ── Service ──

export class UnifiedProviderService {
  private static instance: UnifiedProviderService
  private pipeline = TracePipeline.getInstance()
  private capabilityRegistry = new ProviderCapabilityRegistry()
  private healthMonitor = new ProviderHealthMonitor()
  private runtimeRegistry = new ProviderRegistry()
  private inspector = ProviderInspector.getInstance()
  private decisions: RoutingDecision[] = []
  private maxDecisions = 500

  private constructor() {}

  static getInstance(): UnifiedProviderService {
    if (!UnifiedProviderService.instance) {
      UnifiedProviderService.instance = new UnifiedProviderService()
    }
    return UnifiedProviderService.instance
  }

  // ── Registration ──

  setCapabilityRegistry(registry: ProviderCapabilityRegistry): void {
    this.capabilityRegistry = registry
  }

  setRuntimeRegistry(registry: ProviderRegistry): void {
    this.runtimeRegistry = registry
  }

  // ── Decision Recording ──

  recordRoutingDecision(decision: Omit<RoutingDecision, "id" | "timestamp">): void {
    const entry: RoutingDecision = {
      ...decision,
      id: generateTraceId(),
      timestamp: Date.now(),
    }
    this.decisions.push(entry)
    if (this.decisions.length > this.maxDecisions) {
      this.decisions = this.decisions.slice(-this.maxDecisions / 2)
    }

    this.pipeline.emit({
      type: "routing_decision",
      traceId: entry.id,
      spanId: entry.id,
      parentSpanId: null,
      timestamp: entry.timestamp,
      priority: "normal",
      runtimePhase: "provider_connect",
      source: "unified-provider-service",
      payload: entry,
      metadata: {},
    })
  }

  // ── Snapshot Generation ──

  getSnapshot(): UnifiedProviderSnapshot {
    const presets = getAllPresets()
    const libHealth = getLibHealth()
    const runtimeInstances = this.runtimeRegistry.getAll()
    const allProviderHealth = this.inspector.getHealth() as Map<string, ProviderHealthCheck>

    // Build comparison rows
    const providerMap = new Map<string, ProviderComparisonRow>()

    // From capability registry
    const capProviders = this.capabilityRegistry.getAllProviders()
    for (const reg of capProviders) {
      const existing = providerMap.get(reg.id)
      if (!existing) {
        const health = this.healthMonitor.getHealth(reg.id)
        const models = reg.models.map((m) => m.id)
        const firstCap = reg.models[0]?.capabilities
        providerMap.set(reg.id, {
          id: reg.id,
          name: reg.name,
          type: "registered",
          baseUrl: "",
          isLocal: false,
          isOpenAiCompatible: true,
          healthy: health?.isHealthy ?? true,
          latencyMs: health?.avgLatencyMs ?? 0,
          models,
          capabilities: firstCap ? this.mapCapabilities(firstCap) : null,
          health: health ?? null,
          lastChecked: 0,
          lastError: health?.lastError ?? null,
          samples: health?.samples ?? 0,
          failures: health?.failures ?? 0,
        })
      }
    }

    // From presets
    for (const preset of presets) {
      const existing = providerMap.get(preset.id)
      const health = this.healthMonitor.getHealth(preset.id)
      const inspectorHealth = allProviderHealth.get(preset.id)
      if (!existing) {
        providerMap.set(preset.id, {
          id: preset.id,
          name: preset.name,
          type: "preset",
          baseUrl: preset.baseUrl,
          isLocal: preset.isLocal,
          isOpenAiCompatible: preset.isOpenAiCompatible,
          healthy: inspectorHealth?.healthy ?? health?.isHealthy ?? true,
          latencyMs: inspectorHealth?.latencyMs ?? health?.avgLatencyMs ?? 0,
          models: [],
          capabilities: null,
          health: health ?? null,
          lastChecked: inspectorHealth?.lastChecked ?? 0,
          lastError: inspectorHealth?.error ?? health?.lastError ?? null,
          samples: health?.samples ?? 0,
          failures: health?.failures ?? 0,
        })
      } else {
        // Update existing with baseUrl and health checks
        existing.baseUrl = preset.baseUrl
        existing.isLocal = preset.isLocal
        existing.isOpenAiCompatible = preset.isOpenAiCompatible
        const check = allProviderHealth.get(preset.id) as ProviderHealthCheck | undefined
        if (check) {
          existing.healthy = check.healthy
          existing.latencyMs = check.latencyMs
          existing.lastChecked = check.lastChecked
          existing.lastError = check.error ?? existing.lastError
        }
      }
    }

    // From runtime instances
    for (const inst of runtimeInstances) {
      const key = `${inst.providerType}-${inst.instanceId}`
      if (!providerMap.has(key)) {
        providerMap.set(key, {
          id: key,
          name: inst.displayName || inst.providerType,
          type: "runtime",
          baseUrl: "",
          isLocal: false,
          isOpenAiCompatible: true,
          healthy: inst.isConnected,
          latencyMs: inst.latencyMs,
          models: [inst.model],
          capabilities: this.mapModelCapabilities(inst.capabilities),
          health: null,
          lastChecked: inst.lastHealthCheck,
          lastError: null,
          samples: 0,
          failures: 0,
        })
      }
    }

    // From lib health (runtime-discovered providers)
    for (const [baseUrl, stats] of Object.entries(libHealth)) {
      const key = `lib-${baseUrl}`
      if (!providerMap.has(key)) {
        providerMap.set(key, {
          id: key,
          name: baseUrl.split("/")[2] ?? baseUrl,
          type: "discovered",
          baseUrl,
          isLocal: baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"),
          isOpenAiCompatible: true,
          healthy: stats.consecutiveTimeouts < 3,
          latencyMs: stats.lastFirstTokenMs,
          models: [],
          capabilities: null,
          health: null,
          lastChecked: stats.lastStreamingSuccess || stats.lastStreamingFailure,
          lastError: null,
          samples: stats.totalRequests,
          failures: stats.streamingFailures,
        })
      }
    }

    const providers = Array.from(providerMap.values())

    // Build capability matrix
    const capabilityMatrix = this.buildCapabilityMatrix(providers)

    // Build fallback chains
    const fallbackChains = this.buildFallbackChains(providers)

    // Build role capability gaps
    const roleGaps = this.buildRoleGaps(providers)

    // Compute summary
    const healthyCount = providers.filter((p) => p.healthy).length
    const unhealthyCount = providers.filter((p) => !p.healthy).length
    const allModels = new Set(providers.flatMap((p) => p.models))
    const avgLatency =
      providers.reduce((sum, p) => sum + p.latencyMs, 0) / (providers.length || 1)

    const allRoles = ["coordinator", "researcher", "coder", "verifier", "browser", "vision"] as const
    const assignedRoles = this.runtimeRegistry.getAllAssignments()
    const rolesCovered = assignedRoles.filter((a) => a.isValid).length

    return {
      providers,
      capabilityMatrix,
      fallbackChains,
      routingDecisions: [...this.decisions],
      roleGaps,
      summary: {
        totalProviders: providers.length,
        healthyCount,
        unhealthyCount,
        totalModels: allModels.size,
        avgLatencyMs: Math.round(avgLatency),
        rolesCovered,
        rolesUncovered: allRoles.length - rolesCovered,
        fallbacksConfigured: fallbackChains.length,
        routingDecisions: this.decisions.length,
      },
      timestamp: Date.now(),
    }
  }

  // ── Private Helpers ──

  private mapCapabilities(caps: { streaming: boolean; toolCalls: boolean; vision: boolean; reasoning: boolean; maxContextWindow: number; maxOutputTokens: number; supportsSystemMessages: boolean; supportsFunctionCalling: boolean }): CapabilityEntry {
    return {
      streaming: caps.streaming,
      toolCalls: caps.toolCalls,
      vision: caps.vision,
      reasoning: caps.reasoning,
      maxContext: caps.maxContextWindow,
      maxOutput: caps.maxOutputTokens,
      supportsSystemMessages: caps.supportsSystemMessages,
      supportsFunctionCalling: caps.supportsFunctionCalling,
    }
  }

  private mapModelCapabilities(caps: { supportsTools: boolean; supportsVision: boolean; supportsStreaming: boolean; supportsReasoning: boolean; maxContext: number; maxOutput: number }): CapabilityEntry {
    return {
      streaming: caps.supportsStreaming,
      toolCalls: caps.supportsTools,
      vision: caps.supportsVision,
      reasoning: caps.supportsReasoning,
      maxContext: caps.maxContext,
      maxOutput: caps.maxOutput,
      supportsSystemMessages: true,
      supportsFunctionCalling: caps.supportsTools,
    }
  }

  private buildCapabilityMatrix(providers: ProviderComparisonRow[]): ProviderCapabilityMatrix[] {
    const capabilities: { label: string; key: keyof CapabilityEntry }[] = [
      { label: "Streaming", key: "streaming" },
      { label: "Tool Calls", key: "toolCalls" },
      { label: "Vision", key: "vision" },
      { label: "Reasoning", key: "reasoning" },
      { label: "Sys Messages", key: "supportsSystemMessages" },
      { label: "Fn Calling", key: "supportsFunctionCalling" },
    ]

    return capabilities.map((cap) => ({
      label: cap.label,
      key: cap.key,
      providers: providers.map((p) => {
        const supported = p.capabilities?.[cap.key] ?? false
        const value = cap.key === "maxContext" || cap.key === "maxOutput"
          ? String(p.capabilities?.[cap.key] ?? "-")
          : undefined
        return { id: p.id, supported: supported === true, value }
      }),
    }))
  }

  private buildFallbackChains(providers: ProviderComparisonRow[]): FallbackChain[] {
    const healthy = providers.filter((p) => p.healthy)
    const unhealthy = providers.filter((p) => !p.healthy)

    // Group healthy providers by capability similarity
    const chains: FallbackChain[] = []

    // Default fallback chain: all healthy providers ordered by latency
    if (healthy.length > 0) {
      const ordered = [...healthy].sort((a, b) => a.latencyMs - b.latencyMs)
      chains.push({
        id: "default",
        name: "Default Fallback Chain",
        providerIds: ordered.map((p) => p.id),
        description: `Primary → Fallback chain (${ordered.length} providers, ordered by latency)`,
      })
    }

    // OpenAI-compatible fallback chain
    const oaiCompatible = healthy.filter((p) => p.isOpenAiCompatible)
    if (oaiCompatible.length > 1) {
      chains.push({
        id: "openai-compatible",
        name: "OpenAI-Compatible Chain",
        providerIds: oaiCompatible.map((p) => p.id),
        description: `OpenAI-compatible providers fallback chain (${oaiCompatible.length} providers)`,
      })
    }

    // Local provider fallback chain
    const localProviders = healthy.filter((p) => p.isLocal)
    if (localProviders.length > 1) {
      chains.push({
        id: "local",
        name: "Local Provider Chain",
        providerIds: localProviders.map((p) => p.id),
        description: `Local providers fallback chain (${localProviders.length} providers)`,
      })
    }

    // Unhealthy provider recovery chain
    if (unhealthy.length > 0 && healthy.length > 0) {
      chains.push({
        id: "recovery",
        name: "Recovery Fallback",
        providerIds: [...unhealthy.map((p) => p.id), ...healthy.map((p) => p.id)],
        description: `Unhealthy providers with healthy fallbacks (${unhealthy.length} unhealthy → ${healthy.length} healthy)`,
      })
    }

    return chains
  }

  private buildRoleGaps(providers: ProviderComparisonRow[]): RoleCapabilityGap[] {
    const assignments = this.runtimeRegistry.getAllAssignments()
    const allRoles = ["coordinator", "researcher", "coder", "verifier", "browser", "vision"] as const
    const gaps: RoleCapabilityGap[] = []

    for (const role of allRoles) {
      const assignment = assignments.find((a) => a.role === role)
      if (!assignment) {
        gaps.push({
          role,
          provider: "—",
          model: "—",
          gaps: ["No provider assigned"],
          isCompatible: false,
        })
        continue
      }

      const provider = providers.find((p) => p.id === assignment.providerInstanceId || p.models.includes(assignment.model))
      const gapList: string[] = []

      if (!assignment.isValid) {
        gapList.push(...assignment.validationErrors)
      }
      if (provider && !provider.healthy) {
        gapList.push(`Provider "${provider.name}" is unhealthy`)
      }

      gaps.push({
        role,
        provider: assignment.displayName || assignment.providerType,
        model: assignment.model,
        gaps: gapList.length > 0 ? gapList : ["All requirements met"],
        isCompatible: assignment.isValid && (!provider || provider.healthy),
      })
    }

    return gaps
  }

  // ── Maintenance ──

  clear(): void {
    this.decisions = []
  }
}
