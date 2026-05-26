// ── Shared Observability Types ──

import type { Span, TraceableEvent } from "../telemetry/TraceTypes"
import type { RuntimeRole } from "@/types"

// ── Provider Observability ──

export interface ProviderPacket {
  providerId: string
  providerName: string
  timestamp: number
  direction: "request" | "response" | "chunk" | "error"
  raw: string
  normalized: string
  chunkIndex?: number
  durationMs?: number
  modelName?: string
  traceId: string
  spanId: string
}

export interface ProviderRequestSnapshot {
  baseUrl: string
  model: string
  endpoint: string
  headers: Record<string, string>
  body: unknown
  timestamp: number
  traceId: string
}

export interface ProviderResponseSnapshot {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  durationMs: number
  timestamp: number
  traceId: string
}

export interface ProviderStreamChunk {
  providerId: string
  rawChunk: string
  normalizedDelta: string
  accumulated: string
  chunkIndex: number
  timestamp: number
  traceId: string
  hasToolCall: boolean
  toolCallPartial: boolean
}

export interface ProviderHealthCheck {
  providerId: string
  healthy: boolean
  latencyMs: number
  lastChecked: number
  error?: string
  modelCapabilities: string[]
}

// ── Streaming Diagnostics ──

export interface StreamDiagnostic {
  traceId: string
  spanId: string
  streamId: string
  startTime: number
  endTime: number | null
  durationMs: number | null
  totalChunks: number
  totalTokens: number
  tokensPerSecond: number
  toolCallsDetected: number
  jsonRepairCount: number
  malformedChunks: number
  recoveredChunks: number
  finishReason: string | null
}

export interface ChunkRecord {
  index: number
  raw: string
  timestamp: number
  accumulatedLength: number
  isToolCall: boolean
  toolCallIndex: number | null
  toolCallName: string | null
  toolCallArgs: string | null
  jsonRepairApplied: boolean
  repaired: string | null
}

export interface ToolCallReconstruction {
  index: number
  id: string
  name: string
  arguments: string
  partialChunks: string[]
  validationErrors: string[]
  normalized: boolean
}

// ── Agent Orchestration ──

export interface AgentGraphNode {
  agentId: string
  role: RuntimeRole
  name: string
  model: string
  provider: string
  status: "pending" | "running" | "completed" | "failed"
  startTime: number
  endTime: number | null
  duration: number | null
  parentId: string | null
  children: AgentGraphNode[]
  taskDescription: string
  delegationReason: string
  tokensUsed: number
  toolCalls: number
  fileEdits: number
}

export interface DelegationEdge {
  from: string
  to: string
  reason: string
  timestamp: number
  duration: number | null
}

export interface AgentCommunication {
  from: string
  to: string
  messageType: "delegate" | "result" | "error" | "synthesize"
  content: string
  timestamp: number
  size: number
  traceId: string
}

// ── Context Diagnostics ──

export interface ContextDiagnostics {
  traceId: string
  totalTokens: number
  systemTokens: number
  retrievalTokens: number
  memoryTokens: number
  outputBudget: number
  compressionRatio: number
  retrievalEntries: RetrievalEntry[]
  memoryInjections: MemoryInjection[]
}

export interface RetrievalEntry {
  filePath: string
  relevanceScore: number
  tokenCount: number
  selectionReason: string
  chunkRank: number
}

export interface MemoryInjection {
  source: "session" | "project" | "workspace" | "long_term"
  summary: string
  tokenCount: number
  timestamp: number
  relevance: number
}

// ── Failure Analysis ──

export interface FailureReport {
  traceId: string
  timestamp: number
  phase: string
  errorType: "provider" | "stream" | "tool" | "timeout" | "rate_limit" | "auth" | "unknown"
  errorMessage: string
  recoverable: boolean
  recoveryAttempted: boolean
  recoverySucceeded: boolean
  recoveryStrategy: string | null
  retryCount: number
  retryChain: RetryStep[]
  fallbackActivated: boolean
  fallbackProvider: string | null
  durationMs: number
}

export interface RetryStep {
  attempt: number
  startedAt: number
  durationMs: number
  error?: string
  success: boolean
}

// ── Telemetry Metrics ──

export interface RuntimeMetrics {
  firstTokenLatencyMs: number
  providerRttMs: number
  streamThroughputTokensPerSec: number
  contextAssemblyLatencyMs: number
  retrievalLatencyMs: number
  toolExecutionLatencyMs: number
  eventThroughputEventsPerSec: number
  memoryPressurePct: number
  queueCongestion: number
  activeSpans: number
  activeTraces: number
}

export interface PerformanceSnapshot {
  timestamp: number
  metrics: RuntimeMetrics
  bottlenecks: string[]
  hotspots: string[]
}

// ── Replay ──

export interface ReplaySegment {
  traceId: string
  spanId: string
  events: TraceableEvent[]
  spans: Span[]
  startTime: number
  endTime: number
  durationMs: number
}

export interface ReplayState {
  traceId: string
  currentTime: number
  speed: 0.25 | 0.5 | 1 | 2 | 4
  isPlaying: boolean
  isPaused: boolean
  segments: ReplaySegment[]
  currentSegmentIndex: number
}

// ── Memory Propagation ──

export interface MemoryRecord {
  id: string
  type: "session" | "project" | "workspace" | "role_scoped" | "compressed" | "retrieval" | "long_term"
  content: string
  summary: string
  tokens: number
  timestamp: number
  ttl: number | null
  role: RuntimeRole | null
  metadata: Record<string, unknown>
}

export interface MemoryMutation {
  recordId: string
  mutationType: "create" | "update" | "compress" | "evict" | "propagate"
  fromType: MemoryRecord["type"]
  toType: MemoryRecord["type"]
  timestamp: number
  tokenDelta: number
  reason: string
}

export interface MemorySnapshot {
  totalTokens: number
  records: MemoryRecord[]
  mutations: MemoryMutation[]
  pressure: number
  timestamp: number
}

// ── Actor System ──

export type ActorStatus = "idle" | "running" | "suspended" | "stopped" | "crashed"

export interface ActorMessage {
  id: string
  from: string
  to: string
  type: string
  payload: unknown
  timestamp: number
  correlationId: string | null
  priority: "low" | "normal" | "high"
}

export interface ActorMailbox {
  actorId: string
  messages: ActorMessage[]
  backlog: number
  processed: number
}

export interface ActorDefinition {
  id: string
  name: string
  role: RuntimeRole
  status: ActorStatus
  mailbox: ActorMailbox
  lifecycle: "transient" | "persistent" | "supervised"
  restartStrategy: "always" | "on_failure" | "never"
  dependencies: string[]
}

export type SupervisorStrategy = "one_for_one" | "one_for_all" | "rest_for_one"
