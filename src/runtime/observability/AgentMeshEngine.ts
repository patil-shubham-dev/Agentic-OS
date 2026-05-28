/**
 * AgentMeshEngine — Collaborative Agent Mesh (#17)
 *
 * A real-time agent-to-agent communication visualization engine.
 * Models agents as nodes in a mesh topology with animated message flows,
 * health metrics, throughput tracking, and channel-level diagnostics.
 */

import type { RuntimeRole } from "@/types"
import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId, generateSpanId } from "../telemetry/TraceTypes"

// ── Mesh Types ──

export type MeshNodeHealth = "healthy" | "degraded" | "unhealthy" | "idle"
export type MeshNodeActivity = "active" | "idle" | "blocked"

export interface MeshNode {
  id: string
  role: RuntimeRole
  name: string
  status: "idle" | "running" | "completed" | "failed"
  health: MeshNodeHealth
  activity: MeshNodeActivity
  messagesSent: number
  messagesReceived: number
  errors: number
  avgResponseTime: number
  lastActive: number
  throughput: number // msg/s
  taskCount: number
  position?: { x: number; y: number }
  color: string
}

export interface MeshChannel {
  id: string
  sourceId: string
  targetId: string
  messageCount: number
  avgLatency: number
  errorRate: number
  lastMessageAt: number
  throughput: number
  messages: MeshMessage[]
  active: boolean
}

export interface MeshMessage {
  id: string
  sourceId: string
  targetId: string
  type: "delegate" | "result" | "status_update" | "request_clarification" | "error_report" | "synthesize" | "heartbeat"
  content: string
  timestamp: number
  durationMs: number | null
  size: number
  status: "in_flight" | "delivered" | "failed"
  correlationId: string | null
}

export interface MeshParticle {
  id: string
  sourceId: string
  targetId: string
  progress: number // 0–1
  speed: number
  messageId: string
  messageType: MeshMessage["type"]
  timestamp: number
}

export interface MeshSnapshot {
  nodes: MeshNode[]
  channels: MeshChannel[]
  particles: MeshParticle[]
  stats: MeshStats
  timestamp: number
}

export interface MeshStats {
  totalNodes: number
  activeNodes: number
  totalChannels: number
  activeChannels: number
  totalMessagesRecorded: number
  messagesInFlight: number
  avgLatencyMs: number
  throughput: number
  errorCount: number
  errorRate: number
  uptime: number
}

export type MeshEventType =
  | "node_registered" | "node_status_changed" | "node_health_changed"
  | "message_sent" | "message_delivered" | "message_failed"
  | "channel_created" | "channel_closed"

export interface MeshEvent {
  id: string
  type: MeshEventType
  timestamp: number
  nodeId?: string
  channelId?: string
  messageId?: string
  details: string
}

// ── Role Configuration ──

interface RoleConfig {
  name: string
  color: string
  description: string
  position: { x: number; y: number }
}

const ROLE_CONFIGS: Record<RuntimeRole, RoleConfig> = {
  manager: { name: "Manager", color: "#6366f1", description: "Orchestrates and delegates tasks", position: { x: 50, y: 50 } },
  coder: { name: "Coder", color: "#22c55e", description: "Writes and modifies code", position: { x: 20, y: 20 } },
  vision: { name: "Vision", color: "#a855f7", description: "Processes visual assets and UI", position: { x: 80, y: 20 } },
  research: { name: "Research", color: "#f59e0b", description: "Gathers information and context", position: { x: 20, y: 80 } },
  runtime: { name: "Runtime", color: "#06b6d4", description: "Executes and manages runtime", position: { x: 80, y: 80 } },
  design: { name: "Design", color: "#ec4899", description: "Generates and refines designs", position: { x: 35, y: 5 } },
  qa: { name: "QA", color: "#14b8a6", description: "Validates and tests output", position: { x: 65, y: 5 } },
  browser: { name: "Browser", color: "#f97316", description: "Interacts with web pages", position: { x: 5, y: 50 } },
  memory: { name: "Memory", color: "#8b5cf6", description: "Manages context and recall", position: { x: 95, y: 50 } },
  "fast-inference": { name: "Fast Inference", color: "#ef4444", description: "Rapid response for simple tasks", position: { x: 50, y: 95 } },
}

// ── Demo message templates ──

