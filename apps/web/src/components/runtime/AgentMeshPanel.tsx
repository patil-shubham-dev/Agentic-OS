/**
 * AgentMeshPanel — Collaborative Agent Mesh (#17) visualization
 *
 * Real-time agent-to-agent communication mesh with animated message particles,
 * node health indicators, channel stats, and interactive exploration.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { AgentMeshEngine } from "@/runtime/observability/AgentMeshEngine"
import type {
  MeshNode,
  MeshChannel,
  MeshParticle,
  MeshSnapshot,
  MeshMessage,
  MeshEvent,
  MeshNodeHealth,
} from "@/runtime/observability/AgentMeshEngine"
import {
  Brain,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Layers,
  MessageSquare,
  Network,
  Paintbrush,
  Pause,
  Play,
  Radio,
  RotateCw,
  Search,
  Server,
  TestTube,
  Users,
  X,
  Zap,
  Activity,
} from "lucide-react"

interface AgentMeshPanelProps {
  className?: string
}

// ── Role Icons ──

const ROLE_ICONS: Record<string, typeof Cpu> = {
  manager: Cpu,
  coder: Brain,
  vision: Eye,
  research: Search,
  runtime: Server,
  design: Paintbrush,
  qa: TestTube,
  browser: Globe,
  memory: HardDrive,
  "fast-inference": Zap,
}

// ── Role Colors ──

const ROLE_COLORS: Record<string, string> = {
  manager: "from-indigo-500 to-indigo-600",
  coder: "from-green-500 to-emerald-600",
  vision: "from-purple-500 to-purple-600",
  research: "from-amber-500 to-amber-600",
  runtime: "from-cyan-400 to-cyan-600",
  design: "from-pink-500 to-pink-600",
  qa: "from-teal-400 to-teal-600",
  browser: "from-orange-500 to-orange-600",
  memory: "from-violet-500 to-violet-600",
  "fast-inference": "from-red-500 to-red-600",
}

// ── Message type colors ──

const MESSAGE_TYPE_COLORS: Record<string, string> = {
  delegate: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  result: "text-green-400 border-green-500/30 bg-green-500/10",
  status_update: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  request_clarification: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  error_report: "text-red-400 border-red-500/30 bg-red-500/10",
  synthesize: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  heartbeat: "text-slate-400 border-slate-500/30 bg-slate-500/10",
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  delegate: "Delegate",
  result: "Result",
  status_update: "Status",
  request_clarification: "Clarify",
  error_report: "Error",
  synthesize: "Synthesize",
  heartbeat: "Ping",
}

// ── Particle colors by message type ──

const PARTICLE_COLORS: Record<string, string> = {
  delegate: "#6366f1",
  result: "#22c55e",
  status_update: "#f59e0b",
  request_clarification: "#a855f7",
  error_report: "#ef4444",
  synthesize: "#06b6d4",
  heartbeat: "#94a3b8",
}

// ── Helpers ──

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 1000) return "just now"
  if (diff < 60000) return `${(diff / 1000).toFixed(0)}s ago`
  if (diff < 60000 * 60) return `${(diff / 60000).toFixed(0)}m ago`
  return new Date(ts).toLocaleTimeString()
}

function formatThroughput(val: number): string {
  if (val < 0.1) return `${(val * 60).toFixed(1)}/min`
  if (val < 10) return `${val.toFixed(1)}/s`
  return `${val.toFixed(0)}/s`
}

function healthColor(health: MeshNodeHealth): string {
  switch (health) {
    case "healthy": return "text-green-400"
    case "degraded": return "text-amber-400"
    case "unhealthy": return "text-red-400"
    case "idle": return "text-slate-400"
  }
}

function healthBg(health: MeshNodeHealth): string {
  switch (health) {
    case "healthy": return "bg-green-400"
    case "degraded": return "bg-amber-400"
    case "unhealthy": return "bg-red-400"
    case "idle": return "bg-slate-400"
  }
}

// ── Sub-components ──

// ──────── Stats Bar ────────

function MeshStatsBar({ snapshot }: { snapshot: MeshSnapshot }) {
  const s = snapshot.stats
  return (
    <div className="grid grid-cols-7 gap-px bg-white/[0.04] rounded overflow-hidden text-[8px]">
      <div className="bg-[#0a0a0b] px-2 py-1.5 text-center">
        <span className="text-white/40 block font-mono tabular-nums">{s.totalNodes}</span>
        <span className="text-white/20">Agents</span>
      </div>
      <div className="bg-[#0a0a0b] px-2 py-1.5 text-center">
        <span className="text-white/40 block font-mono tabular-nums">
          {s.activeNodes}/{s.totalChannels}
        </span>
        <span className="text-white/20">Active</span>
      </div>
      <div className="bg-[#0a0a0b] px-2 py-1.5 text-center">
        <span className={cn("block font-mono tabular-nums", s.avgLatencyMs > 500 ? "text-amber-400" : "text-white/40")}>
          {s.avgLatencyMs > 0 ? `${s.avgLatencyMs.toFixed(0)}ms` : "—"}
        </span>
        <span className="text-white/20">Latency</span>
      </div>
      <div className="bg-[#0a0a0b] px-2 py-1.5 text-center">
        <span className="text-white/40 block font-mono tabular-nums">{formatThroughput(s.throughput)}</span>
        <span className="text-white/20">Throughput</span>
      </div>
      <div className="bg-[#0a0a0b] px-2 py-1.5 text-center">
        <span className="text-white/40 block font-mono tabular-nums">{s.messagesInFlight}</span>
        <span className="text-white/20">In Flight</span>
      </div>
      <div className="bg-[#0a0a0b] px-2 py-1.5 text-center">
        <span className={cn("block font-mono tabular-nums", s.errorCount > 0 ? "text-red-400" : "text-white/40")}>
          {s.totalMessagesRecorded}
        </span>
        <span className="text-white/20">Total Msgs</span>
      </div>
      <div className="bg-[#0a0a0b] px-2 py-1.5 text-center">
        <span className="text-white/40 block font-mono tabular-nums">
          {s.errorRate > 0 ? `${(s.errorRate * 100).toFixed(1)}%` : "0%"}
        </span>
        <span className="text-white/20">Errors</span>
      </div>
    </div>
  )
}

// ──────── Mesh Graph (SVG + Nodes) ────────

function MeshGraph({
  snapshot,
  selectedNodeId,
  onSelectNode,
  layout,
}: {
  snapshot: MeshSnapshot
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  layout: "circular" | "grid"
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const padding = 60
  const graphW = Math.max(dims.width - padding * 2, 100)
  const graphH = Math.max(dims.height - padding * 2, 100)
  const cx = dims.width / 2
  const cy = dims.height / 2
  const radius = Math.min(graphW, graphH) / 2 - 10

  // Compute positions based on layout
  const positions = new Map<string, { x: number; y: number }>()
  const nodes = snapshot.nodes

  if (layout === "circular") {
    const total = nodes.length
    nodes.forEach((node, i) => {
      const angle = (i / total) * Math.PI * 2 - Math.PI / 2
      positions.set(node.id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      })
    })
  } else {
    // Grid layout
    const cols = Math.ceil(Math.sqrt(nodes.length))
    const cellW = graphW / cols
    const cellH = graphH / Math.ceil(nodes.length / cols)
    nodes.forEach((node, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      positions.set(node.id, {
        x: padding + col * cellW + cellW / 2,
        y: padding + row * cellH + cellH / 2,
      })
    })
  }

  // Build edge set for dedup
  const edgeSet = new Set<string>()
  const edges: { sourceId: string; targetId: string; channel: MeshChannel }[] = []
  for (const channel of snapshot.channels) {
    const key = [channel.sourceId, channel.targetId].sort().join("|")
    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push({ sourceId: channel.sourceId, targetId: channel.targetId, channel })
    }
  }

  if (dims.width === 0) {
    return <div ref={containerRef} className="flex-1" />
  }

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {/* Edges */}
        {edges.map(({ sourceId, targetId, channel }) => {
          const source = positions.get(sourceId)
          const target = positions.get(targetId)
          if (!source || !target) return null

          const key = [sourceId, targetId].sort().join("|")
          const active = channel.active
          const isSelected =
            selectedNodeId === sourceId || selectedNodeId === targetId

          return (
            <g key={`edge-${key}`}>
              {/* Shadow/glow line */}
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isSelected ? "#6366f1" : active ? "#ffffff" : "#ffffff"}
                strokeOpacity={isSelected ? 0.2 : active ? 0.06 : 0.02}
                strokeWidth={isSelected ? 3 : active ? 2 : 1}
                className="transition-all duration-500"
              />
              {/* Main line */}
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isSelected ? "#818cf8" : active ? "#ffffff" : "#ffffff"}
                strokeOpacity={isSelected ? 0.5 : active ? 0.12 : 0.04}
                strokeWidth={isSelected ? 1.5 : 1}
                strokeDasharray={active ? "none" : "4 4"}
                className="transition-all duration-500"
              />
              {/* Activity indicator dot at midpoint */}
              {active && (
                <circle
                  cx={(source.x + target.x) / 2}
                  cy={(source.y + target.y) / 2}
                  r={1.5}
                  fill="#6366f1"
                  opacity={0.4}
                >
                  <animate
                    attributeName="opacity"
                    values="0.4;0.1;0.4"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="r"
                    values="1.5;3;1.5"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          )
        })}

        {/* Particles */}
        {snapshot.particles.map((particle) => {
          const source = positions.get(particle.sourceId)
          const target = positions.get(particle.targetId)
          if (!source || !target) return null

          const x = source.x + (target.x - source.x) * particle.progress
          const y = source.y + (target.y - source.y) * particle.progress
          const color = PARTICLE_COLORS[particle.messageType] ?? "#6366f1"
          const size = particle.messageType === "delegate" ? 5 : 4

          return (
            <g key={particle.id}>
              {/* Glow */}
              <circle cx={x} cy={y} r={size * 1.8} fill={color} opacity={0.15}>
                <animate
                  attributeName="r"
                  values={`${size * 1.8};${size * 2.5};${size * 1.8}`}
                  dur="0.8s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Core */}
              <circle cx={x} cy={y} r={size} fill={color} opacity={0.9}>
                <animate
                  attributeName="opacity"
                  values="0.9;0.5;0.9"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Center dot */}
              <circle cx={x} cy={y} r={size * 0.4} fill="#ffffff" opacity={0.8} />
            </g>
          )
        })}
      </svg>

      {/* Agent nodes */}
      {nodes.map((node) => {
        const pos = positions.get(node.id)
        if (!pos) return null

        const isSelected = selectedNodeId === node.id
        const RoleIcon = ROLE_ICONS[node.role] ?? Users
        const isRunning = node.status === "running"

        return (
          <button
            key={node.id}
            onClick={() => onSelectNode(node.id)}
            className={cn(
              "absolute flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all duration-200",
              "hover:bg-white/[0.04] cursor-pointer select-none",
              isSelected
                ? "bg-white/[0.06] border-indigo-500/40 shadow-lg shadow-indigo-500/10"
                : "bg-[#0a0a0b]/90 border-white/[0.08] hover:border-white/[0.12]",
            )}
            style={{
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              zIndex: isSelected ? 20 : 10,
            }}
          >
            {/* Status dot */}
            <div className="relative shrink-0">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  healthBg(node.health),
                  isRunning && "animate-pulse",
                )}
              />
              {isRunning && (
                <div
                  className={cn(
                    "absolute inset-0 rounded-full animate-ping opacity-30",
                    healthBg(node.health),
                  )}
                />
              )}
            </div>

            {/* Role icon */}
            <div className={cn(
              "flex items-center justify-center h-4 w-4 rounded shrink-0",
              node.status === "running" && ROLE_COLORS[node.role]
                ? `bg-${ROLE_COLORS[node.role]!.split(" ")[0]!.replace("from-", "")}-500/15`
                : "bg-white/[0.04]",
            )}>
              <RoleIcon className={cn(
                "h-2.5 w-2.5",
                node.status === "running" ? healthColor(node.health) : "text-white/30",
              )} />
            </div>

            {/* Name + status */}
            <div className="text-left min-w-0">
              <span className="text-[8px] font-medium text-white/70 truncate block max-w-[80px]">
                {node.name}
              </span>
              <span className={cn(
                "text-[6px] font-medium",
                healthColor(node.health),
              )}>
                {node.activity === "active" ? "● Active" : "○ Idle"}
              </span>
            </div>

            {/* Throughput badge */}
            {node.throughput > 0.1 && (
              <span className="text-[6px] text-white/25 bg-white/[0.04] rounded px-0.5 py-px font-mono">
                {formatThroughput(node.throughput)}
              </span>
            )}
          </button>
        )
      })}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[6px] text-white/20">
        <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-green-400" /> Healthy</span>
        <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-amber-400" /> Degraded</span>
        <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-slate-400" /> Idle</span>
      </div>
    </div>
  )
}

