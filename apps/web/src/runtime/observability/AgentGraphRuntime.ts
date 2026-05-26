import {
  type AgentGraphNode,
  type DelegationEdge,
  type AgentCommunication,
} from "./ObservabilityTypes"
import type { RuntimeRole } from "@/types"
import { TracePipeline } from "../telemetry/TracePipeline"
import { generateTraceId } from "../telemetry/TraceTypes"

/**
 * Agent Graph Runtime — builds and exposes the multi-agent delegation
 * DAG for real-time orchestration visualization.
 *
 * Light scaffold: graph building + delegation tracking + communication bus.
 * Full implementation should add:
 *  - Dependency graph with topological sort
 *  - Agent communication bus
 *  - Execution dependency graph
 *  - WHY reasoning for each delegation decision
 */
export class AgentGraphRuntime {
  private static instance: AgentGraphRuntime
  private pipeline = TracePipeline.getInstance()
  private nodes = new Map<string, AgentGraphNode>() // agentId -> node
  private edges: DelegationEdge[] = []
  private communications: AgentCommunication[] = []
  private maxNodes = 100

  private constructor() {}

  static getInstance(): AgentGraphRuntime {
    if (!AgentGraphRuntime.instance) {
      AgentGraphRuntime.instance = new AgentGraphRuntime()
    }
    return AgentGraphRuntime.instance
  }

  // ── Node Management ──

  addNode(node: AgentGraphNode): void {
    this.nodes.set(node.agentId, node)
    if (this.nodes.size > this.maxNodes) {
      const oldest = Array.from(this.nodes.entries())
        .sort(([, a], [, b]) => a.startTime - b.startTime)[0]
      if (oldest) this.nodes.delete(oldest[0])
    }

    this.pipeline.emit({
      type: "agent_graph_node_added",
      traceId: generateTraceId(),
      spanId: node.agentId,
      parentSpanId: node.parentId,
      timestamp: node.startTime,
      priority: "normal",
      runtimePhase: "routing",
      source: "agent-graph",
      payload: { agentId: node.agentId, role: node.role, status: node.status },
      metadata: { model: node.model, provider: node.provider },
    })
  }

  updateNode(agentId: string, updates: Partial<AgentGraphNode>): void {
    const existing = this.nodes.get(agentId)
    if (existing) {
      this.nodes.set(agentId, { ...existing, ...updates })
    }
  }

  addDelegation(edge: DelegationEdge): void {
    this.edges.push(edge)
  }

  addCommunication(comm: AgentCommunication): void {
    this.communications.push(comm)
  }

  // ── Query ──

  getNode(agentId: string): AgentGraphNode | undefined {
    return this.nodes.get(agentId)
  }

  getAllNodes(): AgentGraphNode[] {
    return Array.from(this.nodes.values())
      .sort((a, b) => a.startTime - b.startTime)
  }

  getActiveNodes(): AgentGraphNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.status === "running")
  }

  getDelegations(): DelegationEdge[] {
    return [...this.edges]
  }

  getCommunications(): AgentCommunication[] {
    return [...this.communications]
  }

  getRootNodes(): AgentGraphNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.parentId === null)
  }

  getChildren(parentId: string): AgentGraphNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.startTime - b.startTime)
  }

  buildExecutionTree(): AgentGraphNode[] {
    return this.buildTree(null)
  }

  private buildTree(parentId: string | null): AgentGraphNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.startTime - b.startTime)
      .map((node) => ({
        ...node,
        children: this.buildTree(node.agentId),
      }))
  }

  getNodeCount(): number {
    return this.nodes.size
  }

  // ── Maintenance ──

  reset(): void {
    this.nodes.clear()
    this.edges = []
    this.communications = []
  }
}