const MESSAGE_TEMPLATES = [
  { type: "delegate" as const, content: "Analyze the codebase for refactoring opportunities" },
  { type: "delegate" as const, content: "Generate unit tests for the auth module" },
  { type: "delegate" as const, content: "Research best practices for React state management" },
  { type: "delegate" as const, content: "Create a responsive dashboard layout" },
  { type: "delegate" as const, content: "Run performance benchmarks on the render pipeline" },
  { type: "result" as const, content: "Found 3 optimization opportunities in the hot path" },
  { type: "result" as const, content: "All 42 tests pass — coverage at 87%" },
  { type: "result" as const, content: "Designed a new component library architecture" },
  { type: "result" as const, content: "Database queries optimized — 60% faster" },
  { type: "result" as const, content: "Memory usage reduced by 35% after compression" },
  { type: "status_update" as const, content: "Processing task #42 — 60% complete" },
  { type: "status_update" as const, content: "Waiting for dependency from Coder agent" },
  { type: "request_clarification" as const, content: "Should I use the new API or the legacy endpoint?" },
  { type: "request_clarification" as const, content: "What priority should this task have?" },
  { type: "synthesize" as const, content: "Combining results from all agents into a unified plan" },
  { type: "error_report" as const, content: "Rate limit exceeded — retrying with backoff" },
  { type: "error_report" as const, content: "Build failed: missing dependency in package.json" },
  { type: "heartbeat" as const, content: "Ping — agent operational" },
]

// ── Engine ──

export class AgentMeshEngine {
  private static instance: AgentMeshEngine
  private pipeline = TracePipeline.getInstance()
  private startedAt = Date.now()

  // Mesh state
  private nodes = new Map<string, MeshNode>()
  private channels = new Map<string, MeshChannel>()
  private particles: MeshParticle[] = []
  private events: MeshEvent[] = []
  private messageCounter = 0
  private particleCounter = 0

  // Demo simulation
  private simulationInterval: ReturnType<typeof setInterval> | null = null
  private seeded = false

  // Max limits
  private maxParticles = 60
  private maxEvents = 200
  private maxMessagesPerChannel = 100

  private constructor() {}

  static getInstance(): AgentMeshEngine {
    if (!AgentMeshEngine.instance) {
      AgentMeshEngine.instance = new AgentMeshEngine()
    }
    return AgentMeshEngine.instance
  }

  // ── Node Management ──

  registerNode(
    id: string,
    role: RuntimeRole,
    status: MeshNode["status"] = "idle",
  ): MeshNode {
    const config = ROLE_CONFIGS[role]
    const node: MeshNode = {
      id,
      role,
      name: config?.name ?? role,
      status,
      health: "healthy",
      activity: "idle",
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      avgResponseTime: 0,
      lastActive: Date.now(),
      throughput: 0,
      taskCount: 0,
      position: config?.position
        ? {
            x: config.position.x + (Math.random() - 0.5) * 8,
            y: config.position.y + (Math.random() - 0.5) * 8,
          }
        : { x: Math.random() * 90 + 5, y: Math.random() * 90 + 5 },
      color: config?.color ?? "#888888",
    }

    this.nodes.set(id, node)
    this.recordEvent("node_registered", id, `Agent '${node.name}' joined the mesh`)

    // Update position spread over time so subsequent registrations don't overlap
    setTimeout(() => {
      const existing = this.nodes.get(id)
      if (existing && existing.position) {
        existing.position.x += (Math.random() - 0.5) * 4
        existing.position.y += (Math.random() - 0.5) * 4
      }
    }, 100)

    return node
  }

  unregisterNode(id: string): void {
    this.nodes.delete(id)
    // Remove associated channels
    for (const [channelId, channel] of this.channels) {
      if (channel.sourceId === id || channel.targetId === id) {
        this.channels.delete(channelId)
      }
    }
    this.recordEvent("node_registered", id, `Agent left the mesh`)
  }

  updateNodeStatus(id: string, status: MeshNode["status"]): void {
    const node = this.nodes.get(id)
    if (!node) return
    node.status = status
    node.lastActive = Date.now()
    this.recordEvent("node_status_changed", id, `Status → ${status}`)
  }

  updateNodeHealth(id: string, health: MeshNodeHealth): void {
    const node = this.nodes.get(id)
    if (!node) return
    node.health = health
    this.recordEvent("node_health_changed", id, `Health → ${health}`)
  }

  // ── Channel Management ──

  private getOrCreateChannel(sourceId: string, targetId: string): MeshChannel {
    const channelId = `${sourceId}→${targetId}`
    const existing = this.channels.get(channelId)
    if (existing) return existing

    const channel: MeshChannel = {
      id: channelId,
      sourceId,
      targetId,
      messageCount: 0,
      avgLatency: 0,
      errorRate: 0,
      lastMessageAt: Date.now(),
      throughput: 0,
      messages: [],
      active: true,
    }

    this.channels.set(channelId, channel)
    this.recordEvent("channel_created", undefined, `Channel ${sourceId} ↔ ${targetId} opened`, channelId)
    return channel
  }