// ──────── Node Detail Panel ────────

function NodeDetailPanel({
  node,
  channels,
  onClose,
}: {
  node: MeshNode
  channels: MeshChannel[]
  onClose: () => void
}) {
  const RoleIcon = ROLE_ICONS[node.role] ?? Users
  const relatedChannels = channels.filter(
    (c) => c.sourceId === node.id || c.targetId === node.id,
  )
  const recentMessages = relatedChannels
    .flatMap((c) => c.messages)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 15)

  return (
    <div className="border-t border-white/[0.06] bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "flex items-center justify-center h-3.5 w-3.5 rounded",
            node.status === "running" ? "bg-white/[0.06]" : "bg-white/[0.03]",
          )}>
            <RoleIcon className={cn("h-2 w-2", healthColor(node.health))} />
          </div>
          <span className="text-[9px] font-medium text-white/70">{node.name}</span>
          <span className={cn(
            "text-[7px] font-medium px-1 py-px rounded-full",
            healthColor(node.health),
            "bg-white/[0.04]",
          )}>
            {node.health}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-px bg-white/[0.04] text-[7px]">
        <div className="bg-[#0a0a0b] px-2 py-1">
          <span className="text-white/20 block">Role</span>
          <span className="text-white/50 font-medium">{node.role}</span>
        </div>
        <div className="bg-[#0a0a0b] px-2 py-1">
          <span className="text-white/20 block">Status</span>
          <span className={cn("font-medium capitalize", node.status === "running" ? "text-green-400" : "text-white/50")}>{node.status}</span>
        </div>
        <div className="bg-[#0a0a0b] px-2 py-1">
          <span className="text-white/20 block">Activity</span>
          <span className={cn("font-medium", node.activity === "active" ? "text-green-400" : "text-white/50")}>{node.activity}</span>
        </div>
        <div className="bg-[#0a0a0b] px-2 py-1">
          <span className="text-white/20 block">Throughput</span>
          <span className="text-white/50 font-mono">{formatThroughput(node.throughput)}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-white/[0.04] text-[7px]">
        <div className="bg-[#0a0a0b] px-2 py-1">
          <span className="text-white/20 block">Sent</span>
          <span className="text-white/50 font-mono">{node.messagesSent}</span>
        </div>
        <div className="bg-[#0a0a0b] px-2 py-1">
          <span className="text-white/20 block">Received</span>
          <span className="text-white/50 font-mono">{node.messagesReceived}</span>
        </div>
        <div className="bg-[#0a0a0b] px-2 py-1">
          <span className="text-white/20 block">Avg Resp</span>
          <span className="text-white/50 font-mono">{node.avgResponseTime > 0 ? `${node.avgResponseTime.toFixed(0)}ms` : "—"}</span>
        </div>
        <div className="bg-[#0a0a0b] px-2 py-1">
          <span className="text-white/20 block">Errors</span>
          <span className={cn("font-mono", node.errors > 0 ? "text-red-400" : "text-white/50")}>{node.errors}</span>
        </div>
      </div>

      {/* Connection channels */}
      {relatedChannels.length > 0 && (
        <div className="px-2 py-1.5 border-t border-white/[0.04]">
          <div className="flex items-center gap-1 mb-1">
            <Radio className="h-2 w-2 text-white/25" />
            <span className="text-[7px] text-white/25 uppercase tracking-wider">Channels ({relatedChannels.length})</span>
          </div>
          <div className="space-y-0.5 max-h-20 overflow-y-auto">
            {relatedChannels.slice(0, 6).map((ch) => {
              const peerId = ch.sourceId === node.id ? ch.targetId : ch.sourceId
              const dir = ch.sourceId === node.id ? "outgoing" : "incoming"
              return (
                <div key={ch.id} className="flex items-center gap-1 text-[7px] bg-white/[0.02] rounded px-1.5 py-0.5">
                  <span className={cn(
                    "h-1 w-1 rounded-full shrink-0",
                    ch.active ? "bg-green-400" : "bg-slate-400/40",
                  )} />
                  <span className="text-white/20 text-[6px]">{dir === "outgoing" ? "→" : "←"}</span>
                  <span className="text-white/40 font-mono text-[6px] truncate max-w-[50px]">{peerId.replace("agent_", "")}</span>
                  <span className="text-white/20 text-[6px]">{ch.messageCount} msgs</span>
                  <span className="text-white/15 text-[6px] ml-auto">{ch.avgLatency > 0 ? `${ch.avgLatency.toFixed(0)}ms` : ""}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent messages */}
      {recentMessages.length > 0 && (
        <div className="px-2 py-1.5 border-t border-white/[0.04]">
          <div className="flex items-center gap-1 mb-1">
            <MessageSquare className="h-2 w-2 text-white/25" />
            <span className="text-[7px] text-white/25 uppercase tracking-wider">Recent Messages ({recentMessages.length})</span>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {recentMessages.map((msg) => {
              const isOutgoing = msg.sourceId === node.id
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-start gap-1 text-[6px] rounded px-1 py-0.5",
                    msg.status === "failed" ? "bg-red-500/5" : "bg-white/[0.02]",
                  )}
                >
                  <span className={cn(
                    "h-1 w-1 rounded-full mt-0.5 shrink-0",
                    msg.status === "in_flight" ? "bg-blue-400 animate-pulse" :
                    msg.status === "delivered" ? "bg-green-400" : "bg-red-400",
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-0.5">
                      <span className="text-white/20">{isOutgoing ? "→" : "←"}</span>
                      <span className={cn("font-medium", MESSAGE_TYPE_COLORS[msg.type]?.split(" ")[0] ?? "text-white/40")}>
                        {MESSAGE_TYPE_LABELS[msg.type] ?? msg.type}
                      </span>
                      <span className="text-white/10 ml-auto">{formatTime(msg.timestamp)}</span>
                    </div>
                    <span className="text-white/30 block truncate">{msg.content.slice(0, 60)}{msg.content.length > 60 ? "…" : ""}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ──────── Event Stream ────────

function EventStream({ events, visible }: { events: MeshEvent[]; visible: boolean }) {
  if (!visible) return null

  return (
    <div className="border-t border-white/[0.04]">
      <div className="px-2 py-1">
        <div className="flex items-center gap-1 mb-0.5">
          <Activity className="h-2 w-2 text-white/25" />
          <span className="text-[7px] text-white/25 uppercase tracking-wider">Event Stream ({events.length})</span>
        </div>
        <div className="space-y-0.5 max-h-24 overflow-y-auto">
          {events.slice(0, 20).map((evt) => (
            <div key={evt.id} className="flex items-start gap-1 text-[6px]">
              <span className={cn(
                "h-1 w-1 rounded-full mt-0.5 shrink-0",
                evt.type.includes("failed") ? "bg-red-400" :
                evt.type.includes("sent") ? "bg-blue-400" :
                evt.type.includes("delivered") ? "bg-green-400" :
                evt.type.includes("registered") ? "bg-purple-400" : "bg-slate-400",
              )} />
              <div className="flex-1 min-w-0">
                <span className="text-white/40 block truncate">{evt.details}</span>
                <span className="text-white/10">{formatTime(evt.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ──────── Empty State ────────

function EmptyState({ onSeed }: { onSeed: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[200px]">
      <div className="text-center px-8 max-w-xs">
        <div className="relative inline-flex mb-3">
          <Network className="h-8 w-8 text-white/15" />
          <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-indigo-500 animate-ping" />
          <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
        </div>
        <p className="text-[11px] text-white/25 font-medium mb-1">Collaborative Agent Mesh</p>
        <p className="text-[8px] text-white/15 leading-relaxed mb-3">
          Visualize real-time agent-to-agent communication with animated message flows,
          health monitoring, and channel analytics. Agents communicate autonomously
          through a peer-to-peer mesh topology.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onSeed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[9px] font-medium hover:bg-indigo-500/25 hover:border-indigo-500/40 transition-all"
          >
            <Zap className="h-3 w-3" />
            Generate Demo Mesh
          </button>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2.5 text-[6px] text-white/20">
          <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-green-400" /> Healthy</span>
          <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-amber-400" /> Degraded</span>
          <span className="flex items-center gap-0.5"><span className="h-1 w-1 rounded-full bg-red-400" /> Unhealthy</span>
        </div>
      </div>
    </div>
  )
}

// ──────── Main Component ────────

export function AgentMeshPanel({ className }: AgentMeshPanelProps) {
  const engine = AgentMeshEngine.getInstance()
  const [snapshot, setSnapshot] = useState<MeshSnapshot>(engine.snapshot())
  const [events, setEvents] = useState<MeshEvent[]>(engine.getRecentEvents())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [layout, setLayout] = useState<"circular" | "grid">("circular")
  const [showEvents, setShowEvents] = useState(false)
  const [simPaused, setSimPaused] = useState(!engine.isSimulationRunning())
  const animFrameRef = useRef<number | null>(null)

  // Real-time update loop (requestAnimationFrame for smooth particles)
  useEffect(() => {
    let running = true
    const tick = () => {
      if (!running) return
      setSnapshot(engine.snapshot())
      setEvents(engine.getRecentEvents())
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [engine])

  const handleSeed = useCallback(() => {
    engine.seedDemoData()
    setSimPaused(false)
    setSnapshot(engine.snapshot())
  }, [engine])

  const handleSelectNode = useCallback((id: string) => {
    setSelectedNodeId((prev) => (prev === id ? null : id))
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  const handleToggleSimulation = useCallback(() => {
    if (simPaused) {
      engine.resumeSimulation()
    } else {
      engine.pauseSimulation()
    }
    setSimPaused(!simPaused)
  }, [engine, simPaused])

  const handleReset = useCallback(() => {
    engine.clear()
    setSelectedNodeId(null)
    setSnapshot(engine.snapshot())
    setEvents([])
    setSimPaused(true)
  }, [engine])

  const selectedNode = selectedNodeId ? snapshot.nodes.find((n) => n.id === selectedNodeId) ?? null : null
  const hasData = engine.hasData()

  return (
    <div className={cn("flex flex-col bg-[#0a0a0b] h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <Network className="h-3 w-3 text-indigo-400" />
          <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Agent Mesh</span>
          {hasData && (
            <>
              <span className="text-[8px] text-white/20 bg-white/5 rounded px-1">{snapshot.nodes.length} nodes</span>
              {simPaused && (
                <span className="text-[7px] text-amber-400/60 flex items-center gap-0.5">
                  <Pause className="h-2 w-2" /> Paused
                </span>
              )}
            </>
          )}
        </div>
        {hasData && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setLayout(layout === "circular" ? "grid" : "circular")}
              className={cn(
                "rounded p-0.5 transition-all",
                layout === "circular" ? "text-white/20 hover:text-white/50" : "text-indigo-400",
              )}
              title={layout === "circular" ? "Switch to grid" : "Switch to circular"}
            >
              <Layers className="h-2.5 w-2.5" />
            </button>
            <button
              onClick={handleToggleSimulation}
              className="rounded p-0.5 text-white/20 hover:text-white/50 transition-all"
              title={simPaused ? "Resume simulation" : "Pause simulation"}
            >
              {simPaused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
            </button>
            <button
              onClick={() => setShowEvents(!showEvents)}
              className={cn(
                "rounded p-0.5 transition-all",
                showEvents ? "text-indigo-400" : "text-white/20 hover:text-white/50",
              )}
              title="Toggle event stream"
            >
              {showEvents ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
            </button>
            <button
              onClick={handleReset}
              className="rounded p-0.5 text-white/20 hover:text-red-400/60 transition-all"
              title="Reset mesh"
            >
              <RotateCw className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {hasData && (
        <div className="px-2 py-1.5 border-b border-white/[0.04] shrink-0">
          <MeshStatsBar snapshot={snapshot} />
        </div>
      )}

      {/* Event stream */}
      {hasData && (
        <EventStream events={events} visible={showEvents} />
      )}

      {/* Main graph area */}
      {!hasData ? (
        <EmptyState onSeed={handleSeed} />
      ) : (
        <MeshGraph
          snapshot={snapshot}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
          layout={layout}
        />
      )}

      {/* Node detail panel */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          channels={snapshot.channels}
          onClose={handleCloseDetail}
        />
      )}

      {/* Footer status */}
      {hasData && !selectedNode && (
        <div className="px-2 py-1 border-t border-white/[0.04] shrink-0">
          <div className="flex items-center gap-2 text-[6px] text-white/20">
            <span>Uptime: {formatDuration(engine.getUptime())}</span>
            <span>·</span>
            <span>Particles: {snapshot.particles.length}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <span className={cn(
                "h-1 w-1 rounded-full",
                simPaused ? "bg-amber-400" : "bg-green-400",
              )} />
              {simPaused ? "Paused" : "Live"}
            </span>
            <span className="ml-auto text-white/10">
              {layout === "circular" ? "○ Circular" : "⊞ Grid"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
