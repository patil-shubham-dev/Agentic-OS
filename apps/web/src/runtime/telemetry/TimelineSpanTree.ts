import { type Span, type TraceableEvent, formatDuration, computeSpanDuration, spanSortKey } from "./TraceTypes"
import { TraceStore } from "./TraceStore"

export interface SpanTreeNode {
  span: Span
  depth: number
  lane: number
  children: SpanTreeNode[]
  events: TraceableEvent[]
  duration: number
  durationPct: number // percentage of parent/trace duration
}

export interface SpanTreeWaterfall {
  traceId: string
  root: SpanTreeNode | null
  totalDuration: number
  maxDepth: number
  maxLanes: number
  nodes: SpanTreeNode[]
  tree: SpanTreeNode[]
}

export class TimelineSpanTree {
  private store: TraceStore

  constructor() {
    this.store = TraceStore.getInstance()
  }

  buildWaterfall(traceId: string): SpanTreeWaterfall {
    const trace = this.store.getTrace(traceId)
    if (!trace) {
      return {
        traceId,
        root: null,
        totalDuration: 0,
        maxDepth: 0,
        maxLanes: 0,
        nodes: [],
        tree: [],
      }
    }

    // Find root spans (no parent)
    const allSpans = Array.from(trace.spans.values()).sort((a, b) => a.startTime - b.startTime)
    const roots = allSpans.filter((s) => s.parentSpanId === null)
    const totalDuration = trace.duration ?? 0

    // Build trees
    const trees = roots.map((root) => this.buildNode(root, trace.traceId, 0))
    const allNodes = this.flattenTree(trees)

    // Assign lanes
    const maxDepth = Math.max(0, ...allNodes.map((n) => n.depth))
    this.assignLanes(trees, totalDuration)

    return {
      traceId,
      root: trees[0] ?? null,
      totalDuration,
      maxDepth,
      maxLanes: Math.max(0, ...allNodes.map((n) => n.lane + 1)),
      nodes: allNodes,
      tree: trees,
    }
  }

  private buildNode(span: Span, traceId: string, depth: number): SpanTreeNode {
    const children = this.store
      .getSpanChildren(traceId, span.spanId)
      .map((child) => this.buildNode(child, traceId, depth + 1))

    const duration = computeSpanDuration(span)

    return {
      span,
      depth,
      lane: 0,
      children,
      events: [],
      duration,
      durationPct: 0, // computed after parent is known
    }
  }

  private flattenTree(trees: SpanTreeNode[]): SpanTreeNode[] {
    const result: SpanTreeNode[] = []
    const walk = (node: SpanTreeNode) => {
      result.push(node)
      for (const child of node.children) walk(child)
    }
    for (const tree of trees) walk(tree)
    return result
  }

  private assignLanes(trees: SpanTreeNode[], totalDuration: number): void {
    for (const tree of trees) {
      this.assignNodeLane(tree, 0)
      this.computeDurationPct(tree, totalDuration)
    }
  }

  private assignNodeLane(node: SpanTreeNode, lane: number): void {
    node.lane = lane
    let childLane = lane
    for (let i = 0; i < node.children.length; i++) {
      this.assignNodeLane(node.children[i], childLane)
      // Overlapping children get different lanes
      if (i > 0) {
        const prev = node.children[i - 1]
        const curr = node.children[i]
        if (this.spansOverlap(prev.span, curr.span)) {
          childLane = prev.lane + 1
        }
      }
    }
  }

  private computeDurationPct(node: SpanTreeNode, totalDuration: number): void {
    node.durationPct = totalDuration > 0 ? (node.duration / totalDuration) * 100 : 0
    for (const child of node.children) {
      this.computeDurationPct(child, totalDuration)
    }
  }

  private spansOverlap(a: Span, b: Span): boolean {
    const aEnd = a.endTime ?? performance.now()
    const bEnd = b.endTime ?? performance.now()
    return a.startTime < bEnd && b.startTime < aEnd
  }

  // ── Timeline Event Construction ──

  static buildSpanTimelineEvent(
    span: Span,
    index: number,
  ): {
    timestamp: string
    label: string
    duration: string
    depth: number
    kind: string
  } {
    const dur = span.duration !== null ? formatDuration(span.duration) : "running"
    const label = span.status === "error"
      ? `❌ ${span.name}`
      : span.status === "ok"
        ? `✓ ${span.name}`
        : `⋯ ${span.name}`

    return {
      timestamp: `T+${(span.startTime - (span.parentSpanId ? 0 : 0)).toFixed(1)}ms`,
      label,
      duration: dur,
      depth: 0,
      kind: span.kind,
    }
  }

  static formatWaterfallRow(
    node: SpanTreeNode,
    totalDuration: number,
    barWidth = 40,
  ): string {
    const pct = totalDuration > 0 ? (node.duration / totalDuration) * 100 : 0
    const filled = Math.round((pct / 100) * barWidth)
    const bar = "█".repeat(filled) + "░".repeat(Math.max(0, barWidth - filled))
    const indent = "  ".repeat(node.depth)
    return `${indent}${bar} ${formatDuration(node.duration)} ${node.span.name}`
  }
}

// ── Timeline Phase Types ──

export type TimelinePhase =
  | "queued"
  | "routing"
  | "context_assembly"
  | "provider_connect"
  | "streaming"
  | "tool_execution"
  | "synthesis"
  | "validation"
  | "completed"
  | "failed"

export const PHASE_LABELS: Record<TimelinePhase, string> = {
  queued: "Queued",
  routing: "Routing",
  context_assembly: "Context Assembly",
  provider_connect: "Provider Connect",
  streaming: "Streaming",
  tool_execution: "Tool Execution",
  synthesis: "Synthesis",
  validation: "Validation",
  completed: "Completed",
  failed: "Failed",
}

export const PHASE_COLORS: Record<TimelinePhase, string> = {
  queued: "#6b7280",
  routing: "#8b5cf6",
  context_assembly: "#3b82f6",
  provider_connect: "#10b981",
  streaming: "#06b6d4",
  tool_execution: "#f59e0b",
  synthesis: "#ec4899",
  validation: "#14b8a6",
  completed: "#22c55e",
  failed: "#ef4444",
}