  // ── Message Passing ──

  sendMessage(
    sourceId: string,
    targetId: string,
    type: MeshMessage["type"],
    content: string,
    durationMs: number | null = null,
    correlationId: string | null = null,
  ): MeshMessage | null {
    const source = this.nodes.get(sourceId)
    const target = this.nodes.get(targetId)
    if (!source || !target) return null

    this.messageCounter++
    const message: MeshMessage = {
      id: `mesh_msg_${this.messageCounter}_${Date.now().toString(36)}`,
      sourceId,
      targetId,
      type,
      content,
      timestamp: Date.now(),
      durationMs,
      size: content.length * 2,
      status: "in_flight",
      correlationId,
    }

    // Add to channel
    const channel = this.getOrCreateChannel(sourceId, targetId)
    channel.messages.push(message)
    if (channel.messages.length > this.maxMessagesPerChannel) {
      channel.messages = channel.messages.slice(-this.maxMessagesPerChannel)
    }
    channel.messageCount++
    channel.lastMessageAt = Date.now()
    channel.active = true

    // Update source node stats
    source.messagesSent++
    source.lastActive = Date.now()
    source.activity = "active"

    // Spawn particle
    this.spawnParticle(message)

    this.recordEvent("message_sent", sourceId, `${type} → ${target.name}`, channel.id, message.id)

    // Simulate delivery
    const deliveryTime = (durationMs ?? Math.random() * 800 + 200)
    setTimeout(() => {
      this.deliverMessage(message)
    }, deliveryTime)

    return message
  }

  private deliverMessage(message: MeshMessage): void {
    message.status = Math.random() > 0.08 ? "delivered" : "failed"

    const target = this.nodes.get(message.targetId)
    if (target) {
      target.messagesReceived++
      target.lastActive = Date.now()
    }

    // Update channel metrics
    const channel = this.channels.get(`${message.sourceId}→${message.targetId}`)
    if (channel) {
      const delivered = channel.messages.filter((m) => m.status === "delivered").length
      const failed = channel.messages.filter((m) => m.status === "failed").length
      const total = delivered + failed
      channel.errorRate = total > 0 ? failed / total : 0

      // Calculate running average latency
      const completedMessages = channel.messages.filter((m) => m.status === "delivered" && m.durationMs !== null)
      if (completedMessages.length > 0) {
        channel.avgLatency =
          completedMessages.reduce((sum, m) => sum + (m.durationMs ?? 0), 0) / completedMessages.length
      }

      // Throughput (last 10s window)
      const recentWindow = 10000
      const recentMessages = channel.messages.filter(
        (m) => Date.now() - m.timestamp < recentWindow,
      )
      channel.throughput = recentMessages.length / (recentWindow / 1000)
    }

    // Update source node throughput
    const source = this.nodes.get(message.sourceId)
    if (source) {
      const recentWindow = 10000
      const recentFromSource = Array.from(this.channels.values())
        .flatMap((c) => c.messages)
        .filter((m) => m.sourceId === message.sourceId && Date.now() - m.timestamp < recentWindow)
      source.throughput = recentFromSource.length / (recentWindow / 1000)
    }

    if (message.status === "failed") {
      const sourceNode = this.nodes.get(message.sourceId)
      if (sourceNode) {
        sourceNode.errors++
        sourceNode.health = sourceNode.errors > 5 ? "degraded" : sourceNode.health
      }
      this.recordEvent("message_failed", message.sourceId, `Message failed: ${message.type}`, undefined, message.id)
    } else {
      this.recordEvent("message_delivered", message.targetId, `Delivered: ${message.type}`, undefined, message.id)
    }
  }

  // ── Particles ──

  private spawnParticle(message: MeshMessage): void {
    this.particleCounter++
    const particle: MeshParticle = {
      id: `particle_${this.particleCounter}`,
      sourceId: message.sourceId,
      targetId: message.targetId,
      progress: 0,
      speed: 0.01 + Math.random() * 0.02,
      messageId: message.id,
      messageType: message.type,
      timestamp: Date.now(),
    }

    this.particles.push(particle)
    if (this.particles.length > this.maxParticles) {
      this.particles = this.particles.slice(-this.maxParticles)
    }
  }

  tickParticles(): void {
    // Advance all particles
    for (const particle of this.particles) {
      particle.progress += particle.speed
    }

    // Remove completed particles (but keep them for one frame so they render at the target)
    this.particles = this.particles.filter((p) => p.progress < 1.05)

    // Remove particles whose messages were delivered/failed (they've reached their destination)
    const inFlightMessageIds = new Set(
      Array.from(this.channels.values())
        .flatMap((c) => c.messages.filter((m) => m.status === "in_flight").map((m) => m.id)),
    )
    this.particles = this.particles.filter((p) => inFlightMessageIds.has(p.messageId) || p.progress < 0.3)
  }

  // ── Events ──

  private recordEvent(
    type: MeshEventType,
    nodeId?: string,
    details = "",
    channelId?: string,
    messageId?: string,
  ): void {
    const event: MeshEvent = {
      id: `mesh_evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      type,
      timestamp: Date.now(),
      nodeId,
      channelId,
      messageId,
      details,
    }
    this.events.push(event)
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }
  }

  // ── Statistics ──

  private computeStats(): MeshStats {
    const allNodes = this.getAllNodes()
    const activeNodes = allNodes.filter((n) => n.status === "running")
    const allChannels = this.getAllChannels()
    const activeChannels = allChannels.filter((c) => c.active)
    const allMessages = allChannels.flatMap((c) => c.messages)

    const totalLatency = allMessages
      .filter((m) => m.durationMs !== null)
      .reduce((sum, m) => sum + (m.durationMs ?? 0), 0)
    const latencyCount = allMessages.filter((m) => m.durationMs !== null).length

    const recentWindow = 10000
    const recentMessages = allMessages.filter((m) => Date.now() - m.timestamp < recentWindow)
    const errors = allMessages.filter((m) => m.status === "failed")

    return {
      totalNodes: allNodes.length,
      activeNodes: activeNodes.length,
      totalChannels: allChannels.length,
      activeChannels: activeChannels.length,
      totalMessagesRecorded: allMessages.length,
      messagesInFlight: allMessages.filter((m) => m.status === "in_flight").length,
      avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
      throughput: recentMessages.length / (recentWindow / 1000),
      errorCount: errors.length,
      errorRate: allMessages.length > 0 ? errors.length / allMessages.length : 0,
      uptime: Date.now() - this.startedAt,
    }
  }

  // ── Snapshot ──

  snapshot(): MeshSnapshot {
    this.tickParticles()

    // Update node activity: if inactive for >5s, mark as idle
    const now = Date.now()
    for (const node of this.nodes.values()) {
      if (node.activity === "active" && now - node.lastActive > 5000) {
        node.activity = "idle"
      }
      // Update avg response time from received messages
      const receivedMessages = Array.from(this.channels.values())
        .flatMap((c) => c.messages)
        .filter((m) => m.targetId === node.id && m.durationMs !== null)
      if (receivedMessages.length > 0) {
        node.avgResponseTime =
          receivedMessages.reduce((sum, m) => sum + (m.durationMs ?? 0), 0) / receivedMessages.length
      }
    }

    // Mark inactive channels
    for (const channel of this.channels.values()) {
      if (now - channel.lastMessageAt > 15000) {
        channel.active = false
      }
    }

    return {
      nodes: this.getAllNodes(),
      channels: this.getAllChannels(),
      particles: [...this.particles],
      stats: this.computeStats(),
      timestamp: now,
    }
  }

  // ── Query Helpers ──

  getNode(id: string): MeshNode | undefined {
    return this.nodes.get(id)
  }

  getAllNodes(): MeshNode[] {
    return Array.from(this.nodes.values())
  }

  getAllChannels(): MeshChannel[] {
    return Array.from(this.channels.values())
  }

  getChannelsForNode(nodeId: string): MeshChannel[] {
    return Array.from(this.channels.values()).filter(
      (c) => c.sourceId === nodeId || c.targetId === nodeId,
    )
  }

  getRecentEvents(limit = 30): MeshEvent[] {
    return this.events.slice(-limit).reverse()
  }

  getParticles(): MeshParticle[] {
    return [...this.particles]
  }

  // ── Demo Seed Data ──

  seedDemoData(): void {
    if (this.seeded) return
    this.seeded = true

    const roleKeys = Object.keys(ROLE_CONFIGS) as RuntimeRole[]
    const ids: Record<string, string> = {}

    for (const role of roleKeys) {
      const id = `agent_${role}`
      ids[role] = id
      this.registerNode(id, role, role === "manager" ? "running" : "idle")
    }

    // Set a few as "running" initially
    const runningRoles: RuntimeRole[] = ["coder", "research", "design", "qa", "browser"]
    for (const role of runningRoles) {
      this.updateNodeStatus(ids[role], "running")
    }

    // Simulate a wave of messages
    const simulateMessage = (
      sourceRole: RuntimeRole,
      targetRole: RuntimeRole,
      delay: number,
    ) => {
      setTimeout(() => {
        const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)]
        this.sendMessage(
          ids[sourceRole],
          ids[targetRole],
          template.type,
          template.content,
          Math.random() * 600 + 100,
          `corr_${Date.now().toString(36)}`,
        )

        // Maybe send a response
        if (Math.random() > 0.4) {
          setTimeout(() => {
            const responseTemplate =
              MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)]
            this.sendMessage(
              ids[targetRole],
              ids[sourceRole],
              "result",
              responseTemplate.content,
              Math.random() * 400 + 100,
            )
          }, Math.random() * 800 + 300)
        }
      }, delay)
    }

    // Wave 1: Manager delegates tasks
    simulateMessage("manager", "coder", 200)
    simulateMessage("manager", "research", 400)
    simulateMessage("manager", "design", 700)
    simulateMessage("manager", "qa", 1000)
    simulateMessage("manager", "browser", 1300)

    // Wave 2: Cross-agent communication
    simulateMessage("coder", "qa", 1800)
    simulateMessage("research", "coder", 2200)
    simulateMessage("design", "coder", 2600)
    simulateMessage("browser", "research", 3000)

    // Wave 3: Status updates and results
    simulateMessage("coder", "manager", 3500)
    simulateMessage("research", "manager", 3800)
    simulateMessage("qa", "coder", 4200)
    simulateMessage("memory", "manager", 4600)
    simulateMessage("runtime", "coder", 5000)

    // Wave 4: More cross-chatter
    simulateMessage("design", "vision", 5400)
    simulateMessage("vision", "design", 5800)
    simulateMessage("qa", "manager", 6200)
    simulateMessage("fast-inference", "manager", 6600)
    simulateMessage("coder", "memory", 7000)

    // Wave 5: Synthesize + results
    simulateMessage("manager", "design", 7500)
    simulateMessage("coder", "fast-inference", 8000)
    simulateMessage("research", "design", 8500)
    simulateMessage("browser", "qa", 9000)

    // Start periodic simulation
    this.startPeriodicSimulation(ids)
  }

  private startPeriodicSimulation(ids: Record<string, string>): void {
    if (this.simulationInterval) return

    this.simulationInterval = setInterval(() => {
      if (this.nodes.size === 0) return

      const nodeIds = Array.from(this.nodes.keys())
      const sourceId = nodeIds[Math.floor(Math.random() * nodeIds.length)]
      let targetId = nodeIds[Math.floor(Math.random() * nodeIds.length)]
      while (targetId === sourceId) {
        targetId = nodeIds[Math.floor(Math.random() * nodeIds.length)]
      }

      const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)]
      this.sendMessage(
        sourceId,
        targetId,
        template.type,
        template.content,
        Math.random() * 500 + 100,
      )

      // Occasionally trigger a node status change
      if (Math.random() > 0.85) {
        const statusNode = nodeIds[Math.floor(Math.random() * nodeIds.length)]
        const statuses: MeshNode["status"][] = ["running", "running", "idle", "completed", "running"]
        this.updateNodeStatus(statusNode, statuses[Math.floor(Math.random() * statuses.length)])
      }

      // Occasionally degrade health
      if (Math.random() > 0.95) {
        const healthNode = nodeIds[Math.floor(Math.random() * nodeIds.length)]
        this.updateNodeHealth(healthNode, "degraded")
      }

      // Occasionally restore health
      if (Math.random() > 0.92) {
        const healthNode = nodeIds[Math.floor(Math.random() * nodeIds.length)]
        this.updateNodeHealth(healthNode, "healthy")
      }
    }, 2000)
  }

  // ── Control ──

  pauseSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval)
      this.simulationInterval = null
    }
  }

  resumeSimulation(): void {
    const ids: Record<string, string> = {}
    for (const node of this.nodes.values()) {
      const roleKey = Object.entries(ROLE_CONFIGS).find(
        ([, c]) => c.name === node.name,
      )?.[0] as RuntimeRole | undefined
      if (roleKey) ids[roleKey] = node.id
    }
    this.startPeriodicSimulation(ids)
  }

  isSimulationRunning(): boolean {
    return this.simulationInterval !== null
  }

  clear(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval)
      this.simulationInterval = null
    }
    this.nodes.clear()
    this.channels.clear()
    this.particles = []
    this.events = []
    this.messageCounter = 0
    this.seeded = false
  }

  hasData(): boolean {
    return this.nodes.size > 0
  }

  getUptime(): number {
    return Date.now() - this.startedAt
  }
}
